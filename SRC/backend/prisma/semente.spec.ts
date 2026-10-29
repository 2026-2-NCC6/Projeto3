import { TREINOS_PLATAFORMA_MAE } from '../src/integracao/mock-plataforma.controller';
import { LIMITES_PADRAO } from '../src/treinos/conteudo';
import { validarConteudo } from '../src/treinos/validacao';
import { TREINOS_SEED, conteudoDoTreino } from './semente';

// Dados iniciais também precisam obedecer às regras do edital (§3): se falharem aqui,
// o seed ou a importação seriam recusados em produção.
describe('treinos de dados iniciais', () => {
  it.each(TREINOS_SEED.map((t) => [t.slug, t] as const))('seed %s passa na validação', (_, t) => {
    expect(validarConteudo(conteudoDoTreino(t), LIMITES_PADRAO)).toEqual([]);
  });

  it.each(TREINOS_PLATAFORMA_MAE.map((t) => [t.slug, t] as const))('plataforma mãe %s passa na validação', (_, t) => {
    expect(validarConteudo(t.conteudo, LIMITES_PADRAO)).toEqual([]);
  });

  it('a conclusão por repetições cobre todas as bolas do seed', () => {
    TREINOS_SEED.forEach((t) => {
      const c = conteudoDoTreino(t);
      expect(c.conclusao).toEqual({ tipo: 'REPETICOES', valor: c.exercicios.reduce((a, e) => a + e.repeticoes, 0) });
    });
  });
});
