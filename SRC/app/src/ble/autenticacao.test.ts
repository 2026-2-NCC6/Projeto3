import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ErroAutenticacao, autenticarRaquete } from './autenticacao';
import { prova } from './hmac';
import { Comando, Mensagem, interpretarMensagem } from './protocolo';

const CHAVE = '5F3A9C21D04E7B18A6C2E90F3D7B5A14';
const OUTRA = 'AAAA9C21D04E7B18A6C2E90F3D7B5A14';

/** Raquete simulada com a mesma regra do firmware (autenticacao.h). */
function raquete(opcoes: { chave?: string; versao?: string; falsa?: boolean; bloqueada?: boolean; muda?: boolean } = {}) {
  const chave = opcoes.chave ?? CHAVE;
  let na = '';
  const nb = '9F8E7D6C';
  const enviados: string[] = [];
  const responder = (cmd: Comando): string | null => {
    enviados.push(cmd);
    if (opcoes.muda) return null;
    if (opcoes.bloqueada) return 'ERR:BLOQ';
    if (cmd.startsWith('CH:')) {
      na = cmd.slice(3);
      const pb = opcoes.falsa ? '00000000' : prova(chave, 'B', na, nb);
      return `CR:${nb}${pb}`;
    }
    if (cmd.startsWith('PA:')) return cmd.slice(3) === prova(chave, 'A', na, nb) ? `V:${opcoes.versao ?? '1.1.0'}` : 'ERR:AUTH';
    return null;
  };
  const enviarEAguardar = async (cmd: Comando, aceita: (m: Mensagem) => boolean) => {
    const bruta = responder(cmd);
    const msg = bruta ? interpretarMensagem(bruta) : null;
    return msg && aceita(msg) ? msg : null;
  };
  return { enviarEAguardar, enviados };
}

test('autentica com a chave certa e devolve a versão do firmware', async () => {
  const r = raquete();
  assert.deepEqual(await autenticarRaquete(CHAVE, r.enviarEAguardar), { versao: '1.1.0' });
  assert.equal(r.enviados.length, 2);
  assert.ok(!r.enviados.some((c) => c.includes(CHAVE)), 'a chave não passa pelo canal');
});

test('aparelho falso: a prova da placa não confere e o app não envia a sua', async () => {
  const r = raquete({ falsa: true });
  await assert.rejects(autenticarRaquete(CHAVE, r.enviarEAguardar), (e: ErroAutenticacao) => e.codigo === 'APARELHO_FALSO');
  assert.ok(!r.enviados.some((c) => c.startsWith('PA:')));
});

test('placa com outra chave também é tratada como aparelho não comprovado', async () => {
  const r = raquete({ chave: OUTRA });
  await assert.rejects(autenticarRaquete(CHAVE, r.enviarEAguardar), (e: ErroAutenticacao) => e.codigo === 'APARELHO_FALSO');
});

test('placa bloqueada por tentativas erradas', async () => {
  await assert.rejects(autenticarRaquete(CHAVE, raquete({ bloqueada: true }).enviarEAguardar), (e: ErroAutenticacao) => e.codigo === 'BLOQUEADA');
});

test('placa que não responde', async () => {
  await assert.rejects(autenticarRaquete(CHAVE, raquete({ muda: true }).enviarEAguardar), (e: ErroAutenticacao) => e.codigo === 'SEM_RESPOSTA');
});

test('firmware abaixo do mínimo é recusado mesmo autenticando', async () => {
  await assert.rejects(autenticarRaquete(CHAVE, raquete({ versao: '1.0.5' }).enviarEAguardar), (e: ErroAutenticacao) => e.codigo === 'FIRMWARE_ANTIGO');
});

test('chave inválida ou de exemplo nem chega a ser usada', async () => {
  const r = raquete();
  await assert.rejects(autenticarRaquete('000102030405060708090A0B0C0D0E0F', r.enviarEAguardar), (e: ErroAutenticacao) => e.codigo === 'SEM_CHAVE');
  assert.equal(r.enviados.length, 0);
});
