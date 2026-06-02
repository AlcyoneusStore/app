import { storage } from '@/src/utils/storage';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
const TOKEN_KEY = 'finso_token';

let _token: string | null = null;
let _tokenLoaded = false;

async function ensureToken(): Promise<string | null> {
  if (_tokenLoaded) return _token;
  try {
    const v = await storage.getItem<string>(TOKEN_KEY, '');
    _token = v && v.length > 0 ? v : null;
  } catch {
    _token = null;
  }
  _tokenLoaded = true;
  return _token;
}

export async function setStoredToken(t: string | null) {
  _token = t;
  _tokenLoaded = true;
  if (t) await storage.setItem(TOKEN_KEY, t);
  else await storage.removeItem(TOKEN_KEY);
}

export async function getStoredToken(): Promise<string | null> {
  return ensureToken();
}

async function req(path: string, options: RequestInit = {}) {
  const token = await ensureToken();
  const headers: any = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api${path}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${path} ${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  // Auth
  login: (username: string, password: string) => req('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  changeCredentials: (data: any) => req('/auth/change-credentials', { method: 'POST', body: JSON.stringify(data) }),
  me: () => req('/auth/me'),

  getRates: () => req('/rates'),
  getSummary: () => req('/summary'),
  getMonthlyStats: (months = 6) => req(`/monthly-stats?months=${months}`),
  getSnapshots: (period: 'daily'|'monthly'|'yearly' = 'monthly') => req(`/investments/snapshots?period=${period}`),

  getSettings: () => req('/settings'),
  updateSettings: (data: any) => req('/settings', { method: 'PUT', body: JSON.stringify(data) }),

  listCategories: () => req('/categories'),
  createCategory: (data: any) => req('/categories', { method: 'POST', body: JSON.stringify(data) }),
  updateCategory: (id: string, data: any) => req(`/categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCategory: (id: string) => req(`/categories/${id}`, { method: 'DELETE' }),

  listAccounts: () => req('/accounts'),
  createAccount: (data: any) => req('/accounts', { method: 'POST', body: JSON.stringify(data) }),
  updateAccount: (id: string, data: any) => req(`/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteAccount: (id: string) => req(`/accounts/${id}`, { method: 'DELETE' }),

  listCards: () => req('/cards'),
  createCard: (data: any) => req('/cards', { method: 'POST', body: JSON.stringify(data) }),
  updateCard: (id: string, data: any) => req(`/cards/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCard: (id: string) => req(`/cards/${id}`, { method: 'DELETE' }),

  listTransactions: (params: { type?: string; category?: string; q?: string } = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, String(v)); });
    const s = qs.toString();
    return req(`/transactions${s ? `?${s}` : ''}`);
  },
  createTransaction: (data: any) => req('/transactions', { method: 'POST', body: JSON.stringify(data) }),
  updateTransaction: (id: string, data: any) => req(`/transactions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTransaction: (id: string) => req(`/transactions/${id}`, { method: 'DELETE' }),

  createTransfer: (data: any) => req('/transfers', { method: 'POST', body: JSON.stringify(data) }),

  listInvestments: () => req('/investments'),
  createInvestment: (data: any) => req('/investments', { method: 'POST', body: JSON.stringify(data) }),
  updateInvestment: (id: string, data: any) => req(`/investments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  bulkUpdateInvestments: (updates: any[]) => req('/investments/bulk-update', { method: 'POST', body: JSON.stringify({ updates }) }),
  deleteInvestment: (id: string) => req(`/investments/${id}`, { method: 'DELETE' }),

  seed: (force = false) => req(`/seed${force ? '?force=true' : ''}`, { method: 'POST' }),
  factoryReset: () => req('/factory-reset', { method: 'POST' }),
};
