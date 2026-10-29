import { ErroApi } from '../api/cliente';
import type { SincronizacaoOffline } from '../api/endpoints';
import { ChaveValor, lerJson } from '../armazenamento/chaveValor';

const CHAVE_FILA = 'tennis.filaSessoes';
const CHAVE_RECUSADAS = 'tennis.sessoesRecusadas';

export type Recusada = { item: SincronizacaoOffline; motivo: string; em: string };

/** Erros que podem melhorar com o tempo: o item fica na fila e a sincronização para por aqui. */
function temporario(e: unknown) {
  return !(e instanceof ErroApi) || e.status >= 500 || e.status === 401 || e.status === 408 || e.status === 429;
}

/**
 * Sessões feitas sem conexão (RF21). Ficam gravadas no aparelho e são enviadas a
 * POST /sessoes/sincronizar, que é idempotente: reenviar a mesma sessão não duplica.
 */
export class FilaSessoes {
  constructor(private readonly kv: ChaveValor) {}

  listar() {
    return lerJson<SincronizacaoOffline[]>(this.kv, CHAVE_FILA, []);
  }

  recusadas() {
    return lerJson<Recusada[]>(this.kv, CHAVE_RECUSADAS, []);
  }

  async enfileirar(item: SincronizacaoOffline) {
    const fila = (await this.listar()).filter((i) => i.sessao.id !== item.sessao.id);
    await this.kv.gravar(CHAVE_FILA, JSON.stringify([...fila, item]));
  }

  async sincronizar(enviar: (item: SincronizacaoOffline) => Promise<unknown>) {
    const fila = await this.listar();
    const restantes = [...fila];
    let enviadas = 0;
    let recusadas = 0;
    for (const item of fila) {
      try {
        await enviar(item);
        enviadas++;
      } catch (e) {
        if (temporario(e)) break;
        recusadas++;
        const lista = await this.recusadas();
        await this.kv.gravar(CHAVE_RECUSADAS, JSON.stringify([...lista, { item, motivo: (e as Error).message, em: new Date().toISOString() }]));
      }
      restantes.shift();
      await this.kv.gravar(CHAVE_FILA, JSON.stringify(restantes));
    }
    return { enviadas, pendentes: restantes.length, recusadas };
  }
}
