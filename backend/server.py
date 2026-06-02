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

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

CurrencyCode = Literal["TRY", "USD", "RUB"]
SUPPORTED_CURRENCIES = ["TRY", "USD", "RUB"]

# ---------- Models ----------
class Account(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    type: str  # bank, cash, digital
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

class Card(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    bank: str
    last4: str
    currency: CurrencyCode
    card_type: str  # credit or debit
    limit: float
    debt: float
    statement_day: int  # day of month
    due_day: int
    gradient: str = "blue"  # blue, purple, holo1, holo2
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

class Transaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str  # expense or income
    amount: float
    currency: CurrencyCode
    amount_try: float = 0.0
    category: str
    note: Optional[str] = ""
    account_id: Optional[str] = None
    date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TransactionCreate(BaseModel):
    type: str
    amount: float
    currency: CurrencyCode
    category: str
    note: Optional[str] = ""
    account_id: Optional[str] = None
    date: Optional[datetime] = None

class Investment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    symbol: str
    name: str
    asset_type: str  # stock, crypto, gold, fund
    quantity: float
    cost_basis: float  # cost per unit in `currency`
    current_price: float  # current per unit in `currency`
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
    current_price: Optional[float] = None
    quantity: Optional[float] = None
    cost_basis: Optional[float] = None


# ---------- Rates ----------
_RATE_CACHE = {"data": None, "ts": None}

async def fetch_rates() -> dict:
    """Returns rates as: how many TRY per 1 unit of given currency."""
    global _RATE_CACHE
    now = datetime.now(timezone.utc)
    if _RATE_CACHE["data"] and _RATE_CACHE["ts"] and (now - _RATE_CACHE["ts"]) < timedelta(hours=6):
        return _RATE_CACHE["data"]
    rates = {"TRY": 1.0, "USD": 34.0, "RUB": 0.36}  # sensible fallback
    try:
        async with httpx.AsyncClient(timeout=8.0) as hc:
            # frankfurter does not support TRY base reliably; use exchangerate.host
            r = await hc.get("https://api.exchangerate.host/latest", params={"base": "TRY", "symbols": "USD,RUB"})
            if r.status_code == 200:
                j = r.json()
                inv = j.get("rates", {})
                # inv["USD"] = USD per 1 TRY -> we want TRY per 1 USD
                if inv.get("USD"):
                    rates["USD"] = round(1.0 / float(inv["USD"]), 6)
                if inv.get("RUB"):
                    rates["RUB"] = round(1.0 / float(inv["RUB"]), 6)
    except Exception as e:
        logger.warning(f"Rate fetch failed, using fallback: {e}")
    _RATE_CACHE = {"data": rates, "ts": now}
    return rates


def to_try(amount: float, currency: str, rates: dict) -> float:
    return round(float(amount) * float(rates.get(currency, 1.0)), 2)


def convert(amount_try: float, currency: str, rates: dict) -> float:
    rate = rates.get(currency, 1.0)
    if rate == 0:
        return 0.0
    return round(float(amount_try) / float(rate), 2)


@api_router.get("/rates")
async def get_rates():
    rates = await fetch_rates()
    return {"base": "TRY", "rates": rates, "updated_at": datetime.now(timezone.utc).isoformat()}


# ---------- Accounts ----------
@api_router.get("/accounts")
async def list_accounts():
    rates = await fetch_rates()
    items = await db.accounts.find({}, {"_id": 0}).to_list(1000)
    # recompute TRY equivalent on the fly
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

@api_router.delete("/accounts/{account_id}")
async def delete_account(account_id: str):
    res = await db.accounts.delete_one({"id": account_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Account not found")
    return {"ok": True}


# ---------- Cards ----------
@api_router.get("/cards")
async def list_cards():
    items = await db.cards.find({}, {"_id": 0}).to_list(1000)
    return items

@api_router.post("/cards")
async def create_card(payload: CardCreate):
    card = Card(**payload.dict())
    await db.cards.insert_one(card.dict())
    return card.dict()

@api_router.delete("/cards/{card_id}")
async def delete_card(card_id: str):
    res = await db.cards.delete_one({"id": card_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Card not found")
    return {"ok": True}


# ---------- Transactions ----------
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
    items = await db.transactions.find(query, {"_id": 0}).sort("date", -1).to_list(limit)
    return items

@api_router.post("/transactions")
async def create_transaction(payload: TransactionCreate):
    rates = await fetch_rates()
    data = payload.dict()
    if not data.get("date"):
        data["date"] = datetime.now(timezone.utc)
    tx = Transaction(**data)
    tx.amount_try = to_try(tx.amount, tx.currency, rates)
    await db.transactions.insert_one(tx.dict())
    # adjust account balance
    if tx.account_id:
        acc = await db.accounts.find_one({"id": tx.account_id}, {"_id": 0})
        if acc:
            delta = tx.amount if tx.type == "income" else -tx.amount
            # convert delta to account currency
            if tx.currency != acc["currency"]:
                # convert via TRY
                delta_try = to_try(delta, tx.currency, rates)
                delta_acc = convert(delta_try, acc["currency"], rates)
            else:
                delta_acc = delta
            new_balance = round(float(acc["balance"]) + float(delta_acc), 2)
            await db.accounts.update_one({"id": tx.account_id}, {"$set": {"balance": new_balance, "balance_try": to_try(new_balance, acc["currency"], rates)}})
    return tx.dict()

@api_router.delete("/transactions/{tx_id}")
async def delete_transaction(tx_id: str):
    res = await db.transactions.delete_one({"id": tx_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return {"ok": True}


# ---------- Investments ----------
@api_router.get("/investments")
async def list_investments():
    items = await db.investments.find({}, {"_id": 0}).to_list(1000)
    return items

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
        raise HTTPException(status_code=404, detail="Investment not found")
    return {"ok": True}

@api_router.delete("/investments/{inv_id}")
async def delete_investment(inv_id: str):
    res = await db.investments.delete_one({"id": inv_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Investment not found")
    return {"ok": True}


# ---------- Summary / Net worth ----------
@api_router.get("/summary")
async def summary():
    rates = await fetch_rates()
    accounts = await db.accounts.find({}, {"_id": 0}).to_list(1000)
    cards = await db.cards.find({}, {"_id": 0}).to_list(1000)
    investments = await db.investments.find({}, {"_id": 0}).to_list(1000)

    cash_try = 0.0
    bank_try = 0.0
    digital_try = 0.0
    for a in accounts:
        v = to_try(a["balance"], a["currency"], rates)
        if a["type"] == "cash":
            cash_try += v
        elif a["type"] == "digital":
            digital_try += v
        else:
            bank_try += v

    debt_try = 0.0
    for c in cards:
        debt_try += to_try(c["debt"], c["currency"], rates)

    invest_try = 0.0
    invest_cost_try = 0.0
    for i in investments:
        invest_try += to_try(i["current_price"] * i["quantity"], i["currency"], rates)
        invest_cost_try += to_try(i["cost_basis"] * i["quantity"], i["currency"], rates)

    accounts_total_try = cash_try + bank_try + digital_try
    net_worth_try = round(accounts_total_try + invest_try - debt_try, 2)

    return {
        "rates": rates,
        "net_worth_try": net_worth_try,
        "breakdown": {
            "cash_try": round(cash_try, 2),
            "bank_try": round(bank_try, 2),
            "digital_try": round(digital_try, 2),
            "investments_try": round(invest_try, 2),
            "card_debt_try": round(debt_try, 2),
        },
        "investments_pl_try": round(invest_try - invest_cost_try, 2),
        "investments_pl_pct": round(((invest_try - invest_cost_try) / invest_cost_try * 100) if invest_cost_try > 0 else 0, 2),
    }


# ---------- Seed ----------
@api_router.post("/seed")
async def seed_demo(force: bool = False):
    rates = await fetch_rates()
    existing = await db.accounts.count_documents({})
    if existing > 0 and not force:
        return {"ok": True, "seeded": False, "message": "Data already exists"}

    # Clear if force
    if force:
        await db.accounts.delete_many({})
        await db.cards.delete_many({})
        await db.transactions.delete_many({})
        await db.investments.delete_many({})

    # Accounts
    accounts = [
        Account(name="Garanti Vadesiz", type="bank", currency="TRY", balance=45230.50, icon="bank", color="#00A859"),
        Account(name="Wise USD", type="digital", currency="USD", balance=1850.00, icon="wallet", color="#9FE870"),
        Account(name="Tinkoff RUB", type="bank", currency="RUB", balance=125000.00, icon="bank", color="#FFDD2D"),
        Account(name="Nakit Cüzdan", type="cash", currency="TRY", balance=3500.00, icon="cash", color="#0066FF"),
        Account(name="Papara", type="digital", currency="TRY", balance=8420.75, icon="wallet", color="#FF3D71"),
    ]
    for a in accounts:
        a.balance_try = to_try(a.balance, a.currency, rates)
    await db.accounts.insert_many([a.dict() for a in accounts])

    # Cards
    cards = [
        Card(name="Bonus Platinum", bank="Garanti BBVA", last4="4521", currency="TRY", card_type="credit", limit=50000, debt=12450.30, statement_day=15, due_day=25, gradient="holo1"),
        Card(name="Maximum", bank="İş Bankası", last4="8832", currency="TRY", card_type="credit", limit=35000, debt=4280.00, statement_day=5, due_day=20, gradient="holo2"),
        Card(name="Wise Debit", bank="Wise", last4="0193", currency="USD", card_type="debit", limit=0, debt=0, statement_day=1, due_day=1, gradient="blue"),
    ]
    await db.cards.insert_many([c.dict() for c in cards])

    # Transactions
    now = datetime.now(timezone.utc)
    txs_raw = [
        ("expense", 845.30, "TRY", "Market", "Migros haftalık alışveriş", 0),
        ("expense", 120.00, "TRY", "Eğlence", "Sinema bileti", 1),
        ("expense", 1450.00, "TRY", "Fatura", "Elektrik faturası", 2),
        ("expense", 65.50, "USD", "Yazılım", "GitHub Pro + Cursor", 5),
        ("expense", 350.00, "TRY", "Ulaşım", "Akaryakıt", 3),
        ("expense", 2200.00, "TRY", "Kira", "Aylık kira ödemesi", 7),
        ("expense", 89.90, "TRY", "Market", "Bakkal", 10),
        ("income", 35000.00, "TRY", "Maaş", "Ocak maaşı", 12),
        ("expense", 240.00, "TRY", "Restoran", "Akşam yemeği", 4),
        ("expense", 1200.00, "RUB", "Eğlence", "Konser bileti", 6),
        ("expense", 78.50, "TRY", "Market", "Şok market", 9),
        ("income", 850.00, "USD", "Freelance", "Tasarım projesi", 14),
        ("expense", 320.00, "TRY", "Sağlık", "Eczane", 8),
        ("expense", 580.00, "TRY", "Fatura", "İnternet faturası", 11),
    ]
    tx_objs = []
    for t in txs_raw:
        typ, amt, cur, cat, note, days_ago = t
        tx = Transaction(type=typ, amount=amt, currency=cur, category=cat, note=note, date=now - timedelta(days=days_ago))
        tx.amount_try = to_try(amt, cur, rates)
        tx_objs.append(tx)
    await db.transactions.insert_many([t.dict() for t in tx_objs])

    # Investments
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


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
