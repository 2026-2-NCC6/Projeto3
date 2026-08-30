export const colors = {
  bg: '#121212',
  surface: '#1C1C1E',
  surfaceSunken: '#161616',
  surfaceActive: '#2A2A2C',
  border: '#2C2C2E',
  borderStrong: '#38383A',
  divider: '#242426',

  text: '#F5F5F7',
  textSecondary: '#98989D',
  textTertiary: '#6E6E73',
  textQuaternary: '#48484A',

  primary: '#CBE81F',
  primaryInk: '#141C05',
  primarySoft: '#DCF158',
  primaryTintBg: 'rgba(203,232,31,0.10)',
  primaryTintBgSoft: 'rgba(203,232,31,0.07)',
  primaryTintBd: 'rgba(203,232,31,0.32)',

  success: '#22C55E',
  successTintBg: 'rgba(34,197,94,0.09)',
  successTintBd: 'rgba(34,197,94,0.30)',

  danger: '#EF4444',
  dangerInk: '#210505',
  dangerTintBg: 'rgba(239,68,68,0.09)',
  dangerTintBd: 'rgba(239,68,68,0.32)',

  warning: '#EAB308'
} as const;

export type AppColors = typeof colors;
