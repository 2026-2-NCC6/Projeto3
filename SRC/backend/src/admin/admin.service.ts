import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { TokensService } from '../auth/tokens.service';
import type { ContextoRequisicao } from '../comum/contexto';
import { conflito, invalido, naoEncontrado } from '../comum/erros';
import { PrismaService } from '../prisma/prisma.service';
import { AtualizarUsuarioDto, BloqueioDto, CategoriaDto, FiltroSessoesDto, FiltroUsuariosDto } from './dto';

const pagina = (f: { pagina?: number; limite?: number }) => ({ skip: ((f.pagina ?? 1) - 1) * (f.limite ?? 50), take: f.limite ?? 50 });

/** RF17: gestão de usuários, dispositivos, categorias, permissões e sessões. Toda alteração é auditada. */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
    private readonly auditoria: AuditoriaService
  ) {}

  usuarios(f: FiltroUsuariosDto) {
    const where: Prisma.UsuarioWhereInput = f.busca
      ? { OR: [{ email: { contains: f.busca, mode: 'insensitive' } }, { nome: { contains: f.busca, mode: 'insensitive' } }] }
      : {};
    return this.prisma.usuario.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
      ...pagina(f),
      select: { id: true, email: true, nome: true, papel: true, ativo: true, criadoEm: true, anonimizadoEm: true }
    });
  }

  async atualizarUsuario(id: string, dto: AtualizarUsuarioDto, ctx: ContextoRequisicao) {
    if (id === ctx.usuario.id) throw invalido('AUTO_ALTERACAO', 'Um admin não pode alterar o próprio papel ou status.');
    const antes = await this.prisma.usuario.findUnique({ where: { id } });
    if (!antes || antes.anonimizadoEm) throw naoEncontrado('Usuário');
    const u = await this.prisma.usuario.update({ where: { id }, data: dto, select: { id: true, email: true, nome: true, papel: true, ativo: true } });
    // Papel e status vão no token: forçar novo login aplica a mudança na hora.
    await this.tokens.revogarTodos(id);
    await this.auditoria.registrar(ctx, {
      acao: 'USUARIO_ALTERADO',
      alvoTipo: 'usuario',
      alvoId: id,
      detalhes: { de: { papel: antes.papel, ativo: antes.ativo }, para: { papel: u.papel, ativo: u.ativo } }
    });
    return u;
  }

  async criarCategoria(dto: CategoriaDto, ctx: ContextoRequisicao) {
    if (await this.prisma.categoria.findUnique({ where: { slug: dto.slug } })) throw conflito('SLUG_EM_USO', 'Já existe uma categoria com este slug.');
    const c = await this.prisma.categoria.create({ data: dto });
    await this.auditoria.registrar(ctx, { acao: 'CATEGORIA_CRIADA', alvoTipo: 'categoria', alvoId: c.id });
    return c;
  }

  async atualizarCategoria(id: string, dto: CategoriaDto, ctx: ContextoRequisicao) {
    const c = await this.prisma.categoria.update({ where: { id }, data: dto });
    await this.auditoria.registrar(ctx, { acao: 'CATEGORIA_ALTERADA', alvoTipo: 'categoria', alvoId: id });
    return c;
  }

  async removerCategoria(id: string, ctx: ContextoRequisicao) {
    await this.prisma.categoria.delete({ where: { id } });
    await this.auditoria.registrar(ctx, { acao: 'CATEGORIA_REMOVIDA', alvoTipo: 'categoria', alvoId: id });
  }

  dispositivos() {
    return this.prisma.dispositivo.findMany({ orderBy: { criadoEm: 'desc' }, include: { conta: { select: { email: true } } } });
  }

  /** Bloqueio de dispositivo comprometido (RNF IoT: bloqueio de comandos indevidos). */
  async bloquear(id: string, dto: BloqueioDto, ctx: ContextoRequisicao) {
    const d = await this.prisma.dispositivo.update({ where: { id }, data: { bloqueado: dto.bloqueado } });
    await this.auditoria.registrar(ctx, {
      acao: dto.bloqueado ? 'DISPOSITIVO_BLOQUEADO' : 'DISPOSITIVO_DESBLOQUEADO',
      alvoTipo: 'dispositivo',
      alvoId: id,
      severidade: dto.bloqueado ? 'INCIDENTE' : 'INFO',
      detalhes: { motivo: dto.motivo }
    });
    return d;
  }

  sessoes(f: FiltroSessoesDto) {
    return this.prisma.sessao.findMany({
      where: { estado: f.estado },
      orderBy: { criadoEm: 'desc' },
      ...pagina(f),
      select: {
        id: true,
        estado: true,
        origem: true,
        offline: true,
        divergencia: true,
        motivoInterrupcao: true,
        iniciadaEm: true,
        encerradaEm: true,
        pontos: true,
        golpes: true,
        acertos: true,
        dispositivoId: true,
        versao: { select: { numero: true, treino: { select: { slug: true } } } }
      }
    });
  }
}
