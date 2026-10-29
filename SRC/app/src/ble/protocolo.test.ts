import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAVE_EXEMPLO,
  avaliarSeq,
  base64ParaTexto,
  chaveValida,
  comandoDesafio,
  comandoProva,
  interpretarMensagem,
  textoParaBase64,
  versaoAtende
} from './protocolo';

test('golpe válido com seq', () => {
  assert.deepEqual(interpretarMensagem('S:F,6.9,18.2,2,14'), {
    tipo: 'golpe',
    golpe: { lado: 'Forehand', picoG: 6.9, picoGiro: 18.2, forca: 2, seq: 14 }
  });
  const bh = interpretarMensagem('S:B,27.7,60.4,3,9999');
  assert.equal(bh?.tipo, 'golpe');
  assert.equal(bh?.tipo === 'golpe' && bh.golpe.lado, 'Backhand');
});

test('maior golpe possível cabe em 20 bytes', () => {
  assert.ok('S:F,99.9,99.9,3,9999'.length <= 20);
  assert.equal(interpretarMensagem('S:F,99.9,99.9,3,9999')?.tipo, 'golpe');
});

test('golpe truncado é descartado', () => {
  for (const m of ['S:F,6.9,18', 'S:F,6.9,18.2,2', 'S:F,6.9,18.2,2,', 'S:']) {
    assert.equal(interpretarMensagem(m), null, m);
  }
});

test('golpe com campo faltando ou inválido é descartado', () => {
  for (const m of ['S:F,,18.2,2,14', 'S:X,6.9,18.2,2,14', 'S:F,6.9,18.2,4,14', 'S:F,6.9,18.2,0,14', 'S:F,6.9,18.2,2,abc', 'S:F,6.9,18.2,2.5,14', 'S:F,-1,18.2,2,14', 'S:F,6.9,18.2,2,10000', 'S:F,6.9,18.2,2,14,7']) {
    assert.equal(interpretarMensagem(m), null, m);
  }
});

test('lixo é descartado', () => {
  for (const m of ['', 'lixo', 'S', 'E:', 'E:DORMINDO', 'ERR:', '\u0000\u0001', 'A:1,2', 'G:x,y,z']) {
    assert.equal(interpretarMensagem(m), null, JSON.stringify(m));
  }
});

test('estados e erros', () => {
  assert.deepEqual(interpretarMensagem('E:COLETANDO'), { tipo: 'estado', estado: 'COLETANDO' });
  assert.deepEqual(interpretarMensagem('E:AGUARDANDO\r\n'), { tipo: 'estado', estado: 'AGUARDANDO' });
  assert.deepEqual(interpretarMensagem('ERR:MPU'), { tipo: 'erro', texto: 'MPU' });
});

test('telemetria de debug dividida e formato antigo', () => {
  assert.deepEqual(interpretarMensagem('A:-0.1,1.0,0.0'), { tipo: 'acel', x: -0.1, y: 1, z: 0 });
  assert.deepEqual(interpretarMensagem('G:0.0,-34.9,2.1'), { tipo: 'giro', x: 0, y: -34.9, z: 2.1 });
  const antigo = interpretarMensagem('A:0,9.80665,0|G:0.1,-0.2,0.3');
  assert.equal(antigo?.tipo, 'amostra');
  assert.equal(antigo?.tipo === 'amostra' && antigo.amostra.ay, 1);
  assert.equal(interpretarMensagem('A:-12.3,4.5,9.8|G:0.1,-0.'), null);
});

test('seq: aceita em ordem e conta lacunas', () => {
  assert.deepEqual(avaliarSeq(null, 7), { aceitar: true, lacuna: 0 });
  assert.deepEqual(avaliarSeq(7, 8), { aceitar: true, lacuna: 0 });
  assert.deepEqual(avaliarSeq(8, 11), { aceitar: true, lacuna: 2 });
});

test('seq: duplicado e atrasado são ignorados', () => {
  assert.equal(avaliarSeq(14, 14).aceitar, false);
  assert.equal(avaliarSeq(14, 13).aceitar, false);
  assert.equal(avaliarSeq(14, 1).aceitar, false);
});

test('seq: volta de 9999 para 1', () => {
  assert.deepEqual(avaliarSeq(9999, 1), { aceitar: true, lacuna: 0 });
  assert.deepEqual(avaliarSeq(9998, 2), { aceitar: true, lacuna: 2 });
});

test('resposta ao desafio (CR:) traz Nb e PB, cabe em 20 bytes e só aceita hex', () => {
  assert.ok('CR:9F8E7D6CBF55C708'.length <= 20);
  assert.deepEqual(interpretarMensagem('CR:9F8E7D6CBF55C708'), { tipo: 'desafio', nb: '9F8E7D6C', pb: 'BF55C708' });
  assert.deepEqual(interpretarMensagem('CR:9f8e7d6cbf55c708'), { tipo: 'desafio', nb: '9F8E7D6C', pb: 'BF55C708' });
  for (const m of ['CR:9F8E7D6CZF55C708', 'CR:9F8E7D6C', 'CR:9F8E7D6CBF55C70899', 'CR:']) {
    assert.equal(interpretarMensagem(m), null, m);
  }
});

test('versão do firmware (V:) só aceita x.y.z', () => {
  assert.deepEqual(interpretarMensagem('V:1.1.0'), { tipo: 'versao', versao: '1.1.0' });
  for (const m of ['V:', 'V:1.1', 'V:1.1.0;rm', 'V:a.b.c']) {
    assert.equal(interpretarMensagem(m), null, m);
  }
});

test('erros de autenticação da placa', () => {
  assert.deepEqual(interpretarMensagem('ERR:AUTH'), { tipo: 'erro', texto: 'AUTH' });
  assert.deepEqual(interpretarMensagem('ERR:BLOQ'), { tipo: 'erro', texto: 'BLOQ' });
});

test('comandos de autenticação e feedback cabem em 20 bytes e só aceitam 8 hex', () => {
  assert.equal(comandoDesafio('1a2b3c4d'), 'CH:1A2B3C4D');
  assert.equal(comandoProva('83e700b5'), 'PA:83E700B5');
  for (const c of [comandoDesafio('1A2B3C4D'), comandoProva('83E700B5'), 'FB:1', 'FB:0']) assert.ok(c.length <= 20, c);
  assert.throws(() => comandoDesafio('1A2B3C'));
  assert.throws(() => comandoProva('ZZZZZZZZ'));
});

test('chave do dispositivo: 32 hex, recusando a de exemplo', () => {
  assert.equal(chaveValida('00112233445566778899AABBCCDDEEFF'), true);
  assert.equal(chaveValida('0011'), false);
  assert.equal(chaveValida('Z0112233445566778899AABBCCDDEEFF'), false);
  assert.equal(chaveValida(CHAVE_EXEMPLO), false);
});

test('versaoAtende compara por segmento numérico', () => {
  assert.equal(versaoAtende('1.1.0', '1.1.0'), true);
  assert.equal(versaoAtende('1.10.0', '1.2.0'), true);
  assert.equal(versaoAtende('1.0.9', '1.1.0'), false);
  assert.equal(versaoAtende('2.0', '1.9.9'), true);
  assert.equal(versaoAtende('lixo', '1.0.0'), false);
});

test('base64 igual ao do Node', () => {
  for (const s of ['START', 'DBG:1', 'E:AGUARDANDO', 'S:F,6.9,18.2,2,14', 'ab', 'a', '']) {
    assert.equal(textoParaBase64(s), Buffer.from(s).toString('base64'));
    assert.equal(base64ParaTexto(Buffer.from(s).toString('base64')), s);
  }
});
