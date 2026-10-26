import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conteudoPadrao, deLinhas, errosPorCampo, faixaDuracao, paraLinhas, totalLancamentos } from './conteudo';

test('textos de várias linhas viram lista sem linhas vazias', () => {
  assert.deepEqual(deLinhas('  Aqueça antes.\n\n Use tênis adequado \r\n'), ['Aqueça antes.', 'Use tênis adequado']);
  assert.equal(paraLinhas(['a', 'b']), 'a\nb');
});

test('faixa de duração segue a regra do servidor (tempo de máquina até o dobro)', () => {
  const c = conteudoPadrao();
  c.exercicios = [{ ...c.exercicios[0], repeticoes: 30, lancamento: { ...c.exercicios[0].lancamento, intervaloSeg: 4 } }];
  // 30 bolas × 4 s = 2 min de máquina → duração entre 2 e 4 min
  assert.deepEqual(faixaDuracao(c, 1.5), { maquinaMin: 2, minimo: 2, maximo: 4 });
});

test('intervalo abaixo do mínimo conta como o mínimo, como no simulador', () => {
  const c = conteudoPadrao();
  c.exercicios = [{ ...c.exercicios[0], repeticoes: 40, lancamento: { ...c.exercicios[0].lancamento, intervaloSeg: 1 } }];
  assert.equal(faixaDuracao(c, 1.5).maquinaMin, 1);
});

test('conteúdo padrão já respeita a própria faixa de duração e a conclusão', () => {
  const c = conteudoPadrao();
  const f = faixaDuracao(c, 1.5);
  assert.ok(c.duracaoMin >= f.minimo && c.duracaoMin <= f.maximo);
  assert.ok(c.conclusao.valor <= totalLancamentos(c));
});

test('erros do servidor agrupados pelo campo e por prefixo', () => {
  const m = errosPorCampo([
    { campo: 'exercicios[0].lancamento.velocidadeKmh', mensagem: 'rápido demais' },
    { campo: 'riscos', mensagem: 'Liste os riscos' }
  ]);
  assert.deepEqual(m('riscos'), ['Liste os riscos']);
  assert.deepEqual(m('exercicios[0]'), ['rápido demais']);
  assert.deepEqual(m('objetivo'), []);
});
