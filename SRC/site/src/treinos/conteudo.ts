import type { ConteudoTreino, ErroValidacao } from '../api/tipos';

/** Mesma folga do servidor (validacao.ts): a duração pode ter pausas até o dobro do tempo de lançamentos. */
const FOLGA_DURACAO = 2;

/** Ponto de partida de um treino novo. Passa na validação do servidor com os limites padrão. */
export function conteudoPadrao(): ConteudoTreino {
  return {
    publicoAlvo: 'Adultos',
    objetivo: 'Consistência no fundo de quadra',
    nivel: 'INICIANTE',
    duracaoMin: 3,
    modoPublico: 'ADULTO',
    instrucoes: ['Volte ao centro da linha de base depois de cada golpe.'],
    equipamentos: ['Raquete instrumentada', 'Máquina lançadora', 'Bolas'],
    riscos: ['Aqueça ombros e punhos antes de começar.', 'Mantenha a área atrás da máquina livre.'],
    sensores: ['IMU'],
    pontuacao: { base: 10, bonusSequencia: 5, bonusForte: 5, penalidadeErro: 0, metaPrecisao: 60 },
    exercicios: [
      {
        nome: 'Forehand cruzado',
        repeticoes: 30,
        golpeEsperado: 'FH',
        lancamento: { velocidadeKmh: 50, rotacao: 'TOPSPIN', direcao: 'DIR', alturaM: 1.1, intervaloSeg: 4 }
      }
    ],
    feedbacks: { acerto: 'Tom agudo e vibração curta', erro: 'Tom grave e vibração dupla', sequencia: 'LED pisca na sequência' },
    conclusao: { tipo: 'REPETICOES', valor: 30 }
  };
}

export const paraLinhas = (itens: string[]) => itens.join('\n');
export const deLinhas = (texto: string) =>
  texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

export const totalLancamentos = (c: ConteudoTreino) => c.exercicios.reduce((a, ex) => a + ex.repeticoes, 0);

/** Faixa de duração aceita pelo servidor, para o autor ver antes de validar (RF15). */
export function faixaDuracao(c: ConteudoTreino, intervaloMinimoSeg: number) {
  const maquinaMin = c.exercicios.reduce((a, ex) => a + ex.repeticoes * Math.max(ex.lancamento.intervaloSeg, intervaloMinimoSeg), 0) / 60;
  return { maquinaMin, minimo: Math.ceil(maquinaMin), maximo: Math.max(1, Math.ceil(maquinaMin * FOLGA_DURACAO)) };
}

/** Busca os erros de um campo ou de tudo abaixo dele (`exercicios[0]` pega os do lançamento). */
export function errosPorCampo(erros: ErroValidacao[]) {
  return (campo: string) => erros.filter((e) => e.campo === campo || e.campo.startsWith(`${campo}.`) || e.campo.startsWith(`${campo}[`)).map((e) => e.mensagem);
}
