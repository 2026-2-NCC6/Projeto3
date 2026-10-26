import { useEffect, useState } from 'react';
import type { ConteudoTreino, ErroValidacao, Exercicio, Sensor } from '../api/tipos';
import { deLinhas, errosPorCampo, faixaDuracao, paraLinhas, totalLancamentos } from '../treinos/conteudo';
import { Campo, NOME_MODO, NOME_NIVEL } from './ui';

/** Intervalo mínimo padrão do servidor; a validação real usa o parâmetro vigente (RF15). */
const INTERVALO_MINIMO_PADRAO = 1.5;

type Props = { valor: ConteudoTreino; aoMudar: (c: ConteudoTreino) => void; desabilitado?: boolean; erros?: ErroValidacao[] };

function ListaTexto({ valor, aoMudar, desabilitado }: { valor: string[]; aoMudar: (v: string[]) => void; desabilitado?: boolean }) {
  // O texto cru fica local para o autor poder digitar linhas em branco no meio da edição.
  const [texto, setTexto] = useState(paraLinhas(valor));
  useEffect(() => {
    if (JSON.stringify(deLinhas(texto)) !== JSON.stringify(valor)) setTexto(paraLinhas(valor));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);
  return (
    <textarea
      value={texto}
      disabled={desabilitado}
      onChange={(e) => {
        setTexto(e.target.value);
        aoMudar(deLinhas(e.target.value));
      }}
    />
  );
}

const numero = (v: string) => (v === '' ? 0 : Number(v));

export function EditorConteudo({ valor: c, aoMudar, desabilitado, erros = [] }: Props) {
  const e = errosPorCampo(erros);
  const mudar = <K extends keyof ConteudoTreino>(k: K, v: ConteudoTreino[K]) => aoMudar({ ...c, [k]: v });
  const mudarExercicio = (i: number, ex: Exercicio) => mudar('exercicios', c.exercicios.map((x, j) => (j === i ? ex : x)));
  const faixa = faixaDuracao(c, INTERVALO_MINIMO_PADRAO);
  const total = totalLancamentos(c);

  return (
    <fieldset disabled={desabilitado}>
      <section className="secao" style={{ marginTop: 0 }}>
        <h2>Para quem é</h2>
        <div className="grade grade-2">
          <Campo rotulo="Público-alvo" erros={e('publicoAlvo')}>
            <input value={c.publicoAlvo} maxLength={120} onChange={(x) => mudar('publicoAlvo', x.target.value)} />
          </Campo>
          <Campo rotulo="Objetivo" erros={e('objetivo')}>
            <input value={c.objetivo} maxLength={200} onChange={(x) => mudar('objetivo', x.target.value)} />
          </Campo>
          <Campo rotulo="Nível">
            <select value={c.nivel} onChange={(x) => mudar('nivel', x.target.value as ConteudoTreino['nivel'])}>
              {Object.entries(NOME_NIVEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Modo" dica="Infantil e Todos usam o limite de velocidade infantil." erros={e('modoPublico')}>
            <select value={c.modoPublico} onChange={(x) => mudar('modoPublico', x.target.value as ConteudoTreino['modoPublico'])}>
              {Object.entries(NOME_MODO).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Campo>
          <Campo
            rotulo="Duração estimada (min)"
            erros={e('duracaoMin')}
            dica={faixa.maquinaMin > 0 ? `A máquina lança por ${faixa.maquinaMin.toFixed(1)} min; use entre ${faixa.minimo} e ${faixa.maximo}.` : undefined}
          >
            <input type="number" min={1} max={240} value={c.duracaoMin} onChange={(x) => mudar('duracaoMin', numero(x.target.value))} />
          </Campo>
          <Campo rotulo="Sensores necessários" erros={e('sensores')}>
            <div className="linha" style={{ paddingTop: 6 }}>
              {(['IMU', 'PIEZO'] as Sensor[]).map((s) => (
                <label key={s} className="linha" style={{ gap: 6, color: 'var(--text)' }}>
                  <input
                    type="checkbox"
                    checked={c.sensores.includes(s)}
                    onChange={() => mudar('sensores', c.sensores.includes(s) ? c.sensores.filter((x) => x !== s) : [...c.sensores, s])}
                  />
                  {s === 'IMU' ? 'IMU (movimento)' : 'Piezo (impacto no alvo)'}
                </label>
              ))}
            </div>
          </Campo>
        </div>
      </section>

      <section className="secao">
        <div className="linha" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
          <h2>Sequência da máquina</h2>
          <span className="nota">{total} bolas no total</span>
        </div>
        {e('exercicios').length > 0 && !c.exercicios.length && <p className="erro-campo">{e('exercicios').join(' ')}</p>}
        {c.exercicios.map((ex, i) => {
          const l = ex.lancamento;
          const p = `exercicios[${i}].lancamento`;
          const mudarL = (k: keyof Exercicio['lancamento'], v: number | string) => mudarExercicio(i, { ...ex, lancamento: { ...l, [k]: v } });
          return (
            <div className="exercicio" key={i}>
              <div className="grade grade-4">
                <Campo rotulo={`Exercício ${i + 1}`}>
                  <input value={ex.nome} maxLength={80} onChange={(x) => mudarExercicio(i, { ...ex, nome: x.target.value })} />
                </Campo>
                <Campo rotulo="Bolas">
                  <input type="number" min={1} max={500} value={ex.repeticoes} onChange={(x) => mudarExercicio(i, { ...ex, repeticoes: numero(x.target.value) })} />
                </Campo>
                <Campo rotulo="Golpe esperado">
                  <select value={ex.golpeEsperado} onChange={(x) => mudarExercicio(i, { ...ex, golpeEsperado: x.target.value as Exercicio['golpeEsperado'] })}>
                    <option value="FH">Forehand</option>
                    <option value="BH">Backhand</option>
                    <option value="ALTERNADO">Alternado</option>
                  </select>
                </Campo>
                <Campo rotulo="Direção">
                  <select value={l.direcao} onChange={(x) => mudarL('direcao', x.target.value)}>
                    <option value="ESQ">Esquerda</option>
                    <option value="CENTRO">Centro</option>
                    <option value="DIR">Direita</option>
                  </select>
                </Campo>
                <Campo rotulo="Velocidade (km/h)" erros={e(`${p}.velocidadeKmh`)}>
                  <input type="number" min={1} max={250} value={l.velocidadeKmh} onChange={(x) => mudarL('velocidadeKmh', numero(x.target.value))} />
                </Campo>
                <Campo rotulo="Rotação">
                  <select value={l.rotacao} onChange={(x) => mudarL('rotacao', x.target.value)}>
                    <option value="TOPSPIN">Topspin</option>
                    <option value="SLICE">Slice</option>
                    <option value="PLANO">Plano</option>
                  </select>
                </Campo>
                <Campo rotulo="Altura (m)" erros={e(`${p}.alturaM`)}>
                  <input type="number" step={0.1} min={0} max={10} value={l.alturaM} onChange={(x) => mudarL('alturaM', numero(x.target.value))} />
                </Campo>
                <Campo rotulo="Intervalo (s)" erros={e(`${p}.intervaloSeg`)}>
                  <input type="number" step={0.5} min={0} max={120} value={l.intervaloSeg} onChange={(x) => mudarL('intervaloSeg', numero(x.target.value))} />
                </Campo>
              </div>
              {c.exercicios.length > 1 && (
                <button type="button" className="botao pequeno perigo" style={{ marginTop: 12 }} onClick={() => mudar('exercicios', c.exercicios.filter((_, j) => j !== i))}>
                  Remover exercício
                </button>
              )}
            </div>
          );
        })}
        <button
          type="button"
          className="botao pequeno"
          style={{ marginTop: 12 }}
          disabled={c.exercicios.length >= 50}
          onClick={() => mudar('exercicios', [...c.exercicios, structuredClone(c.exercicios[c.exercicios.length - 1] ?? NOVO_EXERCICIO)])}
        >
          Adicionar exercício
        </button>
      </section>

      <section className="secao">
        <h2>Pontuação e conclusão</h2>
        <div className="grade grade-4">
          <Campo rotulo="Pontos por acerto" erros={e('pontuacao')}>
            <input type="number" min={0} value={c.pontuacao.base} onChange={(x) => mudar('pontuacao', { ...c.pontuacao, base: numero(x.target.value) })} />
          </Campo>
          <Campo rotulo="Bônus por sequência">
            <input type="number" min={0} value={c.pontuacao.bonusSequencia} onChange={(x) => mudar('pontuacao', { ...c.pontuacao, bonusSequencia: numero(x.target.value) })} />
          </Campo>
          <Campo rotulo="Bônus golpe forte">
            <input type="number" min={0} value={c.pontuacao.bonusForte} onChange={(x) => mudar('pontuacao', { ...c.pontuacao, bonusForte: numero(x.target.value) })} />
          </Campo>
          <Campo rotulo="Penalidade por erro" erros={e('pontuacao.penalidadeErro')}>
            <input type="number" min={0} value={c.pontuacao.penalidadeErro} onChange={(x) => mudar('pontuacao', { ...c.pontuacao, penalidadeErro: numero(x.target.value) })} />
          </Campo>
          <Campo rotulo="Meta de precisão (%)" erros={e('pontuacao.metaPrecisao')}>
            <input type="number" min={0} max={100} value={c.pontuacao.metaPrecisao} onChange={(x) => mudar('pontuacao', { ...c.pontuacao, metaPrecisao: numero(x.target.value) })} />
          </Campo>
          <Campo rotulo="Termina por">
            <select value={c.conclusao.tipo} onChange={(x) => mudar('conclusao', { ...c.conclusao, tipo: x.target.value as 'TEMPO' | 'REPETICOES' })}>
              <option value="REPETICOES">Repetições</option>
              <option value="TEMPO">Tempo</option>
            </select>
          </Campo>
          <Campo rotulo={c.conclusao.tipo === 'TEMPO' ? 'Segundos' : 'Golpes'} erros={e('conclusao')}>
            <input type="number" min={1} value={c.conclusao.valor} onChange={(x) => mudar('conclusao', { ...c.conclusao, valor: numero(x.target.value) })} />
          </Campo>
        </div>
      </section>

      <section className="secao">
        <h2>Segurança e orientação</h2>
        <p className="nota" style={{ marginTop: -6 }}>
          Um item por linha. O app mostra tudo isso antes de liberar a sessão.
        </p>
        <div className="grade grade-3">
          <Campo rotulo="Riscos e cuidados" erros={e('riscos')}>
            <ListaTexto valor={c.riscos} aoMudar={(v) => mudar('riscos', v)} desabilitado={desabilitado} />
          </Campo>
          <Campo rotulo="Equipamentos" erros={e('equipamentos')}>
            <ListaTexto valor={c.equipamentos} aoMudar={(v) => mudar('equipamentos', v)} desabilitado={desabilitado} />
          </Campo>
          <Campo rotulo="Instruções" erros={e('instrucoes')}>
            <ListaTexto valor={c.instrucoes} aoMudar={(v) => mudar('instrucoes', v)} desabilitado={desabilitado} />
          </Campo>
        </div>
      </section>

      <section className="secao">
        <h2>Feedback na raquete</h2>
        <div className="grade grade-3">
          <Campo rotulo="Acerto">
            <input value={c.feedbacks.acerto} maxLength={120} onChange={(x) => mudar('feedbacks', { ...c.feedbacks, acerto: x.target.value })} />
          </Campo>
          <Campo rotulo="Erro">
            <input value={c.feedbacks.erro} maxLength={120} onChange={(x) => mudar('feedbacks', { ...c.feedbacks, erro: x.target.value })} />
          </Campo>
          <Campo rotulo="Sequência">
            <input value={c.feedbacks.sequencia} maxLength={120} onChange={(x) => mudar('feedbacks', { ...c.feedbacks, sequencia: x.target.value })} />
          </Campo>
        </div>
      </section>
    </fieldset>
  );
}

const NOVO_EXERCICIO: Exercicio = {
  nome: 'Novo exercício',
  repeticoes: 10,
  golpeEsperado: 'FH',
  lancamento: { velocidadeKmh: 50, rotacao: 'TOPSPIN', direcao: 'CENTRO', alturaM: 1.1, intervaloSeg: 4 }
};
