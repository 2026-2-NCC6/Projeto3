import { performance } from 'node:perf_hooks';
import type { Lancamento } from './plano';

/** Meta definida pela equipe para o RNF Desempenho: emergência → máquina parada e notificada. */
export const META_LATENCIA_EMERGENCIA_MS = 200;

export type EstadoMaquina = 'PRONTO' | 'LANCANDO' | 'PAUSADO' | 'CONCLUIDO' | 'PARADO';

export type CallbacksMaquina = {
  aoLancar: (l: Lancamento) => void;
  aoTerminar: () => void;
  aoParar: (motivo: string) => void;
};

/**
 * Máquina lançadora simulada (§1 do edital: sem interface oficial, usa-se simulador).
 * Cada instância executa a fila de uma sessão. PARADO é terminal: só uma nova instância,
 * criada após o reinício explícito da sessão, volta a lançar.
 */
export class Simulador {
  estado: EstadoMaquina = 'PRONTO';
  private proximo = 0;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly fila: Lancamento[],
    private readonly cb: CallbacksMaquina
  ) {}

  get posicao() {
    return this.proximo;
  }

  /** Recomeça a partir de uma posição já lançada (ex.: após reinício da sessão). */
  posicionar(lancados: number) {
    this.proximo = Math.min(lancados, this.fila.length);
  }

  iniciar(): boolean {
    if (this.estado !== 'PRONTO') return false;
    this.agendar();
    return true;
  }

  pausar(): boolean {
    if (this.estado !== 'LANCANDO') return false;
    this.limpar();
    this.estado = 'PAUSADO';
    return true;
  }

  retomar(): boolean {
    if (this.estado !== 'PAUSADO') return false;
    this.agendar();
    return true;
  }

  parar(motivo: string): { latenciaMs: number } {
    const inicio = performance.now();
    this.limpar();
    this.estado = 'PARADO';
    this.cb.aoParar(motivo);
    return { latenciaMs: performance.now() - inicio };
  }

  private agendar() {
    if (this.proximo >= this.fila.length) {
      this.estado = 'CONCLUIDO';
      this.cb.aoTerminar();
      return;
    }
    this.estado = 'LANCANDO';
    const lancamento = this.fila[this.proximo];
    this.timer = setTimeout(() => {
      this.timer = null;
      this.proximo += 1;
      this.cb.aoLancar(lancamento);
      if (this.estado === 'LANCANDO') this.agendar();
    }, lancamento.intervaloSeg * 1000);
  }

  private limpar() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
