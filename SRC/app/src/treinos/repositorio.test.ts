import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ErroRede } from '../api/cliente';
import type { TreinoDetalhe, TreinoResumo } from '../api/tipos';
import { memoria } from '../armazenamento/chaveValor';
import { ApiTreinos, RepositorioTreinos } from './repositorio';

const resumo = (slug: string) => ({ slug, nome: slug }) as TreinoResumo;
const detalhe = (slug: string, numero: number) => ({ slug, numero, nome: slug }) as TreinoDetalhe;

function api(opcoes: { offline?: boolean; versao?: number } = {}) {
  const pedidos: { slug: string; etag?: string }[] = [];
  const a: ApiTreinos = {
    catalogo: async () => {
      if (opcoes.offline) throw new ErroRede('off');
      return [resumo('a'), resumo('b')];
    },
    treino: async (slug, etag) => {
      pedidos.push({ slug, etag });
      if (opcoes.offline) throw new ErroRede('off');
      const v = opcoes.versao ?? 1;
      if (etag === `"v${v}"`) return { treino: null, etag, naoMudou: true };
      return { treino: detalhe(slug, v), etag: `"v${v}"`, naoMudou: false };
    }
  };
  return { a, pedidos };
}

test('catálogo online é guardado e servido offline', async () => {
  const kv = memoria();
  const online = await new RepositorioTreinos(api().a, kv).catalogo();
  assert.equal(online.origem, 'api');
  const off = await new RepositorioTreinos(api({ offline: true }).a, kv).catalogo();
  assert.equal(off.origem, 'cache');
  assert.deepEqual(off.treinos.map((t) => t.slug), ['a', 'b']);
});

test('sem rede e sem cache, o catálogo vem vazio e avisa', async () => {
  const r = await new RepositorioTreinos(api({ offline: true }).a, memoria()).catalogo();
  assert.deepEqual(r, { treinos: [], origem: 'indisponivel' });
});

test('versão guardada é revalidada com ETag e reaproveitada no 304', async () => {
  const kv = memoria();
  const primeira = api();
  await new RepositorioTreinos(primeira.a, kv).treino('a');
  const segunda = api();
  const r = await new RepositorioTreinos(segunda.a, kv).treino('a');
  assert.equal(segunda.pedidos[0].etag, '"v1"');
  assert.equal(r?.treino.numero, 1);
});

test('nova versão publicada substitui a guardada', async () => {
  const kv = memoria();
  await new RepositorioTreinos(api({ versao: 1 }).a, kv).treino('a');
  const r = await new RepositorioTreinos(api({ versao: 2 }).a, kv).treino('a');
  assert.equal(r?.treino.numero, 2);
});

test('offline usa a versão sincronizada antes (RF21)', async () => {
  const kv = memoria();
  await new RepositorioTreinos(api().a, kv).treino('a');
  const r = await new RepositorioTreinos(api({ offline: true }).a, kv).treino('a');
  assert.equal(r?.treino.slug, 'a');
  assert.equal(r?.origem, 'cache');
  assert.equal(await new RepositorioTreinos(api({ offline: true }).a, kv).treino('nunca-baixado'), null);
});
