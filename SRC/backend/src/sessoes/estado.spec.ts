import { ESTADOS, EstadoSessao, GATILHOS, Gatilho, transicao } from './estado';

// Transições da máquina de estados da sessão (RF06, RF22).
const VALIDAS: [EstadoSessao, Gatilho, EstadoSessao][] = [
  ['CRIADA', 'INICIAR', 'EM_EXECUCAO'],
  ['EM_EXECUCAO', 'PAUSAR', 'PAUSADA'],
  ['PAUSADA', 'RETOMAR', 'EM_EXECUCAO'],
  ['EM_EXECUCAO', 'ENCERRAR', 'ENCERRADA'],
  ['PAUSADA', 'ENCERRAR', 'ENCERRADA'],
  ['CRIADA', 'EMERGENCIA', 'PARADA_SEGURA'],
  ['EM_EXECUCAO', 'EMERGENCIA', 'PARADA_SEGURA'],
  ['PAUSADA', 'EMERGENCIA', 'PARADA_SEGURA'],
  ['EM_EXECUCAO', 'FALHA_SENSOR', 'PARADA_SEGURA'],
  ['PAUSADA', 'FALHA_SENSOR', 'PARADA_SEGURA'],
  ['EM_EXECUCAO', 'CONEXAO_PERDIDA', 'PAUSADA'],
  ['PARADA_SEGURA', 'REINICIAR', 'PAUSADA']
];

describe('máquina de estados da sessão (RF06, RF22)', () => {
  it.each(VALIDAS)('%s --%s--> %s', (de, gatilho, para) => {
    expect(transicao(de, gatilho)).toBe(para);
  });

  const invalidas = ESTADOS.flatMap((e) => GATILHOS.map((g) => [e, g] as const)).filter(
    ([e, g]) => !VALIDAS.some(([de, gat]) => de === e && gat === g)
  );

  it.each(invalidas)('%s rejeita %s', (de, gatilho) => {
    expect(transicao(de, gatilho)).toBeNull();
  });

  it('parada segura só aceita reiniciar', () => {
    const aceitos = GATILHOS.filter((g) => transicao('PARADA_SEGURA', g) !== null);
    expect(aceitos).toEqual(['REINICIAR']);
  });

  it('encerrada é final', () => {
    expect(GATILHOS.filter((g) => transicao('ENCERRADA', g) !== null)).toEqual([]);
  });
});
