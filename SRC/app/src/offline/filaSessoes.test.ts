import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ErroApi, ErroRede } from '../api/cliente';
import type { SincronizacaoOffline } from '../api/endpoints';
import { memoria } from '../armazenamento/chaveValor';
import { FilaSessoes } from './filaSessoes';

const item = (id: string): SincronizacaoOffline => ({
  sessao: {
    id,
    praticanteId: 'p',
    treinoSlug: 't',
    versaoNumero: 1,
    origem: 'SENSOR',
    iniciadaEm: '2026-10-25T10:00:00.000Z',
    encerradaEm: '2026-10-25T10:10:00.000Z'
  },
  eventos: []
});

test('a fila sobrevive ao app fechar (mesmo armazenamento)', async () => {
  const kv = memoria();
  await new FilaSessoes(kv).enfileirar(item('a'));
  assert.deepEqual((await new FilaSessoes(kv).listar()).map((i) => i.sessao.id), ['a']);
});

test('enfileirar a mesma sessão de novo substitui, não duplica', async () => {
  const f = new FilaSessoes(memoria());
  await f.enfileirar(item('a'));
  await f.enfileirar({ ...item('a'), eventos: [{ id: 'e', tipo: 'GOLPE', tMs: 1, ocorridoEm: 'x', dados: {} }] });
  const lista = await f.listar();
  assert.equal(lista.length, 1);
  assert.equal(lista[0].eventos.length, 1);
});

test('sincroniza em ordem e remove o que foi aceito', async () => {
  const f = new FilaSessoes(memoria());
  await f.enfileirar(item('a'));
  await f.enfileirar(item('b'));
  const enviados: string[] = [];
  const r = await f.sincronizar(async (i) => void enviados.push(i.sessao.id));
  assert.deepEqual(enviados, ['a', 'b']);
  assert.deepEqual(r, { enviadas: 2, pendentes: 0, recusadas: 0 });
  assert.equal((await f.listar()).length, 0);
});

test('sem rede, para e mantém tudo para depois', async () => {
  const f = new FilaSessoes(memoria());
  await f.enfileirar(item('a'));
  await f.enfileirar(item('b'));
  let chamadas = 0;
  const r = await f.sincronizar(async () => {
    chamadas++;
    throw new ErroRede('off');
  });
  assert.equal(chamadas, 1);
  assert.deepEqual(r, { enviadas: 0, pendentes: 2, recusadas: 0 });
});

test('erro do servidor (5xx) mantém o item e para', async () => {
  const f = new FilaSessoes(memoria());
  await f.enfileirar(item('a'));
  const r = await f.sincronizar(async () => {
    throw new ErroApi(503, 'INDISPONIVEL', 'x');
  });
  assert.deepEqual(r, { enviadas: 0, pendentes: 1, recusadas: 0 });
});

test('recusa definitiva (4xx) sai da fila, mas fica guardada como recusada', async () => {
  const f = new FilaSessoes(memoria());
  await f.enfileirar(item('a'));
  await f.enfileirar(item('b'));
  const r = await f.sincronizar(async (i) => {
    if (i.sessao.id === 'a') throw new ErroApi(404, 'NAO_ENCONTRADO', 'versão não existe');
  });
  assert.deepEqual(r, { enviadas: 1, pendentes: 0, recusadas: 1 });
  const recusadas = await f.recusadas();
  assert.equal(recusadas[0].item.sessao.id, 'a');
  assert.equal(recusadas[0].motivo, 'versão não existe');
});

test('sessão expirada (401) não é recusa: fica para depois do login', async () => {
  const f = new FilaSessoes(memoria());
  await f.enfileirar(item('a'));
  const r = await f.sincronizar(async () => {
    throw new ErroApi(401, 'NAO_AUTENTICADO', 'x');
  });
  assert.deepEqual(r, { enviadas: 0, pendentes: 1, recusadas: 0 });
});
