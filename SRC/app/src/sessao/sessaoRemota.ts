import { ErroRede } from '../api/cliente';
import type { Endpoints } from '../api/endpoints';
import type { ComandoSessao, EventoCliente, Sessao } from '../api/tipos';
import type { FilaSessoes } from '../offline/filaSessoes';
import { gerarUuid } from '../util/uuid';

export type ApiSessao = Pick<Endpoints, 'criarSessao' | 'comando' | 'enviarEventos'>;

export type ContextoSessao = {
  id: string;
  praticanteId: string;
  treinoSlug: string;
  versaoNumero: number;
  dispositivoId?: string;
  origem: 'SENSOR' | 'DEMO';
};

export type GolpeParaEnvio = { lado: 'Forehand' | 'Backhand'; forca: 1 | 2 | 3; picoG: number; picoGiro: number; seq: number };

const LOTE_MAXIMO = 200;

/**
 * Conduz uma sessão pela API (RF06, RF07, RF19, RF22) e, se a rede cair, continua offline e
 * deixa a sessão na fila para POST /sessoes/sincronizar (RF21). Os ids da sessão e de cada
 * evento são gerados aqui, então reenviar nunca duplica nada no servidor.
 */
export class SessaoRemota {
  modo: 'online' | 'offline' = 'online';
  private iniciadaEm: number | null = null;
  private motivoInterrupcao: string | undefined;
  private readonly eventos: EventoCliente[] = [];
  private pendentes: EventoCliente[] = [];

  constructor(
    private readonly api: ApiSessao,
    private readonly fila: FilaSessoes,
    readonly ctx: ContextoSessao,
    private readonly agora: () => number = Date.now
  ) {}

  get id() {
    return this.ctx.id;
  }

  /** Cria a sessão na API. Sem rede, segue offline. Recusas da API (firmware, perfil...) sobem para a tela. */
  async preparar(): Promise<Sessao | null> {
    try {
      return await this.api.criarSessao({ ...this.ctx });
    } catch (e) {
      if (!(e instanceof ErroRede)) throw e;
      this.modo = 'offline';
      return null;
    }
  }

  /** Aplica o comando na API (online). Devolve a sessão atualizada, ou null se estiver offline. */
  async comando(comando: ComandoSessao, extras: { motivo?: string; areaSegura?: boolean } = {}): Promise<Sessao | null> {
    if (comando === 'INICIAR' && this.iniciadaEm === null) this.iniciadaEm = this.agora();
    if (comando === 'EMERGENCIA') this.motivoInterrupcao = extras.motivo;
    if (this.modo === 'offline') return null;
    try {
      return await this.api.comando(this.ctx.id, { comando, ...extras });
    } catch (e) {
      if (!(e instanceof ErroRede)) throw e;
      this.modo = 'offline';
      return null;
    }
  }

  registrarGolpe(g: GolpeParaEnvio) {
    const agora = this.agora();
    const evento: EventoCliente = {
      id: gerarUuid(),
      tipo: 'GOLPE',
      tMs: this.iniciadaEm === null ? 0 : agora - this.iniciadaEm,
      ocorridoEm: new Date(agora).toISOString(),
      dados: { ...g }
    };
    this.eventos.push(evento);
    this.pendentes.push(evento);
  }

  /** Envia os golpes acumulados em lotes de até 200. Sem rede, guarda para a sincronização. */
  async enviarPendentes() {
    while (this.modo === 'online' && this.pendentes.length) {
      const lote = this.pendentes.slice(0, LOTE_MAXIMO);
      try {
        await this.api.enviarEventos(this.ctx.id, lote);
        this.pendentes = this.pendentes.slice(lote.length);
      } catch (e) {
        if (e instanceof ErroRede) this.modo = 'offline';
        return;
      }
    }
  }

  /** Encerra. Online, devolve a sessão com o resumo calculado pelo servidor; offline, enfileira. */
  async encerrar(opcoes: { pontosCliente?: number }): Promise<{ sessao: Sessao | null; pendenteSincronizacao: boolean }> {
    await this.enviarPendentes();
    if (this.modo === 'online') {
      try {
        const sessao = await this.api.comando(this.ctx.id, { comando: 'ENCERRAR', pontosCliente: opcoes.pontosCliente });
        return { sessao, pendenteSincronizacao: false };
      } catch (e) {
        if (!(e instanceof ErroRede)) throw e;
        this.modo = 'offline';
      }
    }
    const fim = this.agora();
    await this.fila.enfileirar({
      sessao: {
        ...this.ctx,
        iniciadaEm: new Date(this.iniciadaEm ?? fim).toISOString(),
        encerradaEm: new Date(fim).toISOString(),
        motivoInterrupcao: this.motivoInterrupcao,
        pontosCliente: opcoes.pontosCliente
      },
      eventos: this.eventos
    });
    return { sessao: null, pendenteSincronizacao: true };
  }
}
