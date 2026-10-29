import { FormEvent, useState } from 'react';
import type { Papel } from '../api/tipos';
import { useSessao } from '../auth/Sessao';
import { Aviso, Campo, Chip, dataHora, mensagemDeErro, useCarregar } from '../componentes/ui';

const ABAS = [
  ['usuarios', 'Usuários'],
  ['dispositivos', 'Raquetes'],
  ['categorias', 'Categorias'],
  ['parametros', 'Limites e retenção'],
  ['sessoes', 'Sessões'],
  ['auditoria', 'Auditoria'],
  ['integracao', 'Plataforma mãe']
] as const;
type Aba = (typeof ABAS)[number][0];

/** RF17 e RF23: gestão de usuários, raquetes, categorias, parâmetros, sessões, auditoria e integração. */
export function Admin() {
  const [aba, setAba] = useState<Aba>('usuarios');
  return (
    <>
      <header className="cabecalho">
        <div>
          <div className="sobrelinha">Toda alteração aqui fica na auditoria</div>
          <h1>Administração</h1>
        </div>
      </header>
      <div className="abas" role="tablist">
        {ABAS.map(([id, rotulo]) => (
          <button key={id} role="tab" aria-selected={aba === id} onClick={() => setAba(id)}>
            {rotulo}
          </button>
        ))}
      </div>
      {aba === 'usuarios' && <Usuarios />}
      {aba === 'dispositivos' && <Dispositivos />}
      {aba === 'categorias' && <Categorias />}
      {aba === 'parametros' && <Parametros />}
      {aba === 'sessoes' && <Sessoes />}
      {aba === 'auditoria' && <Auditoria />}
      {aba === 'integracao' && <Integracao />}
    </>
  );
}

/** Executa uma ação, mostra o resultado e recarrega a lista. */
function useAcao(recarregar: () => Promise<void>) {
  const [aviso, setAviso] = useState<{ tipo: 'erro' | 'ok'; texto: string } | null>(null);
  async function agir(acao: () => Promise<unknown>, ok: string) {
    setAviso(null);
    try {
      await acao();
      setAviso({ tipo: 'ok', texto: ok });
      await recarregar();
    } catch (e) {
      setAviso({ tipo: 'erro', texto: mensagemDeErro(e) });
    }
  }
  const quadro = aviso && (
    <div style={{ marginBottom: 16 }}>
      <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>
    </div>
  );
  return { agir, quadro };
}

