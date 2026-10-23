// Primeiro import do main.ts: carrega o .env local antes de qualquer módulo ler process.env.
// Em produção as variáveis vêm do host e o arquivo não existe.
import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');
