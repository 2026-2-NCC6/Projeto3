import { Injectable } from '@nestjs/common';
import { isDeepStrictEqual } from 'node:util';
import { AuditoriaService } from '../auditoria/auditoria.service';
import type { ContextoRequisicao } from '../comum/contexto';
import { ParametrosService } from '../parametros/parametros.service';
import { PrismaService } from '../prisma/prisma.service';
import { colunasDoConteudo } from '../treinos/treinos.service';
import { validarConteudo } from '../treinos/validacao';
import { PlataformaMaeCliente } from './plataforma-mae.cliente';

/**
 * Igualdade de conteúdo JSON. O jsonb reordena chaves e objetos podem vir de realms diferentes
 * (ex.: fetch nativo vs. Prisma), então os dois lados são normalizados antes da comparação.
 */
const mesmoJson = (a: unknown, b: unknown) => isDeepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));

/**
 * Recebe definições de treino da plataforma mãe (§1: "receber a definição de um treino").
 * Idempotente por id externo: só cria nova versão quando o conteúdo mudou na origem.
 * Definições que violam os limites de operação são recusadas, mesmo vindas da plataforma.
 */
@Injectable()
export class ImportacaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cliente: PlataformaMaeCliente,
    private readonly parametros: ParametrosService,
    private readonly auditoria: AuditoriaService
  ) {}

  async importar(ctx: ContextoRequisicao) {
    const externos = await this.cliente.listarTreinos();
    const limites = await this.parametros.limites();
    const resultado = { criados: 0, atualizados: 0, semMudanca: 0, recusados: [] as { idExterno: string; erros: unknown }[] };

    for (const ext of externos) {
      const erros = validarConteudo(ext.conteudo, limites);
      if (erros.length) {
        resultado.recusados.push({ idExterno: ext.idExterno, erros });
        continue;
      }
      const existente = await this.prisma.treino.findUnique({
        where: { idExterno: ext.idExterno },
        include: { versoes: { orderBy: { numero: 'desc' }, take: 1 } }
      });

      if (!existente) {
        const slugLivre = !(await this.prisma.treino.findUnique({ where: { slug: ext.slug } }));
        await this.prisma.treino.create({
          data: {
            slug: slugLivre ? ext.slug : `pm-${ext.slug}`,
            nome: ext.nome,
            autorId: ctx.usuario.id,
            origem: 'PLATAFORMA_MAE',
            idExterno: ext.idExterno,
            versoes: {
              create: {
                numero: 1,
                status: 'PUBLICADA',
                publicadoEm: new Date(),
                ...colunasDoConteudo(ext.conteudo),
                compatibilidadeFirmware: ext.compatibilidadeFirmware,
                notasAlteracao: 'Importado da plataforma mãe',
                criadoPorId: ctx.usuario.id
              }
            }
          }
        });
        resultado.criados++;
        continue;
      }

      const ultima = existente.versoes[0];
      if (mesmoJson(ultima.conteudo, ext.conteudo) && ultima.compatibilidadeFirmware === ext.compatibilidadeFirmware) {
        resultado.semMudanca++;
        continue;
      }
      await this.prisma.$transaction([
        this.prisma.treinoVersao.updateMany({ where: { treinoId: existente.id, status: 'PUBLICADA' }, data: { status: 'ARQUIVADA' } }),
        this.prisma.treinoVersao.create({
          data: {
            treinoId: existente.id,
            numero: ultima.numero + 1,
            status: 'PUBLICADA',
            publicadoEm: new Date(),
            ...colunasDoConteudo(ext.conteudo),
            compatibilidadeFirmware: ext.compatibilidadeFirmware,
            notasAlteracao: 'Atualizado pela plataforma mãe',
            criadoPorId: ctx.usuario.id
          }
        })
      ]);
      resultado.atualizados++;
    }

    await this.auditoria.registrar(ctx, {
      acao: 'TREINOS_IMPORTADOS',
      detalhes: { criados: resultado.criados, atualizados: resultado.atualizados, recusados: resultado.recusados.length }
    });
    return resultado;
  }
}
