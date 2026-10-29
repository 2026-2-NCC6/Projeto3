import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { Contexto, ContextoRequisicao, Papeis } from '../comum/contexto';
import { ImportacaoService } from '../integracao/importacao.service';
import { OutboxService } from '../integracao/outbox.service';
import { ParametrosService } from '../parametros/parametros.service';
import { AdminService } from './admin.service';
import {
  AtualizarUsuarioDto,
  BloqueioDto,
  CategoriaDto,
  FiltroAuditoriaDto,
  FiltroEnviosDto,
  FiltroSessoesDto,
  FiltroUsuariosDto,
  ParametroDto
} from './dto';

@ApiTags('Administração')
@ApiBearerAuth()
@Papeis('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly parametros: ParametrosService,
    private readonly auditoria: AuditoriaService,
    private readonly outbox: OutboxService,
    private readonly importacao: ImportacaoService
  ) {}

  @Get('usuarios')
  usuarios(@Query() f: FiltroUsuariosDto) {
    return this.admin.usuarios(f);
  }

  /** Promove/rebaixa papéis (jogador, autor, admin) e ativa/desativa contas. */
  @Patch('usuarios/:id')
  atualizarUsuario(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AtualizarUsuarioDto, @Contexto() ctx: ContextoRequisicao) {
    return this.admin.atualizarUsuario(id, dto, ctx);
  }

  @Post('categorias')
  criarCategoria(@Body() dto: CategoriaDto, @Contexto() ctx: ContextoRequisicao) {
    return this.admin.criarCategoria(dto, ctx);
  }

  @Put('categorias/:id')
  atualizarCategoria(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CategoriaDto, @Contexto() ctx: ContextoRequisicao) {
    return this.admin.atualizarCategoria(id, dto, ctx);
  }

  @HttpCode(204)
  @Delete('categorias/:id')
  async removerCategoria(@Param('id', ParseUUIDPipe) id: string, @Contexto() ctx: ContextoRequisicao) {
    await this.admin.removerCategoria(id, ctx);
  }

  @Get('dispositivos')
  dispositivos() {
    return this.admin.dispositivos();
  }

  @Post('dispositivos/:id/bloqueio')
  bloquear(@Param('id', ParseUUIDPipe) id: string, @Body() dto: BloqueioDto, @Contexto() ctx: ContextoRequisicao) {
    return this.admin.bloquear(id, dto, ctx);
  }

  /** Limites de operação da máquina e prazos de retenção (LGPD). */
  @Get('parametros')
  listarParametros() {
    return this.parametros.todos();
  }

  @Put('parametros/:chave')
  async definirParametro(@Param('chave') chave: string, @Body() dto: ParametroDto, @Contexto() ctx: ContextoRequisicao) {
    const todos = await this.parametros.definir(chave, dto.valor);
    await this.auditoria.registrar(ctx, { acao: 'PARAMETRO_ALTERADO', alvoTipo: 'parametro', alvoId: chave, detalhes: { valor: dto.valor } });
    return todos;
  }

  @Get('sessoes')
  sessoes(@Query() f: FiltroSessoesDto) {
    return this.admin.sessoes(f);
  }

  /** RF23: trilha de auditoria. Filtre por severidade=INCIDENTE para os eventos de segurança. */
  @Get('auditoria')
  auditoriaLista(@Query() f: FiltroAuditoriaDto) {
    return this.auditoria.listar({ ...f, pagina: f.pagina ?? 1, limite: f.limite ?? 50 });
  }

  @Get('integracao/envios')
  envios(@Query() f: FiltroEnviosDto) {
    return this.outbox.listar(f.status);
  }

  @Post('integracao/envios/:id/reprocessar')
  reprocessar(@Param('id', ParseUUIDPipe) id: string) {
    return this.outbox.reprocessar(id);
  }

  /** Força um ciclo de envio à plataforma mãe (normalmente roda a cada 30 s). */
  @HttpCode(200)
  @Post('integracao/processar')
  processar() {
    return this.outbox.processar();
  }

  @HttpCode(200)
  @Post('integracao/importar-treinos')
  importar(@Contexto() ctx: ContextoRequisicao) {
    return this.importacao.importar(ctx);
  }
}
