import { LIMITES_PADRAO } from '../treinos/conteudo';
import { conteudoValido } from '../treinos/conteudo.fixture';
import { Lancamento, expandirLancamentos } from './plano';
import { META_LATENCIA_EMERGENCIA_MS, Simulador } from './simulador';

function criar(repeticoes = 3, intervaloSeg = 2) {
  const c = conteudoValido();
  c.exercicios[0] = { ...c.exercicios[0], repeticoes, lancamento: { ...c.exercicios[0].lancamento, intervaloSeg } };
  const lancados: number[] = [];
  const eventos: string[] = [];
  const sim = new Simulador(expandirLancamentos(c, LIMITES_PADRAO), {
    aoLancar: (l: Lancamento) => lancados.push(l.seq),
    aoTerminar: () => eventos.push('fim'),
    aoParar: (motivo: string) => eventos.push(`parada:${motivo}`)
  });
  return { sim, lancados, eventos };
}

describe('Simulador da máquina lançadora (RF09)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('lança cada bola no intervalo configurado, em ordem', () => {
    const { sim, lancados } = criar();
    sim.iniciar();
    jest.advanceTimersByTime(1999);
    expect(lancados).toEqual([]);
    jest.advanceTimersByTime(1);
    expect(lancados).toEqual([1]);
    jest.advanceTimersByTime(4000);
    expect(lancados).toEqual([1, 2, 3]);
  });

  it('avisa quando a fila termina', () => {
    const { sim, eventos } = criar(2);
    sim.iniciar();
    jest.advanceTimersByTime(4000);
    expect(eventos).toEqual(['fim']);
    expect(sim.estado).toBe('CONCLUIDO');
  });

  it('pausar suspende sem perder a posição', () => {
    const { sim, lancados } = criar();
    sim.iniciar();
    jest.advanceTimersByTime(2000);
    sim.pausar();
    jest.advanceTimersByTime(10000);
    expect(lancados).toEqual([1]);
    sim.retomar();
    jest.advanceTimersByTime(2000);
    expect(lancados).toEqual([1, 2]);
  });

  it('nova instância continua de onde a sessão parou (reinício após parada segura)', () => {
    const { sim, lancados } = criar(3);
    sim.posicionar(2);
    sim.iniciar();
    jest.advanceTimersByTime(10000);
    expect(lancados).toEqual([3]);
  });
});

describe('parada de emergência (RF22, RNF Desempenho)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('cancela os lançamentos pendentes imediatamente', () => {
    const { sim, lancados, eventos } = criar();
    sim.iniciar();
    jest.advanceTimersByTime(2000);
    sim.parar('botao_emergencia');
    jest.advanceTimersByTime(60000);
    expect(lancados).toEqual([1]);
    expect(eventos).toEqual(['parada:botao_emergencia']);
    expect(sim.estado).toBe('PARADO');
  });

  it('mede a latência da parada dentro da meta', () => {
    const { sim } = criar();
    sim.iniciar();
    const { latenciaMs } = sim.parar('teste');
    expect(latenciaMs).toBeGreaterThanOrEqual(0);
    expect(latenciaMs).toBeLessThanOrEqual(META_LATENCIA_EMERGENCIA_MS);
  });

  it('depois de parado não aceita novos comandos', () => {
    const { sim, lancados } = criar();
    sim.iniciar();
    sim.parar('teste');
    expect(sim.retomar()).toBe(false);
    expect(sim.iniciar()).toBe(false);
    jest.advanceTimersByTime(60000);
    expect(lancados).toEqual([]);
  });
});
