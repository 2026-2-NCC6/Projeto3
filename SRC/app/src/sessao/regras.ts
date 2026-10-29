// Espelho de SRC/backend/src/pontuacao/regras.ts: o app calcula ao vivo (e offline) com as
// mesmas regras que a API usa no encerramento. Os testes de regras.test.ts são os mesmos do backend.
import type { ConteudoTreino, Lado } from '../api/tipos';

export type { Lado };
export type Forca = 1 | 2 | 3;

export type GolpeRegistrado = {
  /** segundos desde o início da sessão */
  t: number;
  lado: Lado;
  esperado: Lado;
  ok: boolean;
  forca: Forca;
};

export type RegrasPontuacao = {
  base: number;
  bonusSequencia: number;
  bonusForte: number;
  penalidadeErro: number;
  /** precisão mínima, em %, para a meta da sessão */
  metaPrecisao: number;
};

export const REGRAS_PADRAO: RegrasPontuacao = { base: 10, bonusSequencia: 5, bonusForte: 5, penalidadeErro: 0, metaPrecisao: 60 };

export type Conquista = 'PRIMEIRA_SESSAO' | 'SEQUENCIA_10' | 'META_PRECISAO' | 'RESISTENCIA';

export type ResumoCalculado = {
  duracaoSeg: number;
  golpes: number;
  acertos: number;
  precisao: number;
  pontos: number;
  sequenciaAtual: number;
  melhorSequencia: number;
  fortes: number;
  porLado: Record<Lado, { acertos: number; total: number }>;
  /** mesmo que porLado, mas contado pelo lado que o treino pediu */
  porLadoEsperado: Record<Lado, { acertos: number; total: number }>;
  /** força média (1–3) em cada quarto da sessão; 0 quando não houve golpe no quarto */
  quartisForca: [number, number, number, number];
  indiceResistencia: number;
  quedaEmSeg: number | null;
  /** 100 − coeficiente de variação da força, em % */
  consistencia: number;
  cadenciaSeg: number | null;
  metaPrecisao: number;
  metaAtingida: boolean;
};

export const LIMIAR_RESISTENCIA = 70;
const GOLPES_MIN_PARA_QUEDA = 8;
const GOLPES_MIN_RESISTENCIA = 20;

export function pontosDoGolpe(ok: boolean, sequencia: number, forca: Forca, regras: RegrasPontuacao = REGRAS_PADRAO) {
  if (!ok) return -regras.penalidadeErro;
  return regras.base + sequencia * regras.bonusSequencia + (forca === 3 ? regras.bonusForte : 0);
}

function media(arr: number[]) {
  return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
}

const arred1 = (n: number) => Math.round(n * 10) / 10;

/** Força recente comparada com a do início da sessão, em %. */
export function indiceResistencia(forcas: number[]) {
  const base = media(forcas.slice(0, Math.min(5, forcas.length)));
  const atual = media(forcas.slice(-6));
  const bruto = base > 0 ? (atual / base) * 100 : 100;
  return Math.max(0, Math.min(100, Math.round(bruto)));
}

function consistencia(forcas: number[]) {
  if (forcas.length === 0) return 0;
  const m = media(forcas);
  const desvio = Math.sqrt(media(forcas.map((f) => (f - m) ** 2)));
  return Math.max(0, Math.round(100 - (desvio / m) * 100));
}

function contadorPorLado(): ResumoCalculado['porLado'] {
  return { Forehand: { acertos: 0, total: 0 }, Backhand: { acertos: 0, total: 0 } };
}

