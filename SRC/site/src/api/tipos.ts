// Formatos das respostas da API usados pelo site. Fonte: SRC/backend/docs/openapi.json.

export type Papel = 'JOGADOR' | 'AUTOR' | 'ADMIN';
export type Nivel = 'INICIANTE' | 'INTERMEDIARIO' | 'AVANCADO';
export type ModoPublico = 'INFANTIL' | 'ADULTO' | 'TODOS';
export type Sensor = 'IMU' | 'PIEZO';
export type StatusVersao = 'RASCUNHO' | 'EM_REVISAO' | 'PUBLICADA' | 'ARQUIVADA';
export type Origem = 'LOCAL' | 'PLATAFORMA_MAE';
export type Lado = 'Forehand' | 'Backhand';

export type Usuario = { id: string; email: string; nome: string; papel: Papel };
export type RespostaAuth = { accessToken: string; refreshToken: string; usuario: Usuario };

export type FaixaEtaria = 'ATE_9' | 'DE_10_A_13' | 'DE_14_A_17' | 'DE_18_A_29' | 'DE_30_A_44' | 'DE_45_A_59' | 'DE_60_MAIS';
export type Praticante = { id: string; tipo: 'TITULAR' | 'DEPENDENTE'; apelido: string; faixaEtaria: FaixaEtaria; nivel: Nivel };

export type Exercicio = {
  nome: string;
  repeticoes: number;
  golpeEsperado: 'FH' | 'BH' | 'ALTERNADO';
  lancamento: { velocidadeKmh: number; rotacao: 'TOPSPIN' | 'SLICE' | 'PLANO'; direcao: 'ESQ' | 'CENTRO' | 'DIR'; alturaM: number; intervaloSeg: number };
};

export type ConteudoTreino = {
  publicoAlvo: string;
  objetivo: string;
  nivel: Nivel;
  duracaoMin: number;
  modoPublico: ModoPublico;
  instrucoes: string[];
  equipamentos: string[];
  riscos: string[];
  sensores: Sensor[];
  pontuacao: { base: number; bonusSequencia: number; bonusForte: number; penalidadeErro: number; metaPrecisao: number };
  exercicios: Exercicio[];
  feedbacks: { acerto: string; erro: string; sequencia: string };
  conclusao: { tipo: 'TEMPO' | 'REPETICOES'; valor: number };
  tutorial?: { golpes: { lado: 'FH' | 'BH'; alvo: string; arco: number }[]; segPorBola: number; passos: string[] };
};

export type Categoria = { id: string; slug: string; nome: string };

export type ResumoVersao = {
  versaoId: string;
  numero: number;
  status: StatusVersao;
  compatibilidadeFirmware: string | null;
  notasAlteracao: string | null;
  criadoEm: string;
  publicadoEm: string | null;
};

export type Marketplace = {
  descricaoComercial: string;
  licenca: 'CC_BY' | 'PROPRIETARIA' | 'USO_PESSOAL';
  modeloRemuneracao: 'GRATUITO' | 'AVULSO' | 'ASSINATURA';
  precoFuturoCentavos?: number | null;
};

export type DetalheVersao = ResumoVersao & {
  slug: string;
  nome: string;
  autor: string | null;
  origem: Origem;
  categoria: { slug: string; nome: string } | null;
  conteudo: ConteudoTreino;
  marketplace: Marketplace | null;
};

export type TreinoDaAutoria = {
  slug: string;
  nome: string;
  autor: string;
  origem: Origem;
  categoria: { slug: string; nome: string } | null;
  publicada: number | null;
  ultima: { numero: number; status: StatusVersao; criadoEm: string; publicadoEm: string | null };
};

export type ErroValidacao = { campo: string; mensagem: string };

export type Lancamento = {
  seq: number;
  exercicio: number;
  nomeExercicio: string;
  velocidadeKmh: number;
  rotacao: string;
  direcao: 'ESQ' | 'CENTRO' | 'DIR';
  alturaM: number;
  intervaloSeg: number;
  golpeEsperado: Lado;
  emSeg: number;
};

export type ResumoCalculado = {
  duracaoSeg: number;
  golpes: number;
  acertos: number;
  precisao: number;
  pontos: number;
  melhorSequencia: number;
  consistencia: number;
  metaPrecisao: number;
  metaAtingida: boolean;
};

export type Ensaio = { erros: ErroValidacao[]; duracaoEstimadaSeg: number; lancamentos: Lancamento[]; resumoExemplo: ResumoCalculado };

export type Estatisticas =
  | { sessoes: number; praticantes: null; aviso: string }
  | { sessoes: number; praticantes: number; precisaoMedia: number; pontosMedios: number; sessoesPorVersao: Record<string, number> };

export type SessaoHistorico = {
  id: string;
  treino: { slug: string; nome: string; versao: number };
  origem: 'SENSOR' | 'DEMO';
  estado: string;
  iniciadaEm: string | null;
  encerradaEm: string | null;
  duracaoSeg: number | null;
  pontos: number | null;
  golpes: number | null;
  acertos: number | null;
  motivoInterrupcao: string | null;
  offline: boolean;
  resumo: ResumoCalculado | null;
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

export type UsuarioAdmin = Usuario & { ativo: boolean; criadoEm: string; anonimizadoEm: string | null };
export type DispositivoAdmin = {
  id: string;
  nomeBle: string;
  identificador: string;
  firmwareVersao: string;
  ultimoContatoEm: string | null;
  bloqueado: boolean;
  conta: { email: string };
};
export type SessaoAdmin = {
  id: string;
  estado: string;
  origem: string;
  offline: boolean;
  divergencia: boolean;
  motivoInterrupcao: string | null;
  iniciadaEm: string | null;
  encerradaEm: string | null;
  pontos: number | null;
  golpes: number | null;
  versao: { numero: number; treino: { slug: string } };
};
export type RegistroAuditoria = {
  id: string;
  ocorridoEm: string;
  usuarioId: string | null;
  acao: string;
  alvoTipo: string | null;
  alvoId: string | null;
  ip: string | null;
  requestId: string | null;
  severidade: 'INFO' | 'INCIDENTE';
  detalhes: unknown;
};
export type EnvioPlataforma = {
  id: string;
  sessaoId: string;
  tipo: 'RESUMO' | 'EVENTOS';
  status: 'PENDENTE' | 'ENVIADO' | 'FALHOU';
  tentativas: number;
  proximaTentativaEm: string | null;
  ultimoErro: string | null;
  criadoEm: string;
  enviadoEm: string | null;
};

export type Conta = Usuario & { praticantes: Praticante[] };
