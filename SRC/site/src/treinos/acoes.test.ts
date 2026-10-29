import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acoesDaVersao } from './acoes';

const base = { origem: 'LOCAL', podeEditar: true, ehUltima: true } as const;

test('rascunho: edita, valida, ensaia e envia para revisão', () => {
  assert.deepEqual(acoesDaVersao({ ...base, status: 'RASCUNHO' }), ['editar', 'validar', 'ensaiar', 'enviarRevisao']);
});

test('em revisão: devolve ou publica, sem editar', () => {
  assert.deepEqual(acoesDaVersao({ ...base, status: 'EM_REVISAO' }), ['validar', 'ensaiar', 'devolver', 'publicar']);
});

test('publicada mais recente permite criar nova versão', () => {
  assert.deepEqual(acoesDaVersao({ ...base, status: 'PUBLICADA' }), ['validar', 'ensaiar', 'novaVersao']);
});

test('versão antiga não abre nova versão (o servidor copia sempre a mais recente)', () => {
  assert.deepEqual(acoesDaVersao({ ...base, status: 'ARQUIVADA', ehUltima: false }), ['validar', 'ensaiar']);
});

test('treino da plataforma mãe é só leitura, mas pode ser validado e ensaiado', () => {
  assert.deepEqual(acoesDaVersao({ ...base, origem: 'PLATAFORMA_MAE', status: 'RASCUNHO' }), ['validar', 'ensaiar']);
});

test('quem não é autor nem admin só consulta', () => {
  assert.deepEqual(acoesDaVersao({ ...base, podeEditar: false, status: 'RASCUNHO' }), []);
});
