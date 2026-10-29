import { Body, Controller, Delete, Get, Header, HttpCode, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Contexto, ContextoRequisicao } from '../comum/contexto';
import { DispositivosService } from './dispositivos.service';
import { RegistrarDispositivoDto, StatusDispositivoDto } from './dto';

@ApiTags('Dispositivos')
@ApiBearerAuth()
@Controller('dispositivos')
export class DispositivosController {
  constructor(private readonly dispositivos: DispositivosService) {}

  @Get()
  listar(@Contexto() ctx: ContextoRequisicao) {
    return this.dispositivos.listar(ctx.usuario.id);
  }

  /** Vincula a raquete à conta. Uma raquete pertence a uma única conta. */
  @Post()
  registrar(@Body() dto: RegistrarDispositivoDto, @Contexto() ctx: ContextoRequisicao) {
    return this.dispositivos.registrar(dto, ctx);
  }

  /** Chave do BLE da raquete, só para o dono. O app usa para autenticar na raquete e não a guarda em disco. */
  @Header('Cache-Control', 'no-store')
  @Get(':id/chave')
  chave(@Param('id', ParseUUIDPipe) id: string, @Contexto() ctx: ContextoRequisicao) {
    return this.dispositivos.chave(id, ctx);
  }

  @Put(':id/status')
  status(@Param('id', ParseUUIDPipe) id: string, @Body() dto: StatusDispositivoDto, @Contexto() ctx: ContextoRequisicao) {
    return this.dispositivos.atualizarStatus(id, dto, ctx);
  }

  @HttpCode(204)
  @Delete(':id')
  async remover(@Param('id', ParseUUIDPipe) id: string, @Contexto() ctx: ContextoRequisicao) {
    await this.dispositivos.remover(id, ctx);
  }
}
