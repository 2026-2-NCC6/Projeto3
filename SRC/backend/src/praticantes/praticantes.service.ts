import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditoriaService } from '../auditoria/auditoria.service';
import type { ContextoRequisicao } from '../comum/contexto';
import { invalido, naoEncontrado } from '../comum/erros';
import { PrismaService } from '../prisma/prisma.service';
import { AtualizarPraticanteDto, DependenteDto } from './dto';
import { FAIXAS_ADULTAS, FAIXAS_MENORES } from './faixas';

@Injectable()
export class PraticantesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService
  ) {}

  listar(contaId: string) {
    return this.prisma.praticante.findMany({ where: { contaId }, orderBy: [{ tipo: 'desc' }, { criadoEm: 'asc' }] });
  }

  /**
   * Só o responsável acessa os praticantes da conta (proteção reforçada de menores, §3).
   * Praticante de outra conta responde 404, sem revelar que existe.
   */
  async garantirPosse(praticanteId: string, contaId: string) {
    const p = await this.prisma.praticante.findUnique({ where: { id: praticanteId } });
    if (!p || p.contaId !== contaId) throw naoEncontrado('Praticante');
    return p;
  }

  async criarDependente(dto: DependenteDto, ctx: ContextoRequisicao) {
    if (!dto.consentimentoParental) {
      throw invalido('CONSENTIMENTO_PARENTAL_OBRIGATORIO', 'O responsável precisa consentir com o tratamento dos dados do menor.');
    }
    const p = await this.prisma.praticante.create({
      data: {
        contaId: ctx.usuario.id,
        tipo: 'DEPENDENTE',
        apelido: dto.apelido.trim(),
        faixaEtaria: dto.faixaEtaria,
        nivel: dto.nivel ?? 'INICIANTE',
        consenteTelemetria: dto.consenteTelemetria ?? false,
        consentimentoParentalEm: new Date()
      }
    });
    await this.auditoria.registrar(ctx, { acao: 'DEPENDENTE_CRIADO', alvoTipo: 'praticante', alvoId: p.id });
    return p;
  }

  async atualizar(id: string, dto: AtualizarPraticanteDto, ctx: ContextoRequisicao) {
    const p = await this.garantirPosse(id, ctx.usuario.id);
    if (dto.faixaEtaria) {
      const permitidas = p.tipo === 'TITULAR' ? FAIXAS_ADULTAS : FAIXAS_MENORES;
      if (!permitidas.includes(dto.faixaEtaria)) {
        throw invalido('FAIXA_ETARIA_INCOMPATIVEL', p.tipo === 'TITULAR' ? 'O titular da conta é adulto.' : 'Dependentes são menores de 18 anos.');
      }
    }
    const atualizado = await this.prisma.praticante.update({
      where: { id },
      data: { ...dto, preferencias: dto.preferencias as Prisma.InputJsonValue | undefined }
    });
    if (dto.consenteTelemetria !== undefined && dto.consenteTelemetria !== p.consenteTelemetria) {
      await this.auditoria.registrar(ctx, {
        acao: dto.consenteTelemetria ? 'CONSENTIMENTO_TELEMETRIA_CONCEDIDO' : 'CONSENTIMENTO_TELEMETRIA_REVOGADO',
        alvoTipo: 'praticante',
        alvoId: id
      });
    }
    return atualizado;
  }

  async remover(id: string, ctx: ContextoRequisicao) {
    const p = await this.garantirPosse(id, ctx.usuario.id);
    if (p.tipo === 'TITULAR') throw invalido('TITULAR_NAO_REMOVIVEL', 'Para remover o titular, exclua a conta.');
    await this.prisma.praticante.delete({ where: { id } });
    await this.auditoria.registrar(ctx, { acao: 'DEPENDENTE_REMOVIDO', alvoTipo: 'praticante', alvoId: id });
  }
}
