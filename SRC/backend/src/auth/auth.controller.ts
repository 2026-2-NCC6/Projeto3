import { Body, Controller, Delete, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Contexto, ContextoRequisicao, Publico } from '../comum/contexto';
import { AuthService } from './auth.service';
import { ContaService } from './conta.service';
import { CadastroDto, ExcluirContaDto, LoginDto, RefreshDto } from './dto';
import { TokensService } from './tokens.service';

const LIMITE_CREDENCIAIS = { default: { limit: 5, ttl: 60_000 } };

@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokensService
  ) {}

  /** Cria a conta (adulto) e o praticante titular. */
  @Publico()
  @Throttle(LIMITE_CREDENCIAIS)
  @Post('cadastro')
  cadastrar(@Body() dto: CadastroDto, @Contexto() ctx: ContextoRequisicao) {
    return this.auth.cadastrar(dto, ctx);
  }

  @Publico()
  @Throttle(LIMITE_CREDENCIAIS)
  @HttpCode(200)
  @Post('login')
  login(@Body() dto: LoginDto, @Contexto() ctx: ContextoRequisicao) {
    return this.auth.login(dto, ctx);
  }

  /** Troca o refresh token por um novo par. Cada refresh só pode ser usado uma vez. */
  @Publico()
  @HttpCode(200)
  @Post('refresh')
  refresh(@Body() dto: RefreshDto, @Contexto() ctx: ContextoRequisicao) {
    return this.tokens.rotacionar(dto.refreshToken, ctx);
  }

  @Publico()
  @HttpCode(204)
  @Post('logout')
  async logout(@Body() dto: RefreshDto) {
    await this.tokens.revogar(dto.refreshToken);
  }
}

@ApiTags('Conta')
@ApiBearerAuth()
@Controller('me')
export class ContaController {
  constructor(private readonly conta: ContaService) {}

  @Get()
  eu(@Contexto() ctx: ContextoRequisicao) {
    return this.conta.eu(ctx.usuario.id);
  }

  /** Portabilidade (LGPD): todos os dados da conta em JSON. */
  @Get('exportar')
  exportar(@Contexto() ctx: ContextoRequisicao) {
    return this.conta.exportar(ctx);
  }

  /** Eliminação (LGPD): apaga praticantes, sessões e dispositivos e anonimiza a conta. */
  @HttpCode(204)
  @Delete()
  async excluir(@Body() dto: ExcluirContaDto, @Contexto() ctx: ContextoRequisicao) {
    await this.conta.excluir(dto.senha, ctx);
  }
}
