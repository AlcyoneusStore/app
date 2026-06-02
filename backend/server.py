from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import httpx
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone, timedelta


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

CurrencyCode = Literal["TRY", "USD", "RUB"]

# ---------- Models ----------
class Account(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    type: str
    currency: CurrencyCode
    balance: float
    balance_try: float = 0.0
    icon: str = "wallet"
    color: str = "#0066FF"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AccountCreate(BaseModel):
    name: str
    type: str
    currency: CurrencyCode
    balance: float
    icon: Optional[str] = "wallet"
    color: Optional[str] = "#0066FF"

class AccountUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    currency: Optional[CurrencyCode] = None
    balance: Optional[float] = None
    icon: Optional[str] = None
    color: Optional[str] = None

class Card(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    bank: str
    last4: str
    currency: CurrencyCode
    card_type: str
    limit: float
    debt: float
    statement_day: int
    due_day: int
    gradient: str = "blue"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CardCreate(BaseModel):
    name: str
    bank: str
    last4: str
    currency: CurrencyCode
    card_type: str
    limit: float
    debt: float
    statement_day: int
    due_day: int
    gradient: Optional[str] = "blue"

class CardUpdate(BaseModel):
    name: Optional[str] = None
    bank: Optional[str] = None
    last4: Optional[str] = None
    currency: Optional[CurrencyCode] = None
    card_type: Optional[str] = None
    limit: Optional[float] = None
    debt: Optional[float] = None
    statement_day: Optional[int] = None
    due_day: Optional[int] = None
    gradient: Optional[str] = None

class Transaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str  # expense | income | transfer | card_payment
    amount: float
    currency: CurrencyCode
    amount_try: float = 0.0
    category: str
    note: Optional[str] = ""
    source_type: Optional[str] = None  # 'account' | 'card'
    account_id: Optional[str] = None
    card_id: Optional[str] = None
    # for transfers
    to_account_id: Optional[str] = None
    to_amount: Optional[float] = None
    to_currency: Optional[CurrencyCode] = None
    date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TransactionCreate(BaseModel):
    type: str
    amount: float
    currency: CurrencyCode
    category: str
    note: Optional[str] = ""
    source_type: Optional[str] = None
    account_id: Optional[str] = None
    card_id: Optional[str] = None
    date: Optional[datetime] = None

class TransactionUpdate(BaseModel):
    amount: Optional[float] = None
    currency: Optional[CurrencyCode] = None
    category: Optional[str] = None
    note: Optional[str] = None
    date: Optional[datetime] = None

class TransferCreate(BaseModel):
    from_account_id: str
    to_account_id: str
    amount: float
    currency: CurrencyCode
    to_amount: Optional[float] = None  # if manual conversion provided
    note: Optional[str] = ""

class Investment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    symbol: str
    name: str
    asset_type: str
    quantity: float
    cost_basis: float
    current_price: float
    currency: CurrencyCode
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class InvestmentCreate(BaseModel):
    symbol: str
    name: str
    asset_type: str
    quantity: float
    cost_basis: float
    current_price: float
    currency: CurrencyCode

class InvestmentUpdate(BaseModel):
    symbol: Optional[str] = None
    name: Optional[str] = None
    asset_type: Optional[str] = None
    current_price: Optional[float] = None
    quantity: Optional[float] = None
    cost_basis: Optional[float] = None
    currency: Optional[CurrencyCode] = None

class Category(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    icon: str = "ellipsis-horizontal"
    color: str = "#0066FF"
    kind: str = "expense"  # expense | income

class CategoryCreate(BaseModel):
    name: str
    icon: Optional[str] = "ellipsis-horizontal"
    color: Optional[str] = "#0066FF"
    kind: Optional[str] = "expense"

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    kind: Optional[str] = None

class SettingsModel(BaseModel):
    custom_rates_enabled: bool = False
    custom_usd_try: Optional[float] = None
    custom_rub_try: Optional[float] = None

class SettingsUpdate(BaseModel):
    custom_rates_enabled: Optional[bool] = None
    custom_usd_try: Optional[float] = None
    custom_rub_try: Optional[float] = None


# ---------- Default categories ----------
DEFAULT_CATEGORIES = [
    {"name": "Market", "icon": "cart", "color": "#00FF94", "kind": "expense"},
    {"name": "Eğlence", "icon": "film", "color": "#FF3366", "kind": "expense"},
    {"name": "Fatura", "icon": "flash", "color": "#FFB800", "kind": "expense"},
    {"name": "Ulaşım", "icon": "car", "color": "#0090FF", "kind": "expense"},
    {"name": "Kira", "icon": "home", "color": "#9F7AEA", "kind": "expense"},
    {"name": "Restoran", "icon": "restaurant", "color": "#FF6B35", "kind": "expense"},
    {"name": "Sağlık", "icon": "medkit", "color": "#FF3366", "kind": "expense"},
    {"name": "Yazılım", "icon": "code-slash", "color": "#0066FF", "kind": "expense"},
    {"name": "Diğer Gider", "icon": "ellipsis-horizontal", "color": "#A0A8C0", "kind": "expense"},
    {"name": "Maaş", "icon": "briefcase", "color": "#00FF94", "kind": "income"},
    {"name": "Freelance", "icon": "laptop", "color": "#00FF94", "kind": "income"},
    {"name": "Diğer Gelir", "icon": "trending-up", "color": "#00FF94", "kind": "income"},
]

async def ensure_categories():
    count = await db.categories.count_documents({})
    if count == 0:
        docs = [Category(**c).dict() for c in DEFAULT_CATEGORIES]
        await db.categories.insert_many(docs)


# ---------- Rates ----------
_RATE_CACHE = {"data": None, "ts": None}

async def fetch_live_rates() -> dict:
    global _RATE_CACHE
    now = datetime.now(timezone.utc)
    if _RATE_CACHE["data"] and _RATE_CACHE["ts"] and (now - _RATE_CACHE["ts"]) < timedelta(hours=6):
        return _RATE_CACHE["data"]
    rates = {"TRY": 1.0, "USD": 34.0, "RUB": 0.36}
    try:
        async with httpx.AsyncClient(timeout=8.0) as hc:
            r = await hc.get("https://api.exchangerate.host/latest", params={"base": "TRY", "symbols": "USD,RUB"})
            if r.status_code == 200:
                j = r.json()
                inv = j.get("rates", {})
                if inv.get("USD"):
                    rates["USD"] = round(1.0 / float(inv["USD"]), 6)
                if inv.get("RUB"):
                    rates["RUB"] = round(1.0 / float(inv["RUB"]), 6)
    except Exception as e:
        logger.warning(f"Rate fetch failed, using fallback: {e}")
    _RATE_CACHE = {"data": rates, "ts": now}
    return rates

async def fetch_rates() -> dict:
    live = await fetch_live_rates()
    settings = await db.settings.find_one({"_id": "singleton"})
    if settings and settings.get("custom_rates_enabled"):
        out = {"TRY": 1.0,
               "USD": float(settings.get("custom_usd_try") or live["USD"]),
               "RUB": float(settings.get("custom_rub_try") or live["RUB"])}
        return out
    return live

def to_try(amount: float, currency: str, rates: dict) -> float:
    return round(float(amount) * float(rates.get(currency, 1.0)), 2)

def convert(amount_try: float, currency: str, rates: dict) -> float:
    rate = rates.get(currency, 1.0)
    if rate == 0:
        return 0.0
    return round(float(amount_try) / float(rate), 2)


@api_router.get("/rates")
async def get_rates():
    live = await fetch_live_rates()
    effective = await fetch_rates()
    settings = await db.settings.find_one({"_id": "singleton"}) or {}
    return {
        "base": "TRY",
        "rates": effective,
        "live_rates": live,
        "custom_rates_enabled": bool(settings.get("custom_rates_enabled")),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }


# ---------- Settings ----------
@api_router.get("/settings")
async def get_settings():
    s = await db.settings.find_one({"_id": "singleton"}, {"_id": 0}) or {}
    return SettingsModel(**s).dict()

@api_router.put("/settings")
async def update_settings(payload: SettingsUpdate):
    upd = {k: v for k, v in payload.dict().items() if v is not None}
    await db.settings.update_one({"_id": "singleton"}, {"$set": upd}, upsert=True)
    s = await db.settings.find_one({"_id": "singleton"}, {"_id": 0}) or {}
    return SettingsModel(**s).dict()


# ---------- Categories ----------
@api_router.get("/categories")
async def list_categories():
    await ensure_categories()
    return await db.categories.find({}, {"_id": 0}).to_list(500)

@api_router.post("/categories")
async def create_category(payload: CategoryCreate):
    cat = Category(**payload.dict())
    await db.categories.insert_one(cat.dict())
    return cat.dict()

@api_router.patch("/categories/{cat_id}")
async def update_category(cat_id: str, payload: CategoryUpdate):
    upd = {k: v for k, v in payload.dict().items() if v is not None}
    if not upd:
        return {"ok": True}
    res = await db.categories.update_one({"id": cat_id}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Category not found")
    return {"ok": True}

@api_router.delete("/categories/{cat_id}")
async def delete_category(cat_id: str):
    res = await db.categories.delete_one({"id": cat_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Category not found")
    return {"ok": True}


# ---------- Accounts ----------
@api_router.get("/accounts")
async def list_accounts():
    rates = await fetch_rates()
    items = await db.accounts.find({}, {"_id": 0}).to_list(1000)
    for it in items:
        it["balance_try"] = to_try(it["balance"], it["currency"], rates)
    return items

@api_router.post("/accounts")
async def create_account(payload: AccountCreate):
    rates = await fetch_rates()
    acc = Account(**payload.dict())
    acc.balance_try = to_try(acc.balance, acc.currency, rates)
    await db.accounts.insert_one(acc.dict())
    return acc.dict()

@api_router.patch("/accounts/{account_id}")
async def update_account(account_id: str, payload: AccountUpdate):
    upd = {k: v for k, v in payload.dict().items() if v is not None}
    if not upd:
        return {"ok": True}
    res = await db.accounts.update_one({"id": account_id}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Account not found")
    # recompute balance_try
    rates = await fetch_rates()
    acc = await db.accounts.find_one({"id": account_id}, {"_id": 0})
    if acc:
        new_try = to_try(acc["balance"], acc["currency"], rates)
        await db.accounts.update_one({"id": account_id}, {"$set": {"balance_try": new_try}})
    return {"ok": True}

@api_router.delete("/accounts/{account_id}")
async def delete_account(account_id: str):
    res = await db.accounts.delete_one({"id": account_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Account not found")
    return {"ok": True}


# ---------- Cards ----------
@api_router.get("/cards")
async def list_cards():
    return await db.cards.find({}, {"_id": 0}).to_list(1000)

@api_router.post("/cards")
async def create_card(payload: CardCreate):
    card = Card(**payload.dict())
    await db.cards.insert_one(card.dict())
    return card.dict()

@api_router.patch("/cards/{card_id}")
async def update_card(card_id: str, payload: CardUpdate):
    upd = {k: v for k, v in payload.dict().items() if v is not None}
    if not upd:
        return {"ok": True}
    res = await db.cards.update_one({"id": card_id}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Card not found")
    return {"ok": True}

@api_router.delete("/cards/{card_id}")
async def delete_card(card_id: str):
    res = await db.cards.delete_one({"id": card_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Card not found")
    return {"ok": True}


# ---------- Transactions ----------
async def _apply_account_delta(account_id: str, amount: float, amount_currency: str, rates: dict, sign: int):
    acc = await db.accounts.find_one({"id": account_id}, {"_id": 0})
    if not acc:
        return
    if amount_currency != acc["currency"]:
        delta_try = to_try(amount, amount_currency, rates)
        delta_acc = convert(delta_try, acc["currency"], rates)
    else:
        delta_acc = amount
    new_balance = round(float(acc["balance"]) + sign * float(delta_acc), 2)
    await db.accounts.update_one(
        {"id": account_id},
        {"$set": {"balance": new_balance, "balance_try": to_try(new_balance, acc["currency"], rates)}}
    )

async def _apply_card_delta(card_id: str, amount: float, amount_currency: str, rates: dict, sign: int):
    card = await db.cards.find_one({"id": card_id}, {"_id": 0})
    if not card:
        return
    if amount_currency != card["currency"]:
        delta_try = to_try(amount, amount_currency, rates)
        delta_card = convert(delta_try, card["currency"], rates)
    else:
        delta_card = amount
    new_debt = max(0.0, round(float(card["debt"]) + sign * float(delta_card), 2))
    await db.cards.update_one({"id": card_id}, {"$set": {"debt": new_debt}})

@api_router.get("/transactions")
async def list_transactions(type: Optional[str] = None, category: Optional[str] = None, q: Optional[str] = None, limit: int = 500):
    query = {}
    if type:
        query["type"] = type
    if category:
        query["category"] = category
    if q:
        query["$or"] = [
            {"note": {"$regex": q, "$options": "i"}},
            {"category": {"$regex": q, "$options": "i"}},
        ]
    return await db.transactions.find(query, {"_id": 0}).sort("date", -1).to_list(limit)

@api_router.post("/transactions")
async def create_transaction(payload: TransactionCreate):
    rates = await fetch_rates()
    data = payload.dict()
    if not data.get("date"):
        data["date"] = datetime.now(timezone.utc)
    tx = Transaction(**data)
    tx.amount_try = to_try(tx.amount, tx.currency, rates)
    await db.transactions.insert_one(tx.dict())

    # apply effects
    if tx.type == "expense":
        if tx.source_type == "card" and tx.card_id:
            # spending on credit card -> increases debt
            await _apply_card_delta(tx.card_id, tx.amount, tx.currency, rates, +1)
        elif tx.account_id:
            await _apply_account_delta(tx.account_id, tx.amount, tx.currency, rates, -1)
    elif tx.type == "income":
        if tx.account_id:
            await _apply_account_delta(tx.account_id, tx.amount, tx.currency, rates, +1)
    elif tx.type == "card_payment":
        # pay off card debt from an account
        if tx.account_id:
            await _apply_account_delta(tx.account_id, tx.amount, tx.currency, rates, -1)
        if tx.card_id:
            await _apply_card_delta(tx.card_id, tx.amount, tx.currency, rates, -1)
    return tx.dict()

@api_router.patch("/transactions/{tx_id}")
async def update_transaction(tx_id: str, payload: TransactionUpdate):
    upd = {k: v for k, v in payload.dict().items() if v is not None}
    if not upd:
        return {"ok": True}
    # recompute amount_try if amount or currency changed
    if "amount" in upd or "currency" in upd:
        rates = await fetch_rates()
        tx = await db.transactions.find_one({"id": tx_id}, {"_id": 0})
        if not tx:
            raise HTTPException(404, "Transaction not found")
        new_amount = upd.get("amount", tx["amount"])
        new_cur = upd.get("currency", tx["currency"])
        upd["amount_try"] = to_try(new_amount, new_cur, rates)
    res = await db.transactions.update_one({"id": tx_id}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Transaction not found")
    return {"ok": True}

@api_router.delete("/transactions/{tx_id}")
async def delete_transaction(tx_id: str):
    tx = await db.transactions.find_one({"id": tx_id}, {"_id": 0})
    if not tx:
        raise HTTPException(404, "Transaction not found")
    rates = await fetch_rates()
    # revert effects
    if tx["type"] == "expense":
        if tx.get("source_type") == "card" and tx.get("card_id"):
            await _apply_card_delta(tx["card_id"], tx["amount"], tx["currency"], rates, -1)
        elif tx.get("account_id"):
            await _apply_account_delta(tx["account_id"], tx["amount"], tx["currency"], rates, +1)
    elif tx["type"] == "income":
        if tx.get("account_id"):
            await _apply_account_delta(tx["account_id"], tx["amount"], tx["currency"], rates, -1)
    elif tx["type"] == "card_payment":
        if tx.get("account_id"):
            await _apply_account_delta(tx["account_id"], tx["amount"], tx["currency"], rates, +1)
        if tx.get("card_id"):
            await _apply_card_delta(tx["card_id"], tx["amount"], tx["currency"], rates, +1)
    elif tx["type"] == "transfer":
        if tx.get("account_id"):
            await _apply_account_delta(tx["account_id"], tx["amount"], tx["currency"], rates, +1)
        if tx.get("to_account_id") and tx.get("to_amount") is not None and tx.get("to_currency"):
            await _apply_account_delta(tx["to_account_id"], tx["to_amount"], tx["to_currency"], rates, -1)
    await db.transactions.delete_one({"id": tx_id})
    return {"ok": True}


# ---------- Transfer ----------
@api_router.post("/transfers")
async def create_transfer(payload: TransferCreate):
    rates = await fetch_rates()
    from_acc = await db.accounts.find_one({"id": payload.from_account_id}, {"_id": 0})
    to_acc = await db.accounts.find_one({"id": payload.to_account_id}, {"_id": 0})
    if not from_acc or not to_acc:
        raise HTTPException(404, "Account not found")
    if payload.from_account_id == payload.to_account_id:
        raise HTTPException(400, "Cannot transfer to same account")

    amount_try = to_try(payload.amount, payload.currency, rates)
    to_currency = to_acc["currency"]
    if payload.to_amount is not None and payload.to_amount > 0:
        to_amount = round(float(payload.to_amount), 2)
    else:
        to_amount = convert(amount_try, to_currency, rates)

    tx = Transaction(
        type="transfer",
        amount=payload.amount,
        currency=payload.currency,
        amount_try=amount_try,
        category="Transfer",
        note=payload.note or f"{from_acc['name']} → {to_acc['name']}",
        source_type="account",
        account_id=payload.from_account_id,
        to_account_id=payload.to_account_id,
        to_amount=to_amount,
        to_currency=to_currency,
    )
    await db.transactions.insert_one(tx.dict())
    await _apply_account_delta(payload.from_account_id, payload.amount, payload.currency, rates, -1)
    await _apply_account_delta(payload.to_account_id, to_amount, to_currency, rates, +1)
    return tx.dict()


# ---------- Investments ----------
@api_router.get("/investments")
async def list_investments():
    return await db.investments.find({}, {"_id": 0}).to_list(1000)

@api_router.post("/investments")
async def create_investment(payload: InvestmentCreate):
    inv = Investment(**payload.dict())
    await db.investments.insert_one(inv.dict())
    return inv.dict()

@api_router.patch("/investments/{inv_id}")
async def update_investment(inv_id: str, payload: InvestmentUpdate):
    upd = {k: v for k, v in payload.dict().items() if v is not None}
    if not upd:
        return {"ok": True}
    res = await db.investments.update_one({"id": inv_id}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Investment not found")
    return {"ok": True}

@api_router.delete("/investments/{inv_id}")
async def delete_investment(inv_id: str):
    res = await db.investments.delete_one({"id": inv_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Investment not found")
    return {"ok": True}


# ---------- Summary / Monthly stats ----------
@api_router.get("/summary")
async def summary():
    rates = await fetch_rates()
    accounts = await db.accounts.find({}, {"_id": 0}).to_list(1000)
    cards = await db.cards.find({}, {"_id": 0}).to_list(1000)
    investments = await db.investments.find({}, {"_id": 0}).to_list(1000)

    cash_try = bank_try = digital_try = 0.0
    for a in accounts:
        v = to_try(a["balance"], a["currency"], rates)
        if a["type"] == "cash":
            cash_try += v
        elif a["type"] == "digital":
            digital_try += v
        else:
            bank_try += v

    debt_try = sum(to_try(c["debt"], c["currency"], rates) for c in cards)
    invest_try = sum(to_try(i["current_price"] * i["quantity"], i["currency"], rates) for i in investments)
    invest_cost_try = sum(to_try(i["cost_basis"] * i["quantity"], i["currency"], rates) for i in investments)

    accounts_total_try = cash_try + bank_try + digital_try
    net_worth_try = round(accounts_total_try + invest_try - debt_try, 2)

    return {
        "rates": rates,
        "net_worth_try": net_worth_try,
        "breakdown": {
            "cash_try": round(cash_try, 2),
            "bank_try": round(bank_try, 2),
            "digital_try": round(digital_try, 2),
            "accounts_total_try": round(accounts_total_try, 2),
            "investments_try": round(invest_try, 2),
            "card_debt_try": round(debt_try, 2),
        },
        "investments_pl_try": round(invest_try - invest_cost_try, 2),
        "investments_pl_pct": round(((invest_try - invest_cost_try) / invest_cost_try * 100) if invest_cost_try > 0 else 0, 2),
    }

@api_router.get("/monthly-stats")
async def monthly_stats(months: int = 6):
    """Returns income, expense, net per month for the last N months."""
    now = datetime.now(timezone.utc)
    buckets = []
    for i in range(months - 1, -1, -1):
        y = now.year
        m = now.month - i
        while m <= 0:
            m += 12
            y -= 1
        buckets.append({"year": y, "month": m, "label": f"{m:02d}/{str(y)[-2:]}", "income": 0.0, "expense": 0.0, "net": 0.0})

    txs = await db.transactions.find({"type": {"$in": ["income", "expense"]}}, {"_id": 0}).to_list(5000)
    for t in txs:
        d = t["date"] if isinstance(t["date"], datetime) else datetime.fromisoformat(str(t["date"]).replace("Z", "+00:00"))
        for b in buckets:
            if d.year == b["year"] and d.month == b["month"]:
                if t["type"] == "income":
                    b["income"] += t.get("amount_try", 0.0)
                else:
                    b["expense"] += t.get("amount_try", 0.0)
                break
    for b in buckets:
        b["net"] = round(b["income"] - b["expense"], 2)
        b["income"] = round(b["income"], 2)
        b["expense"] = round(b["expense"], 2)
    return buckets


# ---------- Factory reset / Seed ----------
@api_router.post("/factory-reset")
async def factory_reset():
    await db.accounts.delete_many({})
    await db.cards.delete_many({})
    await db.transactions.delete_many({})
    await db.investments.delete_many({})
    await db.categories.delete_many({})
    await db.settings.delete_many({})
    await ensure_categories()
    return {"ok": True}

@api_router.post("/seed")
async def seed_demo(force: bool = False):
    await ensure_categories()
    rates = await fetch_rates()
    existing = await db.accounts.count_documents({})
    if existing > 0 and not force:
        return {"ok": True, "seeded": False, "message": "Data already exists"}

    if force:
        await db.accounts.delete_many({})
        await db.cards.delete_many({})
        await db.transactions.delete_many({})
        await db.investments.delete_many({})

    accounts = [
        Account(name="Garanti Vadesiz", type="bank", currency="TRY", balance=45230.50, icon="business", color="#00A859"),
        Account(name="Wise USD", type="digital", currency="USD", balance=1850.00, icon="phone-portrait", color="#9FE870"),
        Account(name="Tinkoff RUB", type="bank", currency="RUB", balance=125000.00, icon="business", color="#FFDD2D"),
        Account(name="Nakit Cüzdan", type="cash", currency="TRY", balance=3500.00, icon="cash", color="#0066FF"),
        Account(name="Papara", type="digital", currency="TRY", balance=8420.75, icon="phone-portrait", color="#FF3D71"),
    ]
    for a in accounts:
        a.balance_try = to_try(a.balance, a.currency, rates)
    await db.accounts.insert_many([a.dict() for a in accounts])

    cards = [
        Card(name="Bonus Platinum", bank="Garanti BBVA", last4="4521", currency="TRY", card_type="credit", limit=50000, debt=12450.30, statement_day=15, due_day=25, gradient="holo1"),
        Card(name="Maximum", bank="İş Bankası", last4="8832", currency="TRY", card_type="credit", limit=35000, debt=4280.00, statement_day=5, due_day=20, gradient="holo2"),
        Card(name="Wise Debit", bank="Wise", last4="0193", currency="USD", card_type="debit", limit=0, debt=0, statement_day=1, due_day=1, gradient="blue"),
    ]
    await db.cards.insert_many([c.dict() for c in cards])

    now = datetime.now(timezone.utc)
    acc_ids = [a.id for a in accounts]
    card_ids = [c.id for c in cards]
    txs_raw = [
        ("expense", 845.30, "TRY", "Market", "Migros haftalık alışveriş", 0, "account", acc_ids[0], None),
        ("expense", 120.00, "TRY", "Eğlence", "Sinema bileti", 1, "card", None, card_ids[0]),
        ("expense", 1450.00, "TRY", "Fatura", "Elektrik faturası", 2, "account", acc_ids[0], None),
        ("expense", 65.50, "USD", "Yazılım", "GitHub Pro", 5, "card", None, card_ids[0]),
        ("expense", 350.00, "TRY", "Ulaşım", "Akaryakıt", 3, "account", acc_ids[3], None),
        ("expense", 2200.00, "TRY", "Kira", "Aylık kira", 7, "account", acc_ids[0], None),
        ("expense", 89.90, "TRY", "Market", "Bakkal", 10, "account", acc_ids[3], None),
        ("income", 35000.00, "TRY", "Maaş", "Ocak maaşı", 12, "account", acc_ids[0], None),
        ("expense", 240.00, "TRY", "Restoran", "Akşam yemeği", 4, "card", None, card_ids[1]),
        ("expense", 1200.00, "RUB", "Eğlence", "Konser bileti", 6, "account", acc_ids[2], None),
        ("expense", 78.50, "TRY", "Market", "Şok market", 9, "account", acc_ids[3], None),
        ("income", 850.00, "USD", "Freelance", "Tasarım projesi", 14, "account", acc_ids[1], None),
        ("expense", 320.00, "TRY", "Sağlık", "Eczane", 8, "account", acc_ids[0], None),
        ("expense", 580.00, "TRY", "Fatura", "İnternet", 11, "card", None, card_ids[1]),
        ("expense", 4200.00, "TRY", "Kira", "Geçen ay kira", 35, "account", acc_ids[0], None),
        ("income", 33000.00, "TRY", "Maaş", "Geçen ay maaş", 42, "account", acc_ids[0], None),
        ("expense", 1800.00, "TRY", "Market", "Geçen ay market", 50, "account", acc_ids[0], None),
        ("expense", 920.00, "TRY", "Fatura", "Geçen ay fatura", 60, "account", acc_ids[0], None),
        ("income", 32000.00, "TRY", "Maaş", "2 ay önce maaş", 72, "account", acc_ids[0], None),
        ("expense", 3100.00, "TRY", "Kira", "2 ay önce kira", 65, "account", acc_ids[0], None),
    ]
    tx_objs = []
    for t in txs_raw:
        typ, amt, cur, cat, note, days_ago, st, aid, cid = t
        tx = Transaction(
            type=typ, amount=amt, currency=cur, category=cat, note=note,
            date=now - timedelta(days=days_ago),
            source_type=st, account_id=aid, card_id=cid,
        )
        tx.amount_try = to_try(amt, cur, rates)
        tx_objs.append(tx)
    await db.transactions.insert_many([t.dict() for t in tx_objs])

    investments = [
        Investment(symbol="BTC", name="Bitcoin", asset_type="crypto", quantity=0.085, cost_basis=42000, current_price=68500, currency="USD"),
        Investment(symbol="ETH", name="Ethereum", asset_type="crypto", quantity=1.2, cost_basis=2800, current_price=3450, currency="USD"),
        Investment(symbol="THYAO", name="Türk Hava Yolları", asset_type="stock", quantity=120, cost_basis=245.50, current_price=312.80, currency="TRY"),
        Investment(symbol="AAPL", name="Apple Inc.", asset_type="stock", quantity=5, cost_basis=175.00, current_price=228.50, currency="USD"),
        Investment(symbol="GOLD", name="Gram Altın", asset_type="gold", quantity=15, cost_basis=2150, current_price=2880, currency="TRY"),
        Investment(symbol="ASELS", name="Aselsan", asset_type="stock", quantity=80, cost_basis=58.20, current_price=72.40, currency="TRY"),
    ]
    await db.investments.insert_many([i.dict() for i in investments])

    return {"ok": True, "seeded": True}


@api_router.get("/")
async def root():
    return {"app": "Finso", "status": "ok"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await ensure_categories()

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
