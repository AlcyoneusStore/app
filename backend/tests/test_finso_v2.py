"""Finso iteration 2 backend tests - settings, categories, transfers, monthly-stats, edit/delete flows."""
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


@pytest.fixture(scope="module", autouse=True)
def seed(s):
    # Force-reseed before running tests so we have fresh state
    r = s.post(f"{API}/seed?force=true", timeout=30)
    assert r.status_code == 200
    yield


# ---------- Settings ----------
def test_settings_get_default(s):
    r = s.get(f"{API}/settings", timeout=20)
    assert r.status_code == 200
    j = r.json()
    for k in ["custom_rates_enabled", "custom_usd_try", "custom_rub_try"]:
        assert k in j


def test_settings_put_and_persist(s):
    payload = {"custom_rates_enabled": True, "custom_usd_try": 40.5, "custom_rub_try": 0.42}
    r = s.put(f"{API}/settings", json=payload, timeout=20)
    assert r.status_code == 200
    j = r.json()
    assert j["custom_rates_enabled"] is True
    assert j["custom_usd_try"] == 40.5
    assert j["custom_rub_try"] == 0.42
    # GET should reflect
    r2 = s.get(f"{API}/settings", timeout=20)
    assert r2.status_code == 200
    j2 = r2.json()
    assert j2["custom_usd_try"] == 40.5
    assert j2["custom_rub_try"] == 0.42
    assert j2["custom_rates_enabled"] is True
    # Restore disabled
    s.put(f"{API}/settings", json={"custom_rates_enabled": False})


def test_rates_includes_live_and_flag(s):
    r = s.get(f"{API}/rates", timeout=20)
    assert r.status_code == 200
    j = r.json()
    assert "live_rates" in j
    assert "USD" in j["live_rates"] and "RUB" in j["live_rates"]
    assert "custom_rates_enabled" in j


# ---------- Categories ----------
def test_categories_defaults(s):
    r = s.get(f"{API}/categories", timeout=20)
    assert r.status_code == 200
    items = r.json()
    assert len(items) >= 12
    kinds = {c["kind"] for c in items}
    assert "expense" in kinds and "income" in kinds


def test_category_crud(s):
    payload = {"name": "TEST_Cat", "icon": "cart", "color": "#FF0000", "kind": "expense"}
    r = s.post(f"{API}/categories", json=payload, timeout=20)
    assert r.status_code == 200
    cat = r.json()
    cid = cat["id"]
    assert cat["name"] == "TEST_Cat"

    # patch
    r2 = s.patch(f"{API}/categories/{cid}", json={"name": "TEST_Cat_Updated"}, timeout=20)
    assert r2.status_code == 200

    items = s.get(f"{API}/categories").json()
    found = next(c for c in items if c["id"] == cid)
    assert found["name"] == "TEST_Cat_Updated"

    # delete
    d = s.delete(f"{API}/categories/{cid}", timeout=20)
    assert d.status_code == 200
    items2 = s.get(f"{API}/categories").json()
    assert not any(c["id"] == cid for c in items2)


# ---------- Seed verifies source_type/account_id/card_id ----------
def test_transactions_have_source_fields(s):
    items = s.get(f"{API}/transactions").json()
    assert len(items) >= 10
    with_source = [t for t in items if t.get("source_type") in ("account", "card")]
    assert len(with_source) >= 5
    # at least some have account_id, some have card_id
    assert any(t.get("account_id") for t in items)
    assert any(t.get("card_id") for t in items)


# ---------- Expense via card increases debt ----------
def test_expense_via_card_increases_debt(s):
    cards = s.get(f"{API}/cards").json()
    cc = next(c for c in cards if c["card_type"] == "credit")
    before = cc["debt"]
    payload = {
        "type": "expense", "amount": 100.0, "currency": cc["currency"],
        "category": "TEST_CARD_EXPENSE", "note": "TEST",
        "source_type": "card", "card_id": cc["id"],
    }
    r = s.post(f"{API}/transactions", json=payload, timeout=20)
    assert r.status_code == 200
    tx_id = r.json()["id"]
    cards2 = s.get(f"{API}/cards").json()
    after = next(c for c in cards2 if c["id"] == cc["id"])["debt"]
    assert round(after - before, 2) == 100.0
    # cleanup - delete should revert
    s.delete(f"{API}/transactions/{tx_id}")
    cards3 = s.get(f"{API}/cards").json()
    final = next(c for c in cards3 if c["id"] == cc["id"])["debt"]
    assert round(final - before, 2) == 0.0


