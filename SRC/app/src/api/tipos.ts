// Formatos das respostas da API (SRC/backend; contrato completo em SRC/backend/docs/openapi.json).

export type Papel = 'JOGADOR' | 'AUTOR' | 'ADMIN';
export type Nivel = 'INICIANTE' | 'INTERMEDIARIO' | 'AVANCADO';
export type ModoPublico = 'INFANTIL' | 'ADULTO' | 'TODOS';
export type FaixaEtaria = 'ATE_9' | 'DE_10_A_13' | 'DE_14_A_17' | 'DE_18_A_29' | 'DE_30_A_44' | 'DE_45_A_59' | 'DE_60_MAIS';
export type Lado = 'Forehand' | 'Backhand';

export type Usuario = { id: string; email: string; nome: string; papel: Papel };
export type RespostaAuth = { usuario: Usuario; accessToken: string; refreshToken: string; expiraEmSeg: number };

export type Praticante = {
  id: string;
  tipo: 'TITULAR' | 'DEPENDENTE';
  apelido: string;
  faixaEtaria: FaixaEtaria;
  nivel: Nivel;
  objetivos: string[];
  preferencias: Record<string, unknown>;
  restricoes: string | null;
  consenteTelemetria: boolean;
  consentimentoParentalEm: string | null;
};

export type Conta = Usuario & { termosVersao: string; termosAceitosEm: string; praticantes: Praticante[] };

export type RegrasPontuacao = { base: number; bonusSequencia: number; bonusForte: number; penalidadeErro: number; metaPrecisao: number };

export type Exercicio = {
  nome: string;
  repeticoes: number;
  golpeEsperado: 'FH' | 'BH' | 'ALTERNADO';
  lancamento: { velocidadeKmh: number; rotacao: 'TOPSPIN' | 'SLICE' | 'PLANO'; direcao: 'ESQ' | 'CENTRO' | 'DIR'; alturaM: number; intervaloSeg: number };
};

export type GolpeTutorial = { lado: 'FH' | 'BH'; alvo: string; arco: number };

export type ConteudoTreino = {
  publicoAlvo: string;
  objetivo: string;
  nivel: Nivel;
  duracaoMin: number;
  modoPublico: ModoPublico;
  instrucoes: string[];
  equipamentos: string[];
  riscos: string[];
  sensores: ('IMU' | 'PIEZO')[];
  pontuacao: RegrasPontuacao;
  exercicios: Exercicio[];
  feedbacks: { acerto: string; erro: string; sequencia: string };
  conclusao: { tipo: 'TEMPO' | 'REPETICOES'; valor: number };
  tutorial?: { golpes: GolpeTutorial[]; segPorBola: number; passos: string[] };
};

export type TreinoResumo = {
  slug: string;
  nome: string;
  autor: string;
  origem: 'LOCAL' | 'PLATAFORMA_MAE';
  categoria: { slug: string; nome: string } | null;
  versao: number;
  publicoAlvo: string;
  objetivo: string;
  nivel: Nivel;
  duracaoMin: number;
  modoPublico: ModoPublico;
  sensores: string[];
};

export type TreinoDetalhe = Omit<TreinoResumo, 'versao'> & {
  versaoId: string;
  numero: number;
  compatibilidadeFirmware: string;
  publicadoEm: string | null;
  conteudo: ConteudoTreino;
};

export type Dispositivo = {
  id: string;
  nomeBle: string;
  identificador: string;
  firmwareVersao: string;
  bloqueado: boolean;
  ultimoContatoEm: string | null;
};

export type EstadoSessao = 'CRIADA' | 'EM_EXECUCAO' | 'PAUSADA' | 'ENCERRADA' | 'PARADA_SEGURA';
export type ComandoSessao = 'INICIAR' | 'PAUSAR' | 'RETOMAR' | 'ENCERRAR' | 'EMERGENCIA' | 'REINICIAR';

export type Recomendacao = { tipo: 'REFORCAR_LADO' | 'REDUZIR_CARGA' | 'AVANCAR_NIVEL'; mensagem: string; treinoSlug: string | null };
export type Conquista = 'PRIMEIRA_SESSAO' | 'SEQUENCIA_10' | 'META_PRECISAO' | 'RESISTENCIA';

export type ResumoServidor = {
  duracaoSeg: number;
  golpes: number;
  acertos: number;
  precisao: number;
  pontos: number;
  sequenciaAtual: number;
  melhorSequencia: number;
  fortes: number;
  porLado: Record<Lado, { acertos: number; total: number }>;
  porLadoEsperado: Record<Lado, { acertos: number; total: number }>;
  quartisForca: [number, number, number, number];
  indiceResistencia: number;
  quedaEmSeg: number | null;
  consistencia: number;
  cadenciaSeg: number | null;
  metaPrecisao: number;
  metaAtingida: boolean;
  conquistas?: Conquista[];
  recomendacoes?: Recomendacao[];
  treino?: { slug: string; versao: number };
};

export type Sessao = {
  id: string;
  praticanteId: string;
  treino: { slug: string; versao: number };
  dispositivoId: string | null;
  origem: 'SENSOR' | 'DEMO';
  estado: EstadoSessao;
  iniciadaEm: string | null;
  encerradaEm: string | null;
  motivoInterrupcao: string | null;
  duracaoSeg: number | null;
  lancamentos: number;
  pontos: number | null;
  golpes: number | null;
  acertos: number | null;
  divergencia: boolean;
  offline: boolean;
  resumo: ResumoServidor | null;
};

export type SessaoHistorico = Omit<Sessao, 'praticanteId' | 'dispositivoId' | 'lancamentos' | 'divergencia' | 'treino'> & {
  treino: { slug: string; nome: string; versao: number };
};

export type Indicadores = {
  sessoes: number;
  precisao: number;
  consistencia: number;
  cadenciaSeg: number | null;
  volume: number;
  tempoSeg: number;
  pontosMedios: number;
  progressao: { precisaoDelta: number; pontosDelta: number } | null;
};

/** Lançamento do simulador da máquina, recebido pelo WebSocket /maquina. */
export type Lancamento = {
  sessaoId: string;
  seq: number;
  exercicio: number;
  nomeExercicio: string;
  velocidadeKmh: number;
  rotacao: string;
  direcao: string;
  alturaM: number;
  intervaloSeg: number;
  golpeEsperado: Lado;
};

export type EventoCliente = {
  id: string;
  tipo: 'GOLPE' | 'ERRO' | 'ESTADO';
  tMs: number;
  ocorridoEm: string;
  dados: Record<string, unknown>;
};
