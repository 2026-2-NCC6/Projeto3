import { TreinoCatalogo, agregarIndicadores, recomendar } from './analise';
import { GolpeRegistrado, Lado, resumirSessao } from './regras';

const golpe = (t: number, lado: Lado, esperado: Lado, forca: 1 | 2 | 3 = 2): GolpeRegistrado => ({ t, lado, esperado, ok: lado === esperado, forca });

const catalogo: TreinoCatalogo[] = [
  { slug: 'atual', nome: 'Atual', nivel: 'INTERMEDIARIO', duracaoMin: 20, focoLado: null },
  { slug: 'bh-int', nome: 'Backhand intermediário', nivel: 'INTERMEDIARIO', duracaoMin: 18, focoLado: 'Backhand' },
  { slug: 'curto-int', nome: 'Curto intermediário', nivel: 'INTERMEDIARIO', duracaoMin: 10, focoLado: null },
  { slug: 'avancado', nome: 'Avançado', nivel: 'AVANCADO', duracaoMin: 25, focoLado: null }
];

describe('recomendar (RF12)', () => {
  it('sugere treino focado no lado com precisão abaixo de 50%', () => {
    const golpes = [
      ...Array.from({ length: 5 }, (_, i) => golpe(i, 'Forehand', 'Backhand')),
      ...Array.from({ length: 5 }, (_, i) => golpe(10 + i, 'Forehand', 'Forehand'))
    ];
    const recs = recomendar(resumirSessao(golpes, 20), { nivel: 'INTERMEDIARIO', treinoAtual: 'atual', catalogo });
    expect(recs).toContainEqual(expect.objectContaining({ tipo: 'REFORCAR_LADO', treinoSlug: 'bh-int' }));
  });

  it('ignora lado com menos de 5 golpes', () => {
    const golpes = [golpe(1, 'Forehand', 'Backhand'), golpe(2, 'Forehand', 'Forehand')];
    const recs = recomendar(resumirSessao(golpes, 2), { nivel: 'INTERMEDIARIO', treinoAtual: 'atual', catalogo });
    expect(recs.find((r) => r.tipo === 'REFORCAR_LADO')).toBeUndefined();
  });

  it('sugere treino mais curto quando há queda de resistência', () => {
    const golpes = [3, 3, 3, 3, 3, 1, 1, 1, 1, 1, 1].map((f, i) => golpe(i * 10, 'Forehand', 'Forehand', f as 1 | 2 | 3));
    const recs = recomendar(resumirSessao(golpes, 110), { nivel: 'INTERMEDIARIO', treinoAtual: 'atual', catalogo });
    expect(recs).toContainEqual(expect.objectContaining({ tipo: 'REDUZIR_CARGA', treinoSlug: 'curto-int' }));
  });

  it('sugere o nível acima quando a meta é atingida', () => {
    const golpes = Array.from({ length: 10 }, (_, i) => golpe(i, 'Forehand', 'Forehand'));
    const recs = recomendar(resumirSessao(golpes, 10), { nivel: 'INTERMEDIARIO', treinoAtual: 'atual', catalogo });
    expect(recs).toContainEqual(expect.objectContaining({ tipo: 'AVANCAR_NIVEL', treinoSlug: 'avancado' }));
  });
});

describe('agregarIndicadores (RF13)', () => {
  const sessao = (golpes: number, acertos: number, pontos: number, duracaoSeg: number, consistencia: number, cadenciaSeg: number | null) => ({
    golpes,
    acertos,
    pontos,
    duracaoSeg,
    consistencia,
    cadenciaSeg
  });

  it('soma volume e tempo, pondera precisão e consistência pelos golpes', () => {
    const r = agregarIndicadores([sessao(10, 5, 100, 60, 80, 4), sessao(30, 27, 300, 120, 60, 2)], []);
    expect(r.sessoes).toBe(2);
    expect(r.volume).toBe(40);
    expect(r.tempoSeg).toBe(180);
    expect(r.precisao).toBe(80); // 32/40
    expect(r.consistencia).toBe(65); // (80*10 + 60*30) / 40
    expect(r.cadenciaSeg).toBe(3);
    expect(r.pontosMedios).toBe(200);
    expect(r.progressao).toBeNull();
  });

  it('progressão compara com a média das sessões anteriores', () => {
    const r = agregarIndicadores([sessao(10, 8, 150, 60, 80, 4)], [sessao(10, 5, 100, 60, 80, 4), sessao(10, 6, 100, 60, 80, 4)]);
    expect(r.progressao).toEqual({ precisaoDelta: 25, pontosDelta: 50 });
  });

  it('sem sessões retorna zeros', () => {
    const r = agregarIndicadores([], []);
    expect(r).toMatchObject({ sessoes: 0, volume: 0, precisao: 0, consistencia: 0, cadenciaSeg: null });
  });
});
