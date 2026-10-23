import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { AdminModule } from './admin/admin.module';
import { pipeDeValidacao } from './app.setup';
import { AuthModule } from './auth/auth.module';
import { AutenticacaoGuard } from './comum/autenticacao.guard';
import { ErroFilter } from './comum/erro.filter';
import { LimiteGuard } from './comum/limite.guard';
import { Configuracao } from './config/configuracao';
import { DispositivosModule } from './dispositivos/dispositivos.module';
import { IntegracaoModule } from './integracao/integracao.module';
import { NucleoModule } from './nucleo.module';
import { PraticantesModule } from './praticantes/praticantes.module';
import { RetencaoService } from './privacidade/retencao.service';
import { MetricasInterceptor } from './saude/metricas';
import { SaudeController } from './saude/saude.controller';
import { SessoesModule } from './sessoes/sessoes.module';
import { TreinosModule } from './treinos/treinos.module';

const REQUEST_ID = /^[\w-]{8,64}$/;

@Module({
  imports: [
    NucleoModule,
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'test' ? 'silent' : (process.env.LOG_LEVEL ?? 'info'),
        // Correlação entre app, dispositivo e API (RNF Observabilidade): aceita o x-request-id do app ou gera um.
        genReqId: (req, res) => {
          const recebido = req.headers['x-request-id'];
          const id = typeof recebido === 'string' && REQUEST_ID.test(recebido) ? recebido : randomUUID();
          res.setHeader('x-request-id', id);
          return id;
        },
        redact: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["x-api-key"]'],
        customProps: (req) => ({ usuarioId: (req as { usuario?: { id: string } }).usuario?.id }),
        autoLogging: { ignore: (req) => /\/(health|metrics)$/.test(req.url ?? '') },
        transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty', options: { singleLine: true } } : undefined
      }
    }),
    JwtModule.registerAsync({
      global: true,
      inject: [Configuracao],
      useFactory: (config: Configuracao) => ({ secret: config.jwtSegredo, signOptions: { algorithm: 'HS256' } })
    }),
    ThrottlerModule.forRoot({ throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }] }),
    ScheduleModule.forRoot(),
    AuthModule,
    PraticantesModule,
    TreinosModule,
    DispositivosModule,
    SessoesModule,
    IntegracaoModule,
    AdminModule
  ],
  controllers: [SaudeController],
  providers: [
    RetencaoService,
    { provide: APP_GUARD, useClass: LimiteGuard },
    { provide: APP_GUARD, useClass: AutenticacaoGuard },
    { provide: APP_FILTER, useClass: ErroFilter },
    { provide: APP_PIPE, useFactory: pipeDeValidacao },
    { provide: APP_INTERCEPTOR, useClass: MetricasInterceptor }
  ]
})
export class AppModule {}
