from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import httpx
import bcrypt
import jwt
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

JWT_SECRET = os.environ.get('JWT_SECRET', 'finso-default-jwt-secret-change-me-in-prod')
JWT_ALG = 'HS256'
JWT_EXPIRE_HOURS = 24 * 30  # 30 days

app = FastAPI()
api_router = APIRouter(prefix="/api")
bearer = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

CurrencyCode = Literal["TRY", "USD", "RUB"]
ADMIN_DOC_ID = "auth_credentials"

# ---------- Auth helpers ----------
def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False

def create_token(subject: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": subject, "iat": int(now.timestamp()), "exp": int((now + timedelta(hours=JWT_EXPIRE_HOURS)).timestamp())}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

async def ensure_admin():
    doc = await db.auth.find_one({"_id": ADMIN_DOC_ID})
    if not doc:
        await db.auth.insert_one({"_id": ADMIN_DOC_ID, "username": "admin", "password_hash": hash_pw("admin")})

async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> str:
    if not creds or creds.scheme.lower() != "bearer":
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALG])
    except Exception:
        raise HTTPException(401, "Invalid or expired token")
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(401, "Invalid token")
    return sub


# ---------- Models ----------
class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class ChangeCredsRequest(BaseModel):
    current_password: str
    new_username: Optional[str] = None
    new_password: Optional[str] = None


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
    name: str; type: str; currency: CurrencyCode; balance: float
    icon: Optional[str] = "wallet"; color: Optional[str] = "#0066FF"

class AccountUpdate(BaseModel):
    name: Optional[str] = None; type: Optional[str] = None; currency: Optional[CurrencyCode] = None
    balance: Optional[float] = None; icon: Optional[str] = None; color: Optional[str] = None


