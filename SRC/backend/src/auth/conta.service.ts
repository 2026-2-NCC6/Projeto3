import { HttpStatus, Injectable } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { AuditoriaService } from '../auditoria/auditoria.service';
import type { ContextoRequisicao } from '../comum/contexto';
import { ErroApi, naoEncontrado } from '../comum/erros';
import { PrismaService } from '../prisma/prisma.service';
import { CUSTO_BCRYPT } from './auth.service';
import { TokensService } from './tokens.service';

/** Dados da própria conta e direitos do titular (LGPD art. 18: acesso, portabilidade, eliminação). */
@Injectable()
export class ContaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
    private readonly auditoria: AuditoriaService
  ) {}

  async eu(usuarioId: string) {
    const u = await this.prisma.usuario.findUnique({ where: { id: usuarioId }, include: { praticantes: true } });
    if (!u || !u.ativo) throw naoEncontrado('Conta');
    return {
      id: u.id,
      email: u.email,
      nome: u.nome,
      papel: u.papel,
      termosVersao: u.termosVersao,
      termosAceitosEm: u.termosAceitosEm,
      praticantes: u.praticantes
    };
  }

  async exportar(ctx: ContextoRequisicao) {
    const conta = await this.eu(ctx.usuario.id);
    const [dispositivos, sessoes] = await Promise.all([
      this.prisma.dispositivo.findMany({ where: { contaId: ctx.usuario.id } }),
      this.prisma.sessao.findMany({
        where: { praticante: { contaId: ctx.usuario.id } },
        include: { eventos: { orderBy: { tMs: 'asc' } }, versao: { select: { numero: true, treino: { select: { slug: true } } } } }
      })
    ]);
    await this.auditoria.registrar(ctx, { acao: 'DADOS_EXPORTADOS', alvoTipo: 'usuario', alvoId: ctx.usuario.id });
    return { geradoEm: new Date(), conta, dispositivos, sessoes };
  }

  /**
   * Remove praticantes (e, em cascata, sessões e eventos) e dispositivos; a linha da conta fica
   * anonimizada para preservar a integridade da auditoria, que não pode ser apagada pela API.
   */
  async excluir(senha: string, ctx: ContextoRequisicao) {
    const u = await this.prisma.usuario.findUnique({ where: { id: ctx.usuario.id } });
    if (!u || !u.ativo) throw naoEncontrado('Conta');
    if (!(await compare(senha, u.senhaHash))) throw new ErroApi(HttpStatus.UNAUTHORIZED, 'CREDENCIAIS_INVALIDAS', 'Senha incorreta.');

    await this.prisma.$transaction([
      this.prisma.praticante.deleteMany({ where: { contaId: u.id } }),
      this.prisma.dispositivo.deleteMany({ where: { contaId: u.id } }),
      this.prisma.usuario.update({
        where: { id: u.id },
        data: {
          email: `removido+${u.id}@anonimo.invalid`,
          nome: 'Conta removida',
          senhaHash: await hash(randomBytes(24).toString('hex'), CUSTO_BCRYPT),
          ativo: false,
          anonimizadoEm: new Date()
        }
      })
    ]);
    await this.tokens.revogarTodos(u.id);
    await this.auditoria.registrar(ctx, { acao: 'CONTA_EXCLUIDA', alvoTipo: 'usuario', alvoId: u.id });
  }
}
