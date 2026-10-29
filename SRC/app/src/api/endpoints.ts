import type { ClienteApi } from './cliente';
import type {
  ComandoSessao,
  Conta,
  Dispositivo,
  EventoCliente,
  FaixaEtaria,
  Indicadores,
  Nivel,
  Praticante,
  RespostaAuth,
  Sessao,
  SessaoHistorico,
  TreinoDetalhe,
  TreinoResumo
} from './tipos';

/** Funções tipadas para cada rota usada pelo app. */
export function criarEndpoints(api: ClienteApi) {
  const dados = async <T>(p: Promise<{ dados: T }>) => (await p).dados;
  const qs = (p: Record<string, string | number | undefined>) => {
    const pares = Object.entries(p).filter(([, v]) => v !== undefined && v !== '');
    return pares.length ? `?${pares.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')}` : '';
  };

  return {
    login: (email: string, senha: string) => dados(api.requisitar<RespostaAuth>('POST', '/auth/login', { corpo: { email, senha }, publico: true })),
    cadastrar: (c: { email: string; senha: string; nome: string; faixaEtaria: FaixaEtaria; nivel: Nivel; termosVersao: string }) =>
      dados(api.requisitar<RespostaAuth>('POST', '/auth/cadastro', { corpo: { ...c, declaraMaioridade: true }, publico: true })),
    logout: (refreshToken: string) => api.requisitar('POST', '/auth/logout', { corpo: { refreshToken }, publico: true }),
    conta: () => dados(api.requisitar<Conta>('GET', '/me')),
    exportarDados: () => dados(api.requisitar<unknown>('GET', '/me/exportar')),
    excluirConta: (senha: string) => api.requisitar('DELETE', '/me', { corpo: { senha } }),

    praticantes: () => dados(api.requisitar<Praticante[]>('GET', '/praticantes')),
    atualizarPraticante: (id: string, p: Partial<Pick<Praticante, 'apelido' | 'nivel' | 'faixaEtaria' | 'objetivos' | 'restricoes' | 'consenteTelemetria'>>) =>
      dados(api.requisitar<Praticante>('PATCH', `/praticantes/${id}`, { corpo: p })),
    criarDependente: (d: { apelido: string; faixaEtaria: FaixaEtaria; nivel: Nivel; consentimentoParental: boolean; consenteTelemetria: boolean }) =>
      dados(api.requisitar<Praticante>('POST', '/praticantes/dependentes', { corpo: d })),
    removerPraticante: (id: string) => api.requisitar('DELETE', `/praticantes/${id}`),
    historico: (praticanteId: string, f: { de?: string; ate?: string; treino?: string; limite?: number } = {}) =>
      dados(api.requisitar<SessaoHistorico[]>('GET', `/praticantes/${praticanteId}/sessoes${qs(f)}`)),
    indicadores: (praticanteId: string, f: { de?: string; ate?: string; treino?: string } = {}) =>
      dados(api.requisitar<Indicadores>('GET', `/praticantes/${praticanteId}/indicadores${qs(f)}`)),

    catalogo: (f: { nivel?: Nivel; modoPublico?: string; duracaoMax?: number; sensor?: string } = {}) =>
      dados(api.requisitar<TreinoResumo[]>('GET', `/treinos${qs(f)}`)),
    /** Com `etag`, a API responde 304 (`null`) quando a versão guardada ainda é a publicada. */
    treino: async (slug: string, etag?: string) => {
      const r = await api.requisitar<TreinoDetalhe | null>('GET', `/treinos/${encodeURIComponent(slug)}`, { cabecalhos: etag ? { 'If-None-Match': etag } : {} });
      return { treino: r.dados, etag: r.cabecalhos.get('etag') ?? etag ?? null, naoMudou: r.status === 304 };
    },

    dispositivos: () => dados(api.requisitar<Dispositivo[]>('GET', '/dispositivos')),
    registrarDispositivo: (d: { nomeBle: string; identificador: string; firmwareVersao: string; chave: string }) =>
      dados(api.requisitar<Dispositivo>('POST', '/dispositivos', { corpo: d })),
    chaveDispositivo: (id: string) => dados(api.requisitar<{ chave: string }>('GET', `/dispositivos/${id}/chave`)),
    statusDispositivo: (id: string, s: { conectado: boolean; sensores: { imu: 'OK' | 'FALHA' | 'AUSENTE' }; firmwareVersao?: string }) =>
      api.requisitar('PUT', `/dispositivos/${id}/status`, { corpo: s }),

    criarSessao: (s: { id: string; praticanteId: string; treinoSlug: string; versaoNumero?: number; dispositivoId?: string; origem: 'SENSOR' | 'DEMO' }) =>
      dados(api.requisitar<Sessao>('POST', '/sessoes', { corpo: s })),
    comando: (id: string, c: { comando: ComandoSessao; motivo?: string; areaSegura?: boolean; pontosCliente?: number }) =>
      dados(api.requisitar<Sessao>('POST', `/sessoes/${id}/comandos`, { corpo: c })),
    enviarEventos: (id: string, eventos: EventoCliente[]) =>
      dados(api.requisitar<{ aceitos: number; duplicados: number; estado: string; parcial: { pontos: number; golpes: number; acertos: number } }>(
        'POST',
        `/sessoes/${id}/eventos`,
        { corpo: { eventos } }
      )),
    sincronizar: (corpo: SincronizacaoOffline) => dados(api.requisitar<Sessao>('POST', '/sessoes/sincronizar', { corpo }))
  };
}

export type Endpoints = ReturnType<typeof criarEndpoints>;

export type SincronizacaoOffline = {
  sessao: {
    id: string;
    praticanteId: string;
    treinoSlug: string;
    versaoNumero: number;
    dispositivoId?: string;
    origem: 'SENSOR' | 'DEMO';
    iniciadaEm: string;
    encerradaEm: string;
    motivoInterrupcao?: string;
    pontosCliente?: number;
  };
  eventos: EventoCliente[];
};
