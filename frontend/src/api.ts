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

  listAccounts: () => req('/accounts'),
  createAccount: (data: any) => req('/accounts', { method: 'POST', body: JSON.stringify(data) }),
  deleteAccount: (id: string) => req(`/accounts/${id}`, { method: 'DELETE' }),

  listCards: () => req('/cards'),
  createCard: (data: any) => req('/cards', { method: 'POST', body: JSON.stringify(data) }),
  deleteCard: (id: string) => req(`/cards/${id}`, { method: 'DELETE' }),

  listTransactions: (params: { type?: string; category?: string; q?: string } = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, String(v)); });
    const s = qs.toString();
    return req(`/transactions${s ? `?${s}` : ''}`);
  },
  createTransaction: (data: any) => req('/transactions', { method: 'POST', body: JSON.stringify(data) }),
  deleteTransaction: (id: string) => req(`/transactions/${id}`, { method: 'DELETE' }),

  listInvestments: () => req('/investments'),
  createInvestment: (data: any) => req('/investments', { method: 'POST', body: JSON.stringify(data) }),
  updateInvestment: (id: string, data: any) => req(`/investments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteInvestment: (id: string) => req(`/investments/${id}`, { method: 'DELETE' }),

  seed: (force = false) => req(`/seed${force ? '?force=true' : ''}`, { method: 'POST' }),
};
