import { Injectable } from '@nestjs/common';
import { Configuracao } from '../config/configuracao';
import type { ConteudoTreino } from '../treinos/conteudo';

export type TreinoExterno = {
  idExterno: string;
  slug: string;
  nome: string;
  compatibilidadeFirmware: string;
  conteudo: ConteudoTreino;
};

/** Contrato com a plataforma mãe SmartTennis (§1, RF18, RF19). A implementação real fica atrás desta interface. */
export abstract class PlataformaMaeCliente {
  abstract listarTreinos(): Promise<TreinoExterno[]>;
  /** Deve ser idempotente do lado da plataforma: reenviar a mesma chave não duplica o resultado. */
  abstract enviarResultado(idempotencyKey: string, tipo: string, payload: unknown): Promise<void>;
}

const TIMEOUT_MS = 10_000;

/** Cliente HTTP. A URL e a chave vêm só do ambiente, nunca do usuário (A10, SSRF). */
@Injectable()
export class PlataformaMaeHttp extends PlataformaMaeCliente {
  constructor(private readonly config: Configuracao) {
    super();
  }

  async listarTreinos(): Promise<TreinoExterno[]> {
    const r = await this.chamar('/treinos', { method: 'GET' });
    return ((await r.json()) as { treinos: TreinoExterno[] }).treinos;
  }

  async enviarResultado(idempotencyKey: string, tipo: string, payload: unknown) {
    await this.chamar('/resultados', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ tipo, payload })
    });
  }

  private async chamar(caminho: string, init: RequestInit) {
    const r = await fetch(`${this.config.plataformaMaeUrl}${caminho}`, {
      ...init,
      headers: { 'content-type': 'application/json', 'x-api-key': this.config.plataformaMaeApiKey, ...init.headers },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    if (!r.ok) throw new Error(`Plataforma mãe respondeu ${r.status} em ${caminho}`);
    return r;
  }
}
