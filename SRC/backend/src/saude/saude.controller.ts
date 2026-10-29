import { Controller, Get, Headers, HttpStatus, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { Publico } from '../comum/contexto';
import { ErroApi } from '../comum/erros';
import { Configuracao } from '../config/configuracao';
import { PrismaService } from '../prisma/prisma.service';
import { Metricas } from './metricas';

@ApiTags('Operação')
@Publico()
@SkipThrottle()
@Controller()
export class SaudeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metricas: Metricas,
    private readonly config: Configuracao
  ) {}

  /** Usado pelo host (Render/Docker) para saber se a instância está saudável. */
  @Get('health')
  async saude(@Res({ passthrough: true }) res: Response) {
    const banco = await this.prisma.$queryRaw`SELECT 1`.then(() => 'ok' as const).catch(() => 'erro' as const);
    if (banco !== 'ok') res.status(HttpStatus.SERVICE_UNAVAILABLE);
    return { status: banco === 'ok' ? 'ok' : 'degradado', banco, versao: process.env.npm_package_version ?? '1.0.0' };
  }

  /** Métricas Prometheus. Exige `Authorization: Bearer <METRICS_TOKEN>`. */
  @Get('metrics')
  async metricasPrometheus(@Headers('authorization') auth: string | undefined, @Res({ passthrough: true }) res: Response) {
    const esperado = Buffer.from(`Bearer ${this.config.metricsToken}`);
    const recebido = Buffer.from(auth ?? '');
    if (recebido.length !== esperado.length || !timingSafeEqual(recebido, esperado)) {
      throw new ErroApi(HttpStatus.UNAUTHORIZED, 'NAO_AUTENTICADO', 'Token de métricas inválido.');
    }
    res.setHeader('Content-Type', this.metricas.registro.contentType);
    return this.metricas.registro.metrics();
  }
}
