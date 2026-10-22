import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buscarTreino } from '../data/treinos';
import { GolpeRegistrado, golpesDeExemplo, ladoEsperado, mmss, resumirSessao } from './regras';

const golpe = (t: number, lado: GolpeRegistrado['lado'], esperado: GolpeRegistrado['lado'], forca: 1 | 2 | 3 = 2): GolpeRegistrado => ({
  t,
  lado,
  esperado,
  ok: lado === esperado,
  forca
});

test('lado esperado segue a sequência do exercício', () => {
  const alternancia = buscarTreino('alternancia');
  assert.deepEqual([0, 1, 2, 3].map((i) => ladoEsperado(alternancia, i)), ['Forehand', 'Backhand', 'Forehand', 'Backhand']);
  const cruzado = buscarTreino('cruzado-fundo');
  assert.deepEqual([0, 1, 2].map((i) => ladoEsperado(cruzado, i)), ['Forehand', 'Forehand', 'Forehand']);
});

test('FH quando o treino pede BH conta como erro', () => {
  const r = resumirSessao('alternancia', [golpe(2, 'Forehand', 'Forehand'), golpe(4, 'Forehand', 'Backhand')], 10, 'sensor');
  assert.equal(r.acertos, 1);
  assert.equal(r.golpes, 2);
  assert.deepEqual(r.porLado.Forehand, { acertos: 1, total: 2 });
  assert.deepEqual(r.porLado.Backhand, { acertos: 0, total: 0 });
});

test('pontos crescem com a sequência e zeram no erro', () => {
  const r = resumirSessao(
    'cruzado-fundo',
    [golpe(1, 'Forehand', 'Forehand'), golpe(2, 'Forehand', 'Forehand', 3), golpe(3, 'Backhand', 'Forehand'), golpe(4, 'Forehand', 'Forehand')],
    5,
    'sensor'
  );
  // 10+5, 10+10+5 (forte), 0, 10+5
  assert.equal(r.pontos, 15 + 25 + 0 + 15);
  assert.equal(r.melhorSequencia, 2);
  assert.equal(r.sequenciaAtual, 1);
  assert.equal(r.fortes, 1);
});

test('sessão vazia', () => {
  const r = resumirSessao('cruzado-fundo', [], 0, 'sensor');
  assert.equal(r.golpes, 0);
  assert.equal(r.pontos, 0);
  assert.equal(r.quedaEmSeg, null);
  assert.deepEqual(r.quartisForca, [0, 0, 0, 0]);
});

test('queda de resistência é detectada quando a força cai', () => {
  const golpes = [3, 3, 3, 3, 3, 1, 1, 1, 1, 1, 1].map((f, i) => golpe(i * 10, 'Forehand', 'Forehand', f as 1 | 2 | 3));
  const r = resumirSessao('cruzado-fundo', golpes, 110, 'sensor');
  assert.notEqual(r.quedaEmSeg, null);
  assert.ok(r.quartisForca[0] > r.quartisForca[3]);
});

test('golpes de exemplo são consistentes', () => {
  const g = golpesDeExemplo(buscarTreino('alternancia'));
  assert.equal(g.length, 47);
  assert.ok(g.every((x) => x.ok === (x.lado === x.esperado)));
});

test('mmss', () => {
  assert.equal(mmss(0), '00:00');
  assert.equal(mmss(184.7), '03:04');
});
