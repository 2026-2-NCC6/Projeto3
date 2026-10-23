import { Body, Controller, Get, Headers, HttpCode, Param, ParseIntPipe, Patch, Post, Put, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Contexto, ContextoRequisicao, Papeis } from '../comum/contexto';
import { CriarTreinoDto, EditarVersaoDto, FiltroCatalogoDto, MarketplaceDto } from './dto';
import { TreinosService } from './treinos.service';

@ApiTags('Treinos')
@ApiBearerAuth()
@Controller()
export class TreinosController {
  constructor(private readonly treinos: TreinosService) {}

  /** RF03: catálogo de treinos publicados, com filtros. */
  @Get('treinos')
  catalogo(@Query() filtro: FiltroCatalogoDto) {
    return this.treinos.catalogo(filtro);
  }

  @Get('categorias')
  categorias() {
    return this.treinos.categorias();
  }

  /**
   * RF04/RF18/RF21: versão publicada completa. Responde 304 se o app já tem esta versão
   * sincronizada (If-None-Match), o que permite cachear o treino para uso offline.
   */
  @Get('treinos/:slug')
  async publicada(@Param('slug') slug: string, @Headers('if-none-match') etagCliente: string | undefined, @Res({ passthrough: true }) res: Response) {
    const { etag, corpo } = await this.treinos.publicada(slug);
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'private, no-cache');
    if (etagCliente === etag) {
      res.status(304);
      return;
    }
    return corpo;
  }

  @Papeis('AUTOR', 'ADMIN')
  @Post('treinos')
  criar(@Body() dto: CriarTreinoDto, @Contexto() ctx: ContextoRequisicao) {
    return this.treinos.criar(dto, ctx);
  }

  /** RF16: histórico de versões. */
  @Get('treinos/:slug/versoes')
  versoes(@Param('slug') slug: string, @Contexto() ctx: ContextoRequisicao) {
    return this.treinos.versoes(slug, ctx.usuario);
  }

  @Papeis('AUTOR', 'ADMIN')
  @Post('treinos/:slug/versoes')
  novaVersao(@Param('slug') slug: string, @Contexto() ctx: ContextoRequisicao) {
    return this.treinos.novaVersao(slug, ctx);
  }

  @Get('treinos/:slug/versoes/:numero')
  versao(@Param('slug') slug: string, @Param('numero', ParseIntPipe) numero: number, @Contexto() ctx: ContextoRequisicao) {
    return this.treinos.versao(slug, numero, ctx.usuario);
  }

  @Papeis('AUTOR', 'ADMIN')
  @Patch('treinos/:slug/versoes/:numero')
  editar(@Param('slug') slug: string, @Param('numero', ParseIntPipe) numero: number, @Body() dto: EditarVersaoDto, @Contexto() ctx: ContextoRequisicao) {
    return this.treinos.editar(slug, numero, dto, ctx);
  }

  /** RF15: valida regras e limites de operação. */
  @Papeis('AUTOR', 'ADMIN')
  @HttpCode(200)
  @Post('treinos/:slug/versoes/:numero/validar')
  validar(@Param('slug') slug: string, @Param('numero', ParseIntPipe) numero: number, @Contexto() ctx: ContextoRequisicao) {
    return this.treinos.validar(slug, numero, ctx.usuario);
  }

  /** RF15: simula a sequência da máquina e a pontuação antes de publicar. */
  @Papeis('AUTOR', 'ADMIN')
  @HttpCode(200)
  @Post('treinos/:slug/versoes/:numero/ensaiar')
  ensaiar(@Param('slug') slug: string, @Param('numero', ParseIntPipe) numero: number, @Contexto() ctx: ContextoRequisicao) {
    return this.treinos.ensaiar(slug, numero, ctx.usuario);
  }

  @Papeis('AUTOR', 'ADMIN')
  @HttpCode(200)
  @Post('treinos/:slug/versoes/:numero/enviar-revisao')
  enviarParaRevisao(@Param('slug') slug: string, @Param('numero', ParseIntPipe) numero: number, @Contexto() ctx: ContextoRequisicao) {
    return this.treinos.enviarParaRevisao(slug, numero, ctx);
  }

  @Papeis('AUTOR', 'ADMIN')
  @HttpCode(200)
  @Post('treinos/:slug/versoes/:numero/devolver')
  devolver(@Param('slug') slug: string, @Param('numero', ParseIntPipe) numero: number, @Contexto() ctx: ContextoRequisicao) {
    return this.treinos.devolver(slug, numero, ctx);
  }

  @Papeis('AUTOR', 'ADMIN')
  @HttpCode(200)
  @Post('treinos/:slug/versoes/:numero/publicar')
  publicar(@Param('slug') slug: string, @Param('numero', ParseIntPipe) numero: number, @Contexto() ctx: ContextoRequisicao) {
    return this.treinos.publicar(slug, numero, ctx);
  }

  /** RF20: metadados de marketplace (sem cobrança no MVP). */
  @Papeis('AUTOR', 'ADMIN')
  @Put('treinos/:slug/marketplace')
  marketplace(@Param('slug') slug: string, @Body() dto: MarketplaceDto, @Contexto() ctx: ContextoRequisicao) {
    return this.treinos.definirMarketplace(slug, dto, ctx);
  }

  /** Estatísticas agregadas e anônimas para o autor. */
  @Papeis('AUTOR', 'ADMIN')
  @Get('treinos/:slug/estatisticas')
  estatisticas(@Param('slug') slug: string, @Contexto() ctx: ContextoRequisicao) {
    return this.treinos.estatisticas(slug, ctx.usuario);
  }
}
