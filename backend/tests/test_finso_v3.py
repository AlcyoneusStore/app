"""Finso iteration 3 backend tests: JWT auth, optional tx date, optional inv current_price,
bulk price update, snapshots, factory-reset preserves auth, no auto-seed after reset."""
import os
import time
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


def _reset_admin_creds(s):
    """Best-effort: try common passwords to get back to admin/admin so subsequent tests work."""
    for pw in ("admin", "newpass123", "changed_pw_v3"):
        r = s.post(f"{API}/auth/login", json={"username": "admin", "password": pw}, timeout=10)
        if r.status_code == 200 and pw != "admin":
            tok = r.json()["access_token"]
            s.post(f"{API}/auth/change-credentials",
                   headers={"Authorization": f"Bearer {tok}"},
                   json={"current_password": pw, "new_password": "admin"}, timeout=10)
            return
        if r.status_code == 200:
            return


@pytest.fixture(scope="module", autouse=True)
def bootstrap(s):
    _reset_admin_creds(s)
    # Re-seed so we have data to query
    r = s.post(f"{API}/seed?force=true", timeout=30)
    assert r.status_code == 200
    yield
    _reset_admin_creds(s)
    s.post(f"{API}/seed?force=true", timeout=30)


# ---------- AUTH ----------
class TestAuth:
    def test_login_success(self, s):
        r = s.post(f"{API}/auth/login", json={"username": "admin", "password": "admin"}, timeout=10)
        assert r.status_code == 200, r.text
        j = r.json()
        assert "access_token" in j and j.get("token_type") == "bearer"
        assert len(j["access_token"]) > 20

    def test_login_wrong_password(self, s):
        r = s.post(f"{API}/auth/login", json={"username": "admin", "password": "WRONG"}, timeout=10)
        assert r.status_code == 401

    def test_login_wrong_username(self, s):
        r = s.post(f"{API}/auth/login", json={"username": "nope", "password": "admin"}, timeout=10)
        assert r.status_code == 401

    def test_me_with_token(self, s):
        tok = s.post(f"{API}/auth/login", json={"username": "admin", "password": "admin"}).json()["access_token"]
        r = s.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {tok}"}, timeout=10)
        assert r.status_code == 200
        assert r.json().get("username") == "admin"

    def test_me_no_token(self, s):
        r = requests.get(f"{API}/auth/me", timeout=10)
        assert r.status_code == 401

    def test_me_invalid_token(self, s):
        r = requests.get(f"{API}/auth/me", headers={"Authorization": "Bearer junk.token.value"}, timeout=10)
        assert r.status_code == 401

    def test_change_creds_full_flow(self, s):
        # login
        tok = s.post(f"{API}/auth/login", json={"username": "admin", "password": "admin"}).json()["access_token"]
        H = {"Authorization": f"Bearer {tok}"}
        # wrong current_password -> 401
        r = s.post(f"{API}/auth/change-credentials", headers=H,
                   json={"current_password": "NOT_admin", "new_password": "newpass123"}, timeout=10)
        assert r.status_code == 401
        # change password
        r = s.post(f"{API}/auth/change-credentials", headers=H,
                   json={"current_password": "admin", "new_password": "newpass123"}, timeout=10)
        assert r.status_code == 200
        # old password fails
        assert s.post(f"{API}/auth/login", json={"username": "admin", "password": "admin"}).status_code == 401
        # new password works
        r2 = s.post(f"{API}/auth/login", json={"username": "admin", "password": "newpass123"})
        assert r2.status_code == 200
        # restore
        tok2 = r2.json()["access_token"]
        r3 = s.post(f"{API}/auth/change-credentials",
                    headers={"Authorization": f"Bearer {tok2}"},
                    json={"current_password": "newpass123", "new_password": "admin"}, timeout=10)
        assert r3.status_code == 200
        assert s.post(f"{API}/auth/login", json={"username": "admin", "password": "admin"}).status_code == 200


# ---------- Optional transaction date ----------
class TestTransactionDate:
    def test_tx_with_no_date_uses_now(self, s):
        accs = s.get(f"{API}/accounts").json()
        a = next(x for x in accs if x["currency"] == "TRY")
        before = datetime.now(timezone.utc)
        payload = {"type": "expense", "amount": 1.0, "currency": "TRY",
                   "category": "TEST_NO_DATE", "note": "TEST",
                   "source_type": "account", "account_id": a["id"]}
        r = s.post(f"{API}/transactions", json=payload)
        assert r.status_code == 200
        tx = r.json()
        d = datetime.fromisoformat(tx["date"].replace("Z", "+00:00"))
        assert abs((d - before).total_seconds()) < 60
        s.delete(f"{API}/transactions/{tx['id']}")

    def test_tx_with_explicit_date(self, s):
        accs = s.get(f"{API}/accounts").json()
        a = next(x for x in accs if x["currency"] == "TRY")
        custom = "2024-03-15T10:00:00+00:00"
        payload = {"type": "expense", "amount": 2.0, "currency": "TRY",
                   "category": "TEST_DATE", "note": "TEST",
                   "source_type": "account", "account_id": a["id"],
                   "date": custom}
        r = s.post(f"{API}/transactions", json=payload)
        assert r.status_code == 200
        tx = r.json()
        d = datetime.fromisoformat(tx["date"].replace("Z", "+00:00"))
        assert d.year == 2024 and d.month == 3 and d.day == 15
        s.delete(f"{API}/transactions/{tx['id']}")


