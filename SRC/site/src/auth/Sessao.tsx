import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { criarCliente, type Tokens } from '../api/cliente';
import { API_URL } from '../api/config';
import { criarEndpoints, type Endpoints } from '../api/endpoints';
import type { Conta } from '../api/tipos';

// O token de acesso (15 min) fica só em memória. O refresh fica no sessionStorage: sobrevive a
// recarregar a página, mas some ao fechar a aba e não é compartilhado entre abas. Nada vai para
// localStorage nem cookie. A CSP do deploy (render.yaml) bloqueia script de terceiros.
const CHAVE_REFRESH = 'tennis.refresh';

function lerRefresh() {
  try {
    return sessionStorage.getItem(CHAVE_REFRESH);
  } catch {
    return null;
  }
}

function gravarRefresh(valor: string | null) {
  try {
    if (valor) sessionStorage.setItem(CHAVE_REFRESH, valor);
    else sessionStorage.removeItem(CHAVE_REFRESH);
  } catch {
    // sem storage (modo privado restrito): a sessão vale só enquanto a página estiver aberta
  }
}

type Valor = {
  carregando: boolean;
  conta: Conta | null;
  api: Endpoints;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
};

const Contexto = createContext<Valor | null>(null);

export function SessaoProvider({ children }: { children: React.ReactNode }) {
  const tokens = useRef<Tokens | null>(null);
  const [conta, setConta] = useState<Conta | null>(null);
  const [carregando, setCarregando] = useState(true);

  const api = useMemo(
    () =>
      criarEndpoints(
        criarCliente({
          baseUrl: API_URL,
          tokens: {
            atual: () => tokens.current,
            definir: (t) => {
              tokens.current = t;
              gravarRefresh(t?.refreshToken ?? null);
            }
          },
          aoExpirar: () => setConta(null)
        })
      ),
    []
  );

  useEffect(() => {
    const refresh = lerRefresh();
    if (!refresh) return setCarregando(false);
    // Token de acesso vazio: a primeira chamada recebe 401 e o cliente renova com o refresh.
    tokens.current = { accessToken: '', refreshToken: refresh };
    api
      .conta()
      .then(setConta)
      .catch(() => {
        tokens.current = null;
        gravarRefresh(null);
      })
      .finally(() => setCarregando(false));
  }, [api]);

  const entrar = useCallback(
    async (email: string, senha: string) => {
      const r = await api.login(email, senha);
      tokens.current = { accessToken: r.accessToken, refreshToken: r.refreshToken };
      gravarRefresh(r.refreshToken);
      setConta(await api.conta());
    },
    [api]
  );

  const sair = useCallback(async () => {
    const refresh = tokens.current?.refreshToken;
    tokens.current = null;
    gravarRefresh(null);
    setConta(null);
    if (refresh) await api.logout(refresh).catch(() => undefined);
  }, [api]);

  return <Contexto.Provider value={{ carregando, conta, api, entrar, sair }}>{children}</Contexto.Provider>;
}

export function useSessao() {
  const v = useContext(Contexto);
  if (!v) throw new Error('useSessao fora do SessaoProvider');
  return v;
}

/** Autor do treino ou admin podem editá-lo (mesma regra do servidor). */
export const podeAutorar = (c: Conta | null) => c?.papel === 'AUTOR' || c?.papel === 'ADMIN';
