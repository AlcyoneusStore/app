// Extend api client - re-exports + new endpoints
const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

async function req(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${path} ${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  getRates: () => req('/rates'),
  getSummary: () => req('/summary'),
  getMonthlyStats: (months = 6) => req(`/monthly-stats?months=${months}`),

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
  deleteInvestment: (id: string) => req(`/investments/${id}`, { method: 'DELETE' }),

  seed: (force = false) => req(`/seed${force ? '?force=true' : ''}`, { method: 'POST' }),
  factoryReset: () => req('/factory-reset', { method: 'POST' }),
};
