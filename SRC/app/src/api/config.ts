// URL da API. Em produção, o endereço HTTPS do deploy (RNF: comunicação cifrada); em
// desenvolvimento, o IP da máquina na rede local. Ver SRC/app/.env.example.
const url = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1').replace(/\/$/, '');

export const API_URL = url;
/** Origem do servidor, usada pelo Socket.IO do simulador (namespace /maquina). */
export const ORIGEM_API = url.replace(/\/api\/v1$/, '');
/** Versão dos termos de uso e da política de privacidade aceita no cadastro. */
export const TERMOS_VERSAO = '2026-10';
