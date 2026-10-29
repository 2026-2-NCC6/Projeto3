function partes(versao: string): number[] | null {
  const limpa = versao.trim().replace(/^v/i, '');
  if (!/^\d+(\.\d+)*$/.test(limpa)) return null;
  return limpa.split('.').map(Number);
}

/** true se `atual` ≥ `minimo` (comparação numérica por segmento; segmentos ausentes valem 0). */
export function versaoAtende(atual: string, minimo: string): boolean {
  const a = partes(atual);
  const m = partes(minimo);
  if (!a || !m) return false;
  for (let i = 0; i < Math.max(a.length, m.length); i++) {
    const diff = (a[i] ?? 0) - (m[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return true;
}
