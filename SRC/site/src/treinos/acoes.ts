import type { Origem, StatusVersao } from '../api/tipos';

export type Acao = 'editar' | 'validar' | 'ensaiar' | 'enviarRevisao' | 'devolver' | 'publicar' | 'novaVersao';

/**
 * O que a interface oferece para uma versão (RF14–RF16). Espelha as transições do servidor, que
 * continua sendo quem decide: um botão a mais só resultaria num 409.
 */
export function acoesDaVersao(v: { status: StatusVersao; origem: Origem; podeEditar: boolean; ehUltima: boolean }): Acao[] {
  if (!v.podeEditar) return [];
  if (v.origem === 'PLATAFORMA_MAE') return ['validar', 'ensaiar'];
  switch (v.status) {
    case 'RASCUNHO':
      return ['editar', 'validar', 'ensaiar', 'enviarRevisao'];
    case 'EM_REVISAO':
      return ['validar', 'ensaiar', 'devolver', 'publicar'];
    default:
      return v.ehUltima ? ['validar', 'ensaiar', 'novaVersao'] : ['validar', 'ensaiar'];
  }
}
