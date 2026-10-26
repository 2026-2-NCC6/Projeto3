import { sha256 } from '../ble/hmac';

let contador = 0;

/**
 * UUID v4 para sessões e eventos criados no app (a API usa como chave de idempotência).
 * O Hermes não tem crypto.randomUUID; como o id só precisa ser único, misturar tempo,
 * Math.random e um contador no SHA-256 basta, sem módulo nativo.
 */
export function gerarUuid(): string {
  const semente = `${Date.now()}:${Math.random()}:${Math.random()}:${contador++}`;
  const b = sha256(Uint8Array.from(semente, (c) => c.charCodeAt(0))).slice(0, 16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
