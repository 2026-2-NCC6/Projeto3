import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Papel } from '@prisma/client';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { AuditoriaService } from '../auditoria/auditoria.service';
import type { PayloadAcesso } from '../comum/autenticacao.guard';
import type { ContextoRequisicao } from '../comum/contexto';
import { ErroApi } from '../comum/erros';
import { Configuracao } from '../config/configuracao';
import { PrismaService } from '../prisma/prisma.service';

export type ParDeTokens = { accessToken: string; refreshToken: string; expiraEmSeg: number };

const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const refreshInvalido = () => new ErroApi(HttpStatus.UNAUTHORIZED, 'REFRESH_INVALIDO', 'Sessão expirada. Faça login novamente.');

/**
 * Access token JWT curto + refresh token opaco e rotativo. Só o hash do refresh vai ao banco.
 * Reapresentar um refresh já trocado indica roubo: a família inteira é revogada (A07).
 */
@Injectable()
export class TokensService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: Configuracao,
    private readonly auditoria: AuditoriaService
  ) {}

  async emitir(usuario: { id: string; papel: Papel }, familiaId: string = randomUUID()): Promise<ParDeTokens> {
    const payload: PayloadAcesso = { sub: usuario.id, papel: usuario.papel };
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: `${this.config.jwtAcessoMin}m`, algorithm: 'HS256' });
    const refreshToken = randomBytes(48).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        usuarioId: usuario.id,
        familiaId,
        tokenHash: hash(refreshToken),
        expiraEm: new Date(Date.now() + this.config.refreshDias * 86_400_000)
      }
    });
    return { accessToken, refreshToken, expiraEmSeg: this.config.jwtAcessoMin * 60 };
  }

  async rotacionar(refreshToken: string, ctx: Partial<ContextoRequisicao>): Promise<ParDeTokens> {
    const atual = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hash(refreshToken) }, include: { usuario: true } });
    if (!atual) throw refreshInvalido();

    if (atual.revogadoEm) {
      await this.revogarFamilia(atual.familiaId);
      await this.auditoria.registrar(ctx, {
        acao: 'REFRESH_REUTILIZADO',
        alvoTipo: 'usuario',
        alvoId: atual.usuarioId,
        usuarioId: atual.usuarioId,
        severidade: 'INCIDENTE'
      });
      throw refreshInvalido();
    }
    if (atual.expiraEm < new Date() || !atual.usuario.ativo) throw refreshInvalido();

    const novo = await this.emitir(atual.usuario, atual.familiaId);
    const registroNovo = await this.prisma.refreshToken.findUniqueOrThrow({ where: { tokenHash: hash(novo.refreshToken) } });
    // Só revoga se ninguém trocou este token em paralelo; se trocou, é reuso.
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id: atual.id, revogadoEm: null },
      data: { revogadoEm: new Date(), substituidoPorId: registroNovo.id }
    });
    if (count === 0) {
      await this.revogarFamilia(atual.familiaId);
      throw refreshInvalido();
    }
    return novo;
  }

  async revogar(refreshToken: string) {
    const atual = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hash(refreshToken) } });
    if (atual) await this.revogarFamilia(atual.familiaId);
  }

  async revogarTodos(usuarioId: string) {
    await this.prisma.refreshToken.updateMany({ where: { usuarioId, revogadoEm: null }, data: { revogadoEm: new Date() } });
  }

  private async revogarFamilia(familiaId: string) {
    await this.prisma.refreshToken.updateMany({ where: { familiaId, revogadoEm: null }, data: { revogadoEm: new Date() } });
  }
}
