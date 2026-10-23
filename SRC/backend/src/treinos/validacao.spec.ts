import { ConteudoTreino, LIMITES_PADRAO } from './conteudo';
import { conteudoValido } from './conteudo.fixture';
import { validarConteudo } from './validacao';

const campos = (c: ConteudoTreino) => validarConteudo(c, LIMITES_PADRAO).map((e) => e.campo);

describe('validarConteudo (RF15, §3, RNF Segurança física)', () => {
  it('conteúdo completo não tem erros', () => {
    expect(validarConteudo(conteudoValido(), LIMITES_PADRAO)).toEqual([]);
  });

  it('exige os campos da §3 do edital', () => {
    const c = { ...conteudoValido(), publicoAlvo: ' ', objetivo: '', exercicios: [], sensores: [] };
    expect(campos(c)).toEqual(expect.arrayContaining(['publicoAlvo', 'objetivo', 'exercicios', 'sensores']));
  });

  it('exige instruções, equipamentos e riscos (RF04)', () => {
    const c = { ...conteudoValido(), instrucoes: [], equipamentos: [], riscos: [] };
    expect(campos(c)).toEqual(expect.arrayContaining(['instrucoes', 'equipamentos', 'riscos']));
  });

  it('barra velocidade acima do limite adulto', () => {
    const c = conteudoValido();
    c.exercicios[0].lancamento.velocidadeKmh = 121;
    expect(campos(c)).toContain('exercicios[0].lancamento.velocidadeKmh');
  });

  it.each(['INFANTIL', 'TODOS'] as const)('modo %s usa o limite infantil', (modo) => {
    const c = { ...conteudoValido(), modoPublico: modo };
    c.exercicios[0].lancamento.velocidadeKmh = 60;
    expect(campos(c)).toContain('exercicios[0].lancamento.velocidadeKmh');
  });

  it('barra intervalo abaixo do mínimo', () => {
    const c = conteudoValido();
    c.exercicios[0].lancamento.intervaloSeg = 1;
    expect(campos(c)).toContain('exercicios[0].lancamento.intervaloSeg');
  });

  it('barra repetições de conclusão acima do total de lançamentos', () => {
    const c = { ...conteudoValido(), conclusao: { tipo: 'REPETICOES' as const, valor: 11 } };
    expect(campos(c)).toContain('conclusao.valor');
  });

  it('barra meta de precisão fora de 0–100 e penalidade negativa', () => {
    const c = { ...conteudoValido(), pontuacao: { ...conteudoValido().pontuacao, metaPrecisao: 101, penalidadeErro: -1 } };
    expect(campos(c)).toEqual(expect.arrayContaining(['pontuacao.metaPrecisao', 'pontuacao.penalidadeErro']));
  });
});
