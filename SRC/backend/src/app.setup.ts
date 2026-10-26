import { HttpStatus, INestApplication, ValidationError, ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Express, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import type { ServerOptions } from 'socket.io';
import { ErroApi } from './comum/erros';
import { Configuracao } from './config/configuracao';

export const PREFIXO = 'api/v1';

function achatar(erros: ValidationError[], caminho = ''): string[] {
  return erros.flatMap((e) => {
    const campo = caminho ? `${caminho}.${e.property}` : e.property;
    const proprios = Object.values(e.constraints ?? {}).map((m) => `${campo}: ${m}`);
    return [...proprios, ...achatar(e.children ?? [], campo)];
  });
}

/** Rejeita campos desconhecidos e converte tipos (A03). Erros saem como { codigo: VALIDACAO, detalhes: [...] }. */
export function pipeDeValidacao() {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (erros) => new ErroApi(HttpStatus.BAD_REQUEST, 'VALIDACAO', 'Dados inválidos.', achatar(erros))
  });
}

class AdaptadorSocket extends IoAdapter {
  constructor(
    app: INestApplication,
    private readonly origens: string[]
  ) {
    super(app);
  }

  createIOServer(porta: number, opcoes?: ServerOptions) {
    return super.createIOServer(porta, { ...opcoes, cors: { origin: this.origens.length ? this.origens : false } });
  }
}

/** Configuração HTTP comum ao servidor e aos testes E2E. */
export function configurarApp(app: INestApplication) {
  const config = app.get(Configuracao);
  app.setGlobalPrefix(PREFIXO);
  if (config.confiarProxy) (app.getHttpAdapter().getInstance() as Express).set('trust proxy', 1);

  // O Swagger UI usa scripts inline; só a rota da documentação relaxa a CSP (A05).
  const padrao = helmet();
  const docs = helmet({ contentSecurityPolicy: false });
  app.use((req: Request, res: Response, next: NextFunction) => (req.path.startsWith(`/${PREFIXO}/docs`) ? docs : padrao)(req, res, next));

  // Respostas trazem dados pessoais: nada fica no cache do navegador ou de proxies (LGPD).
  // Rotas que podem ser cacheadas definem o próprio Cache-Control (ex.: GET /treinos/:slug).
  app.use(`/${PREFIXO}`, (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.enableCors({ origin: config.corsOrigens.length ? config.corsOrigens : false, exposedHeaders: ['ETag', 'x-request-id'] });
  app.useWebSocketAdapter(new AdaptadorSocket(app, config.corsOrigens));
  return app;
}

export function criarDocumentoOpenApi(app: INestApplication) {
  const doc = new DocumentBuilder()
    .setTitle('Tennis Analytics API')
    .setDescription(
      'API do Smart Tennis Arena (PI 6º CCOMP FECAP 2026). Autentique em /auth/login e use o accessToken como Bearer. ' +
        'Erros seguem { statusCode, codigo, mensagem, detalhes?, requestId }. ' +
        'Tempo real do simulador: Socket.IO no namespace /maquina (handshake auth.token; evento "entrar" {sessaoId}; ' +
        'eventos recebidos: lancamento, estado, parada).'
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  return SwaggerModule.createDocument(app, doc);
}
