import { useSyncExternalStore } from 'react';
import type { ResumoSessao } from './regras';

// Sessões feitas desde que o app abriu. Ainda não persiste: some ao fechar o app.
let sessoes: ResumoSessao[] = [];
const ouvintes = new Set<() => void>();

export function registrarSessao(resumo: ResumoSessao) {
  if (sessoes.some((s) => s.terminadaEm === resumo.terminadaEm && s.treinoId === resumo.treinoId)) return;
  sessoes = [resumo, ...sessoes];
  ouvintes.forEach((cb) => cb());
}

function inscrever(cb: () => void) {
  ouvintes.add(cb);
  return () => {
    ouvintes.delete(cb);
  };
}

export function useSessoesRecentes() {
  return useSyncExternalStore(inscrever, () => sessoes);
}
