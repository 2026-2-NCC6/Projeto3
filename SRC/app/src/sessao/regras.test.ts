import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ConteudoTreino } from '../api/tipos';
import { GolpeRegistrado, Lado, REGRAS_PADRAO, golpesDeExemplo, ladoEsperado, mmss, resumirSessao, sequenciaEsperada } from './regras';

// Mesmos casos de SRC/backend/src/pontuacao/regras.spec.ts: app e API precisam calcular igual.

const golpe = (t: number, lado: Lado, esperado: Lado, forca: 1 | 2 | 3 = 2): GolpeRegistrado => ({ t, lado, esperado, ok: lado === esperado, forca });

const exercicio = (golpeEsperado: 'FH' | 'BH' | 'ALTERNADO', repeticoes: number) => ({
  nome: 'x',
  repeticoes,
  golpeEsperado,
  lancamento: { velocidadeKmh: 60, rotacao: 'PLANO' as const, direcao: 'CENTRO' as const, alturaM: 1, intervaloSeg: 4 }
});

test('lado esperado segue a sequência de exercícios da versão publicada', () => {
  const c = { exercicios: [exercicio('ALTERNADO', 4), exercicio('BH', 2)] } as ConteudoTreino;
  const seq = sequenciaEsperada(c);
  assert.deepEqual(seq, ['Forehand', 'Backhand', 'Forehand', 'Backhand', 'Backhand', 'Backhand']);
  assert.equal(ladoEsperado(seq, 6), 'Forehand', 'cicla quando há mais golpes que bolas');
});

test('FH quando o treino pede BH conta como erro', () => {
  const r = resumirSessao([golpe(2, 'Forehand', 'Forehand'), golpe(4, 'Forehand', 'Backhand')], 10);
  assert.equal(r.acertos, 1);
  assert.deepEqual(r.porLado.Forehand, { acertos: 1, total: 2 });
});

test('pontos crescem com a sequência e zeram no erro (padrão igual ao servidor)', () => {
  const r = resumirSessao(
    [golpe(1, 'Forehand', 'Forehand'), golpe(2, 'Forehand', 'Forehand', 3), golpe(3, 'Backhand', 'Forehand'), golpe(4, 'Forehand', 'Forehand')],
    5
  );
  assert.equal(r.pontos, 15 + 25 + 0 + 15);
  assert.equal(r.melhorSequencia, 2);
  assert.equal(r.sequenciaAtual, 1);
});

test('penalidade do treino desconta sem deixar o total negativo', () => {
  const r = resumirSessao([golpe(1, 'Backhand', 'Forehand'), golpe(2, 'Forehand', 'Forehand'), golpe(3, 'Backhand', 'Forehand')], 3, {
    ...REGRAS_PADRAO,
    penalidadeErro: 20
  });
  assert.equal(r.pontos, 0);
});

test('meta de precisão vem do treino', () => {
  const g = [golpe(1, 'Forehand', 'Forehand'), golpe(2, 'Forehand', 'Forehand'), golpe(3, 'Backhand', 'Forehand')];
  assert.equal(resumirSessao(g, 3, { ...REGRAS_PADRAO, metaPrecisao: 60 }).metaAtingida, true);
  assert.equal(resumirSessao(g, 3, { ...REGRAS_PADRAO, metaPrecisao: 70 }).metaAtingida, false);
});

test('sessão vazia', () => {
  const r = resumirSessao([], 0);
  assert.equal(r.golpes, 0);
  assert.equal(r.quedaEmSeg, null);
  assert.deepEqual(r.quartisForca, [0, 0, 0, 0]);
});

test('queda de resistência é detectada quando a força cai', () => {
  const golpes = [3, 3, 3, 3, 3, 1, 1, 1, 1, 1, 1].map((f, i) => golpe(i * 10, 'Forehand', 'Forehand', f as 1 | 2 | 3));
  const r = resumirSessao(golpes, 110);
  assert.notEqual(r.quedaEmSeg, null);
  assert.ok(r.quartisForca[0] > r.quartisForca[3]);
});

test('golpes de exemplo são consistentes', () => {
  const g = golpesDeExemplo(['Forehand', 'Backhand']);
  assert.equal(g.length, 47);
  assert.ok(g.every((x) => x.ok === (x.lado === x.esperado)));
});

test('mmss', () => {
  assert.equal(mmss(0), '00:00');
  assert.equal(mmss(184.7), '03:04');
});
