import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avaliarSeq, base64ParaTexto, interpretarMensagem, textoParaBase64 } from './protocolo';

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

test('base64 igual ao do Node', () => {
  for (const s of ['START', 'DBG:1', 'E:AGUARDANDO', 'S:F,6.9,18.2,2,14', 'ab', 'a', '']) {
    assert.equal(textoParaBase64(s), Buffer.from(s).toString('base64'));
    assert.equal(base64ParaTexto(Buffer.from(s).toString('base64')), s);
  }
});
