import { Injectable } from '@nestjs/common';
import { Prisma, StatusVersao, Treino, TreinoVersao } from '@prisma/client';
import { AuditoriaService } from '../auditoria/auditoria.service';
import type { ContextoRequisicao, UsuarioAutenticado } from '../comum/contexto';
import { conflito, invalido, naoEncontrado, proibido } from '../comum/erros';
import { expandirLancamentos, focoLado, sequenciaEsperada } from '../maquina/plano';
import type { TreinoCatalogo } from '../pontuacao/analise';
import { golpesDeExemplo, resumirSessao } from '../pontuacao/regras';
import { ParametrosService } from '../parametros/parametros.service';
import { PrismaService } from '../prisma/prisma.service';
import type { ConteudoTreino, ModoPublico } from './conteudo';
import { CriarTreinoDto, EditarVersaoDto, FiltroCatalogoDto, MarketplaceDto } from './dto';
import { validarConteudo } from './validacao';

/** Pode ver rascunhos e editar: o autor do treino ou um admin. */
const podeEditar = (t: Treino, u: UsuarioAutenticado) => u.papel === 'ADMIN' || (u.papel === 'AUTOR' && t.autorId === u.id);
/** Abaixo disso, estatísticas agregadas poderiam identificar o praticante (LGPD). */
const MIN_PRATICANTES_ESTATISTICA = 3;

export function colunasDoConteudo(c: ConteudoTreino) {
  return {
    conteudo: c as unknown as Prisma.InputJsonValue,
    publicoAlvo: c.publicoAlvo,
    objetivo: c.objetivo,
    nivel: c.nivel,
    duracaoMin: c.duracaoMin,
    sensores: c.sensores,
    modoPublico: c.modoPublico
  };
}

