import type { Lado } from '../pontuacao/regras';
import { ConteudoTreino, Direcao, Exercicio, LimitesOperacao, Rotacao, limiteVelocidade } from '../treinos/conteudo';

export type Lancamento = {
  seq: number;
  exercicio: number;
  nomeExercicio: string;
  velocidadeKmh: number;
  rotacao: Rotacao;
  direcao: Direcao;
  alturaM: number;
  intervaloSeg: number;
  golpeEsperado: Lado;
};

const LADO = { FH: 'Forehand', BH: 'Backhand' } as const;

function ladoDaRepeticao(ex: Exercicio, r: number): Lado {
  return ex.golpeEsperado === 'ALTERNADO' ? (r % 2 === 0 ? 'Forehand' : 'Backhand') : LADO[ex.golpeEsperado];
}

/**
 * Fila de lançamentos que o simulador executa. Os limites de operação são reaplicados aqui
 * mesmo que a versão já tenha passado na validação (RNF Segurança física).
 */
export function expandirLancamentos(c: ConteudoTreino, limites: LimitesOperacao): Lancamento[] {
  const teto = limiteVelocidade(c.modoPublico, limites);
  let seq = 0;
  return c.exercicios.flatMap((ex, exercicio) =>
    Array.from({ length: ex.repeticoes }, (_, r) => ({
      seq: ++seq,
      exercicio,
      nomeExercicio: ex.nome,
      velocidadeKmh: Math.min(ex.lancamento.velocidadeKmh, teto),
      rotacao: ex.lancamento.rotacao,
      direcao: ex.lancamento.direcao,
      alturaM: ex.lancamento.alturaM,
      intervaloSeg: Math.max(ex.lancamento.intervaloSeg, limites.intervaloMinimoSeg),
      golpeEsperado: ladoDaRepeticao(ex, r)
    }))
  );
}

/** Lado pedido em cada bola, na ordem. O golpe de índice i é comparado com o item i (ciclando). */
export function sequenciaEsperada(c: ConteudoTreino): Lado[] {
  return c.exercicios.flatMap((ex) =>
    Array.from({ length: ex.repeticoes }, (_, r) => ladoDaRepeticao(ex, r))
  );
}

export function focoLado(c: ConteudoTreino): Lado | null {
  const lados = new Set(sequenciaEsperada(c));
  return lados.size === 1 ? [...lados][0] : null;
}
