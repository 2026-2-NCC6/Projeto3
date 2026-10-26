import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gerarUuid } from './uuid';

test('gera UUID v4 no formato aceito pela API', () => {
  const id = gerarUuid();
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('não repete em 2000 gerações seguidas', () => {
  const vistos = new Set(Array.from({ length: 2000 }, gerarUuid));
  assert.equal(vistos.size, 2000);
});
