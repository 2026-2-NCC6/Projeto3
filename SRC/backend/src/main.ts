import './carregar-env';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { PREFIXO, configurarApp, criarDocumentoOpenApi } from './app.setup';
import { Configuracao } from './config/configuracao';

async function iniciar() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  configurarApp(app);
  SwaggerModule.setup(`${PREFIXO}/docs`, app, criarDocumentoOpenApi(app));
  app.enableShutdownHooks();
  await app.listen(app.get(Configuracao).porta, '0.0.0.0');
}

void iniciar();
