export const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
export const CHAR_DADOS_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';
export const CHAR_CMD_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a9';
export const NOME_DISPOSITIVO = 'ArduinoR4-IMU';

export type Comando = 'START' | 'PAUSE' | 'RESUME' | 'STOP' | 'PING' | 'LED:0' | 'LED:1' | 'BUZ:0' | 'BUZ:1';

export type EstadoDispositivo = 'AGUARDANDO' | 'COLETANDO' | 'PAUSADO' | 'PARADO';

export type Amostra = { ax: number; ay: number; az: number; gx: number; gy: number; gz: number };

export type GolpeSensor = {
  lado: 'Forehand' | 'Backhand';
  picoG: number;
  picoGiro: number;
  forca: 1 | 2 | 3;
};

export type Mensagem =
  | { tipo: 'amostra'; amostra: Amostra }
  | { tipo: 'golpe'; golpe: GolpeSensor }
  | { tipo: 'estado'; estado: EstadoDispositivo }
  | { tipo: 'erro'; texto: string };

const ESTADOS: EstadoDispositivo[] = ['AGUARDANDO', 'COLETANDO', 'PAUSADO', 'PARADO'];

function numeros(texto: string, quantidade: number): number[] | null {
  const partes = texto.split(',').map(Number);
  if (partes.length !== quantidade || partes.some((n) => !Number.isFinite(n))) return null;
  return partes;
}

export function interpretarMensagem(bruta: string): Mensagem | null {
  const texto = bruta.trim();

  if (texto.startsWith('A:')) {
    const [acel, giro] = texto.slice(2).split('|G:');
    const a = acel ? numeros(acel, 3) : null;
    const g = giro ? numeros(giro, 3) : null;
    if (!a || !g) return null;
    return { tipo: 'amostra', amostra: { ax: a[0], ay: a[1], az: a[2], gx: g[0], gy: g[1], gz: g[2] } };
  }

  if (texto.startsWith('S:')) {
    const [lado, ...resto] = texto.slice(2).split(',');
    const valores = numeros(resto.join(','), 3);
    if ((lado !== 'F' && lado !== 'B') || !valores) return null;
    const forca = Math.min(3, Math.max(1, Math.round(valores[2]))) as 1 | 2 | 3;
    return {
      tipo: 'golpe',
      golpe: { lado: lado === 'F' ? 'Forehand' : 'Backhand', picoG: valores[0], picoGiro: valores[1], forca }
    };
  }

  if (texto.startsWith('E:')) {
    const estado = texto.slice(2) as EstadoDispositivo;
    return ESTADOS.includes(estado) ? { tipo: 'estado', estado } : null;
  }

  if (texto.startsWith('ERR:')) {
    return { tipo: 'erro', texto: texto.slice(4) };
  }

  return null;
}

// A biblioteca BLE troca valores em base64; o protocolo é só ASCII.
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function base64ParaTexto(b64: string): string {
  let bits = 0;
  let acumulado = 0;
  let saida = '';
  for (const c of b64) {
    if (c === '=') break;
    const v = B64.indexOf(c);
    if (v < 0) continue;
    acumulado = (acumulado << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      saida += String.fromCharCode((acumulado >> bits) & 0xff);
    }
  }
  return saida;
}

export function textoParaBase64(texto: string): string {
  let saida = '';
  for (let i = 0; i < texto.length; i += 3) {
    const a = texto.charCodeAt(i) & 0xff;
    const b = i + 1 < texto.length ? texto.charCodeAt(i + 1) & 0xff : -1;
    const c = i + 2 < texto.length ? texto.charCodeAt(i + 2) & 0xff : -1;
    const triplo = (a << 16) | ((b < 0 ? 0 : b) << 8) | (c < 0 ? 0 : c);
    saida += B64[(triplo >> 18) & 63] + B64[(triplo >> 12) & 63];
    saida += b < 0 ? '=' : B64[(triplo >> 6) & 63];
    saida += c < 0 ? '=' : B64[triplo & 63];
  }
  return saida;
}

export function magnitude(x: number, y: number, z: number) {
  return Math.sqrt(x * x + y * y + z * z);
}
