import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import type { CurrencyCode } from '../theme';

type Rates = { TRY: number; USD: number; RUB: number };

type Ctx = {
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  rates: Rates;
  fromTry: (amountTry: number) => number;
  toTry: (amount: number, currency: CurrencyCode) => number;
  refresh: () => Promise<void>;
};

const CurrencyContext = createContext<Ctx | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrency] = useState<CurrencyCode>('TRY');
  const [rates, setRates] = useState<Rates>({ TRY: 1, USD: 34, RUB: 0.36 });

  const refresh = useCallback(async () => {
    try {
      const r = await api.getRates();
      if (r?.rates) setRates(r.rates);
    } catch (e) {
      console.warn('rates fetch failed', e);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const fromTry = useCallback((amountTry: number) => {
    const rate = rates[currency] || 1;
    return rate > 0 ? amountTry / rate : 0;
  }, [currency, rates]);

  const toTry = useCallback((amount: number, cur: CurrencyCode) => {
    return amount * (rates[cur] || 1);
  }, [rates]);

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, rates, fromTry, toTry, refresh }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider');
  return ctx;
}

export function formatMoney(amount: number, currency: CurrencyCode, opts?: { decimals?: number; compact?: boolean }) {
  const decimals = opts?.decimals ?? 2;
  const symbol = currency === 'TRY' ? '₺' : currency === 'USD' ? '$' : '₽';
  let n = amount;
  let suffix = '';
  if (opts?.compact) {
    if (Math.abs(n) >= 1e9) { n = n / 1e9; suffix = 'B'; }
    else if (Math.abs(n) >= 1e6) { n = n / 1e6; suffix = 'M'; }
    else if (Math.abs(n) >= 1e3) { n = n / 1e3; suffix = 'K'; }
  }
  const formatted = n.toLocaleString('tr-TR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return `${symbol}${formatted}${suffix}`;
}
