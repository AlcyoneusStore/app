export const theme = {
  colors: {
    surface: '#050816',
    surfaceSecondary: '#0A0E27',
    surfaceTertiary: '#111836',
    surfaceElevated: '#1A2148',
    onSurface: '#FFFFFF',
    onSurfaceMuted: '#A0A8C0',
    onSurfaceDim: '#6B7290',
    brand: '#0066FF',
    brandDim: '#0047B3',
    brandTint: 'rgba(0,102,255,0.15)',
    success: '#00FF94',
    successDim: 'rgba(0,255,148,0.15)',
    danger: '#FF3366',
    dangerDim: 'rgba(255,51,102,0.15)',
    warning: '#FFB800',
    info: '#0090FF',
    border: 'rgba(255,255,255,0.08)',
    borderStrong: 'rgba(255,255,255,0.15)',
    divider: 'rgba(255,255,255,0.06)',
    glass: 'rgba(255,255,255,0.04)',
    glassStrong: 'rgba(255,255,255,0.08)',
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 },
  radius: { sm: 8, md: 16, lg: 24, pill: 999 },
  font: {
    display: 'System',
    text: 'System',
  },
  size: { sm: 12, base: 14, lg: 16, xl: 20, xxl: 28, xxxl: 40, hero: 56 },
};

export type CurrencyCode = 'TRY' | 'USD' | 'RUB';

export const CURRENCY_SYMBOL: Record<CurrencyCode, string> = {
  TRY: '₺',
  USD: '$',
  RUB: '₽',
};

export const CATEGORIES = [
  { id: 'Market', icon: 'cart', color: '#00FF94' },
  { id: 'Eğlence', icon: 'film', color: '#FF3366' },
  { id: 'Fatura', icon: 'flash', color: '#FFB800' },
  { id: 'Ulaşım', icon: 'car', color: '#0090FF' },
  { id: 'Kira', icon: 'home', color: '#9F7AEA' },
  { id: 'Restoran', icon: 'restaurant', color: '#FF6B35' },
  { id: 'Sağlık', icon: 'medkit', color: '#FF3366' },
  { id: 'Yazılım', icon: 'code-slash', color: '#0066FF' },
  { id: 'Maaş', icon: 'briefcase', color: '#00FF94' },
  { id: 'Freelance', icon: 'laptop', color: '#00FF94' },
  { id: 'Diğer', icon: 'ellipsis-horizontal', color: '#A0A8C0' },
];