class Card(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str; bank: str; last4: str; currency: CurrencyCode
    card_type: str; limit: float; debt: float
    statement_day: int; due_day: int; gradient: str = "blue"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CardCreate(BaseModel):
    name: str; bank: str; last4: str; currency: CurrencyCode; card_type: str
    limit: float; debt: float; statement_day: int; due_day: int; gradient: Optional[str] = "blue"

class CardUpdate(BaseModel):
    name: Optional[str] = None; bank: Optional[str] = None; last4: Optional[str] = None
    currency: Optional[CurrencyCode] = None; card_type: Optional[str] = None
    limit: Optional[float] = None; debt: Optional[float] = None
    statement_day: Optional[int] = None; due_day: Optional[int] = None; gradient: Optional[str] = None


class Transaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str  # expense | income | transfer | card_payment
    amount: float; currency: CurrencyCode; amount_try: float = 0.0
    category: str; note: Optional[str] = ""
    source_type: Optional[str] = None
    account_id: Optional[str] = None; card_id: Optional[str] = None
    to_account_id: Optional[str] = None; to_amount: Optional[float] = None
    to_currency: Optional[CurrencyCode] = None
    date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TransactionCreate(BaseModel):
    type: str; amount: float; currency: CurrencyCode
    category: str; note: Optional[str] = ""
    source_type: Optional[str] = None
    account_id: Optional[str] = None; card_id: Optional[str] = None
    date: Optional[datetime] = None

class TransactionUpdate(BaseModel):
    amount: Optional[float] = None; currency: Optional[CurrencyCode] = None
    category: Optional[str] = None; note: Optional[str] = None
    date: Optional[datetime] = None

class TransferCreate(BaseModel):
    from_account_id: str; to_account_id: str
    amount: float; currency: CurrencyCode
    to_amount: Optional[float] = None
    note: Optional[str] = ""


class Investment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    symbol: str; name: str; asset_type: str
    quantity: float; cost_basis: float; current_price: float
    currency: CurrencyCode
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class InvestmentCreate(BaseModel):
    symbol: str; name: str; asset_type: str
    quantity: float; cost_basis: float
    current_price: Optional[float] = None  # defaults to cost_basis
    currency: CurrencyCode

class InvestmentUpdate(BaseModel):
    symbol: Optional[str] = None; name: Optional[str] = None; asset_type: Optional[str] = None
    current_price: Optional[float] = None; quantity: Optional[float] = None
    cost_basis: Optional[float] = None; currency: Optional[CurrencyCode] = None

class InvestmentBulkUpdate(BaseModel):
    updates: List[dict]  # [{"id": "...", "current_price": 123.45}]


class Category(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str; icon: str = "pricetag"; color: str = "#0066FF"; kind: str = "expense"

class CategoryCreate(BaseModel):
    name: str; icon: Optional[str] = "pricetag"; color: Optional[str] = "#0066FF"; kind: Optional[str] = "expense"

class CategoryUpdate(BaseModel):
    name: Optional[str] = None; icon: Optional[str] = None; color: Optional[str] = None; kind: Optional[str] = None


class SettingsModel(BaseModel):
    custom_rates_enabled: bool = False
    custom_usd_try: Optional[float] = None
    custom_rub_try: Optional[float] = None

class SettingsUpdate(BaseModel):
    custom_rates_enabled: Optional[bool] = None
    custom_usd_try: Optional[float] = None
    custom_rub_try: Optional[float] = None


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
    if await db.categories.count_documents({}) == 0:
        await db.categories.insert_many([Category(**c).dict() for c in DEFAULT_CATEGORIES])


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
                inv = r.json().get("rates", {})
                if inv.get("USD"): rates["USD"] = round(1.0 / float(inv["USD"]), 6)
                if inv.get("RUB"): rates["RUB"] = round(1.0 / float(inv["RUB"]), 6)
    except Exception as e:
        logger.warning(f"Rate fetch failed: {e}")
    _RATE_CACHE = {"data": rates, "ts": now}
    return rates

async def fetch_rates() -> dict:
    live = await fetch_live_rates()
    s = await db.settings.find_one({"_id": "singleton"})
    if s and s.get("custom_rates_enabled"):
        return {"TRY": 1.0,
                "USD": float(s.get("custom_usd_try") or live["USD"]),
                "RUB": float(s.get("custom_rub_try") or live["RUB"])}
    return live

def to_try(amount: float, currency: str, rates: dict) -> float:
    return round(float(amount) * float(rates.get(currency, 1.0)), 2)

def convert(amount_try: float, currency: str, rates: dict) -> float:
    rate = rates.get(currency, 1.0)
    return round(float(amount_try) / float(rate), 2) if rate else 0.0


# ---------- AUTH endpoints ----------
@api_router.post("/auth/login", response_model=TokenResponse)
async def login(data: LoginRequest):
    await ensure_admin()
    doc = await db.auth.find_one({"_id": ADMIN_DOC_ID})
    if not doc or data.username != doc.get("username") or not verify_pw(data.password, doc.get("password_hash", "")):
        raise HTTPException(401, "Kullanıcı adı veya şifre hatalı")
    return TokenResponse(access_token=create_token(data.username))

@api_router.post("/auth/change-credentials")
async def change_creds(data: ChangeCredsRequest, _: str = Depends(get_current_user)):
    if not data.new_username and not data.new_password:
        raise HTTPException(400, "Yeni kullanıcı adı veya şifre belirtin")
    doc = await db.auth.find_one({"_id": ADMIN_DOC_ID})
    if not doc or not verify_pw(data.current_password, doc.get("password_hash", "")):
        raise HTTPException(401, "Mevcut şifre hatalı")
    upd = {}
    if data.new_username: upd["username"] = data.new_username
    if data.new_password: upd["password_hash"] = hash_pw(data.new_password)
    await db.auth.update_one({"_id": ADMIN_DOC_ID}, {"$set": upd})
    return {"ok": True, "username": data.new_username or doc["username"]}

@api_router.get("/auth/me")
async def me(user: str = Depends(get_current_user)):
    doc = await db.auth.find_one({"_id": ADMIN_DOC_ID})
    return {"username": doc["username"] if doc else user}


# ---------- Rates endpoint ----------
@api_router.get("/rates")
async def get_rates():
    live = await fetch_live_rates()
    effective = await fetch_rates()
    s = await db.settings.find_one({"_id": "singleton"}) or {}
    return {"base": "TRY", "rates": effective, "live_rates": live,
            "custom_rates_enabled": bool(s.get("custom_rates_enabled")),
            "updated_at": datetime.now(timezone.utc).isoformat()}


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
    cat = Category(**payload.dict()); await db.categories.insert_one(cat.dict()); return cat.dict()

@api_router.patch("/categories/{cat_id}")
async def update_category(cat_id: str, payload: CategoryUpdate):
    upd = {k: v for k, v in payload.dict().items() if v is not None}
    if not upd: return {"ok": True}
    res = await db.categories.update_one({"id": cat_id}, {"$set": upd})
    if res.matched_count == 0: raise HTTPException(404, "Not found")
    return {"ok": True}

@api_router.delete("/categories/{cat_id}")
async def delete_category(cat_id: str):
    res = await db.categories.delete_one({"id": cat_id})
    if res.deleted_count == 0: raise HTTPException(404, "Not found")
    return {"ok": True}


# ---------- Accounts ----------
@api_router.get("/accounts")
async def list_accounts():
    rates = await fetch_rates()
    items = await db.accounts.find({}, {"_id": 0}).to_list(1000)
    for it in items: it["balance_try"] = to_try(it["balance"], it["currency"], rates)
    return items

@api_router.post("/accounts")
async def create_account(payload: AccountCreate):
    rates = await fetch_rates()
    acc = Account(**payload.dict()); acc.balance_try = to_try(acc.balance, acc.currency, rates)
    await db.accounts.insert_one(acc.dict()); return acc.dict()

@api_router.patch("/accounts/{aid}")
async def update_account(aid: str, payload: AccountUpdate):
    upd = {k: v for k, v in payload.dict().items() if v is not None}
    if not upd: return {"ok": True}
    res = await db.accounts.update_one({"id": aid}, {"$set": upd})
    if res.matched_count == 0: raise HTTPException(404, "Not found")
    rates = await fetch_rates()
    acc = await db.accounts.find_one({"id": aid}, {"_id": 0})
    if acc:
        await db.accounts.update_one({"id": aid}, {"$set": {"balance_try": to_try(acc["balance"], acc["currency"], rates)}})
    return {"ok": True}

@api_router.delete("/accounts/{aid}")
async def delete_account(aid: str):
    res = await db.accounts.delete_one({"id": aid})
    if res.deleted_count == 0: raise HTTPException(404, "Not found")
    return {"ok": True}


# ---------- Cards ----------
@api_router.get("/cards")
async def list_cards():
    return await db.cards.find({}, {"_id": 0}).to_list(1000)

@api_router.post("/cards")
async def create_card(payload: CardCreate):
    c = Card(**payload.dict()); await db.cards.insert_one(c.dict()); return c.dict()

@api_router.patch("/cards/{cid}")
async def update_card(cid: str, payload: CardUpdate):
    upd = {k: v for k, v in payload.dict().items() if v is not None}
    if not upd: return {"ok": True}
    res = await db.cards.update_one({"id": cid}, {"$set": upd})
    if res.matched_count == 0: raise HTTPException(404, "Not found")
    return {"ok": True}

@api_router.delete("/cards/{cid}")
async def delete_card(cid: str):
    res = await db.cards.delete_one({"id": cid})
    if res.deleted_count == 0: raise HTTPException(404, "Not found")
    return {"ok": True}


# ---------- Transactions ----------
async def _delta_account(aid: str, amount: float, currency: str, rates: dict, sign: int):
    acc = await db.accounts.find_one({"id": aid}, {"_id": 0})
    if not acc: return
    delta = amount if currency == acc["currency"] else convert(to_try(amount, currency, rates), acc["currency"], rates)
    new_balance = round(float(acc["balance"]) + sign * float(delta), 2)
    await db.accounts.update_one({"id": aid}, {"$set": {"balance": new_balance, "balance_try": to_try(new_balance, acc["currency"], rates)}})

async def _delta_card(cid: str, amount: float, currency: str, rates: dict, sign: int):
    card = await db.cards.find_one({"id": cid}, {"_id": 0})
    if not card: return
    delta = amount if currency == card["currency"] else convert(to_try(amount, currency, rates), card["currency"], rates)
    new_debt = max(0.0, round(float(card["debt"]) + sign * float(delta), 2))
    await db.cards.update_one({"id": cid}, {"$set": {"debt": new_debt}})

@api_router.get("/transactions")
async def list_transactions(type: Optional[str] = None, category: Optional[str] = None, q: Optional[str] = None, limit: int = 500):
    query = {}
    if type: query["type"] = type
    if category: query["category"] = category
    if q: query["$or"] = [{"note": {"$regex": q, "$options": "i"}}, {"category": {"$regex": q, "$options": "i"}}]
    return await db.transactions.find(query, {"_id": 0}).sort("date", -1).to_list(limit)

@api_router.post("/transactions")
async def create_transaction(payload: TransactionCreate):
    rates = await fetch_rates()
    data = payload.dict()
    if not data.get("date"): data["date"] = datetime.now(timezone.utc)
    tx = Transaction(**data); tx.amount_try = to_try(tx.amount, tx.currency, rates)
    await db.transactions.insert_one(tx.dict())
    if tx.type == "expense":
        if tx.source_type == "card" and tx.card_id: await _delta_card(tx.card_id, tx.amount, tx.currency, rates, +1)
        elif tx.account_id: await _delta_account(tx.account_id, tx.amount, tx.currency, rates, -1)
    elif tx.type == "income" and tx.account_id:
        await _delta_account(tx.account_id, tx.amount, tx.currency, rates, +1)
    elif tx.type == "card_payment":
        if tx.account_id: await _delta_account(tx.account_id, tx.amount, tx.currency, rates, -1)
        if tx.card_id: await _delta_card(tx.card_id, tx.amount, tx.currency, rates, -1)
    return tx.dict()

@api_router.patch("/transactions/{tid}")
async def update_transaction(tid: str, payload: TransactionUpdate):
    upd = {k: v for k, v in payload.dict().items() if v is not None}
    if not upd: return {"ok": True}
    if "amount" in upd or "currency" in upd:
        rates = await fetch_rates()
        tx = await db.transactions.find_one({"id": tid}, {"_id": 0})
        if not tx: raise HTTPException(404, "Not found")
        upd["amount_try"] = to_try(upd.get("amount", tx["amount"]), upd.get("currency", tx["currency"]), rates)
    res = await db.transactions.update_one({"id": tid}, {"$set": upd})
    if res.matched_count == 0: raise HTTPException(404, "Not found")
    return {"ok": True}

@api_router.delete("/transactions/{tid}")
async def delete_transaction(tid: str):
    tx = await db.transactions.find_one({"id": tid}, {"_id": 0})
    if not tx: raise HTTPException(404, "Not found")
    rates = await fetch_rates()
    if tx["type"] == "expense":
        if tx.get("source_type") == "card" and tx.get("card_id"): await _delta_card(tx["card_id"], tx["amount"], tx["currency"], rates, -1)
        elif tx.get("account_id"): await _delta_account(tx["account_id"], tx["amount"], tx["currency"], rates, +1)
    elif tx["type"] == "income" and tx.get("account_id"):
        await _delta_account(tx["account_id"], tx["amount"], tx["currency"], rates, -1)
    elif tx["type"] == "card_payment":
        if tx.get("account_id"): await _delta_account(tx["account_id"], tx["amount"], tx["currency"], rates, +1)
        if tx.get("card_id"): await _delta_card(tx["card_id"], tx["amount"], tx["currency"], rates, +1)
    elif tx["type"] == "transfer":
        if tx.get("account_id"): await _delta_account(tx["account_id"], tx["amount"], tx["currency"], rates, +1)
        if tx.get("to_account_id") and tx.get("to_amount") and tx.get("to_currency"):
            await _delta_account(tx["to_account_id"], tx["to_amount"], tx["to_currency"], rates, -1)
    await db.transactions.delete_one({"id": tid})
    return {"ok": True}


# ---------- Transfers ----------
@api_router.post("/transfers")
async def create_transfer(payload: TransferCreate):
    rates = await fetch_rates()
    fa = await db.accounts.find_one({"id": payload.from_account_id}, {"_id": 0})
    ta = await db.accounts.find_one({"id": payload.to_account_id}, {"_id": 0})
    if not fa or not ta: raise HTTPException(404, "Account not found")
    if payload.from_account_id == payload.to_account_id: raise HTTPException(400, "Same account")
    amount_try = to_try(payload.amount, payload.currency, rates)
    to_amount = round(float(payload.to_amount), 2) if payload.to_amount and payload.to_amount > 0 else convert(amount_try, ta["currency"], rates)
    tx = Transaction(type="transfer", amount=payload.amount, currency=payload.currency, amount_try=amount_try,
                     category="Transfer", note=payload.note or f"{fa['name']} → {ta['name']}",
                     source_type="account", account_id=payload.from_account_id,
                     to_account_id=payload.to_account_id, to_amount=to_amount, to_currency=ta["currency"])
    await db.transactions.insert_one(tx.dict())
    await _delta_account(payload.from_account_id, payload.amount, payload.currency, rates, -1)
    await _delta_account(payload.to_account_id, to_amount, ta["currency"], rates, +1)
    return tx.dict()


# ---------- Investments ----------
@api_router.get("/investments")
async def list_investments():
    return await db.investments.find({}, {"_id": 0}).to_list(1000)

@api_router.post("/investments")
async def create_investment(payload: InvestmentCreate):
    data = payload.dict()
    if not data.get("current_price"): data["current_price"] = data["cost_basis"]
    inv = Investment(**data); await db.investments.insert_one(inv.dict())
    await snapshot_now()
    return inv.dict()

@api_router.patch("/investments/{iid}")
async def update_investment(iid: str, payload: InvestmentUpdate):
    upd = {k: v for k, v in payload.dict().items() if v is not None}
    if not upd: return {"ok": True}
    res = await db.investments.update_one({"id": iid}, {"$set": upd})
    if res.matched_count == 0: raise HTTPException(404, "Not found")
    await snapshot_now()
    return {"ok": True}

@api_router.post("/investments/bulk-update")
async def bulk_update_investments(payload: InvestmentBulkUpdate):
    for u in payload.updates:
        iid = u.get("id")
        cp = u.get("current_price")
        if iid and cp is not None:
            await db.investments.update_one({"id": iid}, {"$set": {"current_price": float(cp)}})
    await snapshot_now()
    return {"ok": True, "count": len(payload.updates)}

@api_router.delete("/investments/{iid}")
async def delete_investment(iid: str):
    res = await db.investments.delete_one({"id": iid})
    if res.deleted_count == 0: raise HTTPException(404, "Not found")
    await snapshot_now()
    return {"ok": True}


# ---------- Investment snapshots ----------
async def snapshot_now():
    """Create a snapshot of current portfolio value."""
    rates = await fetch_rates()
    items = await db.investments.find({}, {"_id": 0}).to_list(1000)
    total_value = sum(to_try(i["current_price"] * i["quantity"], i["currency"], rates) for i in items)
    total_cost = sum(to_try(i["cost_basis"] * i["quantity"], i["currency"], rates) for i in items)
    doc = {
        "id": str(uuid.uuid4()),
        "date": datetime.now(timezone.utc),
        "total_value_try": round(total_value, 2),
        "total_cost_try": round(total_cost, 2),
        "pl_try": round(total_value - total_cost, 2),
        "items_count": len(items),
    }
    await db.snapshots.insert_one(doc)

async def ensure_daily_snapshot():
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    existing = await db.snapshots.find_one({"date": {"$gte": today}})
    if not existing:
        await snapshot_now()

@api_router.get("/investments/snapshots")
async def list_snapshots(period: str = "monthly"):
    """period: daily | monthly | yearly"""
    docs = await db.snapshots.find({}, {"_id": 0}).sort("date", 1).to_list(2000)
    if not docs: return []
    if period == "daily":
        return [{"date": d["date"].isoformat() if isinstance(d["date"], datetime) else str(d["date"]),
                 "value_try": d["total_value_try"], "cost_try": d["total_cost_try"], "pl_try": d["pl_try"]} for d in docs]
    # group by month or year - take last value in each group
    grouped: dict = {}
    for d in docs:
        dt = d["date"] if isinstance(d["date"], datetime) else datetime.fromisoformat(str(d["date"]).replace("Z", "+00:00"))
        key = f"{dt.year:04d}-{dt.month:02d}" if period == "monthly" else f"{dt.year:04d}"
        grouped[key] = {"label": key, "value_try": d["total_value_try"], "cost_try": d["total_cost_try"], "pl_try": d["pl_try"]}
    return [v for _, v in sorted(grouped.items())]


# ---------- Summary / Monthly ----------
@api_router.get("/summary")
async def summary():
    rates = await fetch_rates()
    accounts = await db.accounts.find({}, {"_id": 0}).to_list(1000)
    cards = await db.cards.find({}, {"_id": 0}).to_list(1000)
    investments = await db.investments.find({}, {"_id": 0}).to_list(1000)

    cash_try = bank_try = digital_try = 0.0
    for a in accounts:
        v = to_try(a["balance"], a["currency"], rates)
        if a["type"] == "cash": cash_try += v
        elif a["type"] == "digital": digital_try += v
        else: bank_try += v

    debt_try = sum(to_try(c["debt"], c["currency"], rates) for c in cards)
    invest_try = sum(to_try(i["current_price"] * i["quantity"], i["currency"], rates) for i in investments)
    invest_cost_try = sum(to_try(i["cost_basis"] * i["quantity"], i["currency"], rates) for i in investments)

    accounts_total_try = cash_try + bank_try + digital_try
    net_worth_try = round(accounts_total_try + invest_try - debt_try, 2)

    return {
        "rates": rates, "net_worth_try": net_worth_try,
        "breakdown": {
            "cash_try": round(cash_try, 2), "bank_try": round(bank_try, 2),
            "digital_try": round(digital_try, 2), "accounts_total_try": round(accounts_total_try, 2),
            "investments_try": round(invest_try, 2), "card_debt_try": round(debt_try, 2),
            "investments_cost_try": round(invest_cost_try, 2),
        },
        "investments_pl_try": round(invest_try - invest_cost_try, 2),
        "investments_pl_pct": round(((invest_try - invest_cost_try) / invest_cost_try * 100) if invest_cost_try > 0 else 0, 2),
        "counts": {"accounts": len(accounts), "cards": len(cards), "investments": len(investments)},
    }

@api_router.get("/monthly-stats")
async def monthly_stats(months: int = 6):
    now = datetime.now(timezone.utc)
    buckets = []
    for i in range(months - 1, -1, -1):
        y = now.year; m = now.month - i
        while m <= 0: m += 12; y -= 1
        buckets.append({"year": y, "month": m, "label": f"{m:02d}/{str(y)[-2:]}", "income": 0.0, "expense": 0.0, "net": 0.0})
    txs = await db.transactions.find({"type": {"$in": ["income", "expense"]}}, {"_id": 0}).to_list(5000)
    for t in txs:
        d = t["date"] if isinstance(t["date"], datetime) else datetime.fromisoformat(str(t["date"]).replace("Z", "+00:00"))
        for b in buckets:
            if d.year == b["year"] and d.month == b["month"]:
                if t["type"] == "income": b["income"] += t.get("amount_try", 0.0)
                else: b["expense"] += t.get("amount_try", 0.0)
                break
    for b in buckets:
        b["net"] = round(b["income"] - b["expense"], 2); b["income"] = round(b["income"], 2); b["expense"] = round(b["expense"], 2)
    return buckets


# ---------- Factory / Seed ----------
@api_router.post("/factory-reset")
async def factory_reset(keep_auth: bool = True):
    await db.accounts.delete_many({})
    await db.cards.delete_many({})
    await db.transactions.delete_many({})
    await db.investments.delete_many({})
    await db.categories.delete_many({})
    await db.settings.delete_many({})
    await db.snapshots.delete_many({})
    if not keep_auth:
        await db.auth.delete_many({})
    await ensure_categories()
    await ensure_admin()
    return {"ok": True}

@api_router.post("/seed")
async def seed_demo(force: bool = False):
    await ensure_categories()
    rates = await fetch_rates()
    if await db.accounts.count_documents({}) > 0 and not force:
        return {"ok": True, "seeded": False, "message": "Data exists"}
    if force:
        await db.accounts.delete_many({}); await db.cards.delete_many({})
        await db.transactions.delete_many({}); await db.investments.delete_many({})
        await db.snapshots.delete_many({})

    accounts = [
        Account(name="Garanti Vadesiz", type="bank", currency="TRY", balance=45230.50, icon="business", color="#00A859"),
        Account(name="Wise USD", type="digital", currency="USD", balance=1850.00, icon="phone-portrait", color="#9FE870"),
        Account(name="Tinkoff RUB", type="bank", currency="RUB", balance=125000.00, icon="business", color="#FFDD2D"),
        Account(name="Nakit Cüzdan", type="cash", currency="TRY", balance=3500.00, icon="cash", color="#0066FF"),
        Account(name="Papara", type="digital", currency="TRY", balance=8420.75, icon="phone-portrait", color="#FF3D71"),
    ]
    for a in accounts: a.balance_try = to_try(a.balance, a.currency, rates)
    await db.accounts.insert_many([a.dict() for a in accounts])

    cards = [
        Card(name="Bonus Platinum", bank="Garanti BBVA", last4="4521", currency="TRY", card_type="credit", limit=50000, debt=12450.30, statement_day=15, due_day=25, gradient="holo1"),
        Card(name="Maximum", bank="İş Bankası", last4="8832", currency="TRY", card_type="credit", limit=35000, debt=4280.00, statement_day=5, due_day=20, gradient="holo2"),
        Card(name="Wise Debit", bank="Wise", last4="0193", currency="USD", card_type="debit", limit=0, debt=0, statement_day=1, due_day=1, gradient="blue"),
    ]
    await db.cards.insert_many([c.dict() for c in cards])

    now = datetime.now(timezone.utc)
    acc_ids = [a.id for a in accounts]; card_ids = [c.id for c in cards]
    txs_raw = [
        ("expense", 845.30, "TRY", "Market", "Migros", 0, "account", acc_ids[0], None),
        ("expense", 120.00, "TRY", "Eğlence", "Sinema", 1, "card", None, card_ids[0]),
        ("expense", 1450.00, "TRY", "Fatura", "Elektrik", 2, "account", acc_ids[0], None),
        ("expense", 65.50, "USD", "Yazılım", "GitHub Pro", 5, "card", None, card_ids[0]),
        ("expense", 350.00, "TRY", "Ulaşım", "Akaryakıt", 3, "account", acc_ids[3], None),
        ("expense", 2200.00, "TRY", "Kira", "Aylık kira", 7, "account", acc_ids[0], None),
        ("income", 35000.00, "TRY", "Maaş", "Ocak maaşı", 12, "account", acc_ids[0], None),
        ("expense", 240.00, "TRY", "Restoran", "Akşam yemeği", 4, "card", None, card_ids[1]),
        ("income", 850.00, "USD", "Freelance", "Tasarım", 14, "account", acc_ids[1], None),
        ("expense", 320.00, "TRY", "Sağlık", "Eczane", 8, "account", acc_ids[0], None),
        ("expense", 4200.00, "TRY", "Kira", "Geçen ay kira", 35, "account", acc_ids[0], None),
        ("income", 33000.00, "TRY", "Maaş", "Geçen ay maaş", 42, "account", acc_ids[0], None),
        ("expense", 1800.00, "TRY", "Market", "Geçen ay market", 50, "account", acc_ids[0], None),
        ("income", 32000.00, "TRY", "Maaş", "2 ay önce maaş", 72, "account", acc_ids[0], None),
        ("expense", 3100.00, "TRY", "Kira", "2 ay önce kira", 65, "account", acc_ids[0], None),
    ]
    tx_objs = []
    for typ, amt, cur, cat, note, days_ago, st, aid, cid in txs_raw:
        tx = Transaction(type=typ, amount=amt, currency=cur, category=cat, note=note,
                         date=now - timedelta(days=days_ago), source_type=st, account_id=aid, card_id=cid)
        tx.amount_try = to_try(amt, cur, rates); tx_objs.append(tx)
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

    # Seed historical snapshots so chart isn't empty
    for i_days_ago in range(90, -1, -10):
        date_pt = now - timedelta(days=i_days_ago)
        # simulate ~ +0.3% per 10 days variation
        factor = 1.0 - (i_days_ago / 90.0) * 0.25
        items = await db.investments.find({}, {"_id": 0}).to_list(1000)
        total = 0.0; total_cost = 0.0
        for it in items:
            total += to_try(it["current_price"] * it["quantity"] * factor, it["currency"], rates)
            total_cost += to_try(it["cost_basis"] * it["quantity"], it["currency"], rates)
        await db.snapshots.insert_one({
            "id": str(uuid.uuid4()), "date": date_pt,
            "total_value_try": round(total, 2), "total_cost_try": round(total_cost, 2),
            "pl_try": round(total - total_cost, 2), "items_count": len(items),
        })

    return {"ok": True, "seeded": True}


@api_router.get("/")
async def root():
    return {"app": "Finso", "status": "ok"}


app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
async def startup():
    await ensure_categories()
    await ensure_admin()
    await ensure_daily_snapshot()

@app.on_event("shutdown")
async def shutdown():
    client.close()
