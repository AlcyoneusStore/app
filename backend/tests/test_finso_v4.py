"""Finso iteration 4 backend tests:
- GET /api/transactions supports `limit` query param (Dashboard fetches 100)
- Seed creates old transactions (>60d) so the frontend 'Tüm Zaman' range can show them
- Regression: type and category filters still work alongside limit
"""
import os
import pytest
import requests
from datetime import datetime, timezone

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="module", autouse=True)
def bootstrap(s):
    # Ensure admin/admin
    for pw in ("admin", "newpass123", "changed_pw_v3"):
        r = s.post(f"{API}/auth/login", json={"username": "admin", "password": pw}, timeout=10)
        if r.status_code == 200:
            if pw != "admin":
                tok = r.json()["access_token"]
                s.post(f"{API}/auth/change-credentials",
                       headers={"Authorization": f"Bearer {tok}"},
                       json={"current_password": pw, "new_password": "admin"}, timeout=10)
            break
    r = s.post(f"{API}/seed?force=true", timeout=30)
    assert r.status_code == 200
    yield


class TestTransactionsLimit:
    def test_default_returns_many(self, s):
        r = s.get(f"{API}/transactions")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert len(items) >= 10  # seed creates 15

    def test_limit_param_caps_results(self, s):
        r = s.get(f"{API}/transactions?limit=3")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert len(items) <= 3

    def test_limit_100_for_dashboard(self, s):
        r = s.get(f"{API}/transactions?limit=100")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert len(items) <= 100

    def test_limit_with_type_filter(self, s):
        r = s.get(f"{API}/transactions?limit=50&type=expense")
        assert r.status_code == 200
        items = r.json()
        assert all(t["type"] == "expense" for t in items)
        assert len(items) <= 50

    def test_results_sorted_desc_by_date(self, s):
        r = s.get(f"{API}/transactions?limit=100")
        items = r.json()
        if len(items) >= 2:
            dates = [datetime.fromisoformat(t["date"].replace("Z", "+00:00")) for t in items]
            for i in range(len(dates) - 1):
                assert dates[i] >= dates[i + 1]


class TestOldTransactions:
    def test_seed_has_transactions_older_than_60_days(self, s):
        r = s.get(f"{API}/transactions?limit=500")
        items = r.json()
        now = datetime.now(timezone.utc)
        def _parse(d):
            dt = datetime.fromisoformat(d.replace("Z", "+00:00"))
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        old = [t for t in items if (now - _parse(t["date"])).days > 60]
        # Seed has tx_raw entries at 65 and 72 days ago
        assert len(old) >= 1, f"Expected >=1 tx older than 60d, got 0 in {len(items)} items"


class TestRegressionV3:
    def test_auth_admin_admin_still_works(self, s):
        r = s.post(f"{API}/auth/login", json={"username": "admin", "password": "admin"})
        assert r.status_code == 200
        assert "access_token" in r.json()

    def test_summary_breakdown_fields(self, s):
        r = s.get(f"{API}/summary")
        assert r.status_code == 200
        j = r.json()
        for k in ("cash_try", "bank_try", "digital_try", "investments_try", "card_debt_try"):
            assert k in j["breakdown"]
        assert "net_worth_try" in j

    def test_monthly_stats(self, s):
        r = s.get(f"{API}/monthly-stats?months=6")
        assert r.status_code == 200
        j = r.json()
        assert isinstance(j, list)
        assert len(j) == 6
        assert all(k in j[0] for k in ("income", "expense", "net", "label"))

    def test_categories_have_income_and_expense_kinds(self, s):
        cats = s.get(f"{API}/categories").json()
        kinds = {c.get("kind") for c in cats}
        assert "income" in kinds and "expense" in kinds
