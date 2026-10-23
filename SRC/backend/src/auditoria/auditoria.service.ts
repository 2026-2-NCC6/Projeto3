import { Injectable, Logger } from '@nestjs/common';
import { Prisma, Severidade } from '@prisma/client';
import type { ContextoRequisicao } from '../comum/contexto';
import { PrismaService } from '../prisma/prisma.service';

export type RegistroAuditoria = {
  acao: string;
  alvoTipo?: string;
  alvoId?: string;
  severidade?: Severidade;
  detalhes?: Prisma.InputJsonValue;
  usuarioId?: string | null;
};

/** RF23: ações administrativas, publicação, autenticação, comandos, falhas e incidentes. */
@Injectable()
export class AuditoriaService {
  private readonly log = new Logger('Auditoria');

  constructor(private readonly prisma: PrismaService) {}

  /** Nunca derruba a operação principal: falha de auditoria vira log de erro. */
  async registrar(ctx: Partial<ContextoRequisicao> | null, r: RegistroAuditoria) {
    const severidade = r.severidade ?? 'INFO';
    try {
      await this.prisma.auditoria.create({
        data: {
          acao: r.acao,
          alvoTipo: r.alvoTipo,
          alvoId: r.alvoId,
          severidade,
          detalhes: r.detalhes ?? {},
          usuarioId: r.usuarioId !== undefined ? r.usuarioId : (ctx?.usuario?.id ?? null),
          ip: ctx?.ip ?? null,
          requestId: ctx?.requestId ?? null
        }
      });
    } catch (erro) {
      this.log.error({ err: erro, acao: r.acao }, 'Falha ao gravar auditoria');
    }
    if (severidade === 'INCIDENTE') this.log.warn({ acao: r.acao, alvoId: r.alvoId, requestId: ctx?.requestId }, 'Incidente de segurança');
  }

  async listar(filtro: { acao?: string; severidade?: Severidade; de?: Date; ate?: Date; pagina: number; limite: number }) {
    const where: Prisma.AuditoriaWhereInput = {
      acao: filtro.acao,
      severidade: filtro.severidade,
      ocorridoEm: { gte: filtro.de, lte: filtro.ate }
    };
    const [total, itens] = await Promise.all([
      this.prisma.auditoria.count({ where }),
      this.prisma.auditoria.findMany({
        where,
        orderBy: { ocorridoEm: 'desc' },
        skip: (filtro.pagina - 1) * filtro.limite,
        take: filtro.limite
      })
    ]);
    return { total, pagina: filtro.pagina, itens: itens.map((a) => ({ ...a, id: a.id.toString() })) };
  }
}