@Injectable()
export class TreinosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parametros: ParametrosService,
    private readonly auditoria: AuditoriaService
  ) {}

  /** RF03: só versões publicadas, com filtros por público, objetivo, duração, dificuldade e sensor. */
  async catalogo(f: FiltroCatalogoDto) {
    const versoes = await this.prisma.treinoVersao.findMany({
      where: {
        status: 'PUBLICADA',
        nivel: f.nivel,
        modoPublico: f.modoPublico,
        duracaoMin: f.duracaoMax ? { lte: f.duracaoMax } : undefined,
        sensores: f.sensor ? { has: f.sensor } : undefined,
        publicoAlvo: f.publico ? { contains: f.publico, mode: 'insensitive' } : undefined,
        objetivo: f.objetivo ? { contains: f.objetivo, mode: 'insensitive' } : undefined,
        treino: f.categoria ? { categoria: { slug: f.categoria } } : undefined
      },
      include: { treino: { include: { autor: { select: { nome: true } }, categoria: true, marketplace: true } } },
      orderBy: { treino: { nome: 'asc' } }
    });
    return versoes.map((v) => ({
      slug: v.treino.slug,
      nome: v.treino.nome,
      autor: v.treino.autor.nome,
      origem: v.treino.origem,
      categoria: v.treino.categoria ? { slug: v.treino.categoria.slug, nome: v.treino.categoria.nome } : null,
      versao: v.numero,
      publicoAlvo: v.publicoAlvo,
      objetivo: v.objetivo,
      nivel: v.nivel,
      duracaoMin: v.duracaoMin,
      modoPublico: v.modoPublico,
      sensores: v.sensores,
      marketplace: v.treino.marketplace
        ? { descricaoComercial: v.treino.marketplace.descricaoComercial, licenca: v.treino.marketplace.licenca, modeloRemuneracao: v.treino.marketplace.modeloRemuneracao }
        : null
    }));
  }

  /** RF04/RF18: definição completa da versão publicada. O id da versão serve de ETag (versões publicadas são imutáveis). */
  async publicada(slug: string) {
    const treino = await this.buscarTreino(slug);
    const versao = await this.prisma.treinoVersao.findFirst({ where: { treinoId: treino.id, status: 'PUBLICADA' } });
    if (!versao) throw naoEncontrado('Treino publicado');
    return { etag: `"${versao.id}"`, corpo: await this.detalhe(treino, versao) };
  }

  async criar(dto: CriarTreinoDto, ctx: ContextoRequisicao) {
    if (await this.prisma.treino.findUnique({ where: { slug: dto.slug } })) throw conflito('SLUG_EM_USO', 'Já existe um treino com este slug.');
    const categoria = dto.categoriaSlug ? await this.prisma.categoria.findUnique({ where: { slug: dto.categoriaSlug } }) : null;
    if (dto.categoriaSlug && !categoria) throw naoEncontrado('Categoria');

    const treino = await this.prisma.treino.create({
      data: {
        slug: dto.slug,
        nome: dto.nome,
        autorId: ctx.usuario.id,
        categoriaId: categoria?.id,
        versoes: {
          create: {
            numero: 1,
            ...colunasDoConteudo(dto.conteudo),
            notasAlteracao: dto.notasAlteracao,
            compatibilidadeFirmware: dto.compatibilidadeFirmware,
            criadoPorId: ctx.usuario.id
          }
        }
      },
      include: { versoes: true }
    });
    await this.auditoria.registrar(ctx, { acao: 'TREINO_CRIADO', alvoTipo: 'treino', alvoId: treino.id, detalhes: { slug: treino.slug } });
    return { slug: treino.slug, nome: treino.nome, versao: this.resumoVersao(treino.versoes[0]) };
  }

  /** RF16: histórico de versões. Rascunhos só para o autor e admins. */
  async versoes(slug: string, usuario: UsuarioAutenticado) {
    const treino = await this.buscarTreino(slug);
    const visiveis: StatusVersao[] | undefined = podeEditar(treino, usuario) ? undefined : ['PUBLICADA', 'ARQUIVADA'];
    const versoes = await this.prisma.treinoVersao.findMany({
      where: { treinoId: treino.id, status: visiveis ? { in: visiveis } : undefined },
      orderBy: { numero: 'desc' }
    });
    return versoes.map((v) => this.resumoVersao(v));
  }

  async versao(slug: string, numero: number, usuario: UsuarioAutenticado) {
    const { treino, versao } = await this.buscarVersao(slug, numero);
    if (!podeEditar(treino, usuario) && !['PUBLICADA', 'ARQUIVADA'].includes(versao.status)) throw naoEncontrado('Versão');
    return this.detalhe(treino, versao);
  }

  /** Nova versão em rascunho, copiada da mais recente. Um rascunho por vez. */
  async novaVersao(slug: string, ctx: ContextoRequisicao) {
    const treino = await this.treinoEditavel(slug, ctx.usuario);
    const ultima = await this.prisma.treinoVersao.findFirstOrThrow({ where: { treinoId: treino.id }, orderBy: { numero: 'desc' } });
    if (ultima.status === 'RASCUNHO' || ultima.status === 'EM_REVISAO') {
      throw conflito('RASCUNHO_EXISTENTE', `A versão ${ultima.numero} ainda está em ${ultima.status}.`);
    }
    const nova = await this.prisma.treinoVersao.create({
      data: {
        treinoId: treino.id,
        numero: ultima.numero + 1,
        ...colunasDoConteudo(ultima.conteudo as unknown as ConteudoTreino),
        compatibilidadeFirmware: ultima.compatibilidadeFirmware,
        criadoPorId: ctx.usuario.id
      }
    });
    await this.auditoria.registrar(ctx, { acao: 'VERSAO_CRIADA', alvoTipo: 'treino_versao', alvoId: nova.id, detalhes: { slug, numero: nova.numero } });
    return this.resumoVersao(nova);
  }

  async editar(slug: string, numero: number, dto: EditarVersaoDto, ctx: ContextoRequisicao) {
    const { treino, versao } = await this.versaoEditavel(slug, numero, ctx.usuario);
    if (versao.status !== 'RASCUNHO') throw conflito('VERSAO_NAO_EDITAVEL', 'Só rascunhos podem ser editados. Crie uma nova versão.');
    const atualizada = await this.prisma.treinoVersao.update({
      where: { id: versao.id },
      data: {
        ...(dto.conteudo ? colunasDoConteudo(dto.conteudo) : {}),
        notasAlteracao: dto.notasAlteracao,
        compatibilidadeFirmware: dto.compatibilidadeFirmware
      }
    });
    await this.auditoria.registrar(ctx, { acao: 'VERSAO_EDITADA', alvoTipo: 'treino_versao', alvoId: versao.id, detalhes: { slug: treino.slug, numero } });
    return this.detalhe(treino, atualizada);
  }

  /** RF15: validação das regras e dos limites de operação. */
  async validar(slug: string, numero: number, usuario: UsuarioAutenticado) {
    const { versao } = await this.versaoEditavel(slug, numero, usuario, { permitirImportado: true });
    const erros = validarConteudo(versao.conteudo as unknown as ConteudoTreino, await this.parametros.limites());
    return { valido: erros.length === 0, erros };
  }

  /** RF15: ensaio sem tempo real — linha do tempo da máquina e pontuação com golpes de exemplo. */
  async ensaiar(slug: string, numero: number, usuario: UsuarioAutenticado) {
    const { versao } = await this.versaoEditavel(slug, numero, usuario, { permitirImportado: true });
    const conteudo = versao.conteudo as unknown as ConteudoTreino;
    const limites = await this.parametros.limites();
    const lancamentos = expandirLancamentos(conteudo, limites);
    let instante = 0;
    const linhaDoTempo = lancamentos.map((l) => ({ ...l, emSeg: Math.round((instante += l.intervaloSeg) * 10) / 10 }));
    const intervaloMedio = lancamentos.length ? instante / lancamentos.length : 4;
    const golpes = golpesDeExemplo(sequenciaEsperada(conteudo), Math.max(lancamentos.length, 1), intervaloMedio);
    return {
      erros: validarConteudo(conteudo, limites),
      duracaoEstimadaSeg: Math.round(instante),
      lancamentos: linhaDoTempo,
      resumoExemplo: resumirSessao(golpes, instante, conteudo.pontuacao)
    };
  }

  async enviarParaRevisao(slug: string, numero: number, ctx: ContextoRequisicao) {
    const { versao } = await this.versaoEditavel(slug, numero, ctx.usuario);
    if (versao.status !== 'RASCUNHO') throw conflito('TRANSICAO_INVALIDA', `A versão está em ${versao.status}.`);
    const erros = validarConteudo(versao.conteudo as unknown as ConteudoTreino, await this.parametros.limites());
    if (erros.length) throw invalido('TREINO_INVALIDO', 'Corrija os erros de validação antes de enviar para revisão.', erros);
    return this.mudarStatus(versao, 'EM_REVISAO', 'VERSAO_ENVIADA_REVISAO', ctx);
  }

  async devolver(slug: string, numero: number, ctx: ContextoRequisicao) {
    const { versao } = await this.versaoEditavel(slug, numero, ctx.usuario);
    if (versao.status !== 'EM_REVISAO') throw conflito('TRANSICAO_INVALIDA', `A versão está em ${versao.status}.`);
    return this.mudarStatus(versao, 'RASCUNHO', 'VERSAO_DEVOLVIDA', ctx);
  }

  /** RF16: publica a versão e arquiva a anterior, na mesma transação. */
  async publicar(slug: string, numero: number, ctx: ContextoRequisicao) {
    const { treino, versao } = await this.versaoEditavel(slug, numero, ctx.usuario);
    if (versao.status !== 'EM_REVISAO') throw conflito('TRANSICAO_INVALIDA', 'Só versões em revisão podem ser publicadas.');
    const erros = validarConteudo(versao.conteudo as unknown as ConteudoTreino, await this.parametros.limites());
    if (erros.length) throw invalido('TREINO_INVALIDO', 'A versão não passa mais na validação.', erros);

    const [, publicada] = await this.prisma.$transaction([
      this.prisma.treinoVersao.updateMany({ where: { treinoId: treino.id, status: 'PUBLICADA' }, data: { status: 'ARQUIVADA' } }),
      this.prisma.treinoVersao.update({ where: { id: versao.id }, data: { status: 'PUBLICADA', publicadoEm: new Date() } })
    ]);
    await this.auditoria.registrar(ctx, { acao: 'VERSAO_PUBLICADA', alvoTipo: 'treino_versao', alvoId: versao.id, detalhes: { slug, numero } });
    return this.resumoVersao(publicada);
  }

  async definirMarketplace(slug: string, dto: MarketplaceDto, ctx: ContextoRequisicao) {
    const treino = await this.treinoEditavel(slug, ctx.usuario);
    const m = await this.prisma.marketplaceMetadados.upsert({ where: { treinoId: treino.id }, create: { treinoId: treino.id, ...dto }, update: dto });
    await this.auditoria.registrar(ctx, { acao: 'MARKETPLACE_ATUALIZADO', alvoTipo: 'treino', alvoId: treino.id });
    return m;
  }

  /** Estatísticas agregadas para o autor, sem identificar praticantes (LGPD). */
  async estatisticas(slug: string, usuario: UsuarioAutenticado) {
    const treino = await this.buscarTreino(slug);
    if (!podeEditar(treino, usuario)) throw proibido();
    const sessoes = await this.prisma.sessao.findMany({
      where: { versao: { treinoId: treino.id }, estado: 'ENCERRADA', origem: 'SENSOR' },
      select: { praticanteId: true, pontos: true, golpes: true, acertos: true, versao: { select: { numero: true } } }
    });
    const praticantes = new Set(sessoes.map((s) => s.praticanteId)).size;
    if (praticantes < MIN_PRATICANTES_ESTATISTICA) {
      return { sessoes: sessoes.length, praticantes: null, aviso: `Dados insuficientes: são necessários ao menos ${MIN_PRATICANTES_ESTATISTICA} praticantes para exibir agregados.` };
    }
    const golpes = sessoes.reduce((a, s) => a + (s.golpes ?? 0), 0);
    const porVersao = new Map<number, number>();
    sessoes.forEach((s) => porVersao.set(s.versao.numero, (porVersao.get(s.versao.numero) ?? 0) + 1));
    return {
      sessoes: sessoes.length,
      praticantes,
      precisaoMedia: golpes ? Math.round((sessoes.reduce((a, s) => a + (s.acertos ?? 0), 0) / golpes) * 100) : 0,
      pontosMedios: Math.round(sessoes.reduce((a, s) => a + (s.pontos ?? 0), 0) / sessoes.length),
      sessoesPorVersao: Object.fromEntries(porVersao)
    };
  }

  categorias() {
    return this.prisma.categoria.findMany({ orderBy: { nome: 'asc' } });
  }

  /** Treinos publicados no formato usado pelas recomendações. */
  async catalogoParaRecomendacao(modos: ModoPublico[]): Promise<TreinoCatalogo[]> {
    const versoes = await this.prisma.treinoVersao.findMany({
      where: { status: 'PUBLICADA', modoPublico: { in: modos } },
      include: { treino: { select: { slug: true, nome: true } } }
    });
    return versoes.map((v) => ({
      slug: v.treino.slug,
      nome: v.treino.nome,
      nivel: v.nivel,
      duracaoMin: v.duracaoMin,
      focoLado: focoLado(v.conteudo as unknown as ConteudoTreino)
    }));
  }

  private async mudarStatus(versao: TreinoVersao, status: StatusVersao, acao: string, ctx: ContextoRequisicao) {
    const v = await this.prisma.treinoVersao.update({ where: { id: versao.id }, data: { status } });
    await this.auditoria.registrar(ctx, { acao, alvoTipo: 'treino_versao', alvoId: versao.id });
    return this.resumoVersao(v);
  }

  private async buscarTreino(slug: string) {
    const t = await this.prisma.treino.findUnique({ where: { slug } });
    if (!t) throw naoEncontrado('Treino');
    return t;
  }

  private async buscarVersao(slug: string, numero: number) {
    const treino = await this.buscarTreino(slug);
    const versao = await this.prisma.treinoVersao.findUnique({ where: { treinoId_numero: { treinoId: treino.id, numero } } });
    if (!versao) throw naoEncontrado('Versão');
    return { treino, versao };
  }

  private async treinoEditavel(slug: string, usuario: UsuarioAutenticado) {
    const treino = await this.buscarTreino(slug);
    if (!podeEditar(treino, usuario)) throw proibido('Só o autor do treino ou um admin pode alterá-lo.');
    if (treino.origem === 'PLATAFORMA_MAE') throw conflito('TREINO_SOMENTE_LEITURA', 'Treinos da plataforma mãe são alterados apenas na origem.');
    return treino;
  }

  private async versaoEditavel(slug: string, numero: number, usuario: UsuarioAutenticado, opcoes = { permitirImportado: false }) {
    const { treino, versao } = await this.buscarVersao(slug, numero);
    if (!podeEditar(treino, usuario)) throw proibido('Só o autor do treino ou um admin pode alterá-lo.');
    if (treino.origem === 'PLATAFORMA_MAE' && !opcoes.permitirImportado) {
      throw conflito('TREINO_SOMENTE_LEITURA', 'Treinos da plataforma mãe são alterados apenas na origem.');
    }
    return { treino, versao };
  }

  private async detalhe(treino: Treino, versao: TreinoVersao) {
    const [autor, marketplace, categoria] = await Promise.all([
      this.prisma.usuario.findUnique({ where: { id: treino.autorId }, select: { nome: true } }),
      this.prisma.marketplaceMetadados.findUnique({ where: { treinoId: treino.id } }),
      treino.categoriaId ? this.prisma.categoria.findUnique({ where: { id: treino.categoriaId } }) : null
    ]);
    return {
      slug: treino.slug,
      nome: treino.nome,
      autor: autor?.nome ?? null,
      origem: treino.origem,
      categoria: categoria ? { slug: categoria.slug, nome: categoria.nome } : null,
      ...this.resumoVersao(versao),
      conteudo: versao.conteudo,
      marketplace
    };
  }

  private resumoVersao(v: TreinoVersao) {
    return {
      versaoId: v.id,
      numero: v.numero,
      status: v.status,
      compatibilidadeFirmware: v.compatibilidadeFirmware,
      notasAlteracao: v.notasAlteracao,
      criadoEm: v.criadoEm,
      publicadoEm: v.publicadoEm
    };
  }
}