# ---------- Expense via account decreases balance ----------
def test_expense_via_account_decreases_balance(s):
    accs = s.get(f"{API}/accounts").json()
    a = next(x for x in accs if x["currency"] == "TRY")
    before = a["balance"]
    payload = {
        "type": "expense", "amount": 50.0, "currency": "TRY",
        "category": "TEST_ACC_EXPENSE", "note": "TEST",
        "source_type": "account", "account_id": a["id"],
    }
    r = s.post(f"{API}/transactions", json=payload, timeout=20)
    assert r.status_code == 200
    tx_id = r.json()["id"]
    accs2 = s.get(f"{API}/accounts").json()
    after = next(x for x in accs2 if x["id"] == a["id"])["balance"]
    assert round(before - after, 2) == 50.0
    # delete and verify revert
    s.delete(f"{API}/transactions/{tx_id}")
    accs3 = s.get(f"{API}/accounts").json()
    final = next(x for x in accs3 if x["id"] == a["id"])["balance"]
    assert round(final - before, 2) == 0.0


# ---------- card_payment ----------
def test_card_payment_decreases_both(s):
    accs = s.get(f"{API}/accounts").json()
    cards = s.get(f"{API}/cards").json()
    acc = next(x for x in accs if x["currency"] == "TRY" and x["type"] == "bank")
    cc = next(c for c in cards if c["card_type"] == "credit" and c["debt"] > 0 and c["currency"] == "TRY")
    a_before = acc["balance"]
    c_before = cc["debt"]
    payload = {
        "type": "card_payment", "amount": 200.0, "currency": "TRY",
        "category": "Kart Ödemesi", "note": "TEST",
        "account_id": acc["id"], "card_id": cc["id"],
    }
    r = s.post(f"{API}/transactions", json=payload, timeout=20)
    assert r.status_code == 200
    tx_id = r.json()["id"]
    a_after = next(x for x in s.get(f"{API}/accounts").json() if x["id"] == acc["id"])["balance"]
    c_after = next(c for c in s.get(f"{API}/cards").json() if c["id"] == cc["id"])["debt"]
    assert round(a_before - a_after, 2) == 200.0
    assert round(c_before - c_after, 2) == 200.0
    s.delete(f"{API}/transactions/{tx_id}")


# ---------- PATCH on accounts/cards/transactions/investments ----------
def test_patch_account_card_tx_investment(s):
    accs = s.get(f"{API}/accounts").json()
    aid = accs[0]["id"]
    r = s.patch(f"{API}/accounts/{aid}", json={"name": "TEST_PatchedAcc"}, timeout=20)
    assert r.status_code == 200
    accs2 = s.get(f"{API}/accounts").json()
    assert next(a for a in accs2 if a["id"] == aid)["name"] == "TEST_PatchedAcc"

    cards = s.get(f"{API}/cards").json()
    cid = cards[0]["id"]
    r = s.patch(f"{API}/cards/{cid}", json={"debt": 9999.99}, timeout=20)
    assert r.status_code == 200
    cards2 = s.get(f"{API}/cards").json()
    assert next(c for c in cards2 if c["id"] == cid)["debt"] == 9999.99

    txs = s.get(f"{API}/transactions").json()
    tid = txs[0]["id"]
    r = s.patch(f"{API}/transactions/{tid}", json={"note": "TEST_patched_note"}, timeout=20)
    assert r.status_code == 200
    txs2 = s.get(f"{API}/transactions").json()
    assert next(t for t in txs2 if t["id"] == tid)["note"] == "TEST_patched_note"

    invs = s.get(f"{API}/investments").json()
    iid = invs[0]["id"]
    r = s.patch(f"{API}/investments/{iid}", json={"current_price": 12345.67}, timeout=20)
    assert r.status_code == 200
    invs2 = s.get(f"{API}/investments").json()
    assert next(i for i in invs2 if i["id"] == iid)["current_price"] == 12345.67


