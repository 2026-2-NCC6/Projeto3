import { LIMITES_PADRAO } from '../treinos/conteudo';
import { conteudoValido } from '../treinos/conteudo.fixture';
import { expandirLancamentos, focoLado, sequenciaEsperada } from './plano';

describe('expandirLancamentos (RF09)', () => {
  it('gera um lançamento por repetição, numerados em sequência', () => {
    const c = conteudoValido();
    c.exercicios.push({ ...c.exercicios[0], nome: 'Paralela', repeticoes: 2, golpeEsperado: 'BH' });
    const l = expandirLancamentos(c, LIMITES_PADRAO);
    expect(l).toHaveLength(12);
    expect(l.map((x) => x.seq)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    expect(l[10]).toMatchObject({ exercicio: 1, nomeExercicio: 'Paralela', golpeEsperado: 'Backhand' });
  });

  it('ALTERNADO alterna forehand e backhand dentro do exercício', () => {
    const c = conteudoValido();
    c.exercicios[0] = { ...c.exercicios[0], repeticoes: 4, golpeEsperado: 'ALTERNADO' };
    expect(sequenciaEsperada(c)).toEqual(['Forehand', 'Backhand', 'Forehand', 'Backhand']);
  });

  it('aplica o teto de velocidade e o intervalo mínimo em tempo de execução', () => {
    const c = { ...conteudoValido(), modoPublico: 'INFANTIL' as const };
    c.exercicios[0].lancamento = { ...c.exercicios[0].lancamento, velocidadeKmh: 90, intervaloSeg: 0.5 };
    const [primeiro] = expandirLancamentos(c, LIMITES_PADRAO);
    expect(primeiro.velocidadeKmh).toBe(50);
    expect(primeiro.intervaloSeg).toBe(1.5);
  });
});

describe('focoLado', () => {
  it('identifica treino só de backhand', () => {
    const c = conteudoValido();
    c.exercicios[0].golpeEsperado = 'BH';
    expect(focoLado(c)).toBe('Backhand');
  });

  it('treino misto não tem foco', () => {
    const c = conteudoValido();
    c.exercicios[0].golpeEsperado = 'ALTERNADO';
    expect(focoLado(c)).toBeNull();
  });
});
