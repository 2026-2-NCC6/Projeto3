// Contrato BLE: plano-app-ble.md, seção 1. O firmware (SRC/arduino/tennis_imu) segue o mesmo quadro.
export const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
export const CHAR_DADOS_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';
export const CHAR_CMD_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a9';
export const NOME_DISPOSITIVO = 'ArduinoR4-IMU';

export const TAMANHO_MAX_MSG = 20;
export const SEQ_MAX = 9999;

export type Comando = 'START' | 'PAUSE' | 'RESUME' | 'STOP' | 'PING' | 'DBG:0' | 'DBG:1';

export type EstadoDispositivo = 'AGUARDANDO' | 'COLETANDO' | 'PAUSADO' | 'PARADO';

/** Acelerômetro em g, giroscópio em rad/s. */
export type Amostra = { ax: number; ay: number; az: number; gx: number; gy: number; gz: number };

export type GolpeSensor = {
  lado: 'Forehand' | 'Backhand';
  picoG: number;
  picoGiro: number;
  forca: 1 | 2 | 3;
  seq: number;
};

export type Mensagem =
  | { tipo: 'golpe'; golpe: GolpeSensor }
  | { tipo: 'estado'; estado: EstadoDispositivo }
  | { tipo: 'erro'; texto: string }
  | { tipo: 'acel'; x: number; y: number; z: number }
  | { tipo: 'giro'; x: number; y: number; z: number }
  | { tipo: 'amostra'; amostra: Amostra };

const ESTADOS: EstadoDispositivo[] = ['AGUARDANDO', 'COLETANDO', 'PAUSADO', 'PARADO'];
const NUMERO = /^-?\d+(\.\d+)?$/;
const INTEIRO = /^\d+$/;
const G = 9.80665;

function numeros(texto: string, quantidade: number): number[] | null {
  const partes = texto.split(',');
  if (partes.length !== quantidade || !partes.every((p) => NUMERO.test(p))) return null;
  return partes.map(Number);
}

function interpretarGolpe(corpo: string): GolpeSensor | null {
  const campos = corpo.split(',');
  if (campos.length !== 5) return null;
  const [lado, picoG, picoGiro, forca, seq] = campos;
  if (lado !== 'F' && lado !== 'B') return null;
  if (!NUMERO.test(picoG) || !NUMERO.test(picoGiro) || !INTEIRO.test(forca) || !INTEIRO.test(seq)) return null;
  const f = Number(forca);
  const s = Number(seq);
  if (f < 1 || f > 3 || s > SEQ_MAX || Number(picoG) < 0 || Number(picoGiro) < 0) return null;
  return {
    lado: lado === 'F' ? 'Forehand' : 'Backhand',
    picoG: Number(picoG),
    picoGiro: Number(picoGiro),
    forca: f as 1 | 2 | 3,
    seq: s
  };
}

export function interpretarMensagem(bruta: string): Mensagem | null {
  const texto = bruta.trim();

  if (texto.startsWith('S:')) {
    const golpe = interpretarGolpe(texto.slice(2));
    return golpe ? { tipo: 'golpe', golpe } : null;
  }

  if (texto.startsWith('E:')) {
    const estado = texto.slice(2) as EstadoDispositivo;
    return ESTADOS.includes(estado) ? { tipo: 'estado', estado } : null;
  }

  if (texto.startsWith('ERR:')) {
    return texto.length > 4 ? { tipo: 'erro', texto: texto.slice(4) } : null;
  }

  if (texto.startsWith('A:')) {
    // Formato antigo de uma mensagem só (m/s²), mantido por compatibilidade. Só chega inteiro com MTU maior.
    if (texto.includes('|G:')) {
      const [acel, giro] = texto.slice(2).split('|G:');
      const a = numeros(acel, 3);
      const g = numeros(giro, 3);
      if (!a || !g) return null;
      return { tipo: 'amostra', amostra: { ax: a[0] / G, ay: a[1] / G, az: a[2] / G, gx: g[0], gy: g[1], gz: g[2] } };
    }
    const a = numeros(texto.slice(2), 3);
    return a ? { tipo: 'acel', x: a[0], y: a[1], z: a[2] } : null;
  }

  if (texto.startsWith('G:')) {
    const g = numeros(texto.slice(2), 3);
    return g ? { tipo: 'giro', x: g[0], y: g[1], z: g[2] } : null;
  }

  return null;
}

/**
 * Decide se um golpe com `seq` deve ser contado, dado o último aceito.
 * seq vai de 1 a 9999 e volta a 1; uma distância "para trás" é tratada como duplicata/atraso.
 * `ultimo` deve ser zerado (null) a cada nova conexão, porque a placa zera o seq no boot.
 */
export function avaliarSeq(ultimo: number | null, seq: number): { aceitar: boolean; lacuna: number } {
  if (ultimo === null) return { aceitar: true, lacuna: 0 };
  const distancia = (((seq - ultimo) % SEQ_MAX) + SEQ_MAX) % SEQ_MAX;
  if (distancia === 0 || distancia >= SEQ_MAX / 2) return { aceitar: false, lacuna: 0 };
  return { aceitar: true, lacuna: distancia - 1 };
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
    acumulado = ((acumulado << 6) | v) & 0xffffff;
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
