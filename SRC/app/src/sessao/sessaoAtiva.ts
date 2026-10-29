import type { TreinoDetalhe } from '../api/tipos';
import type { GolpeRegistrado } from './regras';
import type { Publico } from './linguagem';
import type { SessaoRemota } from './sessaoRemota';

/** Sessão em andamento, compartilhada entre as telas de Sessão, Parada segura e Resultado. */
export type SessaoEmAndamento = {
  remota: SessaoRemota;
  treino: TreinoDetalhe;
  golpes: GolpeRegistrado[];
  tempoSeg: number;
  usouSensor: boolean;
  publico: Publico;
  /** Marcado pela Parada segura depois do reinício explícito: a tela de Sessão retoma a coleta. */
  retomarAoVoltar: boolean;
};

let atual: SessaoEmAndamento | null = null;

export const sessaoAtiva = {
  obter: () => atual,
  definir: (s: SessaoEmAndamento) => {
    atual = s;
  },
  limpar: () => {
    atual = null;
  }
};
