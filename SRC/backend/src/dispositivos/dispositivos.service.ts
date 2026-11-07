import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { timingSafeEqual } from 'node:crypto';
import { AuditoriaService } from '../auditoria/auditoria.service';
import type { ContextoRequisicao } from '../comum/contexto';
import { Cifra } from '../comum/cifra';
import { conflito, invalido, naoEncontrado, proibido } from '../comum/erros';
import { Configuracao } from '../config/configuracao';
import { PrismaService } from '../prisma/prisma.service';
import { RegistrarDispositivoDto, StatusDispositivoDto } from './dto';

/** Chave de segredo.exemplo.h do firmware: pública, nunca pode ser cadastrada. */
const CHAVE_EXEMPLO = '000102030405060708090A0B0C0D0E0F';
/** Primeira versão do firmware com o BLE autenticado; abaixo dela a raquete não inicia sessão. */
export const FIRMWARE_MINIMO_SEGURO = '1.1.0';

@Injectable()
export class DispositivosService {
  private readonly cifra: Cifra;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    config: Configuracao
  ) {
    this.cifra = new Cifra(config.chaveDispositivos);
  }

  listar(contaId: string) {
    return this.prisma.dispositivo.findMany({ where: { contaId }, orderBy: { criadoEm: 'asc' } });
  }

  /**
   * A chave apresentada é a mesma guardada para esta raquete? Serve como prova de posse física na
   * transferência de vínculo. Compara em tempo constante para não vazar o prefixo correto, e trata
   * um registro ilegível (chave ausente ou adulterada no banco) como "não confere".
   */
  private chaveConfere(chaveCifrada: string | null, apresentada: string) {
    if (!chaveCifrada) return false;
    let guardada: string;
    try {
      guardada = this.cifra.decifrar(chaveCifrada);
    } catch {
      return false;
    }
    const a = Buffer.from(guardada, 'utf8');
    const b = Buffer.from(apresentada.toUpperCase(), 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  }

  async registrar(dto: RegistrarDispositivoDto, ctx: ContextoRequisicao) {
    const { chave, ...dados } = dto;
    if (chave.toUpperCase() === CHAVE_EXEMPLO) {
      throw invalido('CHAVE_DE_EXEMPLO', 'Esta é a chave pública de exemplo. Grave uma chave própria na raquete (segredo.h).');
    }
    const chaveCifrada = this.cifra.cifrar(chave.toUpperCase());
    // `omit: { chaveCifrada: false }` porque a transferência de posse precisa comparar a chave
    // guardada com a apresentada; por padrão essa coluna não sai do banco (ver PrismaService).
    const existente = await this.prisma.dispositivo.findUnique({
      where: { identificador: dto.identificador },
      omit: { chaveCifrada: false }
    });
    if (existente && existente.contaId !== ctx.usuario.id) {
      // Uma raquete não pertence a uma conta para sempre: ela é um objeto físico que troca de mão
      // (outro aluno, outro celular, outro perfil). Quem apresenta a chave correta provou posse
      // física dela — o app só consegue a chave depois de autenticar na própria placa por HMAC.
      // Então a chave é o título de posse, e o vínculo é transferido em vez de recusado.
      if (!this.chaveConfere(existente.chaveCifrada, chave)) {
        await this.auditoria.registrar(ctx, {
          acao: 'DISPOSITIVO_DE_OUTRA_CONTA',
          alvoTipo: 'dispositivo',
          alvoId: existente.id,
          severidade: 'INCIDENTE'
        });
        throw conflito(
          'DISPOSITIVO_JA_VINCULADO',
          'Esta raquete está vinculada a outra conta e a chave informada não é a dela. Confira a chave gravada em segredo.h.'
        );
      }
      const d = await this.prisma.dispositivo.update({
        where: { id: existente.id },
        data: { ...dados, chaveCifrada, contaId: ctx.usuario.id }
      });
      // Transferência de posse é um evento sensível: fica registrado para os dois lados, com as
      // contas envolvidas, mesmo sendo uma operação legítima.
      await this.auditoria.registrar(ctx, {
        acao: 'DISPOSITIVO_TRANSFERIDO',
        alvoTipo: 'dispositivo',
        alvoId: d.id,
        detalhes: { deConta: existente.contaId, paraConta: ctx.usuario.id }
      });
      return d;
    }
    if (existente) {
      // Mesmo dono registrando de novo: a raquete pode ter sido regravada com outra chave.
      const d = await this.prisma.dispositivo.update({ where: { id: existente.id }, data: { ...dados, chaveCifrada } });
      await this.auditoria.registrar(ctx, { acao: 'CHAVE_DISPOSITIVO_ATUALIZADA', alvoTipo: 'dispositivo', alvoId: d.id });
      return d;
    }
    const d = await this.prisma.dispositivo.create({ data: { ...dados, chaveCifrada, contaId: ctx.usuario.id } });
    await this.auditoria.registrar(ctx, { acao: 'DISPOSITIVO_REGISTRADO', alvoTipo: 'dispositivo', alvoId: d.id });
    return d;
  }

  /**
   * Entrega a chave do BLE só ao dono autenticado, para o app provar à raquete que é autorizado
   * (RNF Cibersegurança do IoT). Assim a chave não fica embutida no app instalado.
   */
  async chave(id: string, ctx: ContextoRequisicao) {
    const d = await this.prisma.dispositivo.findUnique({ where: { id }, omit: { chaveCifrada: false } });
    if (!d || d.contaId !== ctx.usuario.id) throw naoEncontrado('Dispositivo');
    if (d.bloqueado) {
      await this.auditoria.registrar(ctx, { acao: 'CHAVE_DE_DISPOSITIVO_BLOQUEADO', alvoTipo: 'dispositivo', alvoId: id, severidade: 'INCIDENTE' });
      throw proibido('Esta raquete foi bloqueada pelo administrador.');
    }
    if (!d.chaveCifrada) throw naoEncontrado('Chave da raquete');
    await this.auditoria.registrar(ctx, { acao: 'CHAVE_DISPOSITIVO_ENTREGUE', alvoTipo: 'dispositivo', alvoId: id });
    return { chave: this.cifra.decifrar(d.chaveCifrada) };
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
