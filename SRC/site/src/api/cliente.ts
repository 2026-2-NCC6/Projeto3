// Cliente HTTP da API do Tennis Analytics. Erros seguem o formato da API:
// { statusCode, codigo, mensagem, detalhes?, requestId }.

export type Tokens = { accessToken: string; refreshToken: string };

/** Resposta de erro da API (4xx/5xx). `codigo` é estável para a interface decidir o que fazer. */
export class ErroApi extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensagem: string,
    readonly detalhes?: unknown,
    readonly requestId?: string
  ) {
    super(mensagem);
  }
}

/** Sem conexão ou sem resposta a tempo: o site avisa e o usuário tenta de novo. */
export class ErroRede extends Error {}

type OpcoesCliente = {
  baseUrl: string;
  fetch?: typeof fetch;
  tokens: { atual: () => Tokens | null; definir: (t: Tokens | null) => void | Promise<void> };
  /** Chamado quando a renovação falha: a sessão expirou e o usuário precisa entrar de novo. */
  aoExpirar?: () => void;
  timeoutMs?: number;
};

type OpcoesRequisicao = { corpo?: unknown; publico?: boolean; cabecalhos?: Record<string, string> };

export type Resposta<T> = { status: number; dados: T; cabecalhos: Headers };

export function criarCliente(op: OpcoesCliente) {
  const fazerFetch = op.fetch ?? fetch;
  const timeoutMs = op.timeoutMs ?? 15_000;
  let renovando: Promise<boolean> | null = null;

  async function chamar(metodo: string, caminho: string, o: OpcoesRequisicao, token: string | null): Promise<Response> {
    const cabecalhos: Record<string, string> = { 'x-request-id': crypto.randomUUID(), ...o.cabecalhos };
    if (o.corpo !== undefined) cabecalhos['content-type'] = 'application/json';
    if (token) cabecalhos.authorization = `Bearer ${token}`;
    const controle = new AbortController();
    const timer = setTimeout(() => controle.abort(), timeoutMs);
    try {
      return await fazerFetch(`${op.baseUrl}${caminho}`, {
        method: metodo,
        headers: cabecalhos,
        body: o.corpo === undefined ? undefined : JSON.stringify(o.corpo),
        signal: controle.signal
      });
    } catch {
      throw new ErroRede('Sem conexão com o servidor.');
    } finally {
      clearTimeout(timer);
    }
  }

  // Uma renovação por vez: chamadas que recebem 401 juntas esperam a mesma.
  function renovar(): Promise<boolean> {
    renovando ??= (async () => {
      const refreshToken = op.tokens.atual()?.refreshToken;
      try {
        if (!refreshToken) return false;
        const r = await chamar('POST', '/auth/refresh', { corpo: { refreshToken }, publico: true }, null);
        if (!r.ok) return false;
        const novos = (await r.json()) as Tokens;
        await op.tokens.definir({ accessToken: novos.accessToken, refreshToken: novos.refreshToken });
        return true;
      } catch {
        return false;
      } finally {
        renovando = null;
      }
    })();
    return renovando;
  }

  async function requisitar<T = unknown>(metodo: string, caminho: string, o: OpcoesRequisicao = {}): Promise<Resposta<T>> {
    let r = await chamar(metodo, caminho, o, o.publico ? null : (op.tokens.atual()?.accessToken ?? null));
    if (r.status === 401 && !o.publico) {
      if (await renovar()) {
        r = await chamar(metodo, caminho, o, op.tokens.atual()?.accessToken ?? null);
      } else {
        await op.tokens.definir(null);
        op.aoExpirar?.();
      }
    }
    if (r.status === 204 || r.status === 304) return { status: r.status, dados: null as T, cabecalhos: r.headers };
    const texto = await r.text();
    const corpo = texto ? JSON.parse(texto) : null;
    if (!r.ok) {
      throw new ErroApi(r.status, corpo?.codigo ?? 'ERRO', corpo?.mensagem ?? `Erro ${r.status}`, corpo?.detalhes, corpo?.requestId);
    }
    return { status: r.status, dados: corpo as T, cabecalhos: r.headers };
  }

  return { requisitar };
}

export type ClienteApi = ReturnType<typeof criarCliente>;
