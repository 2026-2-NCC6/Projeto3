// Máquina de estados da sessão (RF06, RF22). Correspondência com o firmware:
// CRIADA≈AGUARDANDO, EM_EXECUCAO≈COLETANDO, PAUSADA≈PAUSADO, ENCERRADA/PARADA_SEGURA≈PARADO.

export const ESTADOS = ['CRIADA', 'EM_EXECUCAO', 'PAUSADA', 'ENCERRADA', 'PARADA_SEGURA'] as const;
export type EstadoSessao = (typeof ESTADOS)[number];

/** Comandos do usuário + condições de falha detectadas pelo sistema. */
export const GATILHOS = ['INICIAR', 'PAUSAR', 'RETOMAR', 'ENCERRAR', 'EMERGENCIA', 'REINICIAR', 'FALHA_SENSOR', 'CONEXAO_PERDIDA'] as const;
export type Gatilho = (typeof GATILHOS)[number];

export const COMANDOS_USUARIO = ['INICIAR', 'PAUSAR', 'RETOMAR', 'ENCERRAR', 'EMERGENCIA', 'REINICIAR'] as const;
export type ComandoUsuario = (typeof COMANDOS_USUARIO)[number];

const TABELA: Partial<Record<EstadoSessao, Partial<Record<Gatilho, EstadoSessao>>>> = {
  CRIADA: { INICIAR: 'EM_EXECUCAO', EMERGENCIA: 'PARADA_SEGURA' },
  EM_EXECUCAO: {
    PAUSAR: 'PAUSADA',
    ENCERRAR: 'ENCERRADA',
    EMERGENCIA: 'PARADA_SEGURA',
    FALHA_SENSOR: 'PARADA_SEGURA',
    CONEXAO_PERDIDA: 'PAUSADA'
  },
  PAUSADA: { RETOMAR: 'EM_EXECUCAO', ENCERRAR: 'ENCERRADA', EMERGENCIA: 'PARADA_SEGURA', FALHA_SENSOR: 'PARADA_SEGURA' },
  PARADA_SEGURA: { REINICIAR: 'PAUSADA' }
};

/** Próximo estado, ou null se o gatilho não é aceito no estado atual. */
export function transicao(estado: EstadoSessao, gatilho: Gatilho): EstadoSessao | null {
  return TABELA[estado]?.[gatilho] ?? null;
}

/** Estados em que a sessão ainda recebe eventos de golpe. */
export const ESTADOS_ATIVOS: EstadoSessao[] = ['EM_EXECUCAO', 'PAUSADA'];
