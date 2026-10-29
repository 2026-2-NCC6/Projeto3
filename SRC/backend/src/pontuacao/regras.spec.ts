import { GolpeRegistrado, Lado, REGRAS_PADRAO, calcularConquistas, golpesDeExemplo, resumirSessao } from './regras';

const golpe = (t: number, lado: Lado, esperado: Lado, forca: 1 | 2 | 3 = 2): GolpeRegistrado => ({
  t,
  lado,
  esperado,
  ok: lado === esperado,
  forca
});

// Mesmos casos de SRC/app/src/sessao/regras.test.ts: app e API precisam calcular igual.
describe('resumirSessao (paridade com o app)', () => {
  it('FH quando o treino pede BH conta como erro', () => {
    const r = resumirSessao([golpe(2, 'Forehand', 'Forehand'), golpe(4, 'Forehand', 'Backhand')], 10);
    expect(r.acertos).toBe(1);
    expect(r.golpes).toBe(2);
    expect(r.porLado.Forehand).toEqual({ acertos: 1, total: 2 });
    expect(r.porLado.Backhand).toEqual({ acertos: 0, total: 0 });
  });

  it('pontos crescem com a sequência e zeram no erro', () => {
    const r = resumirSessao(
      [golpe(1, 'Forehand', 'Forehand'), golpe(2, 'Forehand', 'Forehand', 3), golpe(3, 'Backhand', 'Forehand'), golpe(4, 'Forehand', 'Forehand')],
      5
    );
    // 10+5, 10+10+5 (forte), 0, 10+5
    expect(r.pontos).toBe(15 + 25 + 0 + 15);
    expect(r.melhorSequencia).toBe(2);
    expect(r.sequenciaAtual).toBe(1);
    expect(r.fortes).toBe(1);
  });

  it('sessão vazia', () => {
    const r = resumirSessao([], 0);
    expect(r.golpes).toBe(0);
    expect(r.pontos).toBe(0);
    expect(r.quedaEmSeg).toBeNull();
    expect(r.quartisForca).toEqual([0, 0, 0, 0]);
  });

  it('queda de resistência é detectada quando a força cai', () => {
    const golpes = [3, 3, 3, 3, 3, 1, 1, 1, 1, 1, 1].map((f, i) => golpe(i * 10, 'Forehand', 'Forehand', f as 1 | 2 | 3));
    const r = resumirSessao(golpes, 110);
    expect(r.quedaEmSeg).not.toBeNull();
    expect(r.quartisForca[0]).toBeGreaterThan(r.quartisForca[3]);
  });

  it('golpes de exemplo são consistentes', () => {
    const g = golpesDeExemplo(['Forehand', 'Backhand']);
    expect(g).toHaveLength(47);
    expect(g.every((x) => x.ok === (x.lado === x.esperado))).toBe(true);
  });
});

describe('regras parametrizadas pela versão do treino (RF10)', () => {
  it('penalidade desconta pontos no erro sem deixar o total negativo', () => {
    const regras = { ...REGRAS_PADRAO, penalidadeErro: 20 };
    const r = resumirSessao([golpe(1, 'Backhand', 'Forehand'), golpe(2, 'Forehand', 'Forehand'), golpe(3, 'Backhand', 'Forehand')], 3, regras);
    // 0 (piso), +15, -15 → 0
    expect(r.pontos).toBe(0);
  });

  it('usa base e bônus definidos no treino', () => {
    const regras = { ...REGRAS_PADRAO, base: 2, bonusSequencia: 1, bonusForte: 10 };
    const r = resumirSessao([golpe(1, 'Forehand', 'Forehand', 3)], 1, regras);
    expect(r.pontos).toBe(2 + 1 + 10);
  });

  it('meta atingida quando a precisão alcança a meta do treino', () => {
    const golpes = [golpe(1, 'Forehand', 'Forehand'), golpe(2, 'Forehand', 'Forehand'), golpe(3, 'Backhand', 'Forehand')];
    expect(resumirSessao(golpes, 3, { ...REGRAS_PADRAO, metaPrecisao: 60 }).metaAtingida).toBe(true);
    expect(resumirSessao(golpes, 3, { ...REGRAS_PADRAO, metaPrecisao: 70 }).metaAtingida).toBe(false);
  });
});

describe('indicadores da sessão (RF13)', () => {
  it('consistência é 100 quando a força não varia', () => {
    const r = resumirSessao([1, 2, 3].map((t) => golpe(t, 'Forehand', 'Forehand', 2)), 3);
    expect(r.consistencia).toBe(100);
  });

  it('consistência cai com força dispersa', () => {
    const r = resumirSessao([1, 3, 1, 3].map((f, i) => golpe(i, 'Forehand', 'Forehand', f as 1 | 3)), 4);
    expect(r.consistencia).toBe(50);
  });

  it('cadência é o intervalo médio entre golpes', () => {
    const r = resumirSessao([golpe(2, 'Forehand', 'Forehand'), golpe(6, 'Forehand', 'Forehand'), golpe(8, 'Forehand', 'Forehand')], 10);
    expect(r.cadenciaSeg).toBe(3);
  });

  it('cadência é nula com menos de dois golpes', () => {
    expect(resumirSessao([golpe(2, 'Forehand', 'Forehand')], 10).cadenciaSeg).toBeNull();
  });
});

describe('conquistas (RF10)', () => {
  const base = resumirSessao([golpe(1, 'Forehand', 'Forehand')], 1);

  it('primeira sessão do praticante', () => {
    expect(calcularConquistas(base, { primeiraSessao: true })).toContain('PRIMEIRA_SESSAO');
    expect(calcularConquistas(base, { primeiraSessao: false })).not.toContain('PRIMEIRA_SESSAO');
  });

  it('sequência de 10 acertos', () => {
    const r = resumirSessao(Array.from({ length: 10 }, (_, i) => golpe(i, 'Forehand', 'Forehand')), 10);
    expect(calcularConquistas(r, { primeiraSessao: false })).toEqual(expect.arrayContaining(['SEQUENCIA_10', 'META_PRECISAO']));
  });

  it('resistência exige 20 golpes sem queda', () => {
    const r = resumirSessao(Array.from({ length: 20 }, (_, i) => golpe(i, 'Forehand', 'Backhand')), 20);
    expect(calcularConquistas(r, { primeiraSessao: false })).toEqual(['RESISTENCIA']);
  });
});
