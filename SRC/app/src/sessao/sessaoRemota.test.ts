import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ErroApi, ErroRede } from '../api/cliente';
import type { Sessao } from '../api/tipos';
import { memoria } from '../armazenamento/chaveValor';
import { FilaSessoes } from '../offline/filaSessoes';
import { ApiSessao, SessaoRemota } from './sessaoRemota';

const ctx = { id: 's1', praticanteId: 'p1', treinoSlug: 'cruzado-fundo', versaoNumero: 4, dispositivoId: 'd1', origem: 'SENSOR' as const };
const golpe = (seq: number) => ({ lado: 'Forehand' as const, forca: 2 as const, picoG: 3, picoGiro: 9, seq });

function apiFalsa(opcoes: { offline?: boolean; cairEm?: 'eventos' | 'encerrar'; recusarCriacao?: ErroApi } = {}) {
  const chamadas: { metodo: string; args: unknown[] }[] = [];
  let online = !opcoes.offline;
  const registrar = (metodo: string, args: unknown[]) => {
    chamadas.push({ metodo, args });
    if (!online) throw new ErroRede('off');
  };
  const api: ApiSessao = {
    criarSessao: async (s) => {
      registrar('criarSessao', [s]);
      if (opcoes.recusarCriacao) throw opcoes.recusarCriacao;
      return { id: s.id, estado: 'CRIADA' } as Sessao;
    },
    comando: async (id, c) => {
      registrar('comando', [id, c]);
      if (opcoes.cairEm === 'encerrar' && c.comando === 'ENCERRAR') {
        online = false;
        throw new ErroRede('caiu');
      }
      return { id, estado: c.comando === 'ENCERRAR' ? 'ENCERRADA' : 'EM_EXECUCAO', resumo: c.comando === 'ENCERRAR' ? { pontos: 15 } : null } as Sessao;
    },
    enviarEventos: async (id, eventos) => {
      registrar('enviarEventos', [id, eventos]);
      if (opcoes.cairEm === 'eventos') {
        online = false;
        throw new ErroRede('caiu');
      }
      return { aceitos: eventos.length, duplicados: 0, estado: 'EM_EXECUCAO', parcial: { pontos: 0, golpes: 0, acertos: 0 } };
    }
  };
  return { api, chamadas };
}

function relogio(inicio = 1_000_000) {
  let agora = inicio;
  return { agora: () => agora, avancar: (ms: number) => void (agora += ms) };
}

test('online: cria a sessão, envia golpes em lote e encerra com o resumo do servidor', async () => {
  const { api, chamadas } = apiFalsa();
  const r = relogio();
  const s = new SessaoRemota(api, new FilaSessoes(memoria()), ctx, r.agora);
  await s.preparar();
  assert.equal(s.modo, 'online');
  await s.comando('INICIAR');
  r.avancar(2500);
  s.registrarGolpe(golpe(1));
  await s.enviarPendentes();
  const enviados = chamadas.find((c) => c.metodo === 'enviarEventos')!.args[1] as { tMs: number; tipo: string }[];
  assert.equal(enviados.length, 1);
  assert.equal(enviados[0].tipo, 'GOLPE');
  assert.equal(enviados[0].tMs, 2500);

  const final = await s.encerrar({ pontosCliente: 15 });
  assert.equal(final.sessao?.estado, 'ENCERRADA');
  assert.equal(final.pendenteSincronizacao, false);
  const encerrar = chamadas.find((c) => c.metodo === 'comando' && (c.args[1] as { comando: string }).comando === 'ENCERRAR')!;
  assert.equal((encerrar.args[1] as { pontosCliente: number }).pontosCliente, 15);
});

test('lote de golpes respeita o máximo de 200 por envio', async () => {
  const { api, chamadas } = apiFalsa();
  const s = new SessaoRemota(api, new FilaSessoes(memoria()), ctx, relogio().agora);
  await s.preparar();
  await s.comando('INICIAR');
  for (let i = 1; i <= 450; i++) s.registrarGolpe(golpe(i));
  await s.enviarPendentes();
  const lotes = chamadas.filter((c) => c.metodo === 'enviarEventos').map((c) => (c.args[1] as unknown[]).length);
  assert.deepEqual(lotes, [200, 200, 50]);
});

test('offline desde o início: nada vai para a API e a sessão entra na fila ao encerrar', async () => {
  const { api } = apiFalsa({ offline: true });
  const fila = new FilaSessoes(memoria());
  const r = relogio();
  const s = new SessaoRemota(api, fila, ctx, r.agora);
  await s.preparar();
  assert.equal(s.modo, 'offline');
  await s.comando('INICIAR');
  r.avancar(1000);
  s.registrarGolpe(golpe(1));
  r.avancar(1000);
  const final = await s.encerrar({ pontosCliente: 15 });
  assert.equal(final.pendenteSincronizacao, true);
  const [item] = await fila.listar();
  assert.equal(item.sessao.id, 's1');
  assert.equal(item.sessao.versaoNumero, 4);
  assert.equal(item.sessao.pontosCliente, 15);
  assert.equal(item.eventos.length, 1);
  assert.equal(new Date(item.sessao.encerradaEm).getTime() - new Date(item.sessao.iniciadaEm).getTime(), 2000);
});

test('rede cai no meio: segue offline e sincroniza depois com todos os golpes', async () => {
  const { api } = apiFalsa({ cairEm: 'eventos' });
  const fila = new FilaSessoes(memoria());
  const s = new SessaoRemota(api, fila, ctx, relogio().agora);
  await s.preparar();
  await s.comando('INICIAR');
  s.registrarGolpe(golpe(1));
  await s.enviarPendentes();
  assert.equal(s.modo, 'offline');
  s.registrarGolpe(golpe(2));
  await s.comando('PAUSAR');
  const final = await s.encerrar({});
  assert.equal(final.pendenteSincronizacao, true);
  assert.equal((await fila.listar())[0].eventos.length, 2);
});

test('rede cai justo no encerramento: a sessão não se perde', async () => {
  const { api } = apiFalsa({ cairEm: 'encerrar' });
  const fila = new FilaSessoes(memoria());
  const s = new SessaoRemota(api, fila, ctx, relogio().agora);
  await s.preparar();
  await s.comando('INICIAR');
  s.registrarGolpe(golpe(1));
  const final = await s.encerrar({});
  assert.equal(final.pendenteSincronizacao, true);
  assert.equal((await fila.listar()).length, 1);
});

test('parada segura offline guarda o motivo para a sincronização', async () => {
  const { api } = apiFalsa({ offline: true });
  const fila = new FilaSessoes(memoria());
  const s = new SessaoRemota(api, fila, ctx, relogio().agora);
  await s.preparar();
  await s.comando('INICIAR');
  await s.comando('EMERGENCIA', { motivo: 'bola na quadra' });
  await s.encerrar({});
  assert.equal((await fila.listar())[0].sessao.motivoInterrupcao, 'bola na quadra');
});

test('recusa da API ao criar (ex.: firmware sem autenticação) não vira modo offline', async () => {
  const { api } = apiFalsa({ recusarCriacao: new ErroApi(409, 'FIRMWARE_SEM_AUTENTICACAO', 'atualize') });
  const s = new SessaoRemota(api, new FilaSessoes(memoria()), ctx, relogio().agora);
  await assert.rejects(s.preparar(), (e: ErroApi) => e.codigo === 'FIRMWARE_SEM_AUTENTICACAO');
});
