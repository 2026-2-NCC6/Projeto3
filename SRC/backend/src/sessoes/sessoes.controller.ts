import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Contexto, ContextoRequisicao } from '../comum/contexto';
import { ComandoDto, CriarSessaoDto, LoteEventosDto, SincronizarDto } from './dto';
import { SessoesService } from './sessoes.service';

@ApiTags('Sessões')
@ApiBearerAuth()
@Controller('sessoes')
export class SessoesController {
  constructor(private readonly sessoes: SessoesService) {}

  /** Cria a sessão (estado CRIADA). Idempotente pelo id gerado no app. */
  @Post()
  criar(@Body() dto: CriarSessaoDto, @Contexto() ctx: ContextoRequisicao) {
    return this.sessoes.criar(dto, ctx);
  }

  /** RF21: sessão feita offline, enviada completa quando a conexão volta. */
  @HttpCode(200)
  @Post('sincronizar')
  sincronizar(@Body() dto: SincronizarDto, @Contexto() ctx: ContextoRequisicao) {
    return this.sessoes.sincronizar(dto, ctx);
  }

  @Get(':id')
  obter(@Param('id', ParseUUIDPipe) id: string, @Contexto() ctx: ContextoRequisicao) {
    return this.sessoes.obter(id, ctx);
  }

  /**
   * RF06/RF09/RF22: INICIAR, PAUSAR, RETOMAR, ENCERRAR, EMERGENCIA, REINICIAR.
   * Em PARADA_SEGURA, só REINICIAR (com areaSegura=true) é aceito.
   */
  @HttpCode(200)
  @Post(':id/comandos')
  comando(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ComandoDto, @Contexto() ctx: ContextoRequisicao) {
    return this.sessoes.comando(id, dto, ctx);
  }

  /** RF07: lote de eventos do sensor (até 200). Duplicatas são ignoradas pelo id. */
  @HttpCode(200)
  @Post(':id/eventos')
  eventos(@Param('id', ParseUUIDPipe) id: string, @Body() dto: LoteEventosDto, @Contexto() ctx: ContextoRequisicao) {
    return this.sessoes.registrarEventos(id, dto, ctx);
  }
}