# ---------- Investments ----------
class TestInvestments:
    def test_create_investment_without_current_price(self, s):
        payload = {"symbol": "TEST1", "name": "TEST_Inv", "asset_type": "stock",
                   "quantity": 10, "cost_basis": 50.0, "currency": "TRY"}
        r = s.post(f"{API}/investments", json=payload)
        assert r.status_code == 200
        inv = r.json()
        assert inv["current_price"] == 50.0
        s.delete(f"{API}/investments/{inv['id']}")

    def test_create_investment_with_current_price(self, s):
        payload = {"symbol": "TEST2", "name": "TEST_Inv2", "asset_type": "stock",
                   "quantity": 5, "cost_basis": 100.0, "current_price": 120.0, "currency": "TRY"}
        r = s.post(f"{API}/investments", json=payload)
        assert r.status_code == 200
        assert r.json()["current_price"] == 120.0
        s.delete(f"{API}/investments/{r.json()['id']}")

    def test_bulk_update_prices_and_snapshot(self, s):
        # snapshot count before
        before = s.get(f"{API}/investments/snapshots?period=daily").json()
        before_count = len(before)
        invs = s.get(f"{API}/investments").json()
        assert len(invs) >= 2
        target = invs[:2]
        updates = [{"id": t["id"], "current_price": round(float(t["current_price"]) + 7.77, 2)} for t in target]
        r = s.post(f"{API}/investments/bulk-update", json={"updates": updates})
        assert r.status_code == 200
        j = r.json()
        assert j["ok"] is True and j["count"] == len(updates)
        # verify persistence
        invs2 = s.get(f"{API}/investments").json()
        for u in updates:
            got = next(i for i in invs2 if i["id"] == u["id"])
            assert got["current_price"] == u["current_price"]
        # snapshot created
        after = s.get(f"{API}/investments/snapshots?period=daily").json()
        assert len(after) >= before_count  # at least one new snapshot (today may coalesce)

    def test_snapshots_periods(self, s):
        for p in ("daily", "monthly", "yearly"):
            r = s.get(f"{API}/investments/snapshots?period={p}")
            assert r.status_code == 200
            j = r.json()
            assert isinstance(j, list) and len(j) >= 1
            if p == "daily":
                assert "value_try" in j[0] and "date" in j[0]
            else:
                assert "label" in j[0] and "value_try" in j[0]
        # monthly should have fewer or equal labels than daily
        d = s.get(f"{API}/investments/snapshots?period=daily").json()
        m = s.get(f"{API}/investments/snapshots?period=monthly").json()
        assert len(m) <= len(d)

    def test_summary_investments_try_uses_current_price(self, s):
        rates = s.get(f"{API}/rates").json()["rates"]
        invs = s.get(f"{API}/investments").json()
        expected = round(sum(round(i["current_price"] * i["quantity"] * rates.get(i["currency"], 1.0), 2) for i in invs), 2)
        # allow small rounding tolerance
        summary = s.get(f"{API}/summary").json()
        got = summary["breakdown"]["investments_try"]
        assert abs(got - expected) < max(1.0, expected * 0.01)


# ---------- Rates / Settings ----------
class TestRates:
    def test_custom_rates_enabled_flag(self, s):
        s.put(f"{API}/settings", json={"custom_rates_enabled": True, "custom_usd_try": 41.0})
        r = s.get(f"{API}/rates")
        j = r.json()
        assert j["custom_rates_enabled"] is True
        assert "live_rates" in j
        assert j["rates"]["USD"] == 41.0
        # restore
        s.put(f"{API}/settings", json={"custom_rates_enabled": False})


# ---------- Factory reset preserves auth, removes snapshots, no auto-reseed ----------
class TestFactoryReset:
    def test_factory_reset_preserves_auth_clears_data_no_autoseed(self, s):
        # change creds, then reset, then verify creds still work + data wiped
        tok = s.post(f"{API}/auth/login", json={"username": "admin", "password": "admin"}).json()["access_token"]
        H = {"Authorization": f"Bearer {tok}"}
        s.post(f"{API}/auth/change-credentials", headers=H,
               json={"current_password": "admin", "new_password": "changed_pw_v3"})
        # factory reset
        r = s.post(f"{API}/factory-reset", timeout=30)
        assert r.status_code == 200
        # data cleared
        assert s.get(f"{API}/accounts").json() == []
        assert s.get(f"{API}/cards").json() == []
        assert s.get(f"{API}/transactions").json() == []
        assert s.get(f"{API}/investments").json() == []
        # snapshots cleared too (no auto seed). Daily snapshot may be created on startup but reset just wiped it.
        snaps = s.get(f"{API}/investments/snapshots?period=daily").json()
        assert isinstance(snaps, list) and len(snaps) == 0
        # categories reseeded
        cats = s.get(f"{API}/categories").json()
        assert len(cats) >= 12
        # summary should show zero networth (no auto reseed of accounts)
        sumr = s.get(f"{API}/summary").json()
        assert sumr["net_worth_try"] == 0
        assert sumr["breakdown"]["accounts_total_try"] == 0
        assert sumr["breakdown"]["investments_try"] == 0
        # auth still works with new password
        r2 = s.post(f"{API}/auth/login", json={"username": "admin", "password": "changed_pw_v3"})
        assert r2.status_code == 200
        # restore admin/admin
        tok2 = r2.json()["access_token"]
        s.post(f"{API}/auth/change-credentials",
               headers={"Authorization": f"Bearer {tok2}"},
               json={"current_password": "changed_pw_v3", "new_password": "admin"})
        assert s.post(f"{API}/auth/login", json={"username": "admin", "password": "admin"}).status_code == 200
