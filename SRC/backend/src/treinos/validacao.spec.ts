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

  describe('duração estimada compatível com os lançamentos (§3)', () => {
    // conteudoValido(): 10 bolas a cada 4 s = 40 s de máquina
    it('aceita duração entre o tempo de máquina e o dobro dele (mínimo 1 min)', () => {
      expect(campos({ ...conteudoValido(), duracaoMin: 1 })).not.toContain('duracaoMin');
    });

    it('barra duração muito maior que o tempo de lançamentos', () => {
      expect(campos({ ...conteudoValido(), duracaoMin: 15 })).toContain('duracaoMin');
    });

    it('barra duração menor que o tempo de lançamentos', () => {
      const c = conteudoValido();
      c.exercicios[0].repeticoes = 300; // 20 min de máquina
      expect(campos({ ...c, duracaoMin: 10, conclusao: { tipo: 'REPETICOES', valor: 300 } })).toContain('duracaoMin');
    });

    it('usa o intervalo efetivo (com o mínimo de operação) no cálculo', () => {
      const c = conteudoValido();
      c.exercicios[0] = { ...c.exercicios[0], repeticoes: 60, lancamento: { ...c.exercicios[0].lancamento, intervaloSeg: 1 } };
      // intervalo efetivo 1,5 s → 90 s de máquina; 1 min seria menor que isso
      expect(campos({ ...c, duracaoMin: 1, conclusao: { tipo: 'REPETICOES', valor: 60 } })).toContain('duracaoMin');
      expect(campos({ ...c, duracaoMin: 2, conclusao: { tipo: 'REPETICOES', valor: 60 } })).not.toContain('duracaoMin');
    });
  });

  it('barra meta de precisão fora de 0–100 e penalidade negativa', () => {
    const c = { ...conteudoValido(), pontuacao: { ...conteudoValido().pontuacao, metaPrecisao: 101, penalidadeErro: -1 } };
    expect(campos(c)).toEqual(expect.arrayContaining(['pontuacao.metaPrecisao', 'pontuacao.penalidadeErro']));
  });
});
