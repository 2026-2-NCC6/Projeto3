import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { bytesParaHex, hexParaBytes, hmacSha256, novoDesafio, prova, sha256 } from './hmac';

const texto = (s: string) => new TextEncoder().encode(s);

test('SHA-256 confere com os vetores da FIPS 180-4', () => {
  assert.equal(bytesParaHex(sha256(texto('abc'))), 'BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD');
  assert.equal(bytesParaHex(sha256(texto(''))), 'E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855');
});

test('SHA-256 confere com o crypto do Node em entradas de vários tamanhos', () => {
  for (const n of [1, 55, 56, 63, 64, 65, 127, 128, 1000]) {
    const dados = randomBytes(n);
    assert.equal(bytesParaHex(sha256(dados)), createHash('sha256').update(dados).digest('hex').toUpperCase(), `tamanho ${n}`);
  }
});

test('HMAC-SHA256 confere com a RFC 4231 (casos 1 e 2)', () => {
  assert.equal(
    bytesParaHex(hmacSha256(new Uint8Array(20).fill(0x0b), texto('Hi There'))),
    'B0344C61D8DB38535CA8AFCEAF0BF12B881DC200C9833DA726E9376C2E32CFF7'
  );
  assert.equal(
    bytesParaHex(hmacSha256(texto('Jefe'), texto('what do ya want for nothing?'))),
    '5BDCC146BF60754E6A042426089575C75A003F089D2739839DEC58B964EC3843'
  );
});

test('HMAC-SHA256 confere com o Node, inclusive com chave maior que o bloco', () => {
  for (const tamChave of [16, 64, 100]) {
    const chave = randomBytes(tamChave);
    const msg = randomBytes(40);
    assert.equal(bytesParaHex(hmacSha256(chave, msg)), createHmac('sha256', chave).update(msg).digest('hex').toUpperCase());
  }
});

// Vetor compartilhado com o firmware (SRC/arduino/tennis_imu/teste_pc): os dois lados precisam calcular igual.
test('prova igual à do firmware (vetor compartilhado)', () => {
  const chave = '000102030405060708090A0B0C0D0E0F';
  assert.equal(prova(chave, 'B', '1A2B3C4D', '9F8E7D6C'), 'BF55C708');
  assert.equal(prova(chave, 'A', '1A2B3C4D', '9F8E7D6C'), '83E700B5');
});

test('provas A e B são diferentes, então a placa não serve de oráculo para o app', () => {
  const chave = 'FFEEDDCCBBAA99887766554433221100';
  assert.notEqual(prova(chave, 'A', '00000001', '00000002'), prova(chave, 'B', '00000001', '00000002'));
});

test('desafio do app tem 8 hex e não se repete', () => {
  const vistos = new Set<string>();
  for (let i = 0; i < 500; i++) {
    const d = novoDesafio();
    assert.match(d, /^[0-9A-F]{8}$/);
    vistos.add(d);
  }
  assert.equal(vistos.size, 500);
});

test('conversões hex', () => {
  assert.deepEqual([...hexParaBytes('00ff10')], [0, 255, 16]);
  assert.equal(bytesParaHex(new Uint8Array([0, 255, 16])), '00FF10');
  assert.throws(() => hexParaBytes('abc'));
  assert.throws(() => hexParaBytes('zz'));
});