# ---------- Transfer same currency ----------
def test_transfer_same_currency(s):
    accs = s.get(f"{API}/accounts").json()
    try_accs = [a for a in accs if a["currency"] == "TRY"]
    a, b = try_accs[0], try_accs[1]
    a_before, b_before = a["balance"], b["balance"]
    payload = {
        "from_account_id": a["id"], "to_account_id": b["id"],
        "amount": 100.0, "currency": "TRY",
    }
    r = s.post(f"{API}/transfers", json=payload, timeout=20)
    assert r.status_code == 200
    tx = r.json()
    assert tx["type"] == "transfer"
    accs2 = s.get(f"{API}/accounts").json()
    a_after = next(x for x in accs2 if x["id"] == a["id"])["balance"]
    b_after = next(x for x in accs2 if x["id"] == b["id"])["balance"]
    assert round(a_before - a_after, 2) == 100.0
    assert round(b_after - b_before, 2) == 100.0
    s.delete(f"{API}/transactions/{tx['id']}")


# ---------- Transfer different currency auto-converts ----------
def test_transfer_diff_currency_auto(s):
    accs = s.get(f"{API}/accounts").json()
    try_acc = next(a for a in accs if a["currency"] == "TRY" and a["type"] == "bank")
    usd_acc = next(a for a in accs if a["currency"] == "USD")
    payload = {
        "from_account_id": try_acc["id"], "to_account_id": usd_acc["id"],
        "amount": 340.0, "currency": "TRY",
    }
    r = s.post(f"{API}/transfers", json=payload, timeout=20)
    assert r.status_code == 200
    tx = r.json()
    assert tx["to_currency"] == "USD"
    assert tx["to_amount"] is not None and tx["to_amount"] > 0
    # 340 TRY at ~34 = ~10 USD (range check)
    assert 5 < tx["to_amount"] < 50
    s.delete(f"{API}/transactions/{tx['id']}")


# ---------- Transfer with manual to_amount override ----------
def test_transfer_manual_to_amount(s):
    accs = s.get(f"{API}/accounts").json()
    try_acc = next(a for a in accs if a["currency"] == "TRY" and a["type"] == "bank")
    usd_acc = next(a for a in accs if a["currency"] == "USD")
    payload = {
        "from_account_id": try_acc["id"], "to_account_id": usd_acc["id"],
        "amount": 1000.0, "currency": "TRY", "to_amount": 27.5,
    }
    r = s.post(f"{API}/transfers", json=payload, timeout=20)
    assert r.status_code == 200
    tx = r.json()
    assert tx["to_amount"] == 27.5
    s.delete(f"{API}/transactions/{tx['id']}")


# ---------- Monthly stats ----------
def test_monthly_stats(s):
    r = s.get(f"{API}/monthly-stats?months=6", timeout=20)
    assert r.status_code == 200
    j = r.json()
    assert isinstance(j, list)
    assert len(j) == 6
    for b in j:
        for k in ["year", "month", "label", "income", "expense", "net"]:
            assert k in b
        assert b["net"] == round(b["income"] - b["expense"], 2)


# ---------- Factory reset ----------
def test_factory_reset(s):
    r = s.post(f"{API}/factory-reset", timeout=30)
    assert r.status_code == 200
    accs = s.get(f"{API}/accounts").json()
    cards = s.get(f"{API}/cards").json()
    txs = s.get(f"{API}/transactions").json()
    invs = s.get(f"{API}/investments").json()
    assert accs == [] and cards == [] and txs == [] and invs == []
    cats = s.get(f"{API}/categories").json()
    assert len(cats) >= 12
    # Re-seed to leave clean state for next runs
    s.post(f"{API}/seed?force=true", timeout=30)
