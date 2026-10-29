import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { AddressInfo } from 'node:net';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/app.setup';
import { Configuracao } from '../src/config/configuracao';
import { semear } from '../prisma/semente';

export type Contexto = { app: INestApplication; url: string; http: ReturnType<typeof request> };

/** Cliente com o papel dono do schema de teste: só para limpar e semear. */
export function clienteDono() {
  return new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL_TEST } } });
}

export async function prepararBanco() {
  const dono = clienteDono();
  const tabelas = await dono.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations'`;
  await dono.$executeRawUnsafe(`TRUNCATE ${tabelas.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
  await semear(dono, { adminEmail: process.env.ADMIN_EMAIL!, adminSenha: process.env.ADMIN_SENHA! });
  await dono.$disconnect();
}

export async function subirApp(): Promise<Contexto> {
  const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = modulo.createNestApplication();
  configurarApp(app);
  await app.listen(0);
  const { port } = app.getHttpServer().address() as AddressInfo;
  const url = `http://127.0.0.1:${port}`;
  // O mock da plataforma mãe está neste mesmo servidor, numa porta só conhecida agora.
  app.get(Configuracao).plataformaMaeUrl = `${url}/api/v1/mock/plataforma-mae`;
  return { app, url, http: request(app.getHttpServer()) };
}

export function conectarMaquina(url: string, token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = io(`${url}/maquina`, { auth: { token }, transports: ['websocket'], reconnection: false });
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
}

export function esperarEventos<T>(socket: Socket, nome: string, quantidade: number, timeoutMs = 15000): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const recebidos: T[] = [];
    const timer = setTimeout(() => reject(new Error(`esperava ${quantidade} "${nome}", recebeu ${recebidos.length}`)), timeoutMs);
    socket.on(nome, (dado: T) => {
      recebidos.push(dado);
      if (recebidos.length === quantidade) {
        clearTimeout(timer);
        resolve(recebidos);
      }
    });
  });
}