export function resumirSessao(golpes: GolpeRegistrado[], duracaoSeg: number, regras: RegrasPontuacao = REGRAS_PADRAO): ResumoCalculado {
  let pontos = 0;
  let sequencia = 0;
  let melhor = 0;
  let quedaEmSeg: number | null = null;
  const porLado = contadorPorLado();
  const porLadoEsperado = contadorPorLado();
  const forcas: number[] = [];

  golpes.forEach((g) => {
    sequencia = g.ok ? sequencia + 1 : 0;
    melhor = Math.max(melhor, sequencia);
    pontos = Math.max(0, pontos + pontosDoGolpe(g.ok, sequencia, g.forca, regras));
    porLado[g.lado].total += 1;
    if (g.ok) porLado[g.lado].acertos += 1;
    porLadoEsperado[g.esperado].total += 1;
    if (g.ok) porLadoEsperado[g.esperado].acertos += 1;
    forcas.push(g.forca);
    if (quedaEmSeg === null && forcas.length >= GOLPES_MIN_PARA_QUEDA && indiceResistencia(forcas) < LIMIAR_RESISTENCIA) {
      quedaEmSeg = g.t;
    }
  });

  const duracao = Math.max(duracaoSeg, golpes.length ? golpes[golpes.length - 1].t : 0, 1);
  const quartos: number[][] = [[], [], [], []];
  golpes.forEach((g) => quartos[Math.min(3, Math.floor((g.t / duracao) * 4))].push(g.forca));

  const acertos = golpes.filter((g) => g.ok).length;
  const precisao = golpes.length ? Math.round((acertos / golpes.length) * 100) : 0;
  const intervalos = golpes.slice(1).map((g, i) => g.t - golpes[i].t);

  return {
    duracaoSeg,
    golpes: golpes.length,
    acertos,
    precisao,
    pontos,
    sequenciaAtual: sequencia,
    melhorSequencia: melhor,
    fortes: golpes.filter((g) => g.forca === 3).length,
    porLado,
    porLadoEsperado,
    quartisForca: quartos.map((q) => arred1(media(q))) as ResumoCalculado['quartisForca'],
    indiceResistencia: indiceResistencia(forcas),
    quedaEmSeg,
    consistencia: consistencia(forcas),
    cadenciaSeg: intervalos.length ? arred1(media(intervalos)) : null,
    metaPrecisao: regras.metaPrecisao,
    metaAtingida: golpes.length > 0 && precisao >= regras.metaPrecisao
  };
}

export function calcularConquistas(resumo: ResumoCalculado, contexto: { primeiraSessao: boolean }): Conquista[] {
  const conquistas: Conquista[] = [];
  if (contexto.primeiraSessao) conquistas.push('PRIMEIRA_SESSAO');
  if (resumo.melhorSequencia >= 10) conquistas.push('SEQUENCIA_10');
  if (resumo.metaAtingida) conquistas.push('META_PRECISAO');
  if (resumo.golpes >= GOLPES_MIN_RESISTENCIA && resumo.quedaEmSeg === null) conquistas.push('RESISTENCIA');
  return conquistas;
}

/** Lado esperado no golpe de número `indice`, ciclando a sequência expandida do treino. */
export function ladoEsperado(sequencia: Lado[], indice: number): Lado {
  return sequencia[indice % sequencia.length];
}

/** Golpes de exemplo para o ensaio de um treino (sem sensor). Determinístico, igual ao app. */
export function golpesDeExemplo(sequencia: Lado[], quantidade = 47, intervaloSeg = 4): GolpeRegistrado[] {
  return Array.from({ length: quantidade }, (_, i) => {
    const esperado = ladoEsperado(sequencia, i);
    const ok = (i * 7) % 10 < 7;
    const outro: Lado = esperado === 'Forehand' ? 'Backhand' : 'Forehand';
    return {
      t: (i + 1) * intervaloSeg,
      lado: ok ? esperado : outro,
      esperado,
      ok,
      forca: (i > quantidade * 0.7 ? 1 + (i % 2) : 2 + (i % 2)) as Forca
    };
  });
}

const LADO = { FH: 'Forehand', BH: 'Backhand' } as const;

/** Lado pedido em cada bola, na ordem dos exercícios (igual a maquina/plano.ts do backend). */
export function sequenciaEsperada(c: Pick<ConteudoTreino, 'exercicios'>): Lado[] {
  return c.exercicios.flatMap((ex) =>
    Array.from({ length: ex.repeticoes }, (_, r): Lado =>
      ex.golpeEsperado === 'ALTERNADO' ? (r % 2 === 0 ? 'Forehand' : 'Backhand') : LADO[ex.golpeEsperado]
    )
  );
}

/** Resumo calculado no aparelho: exibido ao vivo e quando a sessão termina sem conexão. */
export type ResumoSessao = ResumoCalculado & {
  treinoSlug: string;
  origem: 'sensor' | 'demo';
  terminadaEm: number;
};

export function mmss(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m < 10 ? '0' + m : m}:${r < 10 ? '0' + r : r}`;
}
