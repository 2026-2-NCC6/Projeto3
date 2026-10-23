import { golpesDosEventos } from './golpes';

const evento = (tMs: number, lado: 'Forehand' | 'Backhand', extra: { acertoAlvo?: boolean; forca?: 1 | 2 | 3 } = {}) => ({
  tMs,
  dados: { lado, forca: extra.forca ?? 2, picoG: 3, picoGiro: 9, seq: 1, ...(extra.acertoAlvo === undefined ? {} : { acertoAlvo: extra.acertoAlvo }) }
});

describe('golpesDosEventos', () => {
  it('compara cada golpe com o lado pedido na mesma posição da sequência', () => {
    const g = golpesDosEventos([evento(1000, 'Forehand'), evento(2000, 'Forehand')], ['Forehand', 'Backhand']);
    expect(g.map((x) => [x.esperado, x.ok])).toEqual([
      ['Forehand', true],
      ['Backhand', false]
    ]);
  });

  it('cicla a sequência quando há mais golpes que bolas', () => {
    const g = golpesDosEventos([evento(1, 'Forehand'), evento(2, 'Backhand'), evento(3, 'Forehand')], ['Forehand', 'Backhand']);
    expect(g[2].esperado).toBe('Forehand');
  });

  it('alvo piezo não atingido invalida o acerto mesmo com o lado certo', () => {
    const g = golpesDosEventos([evento(1000, 'Forehand', { acertoAlvo: false }), evento(2000, 'Forehand', { acertoAlvo: true })], ['Forehand']);
    expect(g.map((x) => x.ok)).toEqual([false, true]);
  });

  it('converte o instante para segundos e preserva a força', () => {
    const [g] = golpesDosEventos([evento(2500, 'Forehand', { forca: 3 })], ['Forehand']);
    expect(g).toMatchObject({ t: 2.5, forca: 3, lado: 'Forehand' });
  });
});
