import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditoriaService } from '../auditoria/auditoria.service';
import type { ContextoRequisicao } from '../comum/contexto';
import { conflito, naoEncontrado } from '../comum/erros';
import { PrismaService } from '../prisma/prisma.service';
import { RegistrarDispositivoDto, StatusDispositivoDto } from './dto';

@Injectable()
export class DispositivosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService
  ) {}

  listar(contaId: string) {
    return this.prisma.dispositivo.findMany({ where: { contaId }, orderBy: { criadoEm: 'asc' } });
  }

  async registrar(dto: RegistrarDispositivoDto, ctx: ContextoRequisicao) {
    const existente = await this.prisma.dispositivo.findUnique({ where: { identificador: dto.identificador } });
    if (existente && existente.contaId !== ctx.usuario.id) {
      await this.auditoria.registrar(ctx, {
        acao: 'DISPOSITIVO_DE_OUTRA_CONTA',
        alvoTipo: 'dispositivo',
        alvoId: existente.id,
        severidade: 'INCIDENTE'
      });
      throw conflito('DISPOSITIVO_JA_VINCULADO', 'Esta raquete já está vinculada a outra conta.');
    }
    if (existente) return existente;
    const d = await this.prisma.dispositivo.create({ data: { ...dto, contaId: ctx.usuario.id } });
    await this.auditoria.registrar(ctx, { acao: 'DISPOSITIVO_REGISTRADO', alvoTipo: 'dispositivo', alvoId: d.id });
    return d;
  }

  async garantirPosse(id: string, contaId: string) {
    const d = await this.prisma.dispositivo.findUnique({ where: { id } });
    if (!d || d.contaId !== contaId) throw naoEncontrado('Dispositivo');
    return d;
  }

  /** RF05: status dos sensores e da comunicação, reportado pelo app após o pareamento BLE. */
  async atualizarStatus(id: string, dto: StatusDispositivoDto, ctx: ContextoRequisicao) {
    const d = await this.garantirPosse(id, ctx.usuario.id);
    const { firmwareVersao, ...status } = dto;
    const atualizado = await this.prisma.dispositivo.update({
      where: { id },
      data: { ultimoStatus: status as unknown as Prisma.InputJsonValue, ultimoContatoEm: new Date(), firmwareVersao }
    });
    // Atualização controlada (RNF IoT): toda troca de firmware fica registrada.
    if (firmwareVersao && firmwareVersao !== d.firmwareVersao) {
      await this.auditoria.registrar(ctx, {
        acao: 'FIRMWARE_ATUALIZADO',
        alvoTipo: 'dispositivo',
        alvoId: id,
        detalhes: { de: d.firmwareVersao, para: firmwareVersao }
      });
    }
    return atualizado;
  }

  async remover(id: string, ctx: ContextoRequisicao) {
    await this.garantirPosse(id, ctx.usuario.id);
    const ativa = await this.prisma.sessao.findFirst({ where: { dispositivoId: id, estado: { in: ['EM_EXECUCAO', 'PAUSADA', 'PARADA_SEGURA'] } } });
    if (ativa) throw conflito('DISPOSITIVO_EM_USO', 'Encerre a sessão em andamento antes de remover a raquete.');
    await this.prisma.dispositivo.delete({ where: { id } });
    await this.auditoria.registrar(ctx, { acao: 'DISPOSITIVO_REMOVIDO', alvoTipo: 'dispositivo', alvoId: id });
  }
}
