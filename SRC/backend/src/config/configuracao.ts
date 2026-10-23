import { Injectable } from '@nestjs/common';

function obrigatoria(nome: string): string {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Variável de ambiente ${nome} não definida (ver .env.example).`);
  return valor;
}

function numero(nome: string, padrao: number): number {
  const bruto = process.env[nome];
  if (bruto === undefined || bruto === '') return padrao;
  const n = Number(bruto);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`Variável ${nome} deve ser um número positivo.`);
  return n;
}

/** Configuração lida do ambiente uma vez, na inicialização. Falha cedo se faltar algo (A05). */
@Injectable()
export class Configuracao {
  readonly ambiente = process.env.NODE_ENV ?? 'development';
  readonly porta = numero('PORT', 3000);
  readonly jwtSegredo = obrigatoria('JWT_SECRET');
  readonly jwtAcessoMin = numero('JWT_ACESSO_MIN', 15);
  readonly refreshDias = numero('REFRESH_DIAS', 7);
  readonly corsOrigens = (process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  readonly confiarProxy = process.env.TRUST_PROXY === 'true';
  readonly plataformaMaeApiKey = obrigatoria('PLATAFORMA_MAE_API_KEY');
  readonly mockPlataformaMae = process.env.MOCK_PLATAFORMA_MAE === 'true';
  readonly metricsToken = obrigatoria('METRICS_TOKEN');
  /** Mutável só para os testes E2E, que sobem o mock numa porta aleatória. */
  plataformaMaeUrl = obrigatoria('PLATAFORMA_MAE_URL');

  constructor() {
    if (this.jwtSegredo.length < 32) throw new Error('JWT_SECRET precisa ter pelo menos 32 caracteres.');
  }

  get producao() {
    return this.ambiente === 'production';
  }

  get teste() {
    return this.ambiente === 'test';
  }
}
