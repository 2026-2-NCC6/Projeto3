import { ErroRede } from '../api/cliente';
import type { Endpoints } from '../api/endpoints';
import type { TreinoDetalhe, TreinoResumo } from '../api/tipos';
import { ChaveValor, lerJson } from '../armazenamento/chaveValor';

export type ApiTreinos = Pick<Endpoints, 'catalogo' | 'treino'>;

const CHAVE_CATALOGO = 'tennis.catalogo';
const chaveTreino = (slug: string) => `tennis.treino.${slug}`;

type Guardado = { treino: TreinoDetalhe; etag: string | null };

/**
 * Catálogo e versões publicadas vindos da API, guardados no aparelho para treinar sem
 * conexão (RF21: "treino previamente sincronizado"). O ETag evita baixar de novo uma
 * versão que não mudou (RF18).
 */
export class RepositorioTreinos {
  constructor(
    private readonly api: ApiTreinos,
    private readonly kv: ChaveValor
  ) {}

  async catalogo(): Promise<{ treinos: TreinoResumo[]; origem: 'api' | 'cache' | 'indisponivel' }> {
    try {
      const treinos = await this.api.catalogo();
      await this.kv.gravar(CHAVE_CATALOGO, JSON.stringify(treinos));
      return { treinos, origem: 'api' };
    } catch (e) {
      if (!(e instanceof ErroRede)) throw e;
      const guardado = await lerJson<TreinoResumo[] | null>(this.kv, CHAVE_CATALOGO, null);
      return guardado ? { treinos: guardado, origem: 'cache' } : { treinos: [], origem: 'indisponivel' };
    }
  }

  async treino(slug: string): Promise<{ treino: TreinoDetalhe; origem: 'api' | 'cache' } | null> {
    const guardado = await lerJson<Guardado | null>(this.kv, chaveTreino(slug), null);
    try {
      const r = await this.api.treino(slug, guardado?.etag ?? undefined);
      if (r.naoMudou && guardado) return { treino: guardado.treino, origem: 'api' };
      if (!r.treino) return guardado ? { treino: guardado.treino, origem: 'cache' } : null;
      await this.kv.gravar(chaveTreino(slug), JSON.stringify({ treino: r.treino, etag: r.etag } satisfies Guardado));
      return { treino: r.treino, origem: 'api' };
    } catch (e) {
      if (!(e instanceof ErroRede)) throw e;
      return guardado ? { treino: guardado.treino, origem: 'cache' } : null;
    }
  }
}