function Usuarios() {
  const { api, conta } = useSessao();
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('');
  const { dados, erro, recarregar } = useCarregar(() => api.admin.usuarios(filtro || undefined), [api, filtro]);
  const { agir, quadro } = useAcao(recarregar);

  return (
    <>
      <form
        className="linha"
        style={{ marginBottom: 16 }}
        onSubmit={(e) => {
          e.preventDefault();
          setFiltro(busca.trim());
        }}
      >
        <input type="search" placeholder="Buscar por nome ou e-mail" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ maxWidth: 320 }} />
        <button className="botao">Buscar</button>
      </form>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {quadro}
      <div className="tabela-rolagem">
        <table>
          <thead>
            <tr>
              <th>Pessoa</th>
              <th>Papel</th>
              <th>Conta</th>
              <th>Criada</th>
            </tr>
          </thead>
          <tbody>
            {dados?.map((u) => {
              const eu = u.id === conta?.id;
              return (
                <tr key={u.id}>
                  <td>
                    {u.anonimizadoEm ? <span className="nota">conta excluída pelo titular</span> : u.nome}
                    <div className="nota">{u.email}</div>
                  </td>
                  <td>
                    <select
                      aria-label={`Papel de ${u.nome}`}
                      value={u.papel}
                      disabled={eu || !!u.anonimizadoEm}
                      onChange={(e) => agir(() => api.admin.atualizarUsuario(u.id, { papel: e.target.value as Papel }), `Papel de ${u.nome} alterado. Vale no próximo acesso, em até 15 minutos.`)}
                      style={{ width: 'auto' }}
                    >
                      <option value="JOGADOR">Jogador</option>
                      <option value="AUTOR">Autor</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </td>
                  <td>
                    {u.ativo ? 'Ativa' : <span className="delta-neg">Desativada</span>}{' '}
                    {!eu && !u.anonimizadoEm && (
                      <button className="botao pequeno" onClick={() => agir(() => api.admin.atualizarUsuario(u.id, { ativo: !u.ativo }), u.ativo ? 'Conta desativada. O login foi revogado e o acesso aberto expira em até 15 minutos.' : 'Conta reativada.')}>
                        {u.ativo ? 'Desativar' : 'Reativar'}
                      </button>
                    )}
                  </td>
                  <td>{dataHora(u.criadoEm)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="nota">Você não altera o próprio papel nem desativa a própria conta, para o sistema nunca ficar sem administrador.</p>
    </>
  );
}

function Dispositivos() {
  const { api } = useSessao();
  const { dados, erro, recarregar } = useCarregar(() => api.admin.dispositivos(), [api]);
  const { agir, quadro } = useAcao(recarregar);

  function alternar(id: string, nome: string, bloqueado: boolean) {
    const motivo = window.prompt(bloqueado ? `Motivo para desbloquear ${nome}:` : `Motivo para bloquear ${nome} (ex.: raquete perdida, firmware adulterado):`);
    if (!motivo?.trim()) return;
    void agir(() => api.admin.bloquear(id, !bloqueado, motivo.trim()), bloqueado ? `${nome} desbloqueada.` : `${nome} bloqueada: não inicia novas sessões.`);
  }

  return (
    <>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {quadro}
      <div className="tabela-rolagem">
        <table>
          <thead>
            <tr>
              <th>Raquete</th>
              <th>Dono</th>
              <th>Firmware</th>
              <th>Último contato</th>
              <th>Situação</th>
            </tr>
          </thead>
          <tbody>
            {dados?.map((d) => (
              <tr key={d.id}>
                <td>
                  {d.nomeBle}
                  <div className="nota mono">{d.identificador}</div>
                </td>
                <td>{d.conta.email}</td>
                <td className="mono">{d.firmwareVersao}</td>
                <td>{dataHora(d.ultimoContatoEm)}</td>
                <td>
                  {d.bloqueado ? <span className="delta-neg">Bloqueada</span> : 'Liberada'}{' '}
                  <button className={`botao pequeno ${d.bloqueado ? '' : 'perigo'}`} onClick={() => alternar(d.id, d.nomeBle, d.bloqueado)}>
                    {d.bloqueado ? 'Desbloquear' : 'Bloquear'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {dados?.length === 0 && <div className="vazio">Nenhuma raquete registrada. Elas aparecem quando alguém pareia pelo app.</div>}
    </>
  );
}

function Categorias() {
  const { api } = useSessao();
  const { dados, erro, recarregar } = useCarregar(() => api.categorias(), [api]);
  const { agir, quadro } = useAcao(recarregar);
  const [nova, setNova] = useState({ nome: '', slug: '' });

  function criar(e: FormEvent) {
    e.preventDefault();
    void agir(async () => {
      await api.admin.criarCategoria(nova);
      setNova({ nome: '', slug: '' });
    }, `Categoria ${nova.nome} criada.`);
  }

  return (
    <>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {quadro}
      <form className="grade grade-3 cartao" onSubmit={criar} style={{ alignItems: 'end', marginBottom: 20 }}>
        <Campo rotulo="Nome">
          <input required minLength={2} value={nova.nome} onChange={(e) => setNova({ ...nova, nome: e.target.value })} />
        </Campo>
        <Campo rotulo="Slug">
          <input required className="mono" pattern="[a-z0-9]+(-[a-z0-9]+)*" value={nova.slug} onChange={(e) => setNova({ ...nova, slug: e.target.value })} />
        </Campo>
        <button className="botao primario">Criar categoria</button>
      </form>
      <div className="tabela-rolagem">
        <table>
          <tbody>
            {dados?.map((c) => (
              <tr key={c.id}>
                <td>{c.nome}</td>
                <td className="mono">{c.slug}</td>
                <td className="num">
                  <button
                    className="botao pequeno perigo"
                    onClick={() => window.confirm(`Remover a categoria ${c.nome}? Os treinos dela ficam sem categoria.`) && agir(() => api.admin.removerCategoria(c.id), 'Categoria removida.')}
                  >
                    Remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

const PARAMETROS: Record<string, { rotulo: string; unidade: string; dica: string }> = {
  limite_velocidade_adulto_kmh: { rotulo: 'Velocidade máxima — adulto', unidade: 'km/h', dica: 'Teto aplicado pelo simulador mesmo em treinos já publicados.' },
  limite_velocidade_infantil_kmh: { rotulo: 'Velocidade máxima — infantil e todos', unidade: 'km/h', dica: 'Vale para treinos que dependentes menores podem fazer.' },
  intervalo_minimo_seg: { rotulo: 'Intervalo mínimo entre bolas', unidade: 's', dica: 'Tempo para o praticante se recuperar e para a parada de emergência agir.' },
  retencao_eventos_dias: { rotulo: 'Retenção dos golpes — titular', unidade: 'dias', dica: 'Depois disso os golpes são apagados e só o resumo fica (LGPD).' },
  retencao_eventos_dependente_dias: { rotulo: 'Retenção dos golpes — dependente', unidade: 'dias', dica: 'Prazo menor para dados de menores (LGPD).' }
};

function Parametros() {
  const { api } = useSessao();
  const { dados, erro, recarregar } = useCarregar(() => api.admin.parametros(), [api]);
  const { agir, quadro } = useAcao(recarregar);
  const [edicao, setEdicao] = useState<Record<string, string>>({});

  return (
    <>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {quadro}
      <div className="grade grade-2">
        {dados &&
          Object.entries(dados).map(([chave, valor]) => {
            const p = PARAMETROS[chave] ?? { rotulo: chave, unidade: '', dica: '' };
            const atual = edicao[chave] ?? String(valor);
            return (
              <form
                key={chave}
                className="cartao"
                style={{ margin: 0 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  void agir(() => api.admin.definirParametro(chave, Number(atual)), `${p.rotulo}: ${atual} ${p.unidade}.`);
                }}
              >
                <Campo rotulo={`${p.rotulo} (${p.unidade})`} dica={p.dica}>
                  <input type="number" step="any" min={0} value={atual} onChange={(e) => setEdicao({ ...edicao, [chave]: e.target.value })} />
                </Campo>
                <button className="botao pequeno" style={{ marginTop: 10 }} disabled={atual === String(valor)}>
                  Salvar
                </button>
              </form>
            );
          })}
      </div>
    </>
  );
}

function Sessoes() {
  const { api } = useSessao();
  const [estado, setEstado] = useState('');
  const { dados, erro } = useCarregar(() => api.admin.sessoes(estado || undefined), [api, estado]);
  return (
    <>
      <div className="linha" style={{ marginBottom: 16 }}>
        <select aria-label="Estado" value={estado} onChange={(e) => setEstado(e.target.value)} style={{ width: 'auto' }}>
          <option value="">Todos os estados</option>
          {['CRIADA', 'EM_EXECUCAO', 'PAUSADA', 'PARADA_SEGURA', 'ENCERRADA'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <div className="tabela-rolagem">
        <table>
          <thead>
            <tr>
              <th>Início</th>
              <th>Treino</th>
              <th>Estado</th>
              <th className="num">Golpes</th>
              <th className="num">Pontos</th>
              <th>Observações</th>
            </tr>
          </thead>
          <tbody>
            {dados?.map((s) => (
              <tr key={s.id}>
                <td>{dataHora(s.iniciadaEm)}</td>
                <td>
                  <span className="mono">{s.versao.treino.slug}</span> <span className="nota">v{s.versao.numero}</span>
                </td>
                <td>
                  <Chip valor={s.estado} />
                </td>
                <td className="num">{s.golpes ?? '—'}</td>
                <td className="num">{s.pontos ?? '—'}</td>
                <td className="nota">
                  {[s.origem === 'DEMO' && 'demonstração', s.offline && 'offline', s.divergencia && 'pontuação do app divergiu', s.motivoInterrupcao].filter(Boolean).join(' · ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="nota">Sem nome nem e-mail: para o suporte basta o estado da sessão (LGPD).</p>
    </>
  );
}

function Auditoria() {
  const { api } = useSessao();
  const [severidade, setSeveridade] = useState('');
  const [pagina, setPagina] = useState(1);
  const { dados, erro } = useCarregar(() => api.admin.auditoria({ severidade: severidade || undefined, pagina }), [api, severidade, pagina]);
  const paginas = dados ? Math.max(1, Math.ceil(dados.total / 50)) : 1;
  return (
    <>
      <div className="linha" style={{ marginBottom: 16 }}>
        <select
          aria-label="Severidade"
          value={severidade}
          onChange={(e) => {
            setSeveridade(e.target.value);
            setPagina(1);
          }}
          style={{ width: 'auto' }}
        >
          <option value="">Todos os registros</option>
          <option value="INCIDENTE">Só incidentes de segurança</option>
        </select>
        <span className="nota">{dados?.total ?? 0} registros</span>
      </div>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <div className="tabela-rolagem">
        <table>
          <thead>
            <tr>
              <th>Quando</th>
              <th>Ação</th>
              <th>Alvo</th>
              <th>Origem</th>
              <th>Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {dados?.itens.map((a) => (
              <tr key={a.id}>
                <td>{dataHora(a.ocorridoEm)}</td>
                <td>
                  <span className="mono">{a.acao}</span> {a.severidade === 'INCIDENTE' && <Chip valor="INCIDENTE" rotulo="incidente" />}
                </td>
                <td className="nota mono">{a.alvoTipo ? `${a.alvoTipo} ${a.alvoId?.slice(0, 8) ?? ''}` : '—'}</td>
                <td className="nota mono">{a.ip ?? '—'}</td>
                <td className="nota mono" style={{ maxWidth: 360, wordBreak: 'break-word' }}>
                  {a.detalhes ? JSON.stringify(a.detalhes) : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="linha" style={{ marginTop: 12 }}>
        <button className="botao pequeno" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>
          Anterior
        </button>
        <span className="nota">
          Página {pagina} de {paginas}
        </span>
        <button className="botao pequeno" disabled={pagina >= paginas} onClick={() => setPagina(pagina + 1)}>
          Próxima
        </button>
      </div>
    </>
  );
}

function Integracao() {
  const { api } = useSessao();
  const [status, setStatus] = useState('');
  const { dados, erro, recarregar } = useCarregar(() => api.admin.envios(status || undefined), [api, status]);
  const { agir, quadro } = useAcao(recarregar);

  async function importar() {
    const r = await api.admin.importarTreinos();
    return `Importação concluída: ${r.criados} novos, ${r.atualizados} atualizados, ${r.semMudanca} sem mudança${r.recusados.length ? `, ${r.recusados.length} recusados pela validação` : ''}.`;
  }

  const [resultadoImportacao, setResultadoImportacao] = useState<string | null>(null);

  return (
    <>
      <div className="linha" style={{ marginBottom: 16 }}>
        <select aria-label="Situação" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 'auto' }}>
          <option value="">Todos os envios</option>
          <option value="PENDENTE">Pendentes</option>
          <option value="FALHOU">Com falha</option>
          <option value="ENVIADO">Enviados</option>
        </select>
        <button className="botao pequeno" onClick={() => agir(() => api.admin.processar(), 'Ciclo de envio executado.')}>
          Enviar pendentes agora
        </button>
        <button
          className="botao pequeno"
          onClick={() =>
            agir(async () => {
              setResultadoImportacao(await importar());
            }, 'Treinos da plataforma mãe importados.')
          }
        >
          Importar treinos
        </button>
      </div>
      {quadro}
      {resultadoImportacao && <p className="nota">{resultadoImportacao}</p>}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <div className="tabela-rolagem">
        <table>
          <thead>
            <tr>
              <th>Criado</th>
              <th>Tipo</th>
              <th>Situação</th>
              <th className="num">Tentativas</th>
              <th>Último erro</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {dados?.map((e) => (
              <tr key={e.id}>
                <td>{dataHora(e.criadoEm)}</td>
                <td>{e.tipo === 'RESUMO' ? 'Resumo da sessão' : 'Golpes (telemetria)'}</td>
                <td>
                  <Chip valor={e.status} />
                  {e.status === 'PENDENTE' && e.proximaTentativaEm && <div className="nota">próxima: {dataHora(e.proximaTentativaEm)}</div>}
                </td>
                <td className="num">{e.tentativas}</td>
                <td className="nota">{e.ultimoErro ?? '—'}</td>
                <td className="num">
                  {e.status === 'FALHOU' && (
                    <button className="botao pequeno" onClick={() => agir(() => api.admin.reprocessar(e.id), 'Envio voltou para a fila.')}>
                      Reenviar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {dados?.length === 0 && <div className="vazio">Nenhum envio nesta situação.</div>}
    </>
  );
}
