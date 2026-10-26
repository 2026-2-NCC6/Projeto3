import { novoDesafio, prova } from './hmac';
import { Comando, FIRMWARE_MINIMO, Mensagem, chaveValida, comandoDesafio, comandoProva, versaoAtende } from './protocolo';

// Autenticação do app na raquete (RNF Cibersegurança do IoT). Mesmo protocolo de
// SRC/arduino/tennis_imu/autenticacao.h: a placa prova primeiro que conhece a chave,
// e só então o app envia a sua prova. A chave nunca passa pelo canal.

export type CodigoErroAutenticacao = 'SEM_CHAVE' | 'SEM_RESPOSTA' | 'APARELHO_FALSO' | 'CHAVE_RECUSADA' | 'BLOQUEADA' | 'FIRMWARE_ANTIGO';

const MENSAGENS: Record<CodigoErroAutenticacao, string> = {
  SEM_CHAVE: 'Sem a chave desta raquete. Registre a raquete na sua conta e tente de novo.',
  SEM_RESPOSTA: 'A raquete não respondeu à autenticação. Aproxime o celular e tente de novo.',
  APARELHO_FALSO:
    'A raquete não comprovou a chave: pode ser um aparelho se passando por ela, ou a chave cadastrada não é a gravada nesta raquete. Conexão recusada.',
  CHAVE_RECUSADA: 'A raquete recusou a autenticação. Confira se a chave cadastrada é a mesma do firmware.',
  BLOQUEADA: 'A raquete bloqueou novas tentativas por 30 s depois de provas erradas. Aguarde e tente de novo.',
  FIRMWARE_ANTIGO: `O firmware da raquete é anterior a ${FIRMWARE_MINIMO} e não é seguro. Atualize a raquete.`
};

export class ErroAutenticacao extends Error {
  constructor(readonly codigo: CodigoErroAutenticacao) {
    super(MENSAGENS[codigo]);
  }
}

/** Envia o comando e devolve a primeira mensagem que `aceita` aprovar (null se não vier a tempo). */
export type EnviarEAguardar = (cmd: Comando, aceita: (m: Mensagem) => boolean) => Promise<Mensagem | null>;

const ehErroAuth = (m: Mensagem) => m.tipo === 'erro' && (m.texto === 'AUTH' || m.texto === 'BLOQ');

export async function autenticarRaquete(chave: string | null, enviarEAguardar: EnviarEAguardar): Promise<{ versao: string }> {
  if (!chave || !chaveValida(chave)) throw new ErroAutenticacao('SEM_CHAVE');

  const na = novoDesafio();
  const resposta = await enviarEAguardar(comandoDesafio(na), (m) => m.tipo === 'desafio' || ehErroAuth(m));
  if (!resposta) throw new ErroAutenticacao('SEM_RESPOSTA');
  if (resposta.tipo === 'erro') throw new ErroAutenticacao(resposta.texto === 'BLOQ' ? 'BLOQUEADA' : 'CHAVE_RECUSADA');
  if (resposta.tipo !== 'desafio' || resposta.pb !== prova(chave, 'B', na, resposta.nb)) throw new ErroAutenticacao('APARELHO_FALSO');

  const fim = await enviarEAguardar(comandoProva(prova(chave, 'A', na, resposta.nb)), (m) => m.tipo === 'versao' || ehErroAuth(m));
  if (!fim) throw new ErroAutenticacao('SEM_RESPOSTA');
  if (fim.tipo === 'erro') throw new ErroAutenticacao(fim.texto === 'BLOQ' ? 'BLOQUEADA' : 'CHAVE_RECUSADA');
  if (fim.tipo !== 'versao') throw new ErroAutenticacao('SEM_RESPOSTA');
  if (!versaoAtende(fim.versao, FIRMWARE_MINIMO)) throw new ErroAutenticacao('FIRMWARE_ANTIGO');
  return { versao: fim.versao };
}
