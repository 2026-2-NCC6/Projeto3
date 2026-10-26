// SHA-256 (FIPS 180-4) e HMAC-SHA256 (RFC 2104) em TypeScript puro: o Hermes não traz HMAC.
// Usados na autenticação do BLE por desafio e resposta; o firmware tem a mesma implementação
// em hmac_sha256.h, e os dois lados são conferidos com o mesmo vetor de teste.

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

export function sha256(dados: Uint8Array): Uint8Array {
  const tamBits = dados.length * 8;
  const total = Math.ceil((dados.length + 9) / 64) * 64;
  const msg = new Uint8Array(total);
  msg.set(dados);
  msg[dados.length] = 0x80;
  const vista = new DataView(msg.buffer);
  vista.setUint32(total - 8, Math.floor(tamBits / 2 ** 32));
  vista.setUint32(total - 4, tamBits >>> 0);

  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  for (let bloco = 0; bloco < total; bloco += 64) {
    for (let i = 0; i < 16; i++) w[i] = vista.getUint32(bloco + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] += a;
    h[1] += b;
    h[2] += c;
    h[3] += d;
    h[4] += e;
    h[5] += f;
    h[6] += g;
    h[7] += hh;
  }
  const saida = new Uint8Array(32);
  const vs = new DataView(saida.buffer);
  h.forEach((v, i) => vs.setUint32(i * 4, v));
  return saida;
}

const BLOCO = 64;

export function hmacSha256(chave: Uint8Array, msg: Uint8Array): Uint8Array {
  const k = new Uint8Array(BLOCO);
  k.set(chave.length > BLOCO ? sha256(chave) : chave);
  const interno = new Uint8Array(BLOCO + msg.length);
  const externo = new Uint8Array(BLOCO + 32);
  for (let i = 0; i < BLOCO; i++) {
    interno[i] = k[i] ^ 0x36;
    externo[i] = k[i] ^ 0x5c;
  }
  interno.set(msg, BLOCO);
  externo.set(sha256(interno), BLOCO);
  return sha256(externo);
}

export function hexParaBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) throw new Error('hex inválido');
  return Uint8Array.from({ length: hex.length / 2 }, (_, i) => parseInt(hex.slice(i * 2, i * 2 + 2), 16));
}

export function bytesParaHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

let contadorDesafio = 0;

/**
 * Desafio do app (Na), 8 hex. Não precisa ser secreto, só não se repetir: misturar tempo,
 * Math.random e um contador no SHA-256 basta, sem depender de módulo nativo de aleatoriedade.
 */
export function novoDesafio(): string {
  const semente = `${Date.now()}:${Math.random()}:${Math.random()}:${contadorDesafio++}`;
  return bytesParaHex(sha256(Uint8Array.from(semente, (c) => c.charCodeAt(0))).slice(0, 4));
}

/**
 * Prova de posse da chave para um par de desafios: 4 primeiros bytes de
 * HMAC-SHA256(chave, papel + Na + Nb), em hex maiúsculo. 'B' = placa, 'A' = app.
 */
export function prova(chaveHex: string, papel: 'A' | 'B', na: string, nb: string): string {
  // Só ASCII: dispensa o TextEncoder, que nem todo runtime do React Native oferece.
  const msg = Uint8Array.from(papel + na.toUpperCase() + nb.toUpperCase(), (c) => c.charCodeAt(0));
  return bytesParaHex(hmacSha256(hexParaBytes(chaveHex), msg).slice(0, 4));
}
