/** Armazenamento chave/valor assíncrono. No app é o AsyncStorage; nos testes, memória. */
export type ChaveValor = {
  ler: (chave: string) => Promise<string | null>;
  gravar: (chave: string, valor: string) => Promise<void>;
  apagar: (chave: string) => Promise<void>;
};

export function memoria(): ChaveValor {
  const m = new Map<string, string>();
  return {
    ler: async (k) => m.get(k) ?? null,
    gravar: async (k, v) => void m.set(k, v),
    apagar: async (k) => void m.delete(k)
  };
}

export async function lerJson<T>(kv: ChaveValor, chave: string, padrao: T): Promise<T> {
  const bruto = await kv.ler(chave);
  if (!bruto) return padrao;
  try {
    return JSON.parse(bruto) as T;
  } catch {
    return padrao;
  }
}
