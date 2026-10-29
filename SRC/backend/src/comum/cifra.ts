import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITMO = 'aes-256-gcm';
const PREFIXO = 'v1:';

/** CHAVE_DISPOSITIVOS: 32 bytes em base64 (como o Render gera) ou em hex. */
export function lerChaveMestra(valor: string): Buffer {
  const chave = /^[0-9a-fA-F]{64}$/.test(valor) ? Buffer.from(valor, 'hex') : Buffer.from(valor, 'base64');
  if (chave.length !== 32) throw new Error('CHAVE_DISPOSITIVOS precisa ter 32 bytes (base64 ou 64 hex).');
  return chave;
}

/**
 * Cifra segredos guardados no banco (chave de cada raquete) com AES-256-GCM.
 * Formato: "v1:" + base64(iv 12 bytes | tag 16 bytes | texto cifrado). O GCM autentica,
 * então um valor adulterado no banco falha ao decifrar em vez de virar uma chave errada.
 */
export class Cifra {
  constructor(private readonly chaveMestra: Buffer) {}

  cifrar(texto: string): string {
    const iv = randomBytes(12);
    const c = createCipheriv(ALGORITMO, this.chaveMestra, iv);
    const corpo = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
    return PREFIXO + Buffer.concat([iv, c.getAuthTag(), corpo]).toString('base64');
  }

  decifrar(valor: string): string {
    if (!valor.startsWith(PREFIXO)) throw new Error('formato de segredo desconhecido');
    const bytes = Buffer.from(valor.slice(PREFIXO.length), 'base64');
    const d = createDecipheriv(ALGORITMO, this.chaveMestra, bytes.subarray(0, 12));
    d.setAuthTag(bytes.subarray(12, 28));
    return Buffer.concat([d.update(bytes.subarray(28)), d.final()]).toString('utf8');
  }
}
