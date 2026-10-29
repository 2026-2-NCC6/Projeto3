import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Contexto, ContextoRequisicao } from '../comum/contexto';
import { HistoricoService } from '../historico/historico.service';
import { AtualizarPraticanteDto, DependenteDto, FiltroHistoricoDto } from './dto';
import { PraticantesService } from './praticantes.service';

@ApiTags('Praticantes e histórico')
@ApiBearerAuth()
@Controller('praticantes')
export class PraticantesController {
  constructor(
    private readonly praticantes: PraticantesService,
    private readonly historico: HistoricoService
  ) {}

  /** Titular e dependentes da conta logada (RF02). */
  @Get()
  listar(@Contexto() ctx: ContextoRequisicao) {
    return this.praticantes.listar(ctx.usuario.id);
  }

  /** Perfil de menor gerido pelo responsável (RF11). */
  @Post('dependentes')
  criarDependente(@Body() dto: DependenteDto, @Contexto() ctx: ContextoRequisicao) {
    return this.praticantes.criarDependente(dto, ctx);
  }

  @Patch(':id')
  atualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AtualizarPraticanteDto, @Contexto() ctx: ContextoRequisicao) {
    return this.praticantes.atualizar(id, dto, ctx);
  }

  @HttpCode(204)
  @Delete(':id')
  async remover(@Param('id', ParseUUIDPipe) id: string, @Contexto() ctx: ContextoRequisicao) {
    await this.praticantes.remover(id, ctx);
  }

  /** RF13: sessões por período e treino. */
  @Get(':id/sessoes')
  async sessoes(@Param('id', ParseUUIDPipe) id: string, @Query() filtro: FiltroHistoricoDto, @Contexto() ctx: ContextoRequisicao) {
    await this.praticantes.garantirPosse(id, ctx.usuario.id);
    return this.historico.sessoes(id, filtro);
  }

  /** RF13: precisão, consistência, cadência, volume, tempo e progressão. */
  @Get(':id/indicadores')
  async indicadores(@Param('id', ParseUUIDPipe) id: string, @Query() filtro: FiltroHistoricoDto, @Contexto() ctx: ContextoRequisicao) {
    await this.praticantes.garantirPosse(id, ctx.usuario.id);
    return this.historico.indicadores(id, filtro);
  }
}
