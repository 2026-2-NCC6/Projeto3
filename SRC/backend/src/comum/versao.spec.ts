import { versaoAtende } from './versao';

describe('versaoAtende (compatibilidade de firmware, RNF IoT)', () => {
  it.each([
    ['1.0.0', '1.0.0', true],
    ['1.2.0', '1.10.0', false],
    ['1.10.0', '1.2.0', true],
    ['2.0', '1.9.9', true],
    ['1.0', '1.0.1', false],
    ['v1.3.0', '1.3.0', true]
  ])('firmware %s atende mínimo %s: %s', (atual, minimo, esperado) => {
    expect(versaoAtende(atual, minimo)).toBe(esperado);
  });

  it('versão ilegível nunca atende', () => {
    expect(versaoAtende('desconhecida', '1.0.0')).toBe(false);
  });
});
