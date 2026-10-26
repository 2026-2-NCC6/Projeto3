import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ErroApi, ErroRede, Tokens, criarCliente } from '../api/cliente';
import { API_URL, TERMOS_VERSAO } from '../api/config';
import { Endpoints, criarEndpoints } from '../api/endpoints';
import type { FaixaEtaria, Nivel, Praticante, Usuario } from '../api/tipos';
import { armazenamentoApp, cofre } from '../armazenamento/aparelho';
import { lerJson } from '../armazenamento/chaveValor';
import { FilaSessoes } from '../offline/filaSessoes';
import { RepositorioTreinos } from '../treinos/repositorio';

const CHAVE_REFRESH = 'tennis.refresh';
const CHAVE_CONTA = 'tennis.conta';
const CHAVE_PRATICANTE = 'tennis.praticanteAtivo';
const CHAVE_IDS_RAQUETES = 'tennis.raquetesComChave';
export const chaveDaRaquete = (idBle: string) => `tennis.chave.${idBle}`;

type ContaCache = { usuario: Usuario; praticantes: Praticante[] };

type Auth = {
  carregando: boolean;
  usuario: Usuario | null;
  praticantes: Praticante[];
  praticanteAtivo: Praticante | null;
  /** A última chamada falhou por falta de rede: o app está usando dados guardados. */
  offline: boolean;
  pendentesSync: number;
  api: Endpoints;
  repositorio: RepositorioTreinos;
  fila: FilaSessoes;
  escolherPraticante: (id: string) => void;
  entrar: (email: string, senha: string) => Promise<void>;
  cadastrar: (d: { email: string; senha: string; nome: string; faixaEtaria: FaixaEtaria; nivel: Nivel }) => Promise<void>;
  sair: () => Promise<void>;
  recarregar: () => Promise<void>;
  sincronizar: () => Promise<void>;
  tokenAcesso: () => string | null;
  /** Chave do BLE da raquete: da API (só para o dono) ou, sem rede, a guardada no cofre. */
  obterChaveRaquete: (idBle: string) => Promise<string | null>;
  guardarChaveRaquete: (idBle: string, chave: string) => Promise<void>;
};

