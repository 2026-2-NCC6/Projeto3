import { Body, Controller, Get, Headers, HttpCode, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Prisma } from '@prisma/client';
import { timingSafeEqual } from 'node:crypto';
import { Publico } from '../comum/contexto';
import { ErroApi, invalido, naoEncontrado } from '../comum/erros';
import { Configuracao } from '../config/configuracao';
import { PrismaService } from '../prisma/prisma.service';
import type { TreinoExterno } from './plataforma-mae.cliente';

const base = {
  instrucoes: ['Posicione-se no centro da linha de base.', 'Volte à posição de espera depois de cada golpe.'],
  equipamentos: ['Raquete com sensor Tennis Analytics', 'Máquina lançadora (ou simulador)', 'Bolas de tênis'],
  riscos: ['Faça aquecimento antes de começar.', 'Mantenha a área de lançamento livre.'],
  sensores: ['IMU' as const],
  feedbacks: {
    acerto: 'Raquete: LED e tom pela força do golpe; app: indicação de acerto',
    erro: 'App: indicação de erro e sequência zerada',
    sequencia: 'App: contador de sequência'
  }
};

/** Catálogo que a "plataforma mãe" simulada oferece. */
export const TREINOS_PLATAFORMA_MAE: TreinoExterno[] = [
  {
    idExterno: 'stp-001',
    slug: 'devolucao-de-saque',
    nome: 'Devolução de saque',
    compatibilidadeFirmware: '1.0.0',
    conteudo: {
      ...base,
      publicoAlvo: 'Todos os públicos',
      objetivo: 'Reação e devolução segura',
      nivel: 'INICIANTE',
      duracaoMin: 10,
      modoPublico: 'TODOS',
      pontuacao: { base: 10, bonusSequencia: 5, bonusForte: 5, penalidadeErro: 0, metaPrecisao: 40 },
      exercicios: [
        { nome: 'Devolução cruzada', repeticoes: 90, golpeEsperado: 'ALTERNADO', lancamento: { velocidadeKmh: 45, rotacao: 'PLANO', direcao: 'CENTRO', alturaM: 1, intervaloSeg: 5 } }
      ],
      conclusao: { tipo: 'REPETICOES', valor: 90 }
    }
  },
  {
    idExterno: 'stp-002',
    slug: 'missao-alvo-colorido',
    nome: 'Missão alvo colorido',
    compatibilidadeFirmware: '1.0.0',
    conteudo: {
      ...base,
      publicoAlvo: 'Crianças de 6 a 13 anos',
      objetivo: 'Coordenação e diversão com metas curtas',
      nivel: 'INICIANTE',
      duracaoMin: 8,
      modoPublico: 'INFANTIL',
      pontuacao: { base: 10, bonusSequencia: 2, bonusForte: 0, penalidadeErro: 0, metaPrecisao: 30 },
      exercicios: [
        { nome: 'Fase 1: forehand', repeticoes: 30, golpeEsperado: 'FH', lancamento: { velocidadeKmh: 30, rotacao: 'PLANO', direcao: 'CENTRO', alturaM: 0.9, intervaloSeg: 6 } },
        { nome: 'Fase 2: backhand', repeticoes: 30, golpeEsperado: 'BH', lancamento: { velocidadeKmh: 30, rotacao: 'PLANO', direcao: 'CENTRO', alturaM: 0.9, intervaloSeg: 6 } }
      ],
      conclusao: { tipo: 'REPETICOES', valor: 60 }
    }
  }
];

/**
 * Mock da plataforma mãe SmartTennis, embutido para demonstração (o edital aceita "mock compatível").
 * Fica desligado em produção (MOCK_PLATAFORMA_MAE) e exige a mesma API key do cliente.
 */
@ApiExcludeController()
@Publico()
@SkipThrottle()
@Controller('mock/plataforma-mae')
export class MockPlataformaController {
  constructor(
    private readonly config: Configuracao,
    private readonly prisma: PrismaService
  ) {}

  @Get('treinos')
  treinos(@Headers('x-api-key') chave: string | undefined) {
    this.autorizar(chave);
    return { treinos: TREINOS_PLATAFORMA_MAE };
  }

  @HttpCode(200)
  @Post('resultados')
  async resultado(
    @Headers('x-api-key') chave: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() corpo: Record<string, unknown>
  ) {
    this.autorizar(chave);
    if (!idempotencyKey || idempotencyKey.length > 120) throw invalido('IDEMPOTENCY_KEY_OBRIGATORIA', 'Envie o cabeçalho Idempotency-Key.');
    const existente = await this.prisma.mockPlataformaResultado.findUnique({ where: { idempotencyKey } });
    if (!existente) await this.prisma.mockPlataformaResultado.create({ data: { idempotencyKey, payload: corpo as Prisma.InputJsonValue } });
    return { recebido: true, duplicado: Boolean(existente) };
  }

  private autorizar(chave: string | undefined) {
    if (!this.config.mockPlataformaMae) throw naoEncontrado('Recurso');
    const esperada = Buffer.from(this.config.plataformaMaeApiKey);
    const recebida = Buffer.from(chave ?? '');
    if (recebida.length !== esperada.length || !timingSafeEqual(recebida, esperada)) {
      throw new ErroApi(401, 'API_KEY_INVALIDA', 'Chave de integração inválida.');
    }
  }
}
