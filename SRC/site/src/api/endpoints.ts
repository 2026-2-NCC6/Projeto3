import type { ClienteApi } from './cliente';
import type {
  Categoria,
  Conta,
  ConteudoTreino,
  DetalheVersao,
  DispositivoAdmin,
  Ensaio,
  EnvioPlataforma,
  ErroValidacao,
  Estatisticas,
  Indicadores,
  Marketplace,
  Papel,
  RegistroAuditoria,
  RespostaAuth,
  ResumoVersao,
  SessaoAdmin,
  SessaoHistorico,
  TreinoDaAutoria,
  UsuarioAdmin
} from './tipos';

const qs = (f: Record<string, string | number | undefined>) => {
  const p = Object.entries(f).filter(([, v]) => v !== undefined && v !== '');
  return p.length ? `?${p.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')}` : '';
};

export function criarEndpoints(api: ClienteApi) {
  const dados = <T>(p: Promise<{ dados: T }>) => p.then((r) => r.dados);
  const versao = (slug: string, n: number) => `/treinos/${encodeURIComponent(slug)}/versoes/${n}`;

  return {
    login: (email: string, senha: string) => dados(api.requisitar<RespostaAuth>('POST', '/auth/login', { corpo: { email, senha }, publico: true })),
    logout: (refreshToken: string) => api.requisitar('POST', '/auth/logout', { corpo: { refreshToken }, publico: true }),
    conta: () => dados(api.requisitar<Conta>('GET', '/me')),

    // RF13: consulta de resultados
    historico: (praticanteId: string, f: { de?: string; limite?: number }) =>
      dados(api.requisitar<SessaoHistorico[]>('GET', `/praticantes/${praticanteId}/sessoes${qs(f)}`)),
    indicadores: (praticanteId: string, f: { de?: string }) => dados(api.requisitar<Indicadores>('GET', `/praticantes/${praticanteId}/indicadores${qs(f)}`)),

    // RF14–RF16, RF20: autoria
    categorias: () => dados(api.requisitar<Categoria[]>('GET', '/categorias')),
    meusTreinos: () => dados(api.requisitar<TreinoDaAutoria[]>('GET', '/autoria/treinos')),
    criarTreino: (t: { slug: string; nome: string; categoriaSlug?: string; conteudo: ConteudoTreino; notasAlteracao?: string; compatibilidadeFirmware?: string }) =>
      dados(api.requisitar<{ slug: string; versao: ResumoVersao }>('POST', '/treinos', { corpo: t })),
    versoes: (slug: string) => dados(api.requisitar<ResumoVersao[]>('GET', `/treinos/${encodeURIComponent(slug)}/versoes`)),
    versao: (slug: string, n: number) => dados(api.requisitar<DetalheVersao>('GET', versao(slug, n))),
    editarVersao: (slug: string, n: number, v: { conteudo?: ConteudoTreino; notasAlteracao?: string; compatibilidadeFirmware?: string }) =>
      dados(api.requisitar<DetalheVersao>('PATCH', versao(slug, n), { corpo: v })),
    novaVersao: (slug: string) => dados(api.requisitar<ResumoVersao>('POST', `/treinos/${encodeURIComponent(slug)}/versoes`)),
    validar: (slug: string, n: number) => dados(api.requisitar<{ valido: boolean; erros: ErroValidacao[] }>('POST', `${versao(slug, n)}/validar`)),
    ensaiar: (slug: string, n: number) => dados(api.requisitar<Ensaio>('POST', `${versao(slug, n)}/ensaiar`)),
    transicao: (slug: string, n: number, acao: 'enviar-revisao' | 'devolver' | 'publicar') =>
      dados(api.requisitar<ResumoVersao>('POST', `${versao(slug, n)}/${acao}`)),
    marketplace: (slug: string, m: Marketplace) => dados(api.requisitar<Marketplace>('PUT', `/treinos/${encodeURIComponent(slug)}/marketplace`, { corpo: m })),
    estatisticas: (slug: string) => dados(api.requisitar<Estatisticas>('GET', `/treinos/${encodeURIComponent(slug)}/estatisticas`)),

    // RF17, RF23: administração
    admin: {
      usuarios: (busca?: string) => dados(api.requisitar<UsuarioAdmin[]>('GET', `/admin/usuarios${qs({ busca, limite: 100 })}`)),
      atualizarUsuario: (id: string, u: { papel?: Papel; ativo?: boolean }) => dados(api.requisitar<UsuarioAdmin>('PATCH', `/admin/usuarios/${id}`, { corpo: u })),
      criarCategoria: (c: { nome: string; slug: string }) => dados(api.requisitar<Categoria>('POST', '/admin/categorias', { corpo: c })),
      removerCategoria: (id: string) => api.requisitar('DELETE', `/admin/categorias/${id}`),
      dispositivos: () => dados(api.requisitar<DispositivoAdmin[]>('GET', '/admin/dispositivos')),
      bloquear: (id: string, bloqueado: boolean, motivo: string) =>
        dados(api.requisitar<DispositivoAdmin>('POST', `/admin/dispositivos/${id}/bloqueio`, { corpo: { bloqueado, motivo } })),
      parametros: () => dados(api.requisitar<Record<string, number>>('GET', '/admin/parametros')),
      definirParametro: (chave: string, valor: number) => api.requisitar('PUT', `/admin/parametros/${encodeURIComponent(chave)}`, { corpo: { valor } }),
      sessoes: (estado?: string) => dados(api.requisitar<SessaoAdmin[]>('GET', `/admin/sessoes${qs({ estado, limite: 100 })}`)),
      auditoria: (f: { severidade?: string; acao?: string; pagina?: number }) =>
        dados(api.requisitar<{ total: number; pagina: number; itens: RegistroAuditoria[] }>('GET', `/admin/auditoria${qs({ ...f, limite: 50 })}`)),
      envios: (status?: string) => dados(api.requisitar<EnvioPlataforma[]>('GET', `/admin/integracao/envios${qs({ status })}`)),
      reprocessar: (id: string) => api.requisitar('POST', `/admin/integracao/envios/${id}/reprocessar`),
      processar: () => api.requisitar('POST', '/admin/integracao/processar'),
      importarTreinos: () => dados(api.requisitar<{ criados: number; atualizados: number; semMudanca: number; recusados: { idExterno: string; erros: unknown }[] }>('POST', '/admin/integracao/importar-treinos'))
    }
  };
}

export type Endpoints = ReturnType<typeof criarEndpoints>;
