import type { Nivel } from '../pontuacao/analise';
import type { RegrasPontuacao } from '../pontuacao/regras';

// Estrutura de `treino_versao.conteudo`. Cobre os campos que a §3 do edital exige em todo treino:
// público-alvo, objetivo, nível, duração, regras de pontuação, sequência de exercícios,
// parâmetros da máquina e sensores necessários.

export type ModoPublico = 'INFANTIL' | 'ADULTO' | 'TODOS';
export type Sensor = 'IMU' | 'PIEZO';
export type GolpeEsperado = 'FH' | 'BH' | 'ALTERNADO';
export type Rotacao = 'TOPSPIN' | 'SLICE' | 'PLANO';
export type Direcao = 'ESQ' | 'CENTRO' | 'DIR';

export type ParametrosLancamento = {
  velocidadeKmh: number;
  rotacao: Rotacao;
  direcao: Direcao;
  alturaM: number;
  intervaloSeg: number;
};

export type Exercicio = {
  nome: string;
  repeticoes: number;
  golpeEsperado: GolpeEsperado;
  lancamento: ParametrosLancamento;
};

export type ConteudoTreino = {
  publicoAlvo: string;
  objetivo: string;
  nivel: Nivel;
  duracaoMin: number;
  modoPublico: ModoPublico;
  instrucoes: string[];
  equipamentos: string[];
  riscos: string[];
  sensores: Sensor[];
  pontuacao: RegrasPontuacao;
  exercicios: Exercicio[];
  feedbacks: { acerto: string; erro: string; sequencia: string };
  conclusao: { tipo: 'TEMPO' | 'REPETICOES'; valor: number };
  tutorial?: {
    golpes: { lado: 'FH' | 'BH'; alvo: string; arco: number }[];
    segPorBola: number;
    passos: string[];
  };
};

export type LimitesOperacao = {
  velocidadeAdultoKmh: number;
  velocidadeInfantilKmh: number;
  intervaloMinimoSeg: number;
};

export const LIMITES_PADRAO: LimitesOperacao = { velocidadeAdultoKmh: 120, velocidadeInfantilKmh: 50, intervaloMinimoSeg: 1.5 };

/** Treinos que podem ser feitos por crianças usam o limite infantil (TODOS inclui crianças). */
export function limiteVelocidade(modo: ModoPublico, limites: LimitesOperacao) {
  return modo === 'ADULTO' ? limites.velocidadeAdultoKmh : limites.velocidadeInfantilKmh;
}
