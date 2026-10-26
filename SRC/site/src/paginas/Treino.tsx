import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ErroApi } from '../api/cliente';
import type { ConteudoTreino, DetalheVersao, Ensaio, ErroValidacao, Marketplace, ResumoVersao } from '../api/tipos';
import { useSessao } from '../auth/Sessao';
import { EditorConteudo } from '../componentes/EditorConteudo';
import { Quadra } from '../componentes/Quadra';
import { Aviso, Campo, Chip, data, dataHora, Indicador, mensagemDeErro, minutos, NOME_STATUS, useCarregar } from '../componentes/ui';
import { acoesDaVersao } from '../treinos/acoes';

type Aba = 'conteudo' | 'ensaio' | 'marketplace' | 'estatisticas';

/** RF14–RF16 e RF20: edição, validação, ensaio, revisão, publicação e versões de um treino. */
export function Treino() {
  const { slug = '' } = useParams();
  const { api, conta } = useSessao();
  const [numero, setNumero] = useState<number | null>(null);
  const [aba, setAba] = useState<Aba>('conteudo');
  const [aviso, setAviso] = useState<{ tipo: 'erro' | 'ok'; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const base = useCarregar(async () => {
    const [versoes, meus] = await Promise.all([api.versoes(slug), api.meusTreinos()]);
    return { versoes, podeEditar: conta?.papel === 'ADMIN' || meus.some((t) => t.slug === slug) };
  }, [api, slug]);
  const versoes = base.dados?.versoes ?? [];
  const selecionada = numero ?? versoes[0]?.numero ?? null;

  const det = useCarregar(async () => (selecionada ? api.versao(slug, selecionada) : null), [api, slug, selecionada]);
  const v = det.dados;

  const [rascunho, setRascunho] = useState<{ conteudo: ConteudoTreino; notas: string; firmware: string } | null>(null);
  const [erros, setErros] = useState<ErroValidacao[]>([]);
  const [ensaio, setEnsaio] = useState<Ensaio | null>(null);
  useEffect(() => {
    setRascunho(v ? { conteudo: v.conteudo, notas: v.notasAlteracao ?? '', firmware: v.compatibilidadeFirmware ?? '' } : null);
    setErros([]);
    setEnsaio(null);
  }, [v]);

  if (base.erro) return <Aviso tipo="erro">{base.erro}</Aviso>;
  if (!base.dados || !v || !rascunho) return null;

  const acoes = acoesDaVersao({ status: v.status, origem: v.origem, podeEditar: base.dados.podeEditar, ehUltima: v.numero === versoes[0]?.numero });
  const editavel = acoes.includes('editar');
  const alterado =
    editavel &&
    (JSON.stringify(rascunho.conteudo) !== JSON.stringify(v.conteudo) ||
      rascunho.notas !== (v.notasAlteracao ?? '') ||
      rascunho.firmware !== (v.compatibilidadeFirmware ?? ''));

  async function executar(acao: () => Promise<unknown>, sucesso: string, depois?: () => Promise<void> | void) {
    setAviso(null);
    setOcupado(true);
    try {
      await acao();
      setAviso({ tipo: 'ok', texto: sucesso });
      await depois?.();
    } catch (e) {
      setAviso({ tipo: 'erro', texto: mensagemDeErro(e) });
      if (e instanceof ErroApi && Array.isArray(e.detalhes)) {
        setErros(e.detalhes as ErroValidacao[]);
        setAba('conteudo');
      }
    } finally {
      setOcupado(false);
    }
  }

  const recarregarTudo = async () => {
    await base.recarregar();
    await det.recarregar();
  };

  const salvar = () =>
    executar(
      () =>
        api.editarVersao(slug, v.numero, {
          conteudo: rascunho.conteudo,
          notasAlteracao: rascunho.notas || undefined,
          compatibilidadeFirmware: rascunho.firmware || undefined
        }),
      `Rascunho v${v.numero} salvo.`,
      det.recarregar
    );

  async function validar() {
    setAviso(null);
    setOcupado(true);
    try {
      const r = await api.validar(slug, v!.numero);
      setErros(r.erros);
      setAviso(r.valido ? { tipo: 'ok', texto: 'Nenhum problema encontrado. A versão pode ir para revisão.' } : { tipo: 'erro', texto: `${r.erros.length} problema(s) para corrigir, marcados nos campos.` });
      setAba('conteudo');
    } catch (e) {
      setAviso({ tipo: 'erro', texto: mensagemDeErro(e) });
    } finally {
      setOcupado(false);
    }
  }

  async function ensaiar() {
    setAviso(null);
    setOcupado(true);
    try {
      setEnsaio(await api.ensaiar(slug, v!.numero));
      setAba('ensaio');
    } catch (e) {
      setAviso({ tipo: 'erro', texto: mensagemDeErro(e) });
    } finally {
      setOcupado(false);
    }
  }

  const publicar = () => {
    const anterior = versoes.find((x) => x.status === 'PUBLICADA');
    const texto = anterior ? `Publicar a v${v.numero}? A v${anterior.numero} será arquivada e o app passa a baixar a nova.` : `Publicar a v${v.numero}? Ela aparece no catálogo do app.`;
    if (window.confirm(texto)) void executar(() => api.transicao(slug, v.numero, 'publicar'), `Versão ${v.numero} publicada.`, recarregarTudo);
  };

  const novaVersao = () =>
    executar(
      () => api.novaVersao(slug),
      'Nova versão criada como rascunho, copiada da mais recente.',
      async () => {
        setNumero(null);
        await recarregarTudo();
      }
    );

  return (
    <>
      <header className="cabecalho">
        <div>
          <div className="sobrelinha">
            <Link to="/treinos">Treinos</Link> / <span className="mono">{slug}</span>
          </div>
          <h1>{v.nome}</h1>
          <p className="nota" style={{ margin: '8px 0 0' }}>
            {v.autor && `por ${v.autor}`}
            {v.categoria && ` · ${v.categoria.nome}`}
            {v.origem === 'PLATAFORMA_MAE' && ' · importado da plataforma mãe (alterações só na origem)'}
          </p>
        </div>
      </header>

      <div className="treino-layout">
        <nav aria-label="Versões">
          <div className="sobrelinha">Versões</div>
          <Trilho versoes={versoes} atual={v.numero} escolher={setNumero} />
        </nav>

        <div>
          <div className="cartao">
            <div className="linha" style={{ justifyContent: 'space-between' }}>
              <div className="linha">
                <h2 className="mono" style={{ textTransform: 'none' }}>
                  v{v.numero}
                </h2>
                <Chip valor={v.status} rotulo={NOME_STATUS[v.status]} />
                <span className="nota">{v.publicadoEm ? `publicada em ${dataHora(v.publicadoEm)}` : `criada em ${dataHora(v.criadoEm)}`}</span>
              </div>
              <div className="linha">
                {acoes.includes('validar') && (
                  <button className="botao pequeno" disabled={ocupado || alterado} onClick={validar}>
                    Validar
                  </button>
                )}
                {acoes.includes('ensaiar') && (
                  <button className="botao pequeno" disabled={ocupado || alterado} onClick={ensaiar}>
                    Ensaiar
                  </button>
                )}
                {acoes.includes('enviarRevisao') && (
                  <button
                    className="botao pequeno"
                    disabled={ocupado || alterado}
                    onClick={() => executar(() => api.transicao(slug, v.numero, 'enviar-revisao'), 'Enviada para revisão. A edição fica bloqueada até devolver.', recarregarTudo)}
                  >
                    Enviar para revisão
                  </button>
                )}
                {acoes.includes('devolver') && (
                  <button
                    className="botao pequeno"
                    disabled={ocupado}
                    onClick={() => executar(() => api.transicao(slug, v.numero, 'devolver'), 'Versão devolvida para rascunho.', recarregarTudo)}
                  >
                    Devolver para rascunho
                  </button>
                )}
                {acoes.includes('publicar') && (
                  <button className="botao pequeno primario" disabled={ocupado} onClick={publicar}>
                    Publicar
                  </button>
                )}
                {acoes.includes('novaVersao') && (
                  <button className="botao pequeno" disabled={ocupado} onClick={novaVersao}>
                    Criar nova versão
                  </button>
                )}
              </div>
            </div>
            {alterado && <p className="nota" style={{ marginBottom: 0 }}>Salve as alterações para validar, ensaiar ou enviar para revisão.</p>}
            {v.status === 'EM_REVISAO' && <p className="nota" style={{ marginBottom: 0 }}>Em revisão: confira com Ensaiar e publique, ou devolva para ajustes.</p>}
          </div>

          {aviso && (
            <div style={{ marginTop: 16 }}>
              <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>
            </div>
          )}

          <div className="abas" role="tablist" style={{ marginTop: 24 }}>
            {(
              [
                ['conteudo', 'Conteúdo'],
                ['ensaio', 'Ensaio'],
                ['marketplace', 'Marketplace'],
                ['estatisticas', 'Uso no app']
              ] as const
            ).map(([id, rotulo]) => (
              <button key={id} role="tab" aria-selected={aba === id} onClick={() => setAba(id)}>
                {rotulo}
              </button>
            ))}
          </div>

          {aba === 'conteudo' && (
            <>
              <div className="grade grade-2" style={{ marginBottom: 32 }}>
                <Campo rotulo="Notas da versão" dica="O que mudou em relação à anterior.">
                  <input value={rascunho.notas} maxLength={500} disabled={!editavel} onChange={(e) => setRascunho({ ...rascunho, notas: e.target.value })} />
                </Campo>
                <Campo rotulo="Firmware mínimo da raquete" dica="Ex.: 1.1.0. Raquetes mais antigas não iniciam este treino.">
                  <input className="mono" value={rascunho.firmware} pattern="\d+(\.\d+){0,2}" disabled={!editavel} onChange={(e) => setRascunho({ ...rascunho, firmware: e.target.value })} />
                </Campo>
              </div>
              <EditorConteudo valor={rascunho.conteudo} aoMudar={(c) => setRascunho({ ...rascunho, conteudo: c })} desabilitado={!editavel} erros={erros} />
              {editavel && (
                <div className="barra-acoes">
                  <button className="botao primario" disabled={ocupado || !alterado} onClick={salvar}>
                    Salvar rascunho
                  </button>
                  {alterado && (
                    <button className="botao" onClick={() => setRascunho({ conteudo: v.conteudo, notas: v.notasAlteracao ?? '', firmware: v.compatibilidadeFirmware ?? '' })}>
                      Descartar alterações
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {aba === 'ensaio' && <PainelEnsaio ensaio={ensaio} ensaiar={acoes.includes('ensaiar') ? ensaiar : undefined} />}
          {aba === 'marketplace' && <PainelMarketplace detalhe={v} podeEditar={base.dados.podeEditar && v.origem === 'LOCAL'} aoSalvar={det.recarregar} />}
          {aba === 'estatisticas' && <PainelEstatisticas slug={slug} />}
        </div>
      </div>
    </>
  );
}

function Trilho({ versoes, atual, escolher }: { versoes: ResumoVersao[]; atual: number; escolher: (n: number) => void }) {
  return (
    <ol className="trilho">
      {versoes.map((x) => (
        <li key={x.numero} aria-current={x.numero === atual}>
          <button onClick={() => escolher(x.numero)}>
            <span className="marco">{x.numero}</span>
            <span>
              <Chip valor={x.status} rotulo={NOME_STATUS[x.status]} />
              <span className="data">{data(x.publicadoEm ?? x.criadoEm)}</span>
              {x.notasAlteracao && <span className="data">{x.notasAlteracao}</span>}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

/** RF15: linha do tempo da máquina e pontuação simulada, sem tempo real e sem raquete. */
function PainelEnsaio({ ensaio, ensaiar }: { ensaio: Ensaio | null; ensaiar?: () => void }) {
  if (!ensaio) {
    return (
      <div className="vazio">
        O ensaio simula a sequência da máquina e a pontuação com golpes de exemplo, sem lançar nenhuma bola.
        {ensaiar && (
          <div style={{ marginTop: 14 }}>
            <button className="botao primario" onClick={ensaiar}>
              Ensaiar esta versão
            </button>
          </div>
        )}
      </div>
    );
  }
  const r = ensaio.resumoExemplo;
  return (
    <div className="ensaio">
      <div>
        <Quadra lancamentos={ensaio.lancamentos} />
        <div className="legenda">
          <span>
            <i style={{ background: 'var(--primary)' }} />
            Forehand
          </span>
          <span>
            <i style={{ background: 'var(--bh)' }} />
            Backhand
          </span>
        </div>
      </div>
      <div>
        {ensaio.erros.length > 0 && <Aviso tipo="erro">Esta versão ainda tem {ensaio.erros.length} problema(s) de validação. O ensaio aplica os limites de operação mesmo assim.</Aviso>}
        <div className="grade grade-3" style={{ marginTop: ensaio.erros.length ? 16 : 0 }}>
          <Indicador valor={ensaio.lancamentos.length} rotulo="bolas lançadas" />
          <Indicador valor={minutos(ensaio.duracaoEstimadaSeg)} rotulo="tempo de máquina" />
          <Indicador valor={r.pontos.toLocaleString('pt-BR')} rotulo={`pontos no exemplo · ${r.precisao}% de precisão`} />
        </div>
        <h3 style={{ marginTop: 24 }}>Ordem dos lançamentos</h3>
        <div className={`trilha ${ensaio.lancamentos.length > 60 ? 'densa' : ''}`} aria-label="Golpe esperado em cada bola">
          {ensaio.lancamentos.map((l) => (
            <span key={l.seq} className={l.golpeEsperado} title={`${l.seq}: ${l.golpeEsperado} aos ${l.emSeg}s`}>
              {l.golpeEsperado === 'Forehand' ? 'F' : 'B'}
            </span>
          ))}
        </div>
        <div className="tabela-rolagem" style={{ marginTop: 20, maxHeight: 320, overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th className="num">Bola</th>
                <th className="num">Aos</th>
                <th>Exercício</th>
                <th>Golpe</th>
                <th className="num">km/h</th>
                <th>Rotação</th>
                <th>Direção</th>
              </tr>
            </thead>
            <tbody>
              {ensaio.lancamentos.map((l) => (
                <tr key={l.seq}>
                  <td className="num">{l.seq}</td>
                  <td className="num">{l.emSeg}s</td>
                  <td>{l.nomeExercicio}</td>
                  <td>{l.golpeEsperado}</td>
                  <td className="num">{l.velocidadeKmh}</td>
                  <td>{l.rotacao.toLowerCase()}</td>
                  <td>{{ ESQ: 'esquerda', CENTRO: 'centro', DIR: 'direita' }[l.direcao]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="nota">Velocidade e intervalo já aparecem com os limites de operação aplicados, como a máquina executaria.</p>
      </div>
    </div>
  );
}

const MKT_VAZIO: Marketplace = { descricaoComercial: '', licenca: 'CC_BY', modeloRemuneracao: 'GRATUITO', precoFuturoCentavos: null };

/** RF20: metadados para um marketplace futuro. Nada é cobrado nesta versão. */
function PainelMarketplace({ detalhe, podeEditar, aoSalvar }: { detalhe: DetalheVersao; podeEditar: boolean; aoSalvar: () => Promise<void> }) {
  const { api } = useSessao();
  const [m, setM] = useState<Marketplace>(detalhe.marketplace ?? MKT_VAZIO);
  const [aviso, setAviso] = useState<{ tipo: 'erro' | 'ok'; texto: string } | null>(null);

  async function salvar() {
    try {
      // Só os campos do DTO: o registro do banco traz treinoId e datas, que a API recusa.
      await api.marketplace(detalhe.slug, {
        descricaoComercial: m.descricaoComercial.trim(),
        licenca: m.licenca,
        modeloRemuneracao: m.modeloRemuneracao,
        precoFuturoCentavos: m.modeloRemuneracao === 'GRATUITO' ? undefined : (m.precoFuturoCentavos ?? undefined)
      });
      setAviso({ tipo: 'ok', texto: 'Dados de marketplace salvos.' });
      await aoSalvar();
    } catch (e) {
      setAviso({ tipo: 'erro', texto: mensagemDeErro(e) });
    }
  }

  return (
    <fieldset disabled={!podeEditar}>
      <p className="nota" style={{ marginTop: 0 }}>
        Preparação para venda ou compartilhamento futuro. Nenhuma cobrança acontece nesta versão do sistema.
      </p>
      <div className="grade grade-3">
        <Campo rotulo="Licença">
          <select value={m.licenca} onChange={(e) => setM({ ...m, licenca: e.target.value as Marketplace['licenca'] })}>
            <option value="CC_BY">CC BY (livre com atribuição)</option>
            <option value="USO_PESSOAL">Uso pessoal</option>
            <option value="PROPRIETARIA">Proprietária</option>
          </select>
        </Campo>
        <Campo rotulo="Modelo">
          <select value={m.modeloRemuneracao} onChange={(e) => setM({ ...m, modeloRemuneracao: e.target.value as Marketplace['modeloRemuneracao'] })}>
            <option value="GRATUITO">Gratuito</option>
            <option value="AVULSO">Compra avulsa</option>
            <option value="ASSINATURA">Assinatura</option>
          </select>
        </Campo>
        <Campo rotulo="Preço previsto (R$)" dica="Só referência; não é cobrado.">
          <input
            type="number"
            min={0}
            step={0.01}
            disabled={m.modeloRemuneracao === 'GRATUITO'}
            value={m.precoFuturoCentavos != null ? m.precoFuturoCentavos / 100 : ''}
            onChange={(e) => setM({ ...m, precoFuturoCentavos: e.target.value === '' ? null : Math.round(Number(e.target.value) * 100) })}
          />
        </Campo>
      </div>
      <div style={{ marginTop: 16 }}>
        <Campo rotulo="Descrição comercial" dica="De 10 a 1000 caracteres. Aparece no catálogo do app.">
          <textarea minLength={10} maxLength={1000} value={m.descricaoComercial} onChange={(e) => setM({ ...m, descricaoComercial: e.target.value })} />
        </Campo>
      </div>
      {aviso && (
        <div style={{ marginTop: 16 }}>
          <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>
        </div>
      )}
      {podeEditar && (
        <button className="botao primario" style={{ marginTop: 16 }} disabled={m.descricaoComercial.trim().length < 10} onClick={salvar}>
          Salvar marketplace
        </button>
      )}
    </fieldset>
  );
}

/** Estatísticas agregadas e anônimas (LGPD): o autor nunca vê quem treinou. */
function PainelEstatisticas({ slug }: { slug: string }) {
  const { api } = useSessao();
  const { dados, erro } = useCarregar(() => api.estatisticas(slug), [api, slug]);
  if (erro) return <Aviso tipo="erro">{erro}</Aviso>;
  if (!dados) return null;
  if (dados.praticantes === null) {
    return (
      <div className="vazio">
        {dados.sessoes} sessão(ões) registradas. {dados.aviso}
      </div>
    );
  }
  return (
    <>
      <div className="grade grade-4">
        <Indicador valor={dados.sessoes} rotulo="sessões com a raquete" />
        <Indicador valor={dados.praticantes} rotulo="praticantes" />
        <Indicador valor={dados.precisaoMedia} unidade="%" rotulo="precisão média" />
        <Indicador valor={dados.pontosMedios.toLocaleString('pt-BR')} rotulo="pontos por sessão" />
      </div>
      <p className="nota">
        Sessões por versão:{' '}
        {Object.entries(dados.sessoesPorVersao)
          .map(([n, q]) => `v${n}: ${q}`)
          .join(' · ')}
        . Agregados só aparecem com 3 praticantes ou mais, para ninguém ser identificado.
      </p>
    </>
  );
}
