import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ErroApi, ErroRede, Tokens, criarCliente } from './cliente';

type Chamada = { url: string; init: RequestInit };

function resposta(status: number, corpo?: unknown, cabecalhos: Record<string, string> = {}) {
  return new Response(corpo === undefined ? null : JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json', ...cabecalhos } });
}

function montar(responder: (c: Chamada, n: number) => Response | Promise<Response>, tokens: Tokens | null = { accessToken: 'A1', refreshToken: 'R1' }) {
  const chamadas: Chamada[] = [];
  let atual = tokens;
  let expirou = 0;
  const cliente = criarCliente({
    baseUrl: 'https://api.teste/api/v1',
    fetch: (async (url: string, init: RequestInit) => {
      const c = { url, init };
      chamadas.push(c);
      return responder(c, chamadas.length);
    }) as typeof fetch,
    tokens: { atual: () => atual, definir: (t) => void (atual = t) },
    aoExpirar: () => void expirou++
  });
  return { cliente, chamadas, tokens: () => atual, expirou: () => expirou };
}

const cab = (c: Chamada, nome: string) => new Headers(c.init.headers).get(nome);

test('envia o token e um x-request-id em cada chamada', async () => {
  const m = montar(() => resposta(200, { ok: true }));
  const r = await m.cliente.requisitar<{ ok: boolean }>('GET', '/treinos');
  assert.deepEqual(r.dados, { ok: true });
  assert.equal(m.chamadas[0].url, 'https://api.teste/api/v1/treinos');
  assert.equal(cab(m.chamadas[0], 'authorization'), 'Bearer A1');
  assert.match(cab(m.chamadas[0], 'x-request-id') ?? '', /^[0-9a-f-]{36}$/);
});

test('rota pública não leva token', async () => {
  const m = montar(() => resposta(200, {}));
  await m.cliente.requisitar('POST', '/auth/login', { corpo: { email: 'a' }, publico: true });
  assert.equal(cab(m.chamadas[0], 'authorization'), null);
});

test('erro da API vira ErroApi com o código', async () => {
  const m = montar(() => resposta(409, { statusCode: 409, codigo: 'COMANDO_INVALIDO', mensagem: 'não pode', requestId: 'x' }));
  await assert.rejects(m.cliente.requisitar('POST', '/sessoes/1/comandos'), (e: ErroApi) => e.status === 409 && e.codigo === 'COMANDO_INVALIDO' && e.message === 'não pode');
});

test('401 renova o token e repete a chamada uma vez', async () => {
  const m = montar((c) => {
    if (c.url.endsWith('/auth/refresh')) return resposta(200, { accessToken: 'A2', refreshToken: 'R2' });
    return cab(c, 'authorization') === 'Bearer A2' ? resposta(200, { ok: 1 }) : resposta(401, { codigo: 'NAO_AUTENTICADO', mensagem: 'x' });
  });
  const r = await m.cliente.requisitar('GET', '/me');
  assert.deepEqual(r.dados, { ok: 1 });
  assert.deepEqual(m.tokens(), { accessToken: 'A2', refreshToken: 'R2' });
  assert.equal(JSON.parse(String(m.chamadas.find((c) => c.url.endsWith('/auth/refresh'))!.init.body)).refreshToken, 'R1');
});

test('várias chamadas com 401 ao mesmo tempo renovam uma única vez', async () => {
  let renovacoes = 0;
  const m = montar(async (c) => {
    if (c.url.endsWith('/auth/refresh')) {
      renovacoes++;
      await new Promise((r) => setTimeout(r, 10));
      return resposta(200, { accessToken: 'A2', refreshToken: 'R2' });
    }
    return cab(c, 'authorization') === 'Bearer A2' ? resposta(200, {}) : resposta(401, {});
  });
  await Promise.all([m.cliente.requisitar('GET', '/a'), m.cliente.requisitar('GET', '/b'), m.cliente.requisitar('GET', '/c')]);
  assert.equal(renovacoes, 1);
});

test('refresh recusado limpa os tokens e avisa que a sessão expirou', async () => {
  const m = montar((c) => (c.url.endsWith('/auth/refresh') ? resposta(401, { codigo: 'REFRESH_INVALIDO', mensagem: 'x' }) : resposta(401, {})));
  await assert.rejects(m.cliente.requisitar('GET', '/me'), (e: ErroApi) => e.status === 401);
  assert.equal(m.tokens(), null);
  assert.equal(m.expirou(), 1);
});

test('falha de rede vira ErroRede (o app trata como offline)', async () => {
  const m = montar(() => {
    throw new TypeError('Network request failed');
  });
  await assert.rejects(m.cliente.requisitar('GET', '/treinos'), (e: unknown) => e instanceof ErroRede);
});

test('304 devolve o status sem corpo (treino em cache continua válido)', async () => {
  const m = montar(() => new Response(null, { status: 304 }));
  const r = await m.cliente.requisitar('GET', '/treinos/x', { cabecalhos: { 'If-None-Match': '"v1"' } });
  assert.equal(r.status, 304);
  assert.equal(r.dados, null);
  assert.equal(cab(m.chamadas[0], 'if-none-match'), '"v1"');
});
