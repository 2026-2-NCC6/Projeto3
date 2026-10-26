import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/** Colunas que nunca saem do banco sem pedido explícito (`omit: { coluna: false }`). */
export const OMITIR_SEGREDOS = { dispositivo: { chaveCifrada: true } } as const;

@Injectable()
export class PrismaService extends PrismaClient<{ omit: typeof OMITIR_SEGREDOS }> implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({ omit: OMITIR_SEGREDOS });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
