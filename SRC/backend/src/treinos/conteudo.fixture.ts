import type { ConteudoTreino } from './conteudo';

/** Conteúdo mínimo que passa na validação. Usado só em testes. */
export function conteudoValido(): ConteudoTreino {
  return {
    publicoAlvo: 'Adultos',
    objetivo: 'Consistência',
    nivel: 'INTERMEDIARIO',
    duracaoMin: 1,
    modoPublico: 'ADULTO',
    instrucoes: ['Bata na diagonal.'],
    equipamentos: ['Raquete instrumentada'],
    riscos: ['Aqueça antes.'],
    sensores: ['IMU'],
    pontuacao: { base: 10, bonusSequencia: 5, bonusForte: 5, penalidadeErro: 0, metaPrecisao: 60 },
    exercicios: [
      {
        nome: 'Cruzado',
        repeticoes: 10,
        golpeEsperado: 'FH',
        lancamento: { velocidadeKmh: 70, rotacao: 'TOPSPIN', direcao: 'ESQ', alturaM: 1.2, intervaloSeg: 4 }
      }
    ],
    feedbacks: { acerto: 'LED verde', erro: 'LED vermelho', sequencia: 'Animação' },
    conclusao: { tipo: 'REPETICOES', valor: 10 }
  };
}
