import { HttpStatus, Injectable } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { AuditoriaService } from '../auditoria/auditoria.service';
import type { ContextoRequisicao } from '../comum/contexto';
import { ErroApi, conflito } from '../comum/erros';
import { PrismaService } from '../prisma/prisma.service';
import { CadastroDto, LoginDto } from './dto';
import { TokensService } from './tokens.service';

export const CUSTO_BCRYPT = 12;

@Injectable()
export class AuthService {
  /** Hash descartável: login de e-mail inexistente custa o mesmo tempo (evita enumeração por tempo). */
  private hashFalso: Promise<string> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
    private readonly auditoria: AuditoriaService
  ) {}

  async cadastrar(dto: CadastroDto, ctx: Partial<ContextoRequisicao>) {
    const email = dto.email.trim().toLowerCase();
    if (await this.prisma.usuario.findUnique({ where: { email } })) throw conflito('EMAIL_EM_USO', 'Já existe uma conta com este e-mail.');

    const usuario = await this.prisma.usuario.create({
      data: {
        email,
        senhaHash: await hash(dto.senha, CUSTO_BCRYPT),
        nome: dto.nome.trim(),
        declaraMaioridade: true,
        termosVersao: dto.termosVersao,
        termosAceitosEm: new Date(),
        praticantes: {
          create: { tipo: 'TITULAR', apelido: dto.nome.trim().split(' ')[0], faixaEtaria: dto.faixaEtaria, nivel: dto.nivel ?? 'INICIANTE' }
        }
      }
    });
    await this.auditoria.registrar(ctx, { acao: 'CONTA_CRIADA', alvoTipo: 'usuario', alvoId: usuario.id, usuarioId: usuario.id });
    return { usuario: this.publico(usuario), ...(await this.tokens.emitir(usuario)) };
  }

  async login(dto: LoginDto, ctx: Partial<ContextoRequisicao>) {
    const email = dto.email.trim().toLowerCase();
    const usuario = await this.prisma.usuario.findUnique({ where: { email } });
    const confere = await compare(dto.senha, usuario?.senhaHash ?? (await this.obterHashFalso()));

    if (!usuario || !confere || !usuario.ativo) {
      await this.auditoria.registrar(ctx, {
        acao: 'LOGIN_FALHA',
        alvoTipo: 'usuario',
        alvoId: usuario?.id,
        usuarioId: usuario?.id ?? null,
        detalhes: { motivo: !usuario ? 'email_desconhecido' : !confere ? 'senha_incorreta' : 'conta_inativa' }
      });
      throw new ErroApi(HttpStatus.UNAUTHORIZED, 'CREDENCIAIS_INVALIDAS', 'E-mail ou senha incorretos.');
    }

    await this.auditoria.registrar(ctx, { acao: 'LOGIN', alvoTipo: 'usuario', alvoId: usuario.id, usuarioId: usuario.id });
    return { usuario: this.publico(usuario), ...(await this.tokens.emitir(usuario)) };
  }

  publico(u: { id: string; email: string; nome: string; papel: string }) {
    return { id: u.id, email: u.email, nome: u.nome, papel: u.papel };
  }

  private obterHashFalso() {
    this.hashFalso ??= hash(randomBytes(16).toString('hex'), CUSTO_BCRYPT);
    return this.hashFalso;
  }
}
