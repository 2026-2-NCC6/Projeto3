import type { Nivel, Treino } from '../data/treinos';

export type Lado = 'Forehand' | 'Backhand';

export type GolpeRegistrado = {
  /** segundos desde o início da sessão */
  t: number;
  lado: Lado;
  esperado: Lado;
  ok: boolean;
  forca: 1 | 2 | 3;
};

export type ResumoSessao = {
  treinoId: string;
  origem: 'sensor' | 'demo';
  terminadaEm: number;
  duracaoSeg: number;
  golpes: number;
  acertos: number;
  pontos: number;
  sequenciaAtual: number;
  melhorSequencia: number;
  fortes: number;
  porLado: Record<Lado, { acertos: number; total: number }>;
  /** força média (1–3) em cada quarto da sessão; 0 quando não houve golpe no quarto */
  quartisForca: [number, number, number, number];
  indiceResistencia: number;
  quedaEmSeg: number | null;
};

export const LIMIAR_RESISTENCIA = 70;
const GOLPES_MIN_PARA_QUEDA = 8;

export const META_POR_NIVEL: Record<Nivel, number> = { Iniciante: 40, Intermediário: 60, Avançado: 75 };

const LADO: Record<'FH' | 'BH', Lado> = { FH: 'Forehand', BH: 'Backhand' };

/** Lado que o exercício pede no golpe de número `indice` (0, 1, 2...), seguindo a sequência do tutorial. */
export function ladoEsperado(treino: Treino, indice: number): Lado {
  const seqTutorial = treino.tutorial.golpes;
  return LADO[seqTutorial[indice % seqTutorial.length].lado];
}

export function pontosDoGolpe(ok: boolean, sequencia: number, forca: 1 | 2 | 3) {
  if (!ok) return 0;
  return 10 + sequencia * 5 + (forca === 3 ? 5 : 0);
}

function media(arr: number[]) {
  return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
}

/** Força recente comparada com a do início da sessão, em %. */
export function indiceResistencia(forcas: number[]) {
  const base = media(forcas.slice(0, Math.min(5, forcas.length)));
  const atual = media(forcas.slice(-6));
  const bruto = base > 0 ? (atual / base) * 100 : 100;
  return Math.max(0, Math.min(100, Math.round(bruto)));
}

export function resumirSessao(
  treinoId: string,
  golpes: GolpeRegistrado[],
  duracaoSeg: number,
  origem: 'sensor' | 'demo'
): ResumoSessao {
  let pontos = 0;
  let sequencia = 0;
  let melhor = 0;
  let quedaEmSeg: number | null = null;
  const porLado: ResumoSessao['porLado'] = {
    Forehand: { acertos: 0, total: 0 },
    Backhand: { acertos: 0, total: 0 }
  };
  const forcas: number[] = [];

  golpes.forEach((g) => {
    sequencia = g.ok ? sequencia + 1 : 0;
    melhor = Math.max(melhor, sequencia);
    pontos += pontosDoGolpe(g.ok, sequencia, g.forca);
    porLado[g.lado].total += 1;
    if (g.ok) porLado[g.lado].acertos += 1;
    forcas.push(g.forca);
    if (quedaEmSeg === null && forcas.length >= GOLPES_MIN_PARA_QUEDA && indiceResistencia(forcas) < LIMIAR_RESISTENCIA) {
      quedaEmSeg = g.t;
    }
  });

  const duracao = Math.max(duracaoSeg, golpes.length ? golpes[golpes.length - 1].t : 0, 1);
  const quartos: number[][] = [[], [], [], []];
  golpes.forEach((g) => quartos[Math.min(3, Math.floor((g.t / duracao) * 4))].push(g.forca));

  return {
    treinoId,
    origem,
    terminadaEm: Date.now(),
    duracaoSeg,
    golpes: golpes.length,
    acertos: golpes.filter((g) => g.ok).length,
    pontos,
    sequenciaAtual: sequencia,
    melhorSequencia: melhor,
    fortes: golpes.filter((g) => g.forca === 3).length,
    porLado,
    quartisForca: quartos.map((q) => Math.round(media(q) * 10) / 10) as ResumoSessao['quartisForca'],
    indiceResistencia: indiceResistencia(forcas),
    quedaEmSeg
  };
}

/** Golpes de exemplo para o modo demonstração (sem sensor). Determinístico. */
export function golpesDeExemplo(treino: Treino, quantidade = 47, intervaloSeg = 4): GolpeRegistrado[] {
  return Array.from({ length: quantidade }, (_, i) => {
    const esperado = ladoEsperado(treino, i);
    const ok = (i * 7) % 10 < 7;
    const outro: Lado = esperado === 'Forehand' ? 'Backhand' : 'Forehand';
    return {
      t: (i + 1) * intervaloSeg,
      lado: ok ? esperado : outro,
      esperado,
      ok,
      forca: (i > quantidade * 0.7 ? 1 + (i % 2) : 2 + (i % 2)) as 1 | 2 | 3
    };
  });
}

export function mmss(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m < 10 ? '0' + m : m}:${r < 10 ? '0' + r : r}`;
}
