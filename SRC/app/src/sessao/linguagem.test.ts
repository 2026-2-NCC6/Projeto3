import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicoDaSessao, textos } from './linguagem';

test('dependente usa linguagem infantil em qualquer treino', () => {
  assert.equal(publicoDaSessao({ tipo: 'DEPENDENTE' }, 'TODOS'), 'infantil');
});

test('treino infantil usa linguagem infantil mesmo para o titular', () => {
  assert.equal(publicoDaSessao({ tipo: 'TITULAR' }, 'INFANTIL'), 'infantil');
});

test('titular em treino adulto ou para todos usa linguagem adulta', () => {
  assert.equal(publicoDaSessao({ tipo: 'TITULAR' }, 'ADULTO'), 'adulto');
  assert.equal(publicoDaSessao({ tipo: 'TITULAR' }, 'TODOS'), 'adulto');
});

test('os textos mudam com o público e citam o lado', () => {
  const inf = textos('infantil');
  const adu = textos('adulto');
  assert.notEqual(inf.acerto('Forehand'), adu.acerto('Forehand'));
  assert.match(adu.erro('Backhand'), /Backhand/);
  assert.match(inf.aguardando('Forehand'), /direita|Forehand/i);
});
