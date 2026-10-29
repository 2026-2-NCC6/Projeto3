// Gera docs/openapi.json (contrato da API, entregável da §9) a partir do build: `npm run openapi`.
import './carregar-env';
import { NestFactory } from '@nestjs/core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { AppModule } from './app.module';
import { configurarApp, criarDocumentoOpenApi } from './app.setup';

async function exportar() {
  const app = await NestFactory.create(AppModule, { logger: false });
  configurarApp(app);
  mkdirSync('docs', { recursive: true });
  writeFileSync('docs/openapi.json', JSON.stringify(criarDocumentoOpenApi(app), null, 2) + '\n');
  await app.close();
  console.log('docs/openapi.json gerado.');
}

void exportar();
