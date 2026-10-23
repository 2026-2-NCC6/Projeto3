import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Prisma, StatusEnvio, TipoEnvio } from '@prisma/client';
import { createHmac } from 'node:crypto';
import { conflito, naoEncontrado } from '../comum/erros';
import { Configuracao } from '../config/configuracao';
import { PrismaService } from '../prisma/prisma.service';
import { Metricas } from '../saude/metricas';
import { PlataformaMaeCliente } from './plataforma-mae.cliente';

const MAX_TENTATIVAS = 10;
const LOTE = 20;

/**
 * Fila de envio à plataforma mãe (padrão outbox). O resultado é gravado na mesma transação que
 * encerra a sessão e enviado depois, com retry e backoff: se a plataforma cair, nada se perde
 * (RNF Disponibilidade: reenvio idempotente e degradação segura).
 */
@Injectable()
export class OutboxService {
  private readonly log = new Logger('Outbox');
  private processando = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cliente: PlataformaMaeCliente,
    private readonly config: Configuracao,
    private readonly metricas: Metricas
  ) {}

  /** Identificador estável e não reversível do praticante para a plataforma mãe (minimização, LGPD). */
  pseudonimo(praticanteId: string) {
    return createHmac('sha256', this.config.jwtSegredo).update(`praticante:${praticanteId}`).digest('hex').slice(0, 32);
  }

  enfileirar(tx: Prisma.TransactionClient, sessaoId: string, envios: { tipo: TipoEnvio; payload: Prisma.InputJsonValue }[]) {
    return tx.envioPlataforma.createMany({
      data: envios.map((e) => ({ sessaoId, tipo: e.tipo, payload: e.payload, idempotencyKey: `${sessaoId}:${e.tipo}` })),
      skipDuplicates: true
    });
  }

  @Interval(30_000)
  async ciclo() {
    if (!this.config.teste) await this.processar();
  }

  async processar() {
    const resultado = { enviados: 0, falhas: 0 };
    if (this.processando) return resultado;
    this.processando = true;
    try {
      const pendentes = await this.prisma.envioPlataforma.findMany({
        where: { status: 'PENDENTE', proximaTentativaEm: { lte: new Date() } },
        orderBy: { criadoEm: 'asc' },
        take: LOTE
      });
      for (const envio of pendentes) {
        try {
          await this.cliente.enviarResultado(envio.idempotencyKey, envio.tipo, envio.payload);
          await this.prisma.envioPlataforma.update({ where: { id: envio.id }, data: { status: 'ENVIADO', enviadoEm: new Date(), ultimoErro: null } });
          resultado.enviados++;
        } catch (erro) {
          const tentativas = envio.tentativas + 1;
          const esperaMin = Math.min(2 ** tentativas, 60);
          await this.prisma.envioPlataforma.update({
            where: { id: envio.id },
            data: {
              tentativas,
              status: tentativas >= MAX_TENTATIVAS ? 'FALHOU' : 'PENDENTE',
              proximaTentativaEm: new Date(Date.now() + esperaMin * 60_000),
              ultimoErro: String((erro as Error).message ?? erro).slice(0, 500)
            }
          });
          this.metricas.falhasEnvio.inc();
          this.log.warn({ envio: envio.idempotencyKey, tentativas, err: erro }, 'Falha ao enviar à plataforma mãe');
          resultado.falhas++;
        }
      }
    } finally {
      this.processando = false;
    }
    return resultado;
  }

  listar(status?: StatusEnvio) {
    return this.prisma.envioPlataforma.findMany({
      where: { status },
      orderBy: { criadoEm: 'desc' },
      take: 200,
      select: { id: true, sessaoId: true, tipo: true, idempotencyKey: true, status: true, tentativas: true, proximaTentativaEm: true, ultimoErro: true, criadoEm: true, enviadoEm: true }
    });
  }

  async reprocessar(id: string) {
    const envio = await this.prisma.envioPlataforma.findUnique({ where: { id } });
    if (!envio) throw naoEncontrado('Envio');
    if (envio.status !== 'FALHOU') throw conflito('ENVIO_NAO_FALHOU', 'Só envios que falharam podem ser reprocessados.');
    return this.prisma.envioPlataforma.update({ where: { id }, data: { status: 'PENDENTE', tentativas: 0, proximaTentativaEm: new Date() } });
  }
}