const AuthCtx = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const tokens = useRef<Tokens | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [praticantes, setPraticantes] = useState<Praticante[]>([]);
  const [praticanteAtivoId, setPraticanteAtivoId] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [pendentesSync, setPendentesSync] = useState(0);

  const api = useMemo(
    () =>
      criarEndpoints(
        criarCliente({
          baseUrl: API_URL,
          tokens: {
            atual: () => tokens.current,
            definir: async (t) => {
              tokens.current = t;
              if (t) await cofre.gravar(CHAVE_REFRESH, t.refreshToken);
              else await cofre.apagar(CHAVE_REFRESH);
            }
          },
          aoExpirar: () => setUsuario(null)
        })
      ),
    []
  );
  const fila = useMemo(() => new FilaSessoes(armazenamentoApp), []);
  const repositorio = useMemo(() => new RepositorioTreinos(api, armazenamentoApp), [api]);

  const aplicarConta = useCallback(async (c: ContaCache) => {
    setUsuario(c.usuario);
    setPraticantes(c.praticantes);
    await armazenamentoApp.gravar(CHAVE_CONTA, JSON.stringify(c));
  }, []);

  const contarPendentes = useCallback(async () => setPendentesSync((await fila.listar()).length), [fila]);

  const sincronizar = useCallback(async () => {
    await fila.sincronizar((item) => api.sincronizar(item));
    await contarPendentes();
  }, [api, fila, contarPendentes]);

  const recarregar = useCallback(async () => {
    try {
      const c = await api.conta();
      setOffline(false);
      await aplicarConta({ usuario: { id: c.id, email: c.email, nome: c.nome, papel: c.papel }, praticantes: c.praticantes });
      await sincronizar();
    } catch (e) {
      if (e instanceof ErroRede) setOffline(true);
      else throw e;
    }
  }, [api, aplicarConta, sincronizar]);

  // Abertura do app: retoma a sessão pelo refresh token; sem rede, usa a conta guardada.
  useEffect(() => {
    (async () => {
      try {
        const refresh = await cofre.ler(CHAVE_REFRESH);
        setPraticanteAtivoId(await armazenamentoApp.ler(CHAVE_PRATICANTE));
        await contarPendentes();
        if (!refresh) return;
        tokens.current = { accessToken: '', refreshToken: refresh };
        try {
          await recarregar();
        } catch {
          tokens.current = null;
        }
        const guardada = await lerJson<ContaCache | null>(armazenamentoApp, CHAVE_CONTA, null);
        if (guardada && tokens.current) {
          setUsuario((u) => u ?? guardada.usuario);
          setPraticantes((p) => (p.length ? p : guardada.praticantes));
        }
      } finally {
        setCarregando(false);
      }
    })();
  }, [recarregar, contarPendentes]);

  const entrar = useCallback(
    async (email: string, senha: string) => {
      const r = await api.login(email, senha);
      tokens.current = { accessToken: r.accessToken, refreshToken: r.refreshToken };
      await cofre.gravar(CHAVE_REFRESH, r.refreshToken);
      await recarregar();
    },
    [api, recarregar]
  );

  const cadastrar = useCallback<Auth['cadastrar']>(
    async (d) => {
      const r = await api.cadastrar({ ...d, termosVersao: TERMOS_VERSAO });
      tokens.current = { accessToken: r.accessToken, refreshToken: r.refreshToken };
      await cofre.gravar(CHAVE_REFRESH, r.refreshToken);
      await recarregar();
    },
    [api, recarregar]
  );

  const sair = useCallback(async () => {
    const refresh = tokens.current?.refreshToken;
    if (refresh) await api.logout(refresh).catch(() => undefined);
    tokens.current = null;
    // Credenciais e dados da conta saem do aparelho junto com a sessão (LGPD: minimização).
    const idsRaquetes = await lerJson<string[]>(armazenamentoApp, CHAVE_IDS_RAQUETES, []);
    await Promise.all([
      cofre.apagar(CHAVE_REFRESH),
      ...idsRaquetes.map((id) => cofre.apagar(chaveDaRaquete(id))),
      armazenamentoApp.apagar(CHAVE_IDS_RAQUETES),
      armazenamentoApp.apagar(CHAVE_CONTA),
      armazenamentoApp.apagar(CHAVE_PRATICANTE)
    ]);
    setUsuario(null);
    setPraticantes([]);
    setPraticanteAtivoId(null);
  }, [api]);

  const guardarChaveRaquete = useCallback(async (idBle: string, chave: string) => {
    await cofre.gravar(chaveDaRaquete(idBle), chave);
    const ids = await lerJson<string[]>(armazenamentoApp, CHAVE_IDS_RAQUETES, []);
    if (!ids.includes(idBle)) await armazenamentoApp.gravar(CHAVE_IDS_RAQUETES, JSON.stringify([...ids, idBle]));
  }, []);

  const obterChaveRaquete = useCallback(
    async (idBle: string) => {
      try {
        const d = (await api.dispositivos()).find((x) => x.identificador === idBle);
        if (!d) return null;
        const { chave } = await api.chaveDispositivo(d.id);
        await guardarChaveRaquete(idBle, chave);
        return chave;
      } catch (e) {
        // Sem rede, usa a chave guardada da última vez; recusa da API (ex.: raquete bloqueada) não.
        if (e instanceof ErroRede) return cofre.ler(chaveDaRaquete(idBle));
        if (e instanceof ErroApi) return null;
        throw e;
      }
    },
    [api, guardarChaveRaquete]
  );

  const escolherPraticante = useCallback((id: string) => {
    setPraticanteAtivoId(id);
    void armazenamentoApp.gravar(CHAVE_PRATICANTE, id);
  }, []);

  const praticanteAtivo = praticantes.find((p) => p.id === praticanteAtivoId) ?? praticantes.find((p) => p.tipo === 'TITULAR') ?? null;

  const valor: Auth = {
    carregando,
    usuario,
    praticantes,
    praticanteAtivo,
    offline,
    pendentesSync,
    api,
    repositorio,
    fila,
    escolherPraticante,
    entrar,
    cadastrar,
    sair,
    recarregar,
    sincronizar,
    tokenAcesso: () => tokens.current?.accessToken || null,
    obterChaveRaquete,
    guardarChaveRaquete
  };

  return <AuthCtx.Provider value={valor}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return ctx;
}
