import { useState } from 'react';
import { useSessao } from '../auth/Sessao';
import { Aviso, Chip, dataHora, Indicador, minutos, useCarregar } from '../componentes/ui';

const PERIODOS = [7, 30, 90] as const;
const DIA_MS = 86_400_000;

/** RF13: sessões e indicadores do praticante (titular ou dependente) por período. */
export function Resultados() {
  const { api, conta } = useSessao();
  const praticantes = conta?.praticantes ?? [];
  const [praticanteId, setPraticanteId] = useState(praticantes.find((p) => p.tipo === 'TITULAR')?.id ?? praticantes[0]?.id);
  const [dias, setDias] = useState<(typeof PERIODOS)[number]>(30);

  const { dados, erro, carregando } = useCarregar(async () => {
    if (!praticanteId) return null;
    const de = new Date(Date.now() - dias * DIA_MS).toISOString();
    const [indicadores, sessoes] = await Promise.all([api.indicadores(praticanteId, { de }), api.historico(praticanteId, { de, limite: 100 })]);
    return { indicadores, sessoes };
  }, [api, praticanteId, dias]);

  const ind = dados?.indicadores;

  return (
    <>
      <header className="cabecalho">
        <div>
          <div className="sobrelinha">Consulta de resultados</div>
          <h1>Resultados</h1>
        </div>
        <div className="linha">
          {praticantes.length > 1 && (
            <select aria-label="Praticante" value={praticanteId} onChange={(e) => setPraticanteId(e.target.value)} style={{ width: 'auto' }}>
              {praticantes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.apelido}
                  {p.tipo === 'DEPENDENTE' ? ' (dependente)' : ''}
                </option>
              ))}
            </select>
          )}
          <div className="linha" role="group" aria-label="Período">
            {PERIODOS.map((d) => (
              <button key={d} className={`botao pequeno ${d === dias ? 'primario' : ''}`} aria-pressed={d === dias} onClick={() => setDias(d)}>
                {d} dias
              </button>
            ))}
          </div>
        </div>
      </header>

      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {!praticanteId && <div className="vazio">Esta conta não tem praticantes. Os resultados aparecem aqui depois das sessões feitas no app.</div>}

      {ind && (
        <div className="grade grade-4">
          <Indicador valor={ind.sessoes} rotulo="sessões com a raquete" />
          <Indicador valor={ind.precisao} unidade="%" rotulo="precisão" delta={ind.progressao?.precisaoDelta} />
          <Indicador valor={ind.consistencia} unidade="%" rotulo="consistência da força" />
          <Indicador valor={Math.round(ind.tempoSeg / 60)} unidade="min" rotulo={`treinados · ${ind.volume} golpes`} />
        </div>
      )}
      {ind?.progressao && (
        <p className="nota">
          Progressão comparada às 5 sessões anteriores ao período: precisão {ind.progressao.precisaoDelta >= 0 ? '+' : ''}
          {ind.progressao.precisaoDelta} p.p., pontos {ind.progressao.pontosDelta >= 0 ? '+' : ''}
          {ind.progressao.pontosDelta}.
        </p>
      )}

      {praticanteId && (
      <section className="secao">
        <h2>Sessões</h2>
        {!carregando && dados?.sessoes.length === 0 && <div className="vazio">Nenhuma sessão nos últimos {dias} dias. As sessões feitas no app aparecem aqui.</div>}
        {!!dados?.sessoes.length && (
          <div className="tabela-rolagem">
            <table>
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Treino</th>
                  <th>Estado</th>
                  <th className="num">Duração</th>
                  <th className="num">Golpes</th>
                  <th className="num">Precisão</th>
                  <th className="num">Pontos</th>
                </tr>
              </thead>
              <tbody>
                {dados.sessoes.map((s) => (
                  <tr key={s.id}>
                    <td>{dataHora(s.encerradaEm ?? s.iniciadaEm)}</td>
                    <td>
                      {s.treino.nome} <span className="nota mono">v{s.treino.versao}</span>
                      {s.origem === 'DEMO' && <span className="nota"> · demonstração</span>}
                      {s.offline && <span className="nota"> · sincronizada depois</span>}
                    </td>
                    <td>
                      <Chip valor={s.estado} />
                      {s.motivoInterrupcao && <div className="nota">{s.motivoInterrupcao.replaceAll('_', ' ')}</div>}
                    </td>
                    <td className="num">{minutos(s.duracaoSeg)}</td>
                    <td className="num">{s.golpes ?? '—'}</td>
                    <td className="num">{s.resumo ? `${s.resumo.precisao}%` : '—'}</td>
                    <td className="num">{s.pontos?.toLocaleString('pt-BR') ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="nota">Demonstrações ficam fora dos indicadores.</p>
      </section>
      )}
    </>
  );
}
