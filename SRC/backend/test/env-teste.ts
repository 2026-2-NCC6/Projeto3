// Os testes E2E rodam contra o schema `tennis_test`, nunca contra `tennis`.
// O Jest isola process.env por arquivo de teste, então o .env é lido e copiado aqui (não via process.loadEnvFile).
import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

if (existsSync('.env')) {
  for (const [chave, valor] of Object.entries(parseEnv(readFileSync('.env', 'utf8')))) process.env[chave] ??= valor;
}
if (!process.env.DATABASE_URL_TEST || !process.env.DIRECT_URL_TEST) {
  throw new Error('Defina DATABASE_URL_TEST e DIRECT_URL_TEST (schema tennis_test) para rodar os testes E2E.');
}
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
process.env.DIRECT_URL = process.env.DIRECT_URL_TEST;
process.env.NODE_ENV = 'test';
process.env.MOCK_PLATAFORMA_MAE = 'true';
