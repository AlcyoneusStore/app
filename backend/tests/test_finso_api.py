"""Finso backend API tests."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://finso-finance.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# Rates
def test_rates(s):
    r = s.get(f"{API}/rates", timeout=20)
    assert r.status_code == 200
    j = r.json()
    assert j["base"] == "TRY"
    assert "USD" in j["rates"] and "RUB" in j["rates"]
    assert j["rates"]["TRY"] == 1.0
    assert j["rates"]["USD"] > 0 and j["rates"]["RUB"] > 0


# Seed
def test_seed_force(s):
    r = s.post(f"{API}/seed?force=true", timeout=30)
    assert r.status_code == 200
    j = r.json()
    assert j.get("ok") is True and j.get("seeded") is True


def test_seed_idempotent_no_force(s):
    r = s.post(f"{API}/seed", timeout=30)
    assert r.status_code == 200
    assert r.json().get("seeded") in (False, True)


# Summary
def test_summary(s):
    r = s.get(f"{API}/summary", timeout=20)
    assert r.status_code == 200
    j = r.json()
    assert "net_worth_try" in j and isinstance(j["net_worth_try"], (int, float))
    assert j["net_worth_try"] > 0
    b = j["breakdown"]
    for k in ["cash_try", "bank_try", "digital_try", "investments_try", "card_debt_try"]:
        assert k in b
    assert "investments_pl_try" in j and "investments_pl_pct" in j


# Accounts
def test_accounts_list_no_objectid(s):
    r = s.get(f"{API}/accounts", timeout=20)
    assert r.status_code == 200
    items = r.json()
    assert len(items) >= 5
    for it in items:
        assert "_id" not in it
        assert "balance_try" in it
        assert it["currency"] in ["TRY", "USD", "RUB"]


# Cards
def test_cards_list(s):
    r = s.get(f"{API}/cards", timeout=20)
    assert r.status_code == 200
    items = r.json()
    assert len(items) >= 3
    for it in items:
        assert "_id" not in it
        assert "limit" in it and "debt" in it and "statement_day" in it and "due_day" in it


# Transactions
def test_transactions_list(s):
    r = s.get(f"{API}/transactions", timeout=20)
    assert r.status_code == 200
    items = r.json()
    assert len(items) >= 10
    for it in items:
        assert "_id" not in it
        assert "amount_try" in it


def test_transactions_filter_q(s):
    r = s.get(f"{API}/transactions", params={"q": "Market"}, timeout=20)
    assert r.status_code == 200
    items = r.json()
    # All should match
    for it in items:
        blob = (it.get("note", "") + " " + it.get("category", "")).lower()
        assert "market" in blob


def test_create_transaction_usd_converts(s):
    # Pick a TRY account to test currency conversion adjustment
    accs = s.get(f"{API}/accounts").json()
    try_acc = next((a for a in accs if a["currency"] == "TRY" and a["type"] == "bank"), accs[0])
    before = try_acc["balance"]
    payload = {
        "type": "expense",
        "amount": 10.0,
        "currency": "USD",
        "category": "TEST_USD",
        "note": "TEST_conversion",
        "account_id": try_acc["id"],
    }
    r = s.post(f"{API}/transactions", json=payload, timeout=20)
    assert r.status_code == 200
    tx = r.json()
    assert tx["amount_try"] > 0
    assert tx["currency"] == "USD"
    tx_id = tx["id"]

    # Verify account balance decreased
    accs2 = s.get(f"{API}/accounts").json()
    after = next(a for a in accs2 if a["id"] == try_acc["id"])
    assert after["balance"] < before

    # Cleanup
    s.delete(f"{API}/transactions/{tx_id}")


# Investments
def test_investments_list(s):
    r = s.get(f"{API}/investments", timeout=20)
    assert r.status_code == 200
    items = r.json()
    assert len(items) >= 4
    for it in items:
        assert "_id" not in it
        assert it["asset_type"] in ["stock", "crypto", "gold", "fund"]


def test_create_and_update_investment(s):
    payload = {
        "symbol": "TEST", "name": "TEST_Asset", "asset_type": "stock",
        "quantity": 10, "cost_basis": 100, "current_price": 110, "currency": "TRY"
    }
    r = s.post(f"{API}/investments", json=payload, timeout=20)
    assert r.status_code == 200
    inv = r.json()
    inv_id = inv["id"]
    assert inv["current_price"] == 110

    # Patch price
    r2 = s.patch(f"{API}/investments/{inv_id}", json={"current_price": 150}, timeout=20)
    assert r2.status_code == 200

    # Verify via list
    items = s.get(f"{API}/investments").json()
    updated = next(i for i in items if i["id"] == inv_id)
    assert updated["current_price"] == 150

    # Cleanup
    d = s.delete(f"{API}/investments/{inv_id}")
    assert d.status_code == 200
