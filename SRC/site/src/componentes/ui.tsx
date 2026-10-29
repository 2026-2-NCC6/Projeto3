import React, { useCallback, useEffect, useState } from 'react';
import { ErroApi, ErroRede } from '../api/cliente';

export function mensagemDeErro(e: unknown) {
  if (e instanceof ErroRede) return 'Sem conexão com a API. Confira a internet e tente de novo.';
  if (e instanceof ErroApi) return e.status === 403 ? 'Sua conta não tem permissão para esta ação.' : e.message;
  return 'Algo deu errado. Tente de novo.';
}

/** Carrega dados ao montar e expõe recarregar(); o erro vira texto pronto para exibir. */
export function useCarregar<T>(buscar: () => Promise<T>, deps: React.DependencyList) {
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const executar = useCallback(buscar, deps);
  const recarregar = useCallback(async () => {
    setCarregando(true);
    try {
      setDados(await executar());
      setErro(null);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setCarregando(false);
    }
  }, [executar]);
  useEffect(() => {
    void recarregar();
  }, [recarregar]);
  return { dados, erro, carregando, recarregar, setDados };
}

export function Aviso({ tipo, children }: { tipo?: 'erro' | 'ok'; children: React.ReactNode }) {
  return (
    <div className={`aviso ${tipo ?? ''}`} role={tipo === 'erro' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

export function Chip({ valor, rotulo }: { valor: string; rotulo?: string }) {
  return <span className={`chip ${valor}`}>{rotulo ?? valor.replaceAll('_', ' ')}</span>;
}

export function Indicador({ valor, unidade, rotulo, delta }: { valor: React.ReactNode; unidade?: string; rotulo: string; delta?: number | null }) {
  return (
    <div className="indicador">
      <div className="valor">
        {valor}
        {unidade && <small>{unidade}</small>}
      </div>
      <div className="rotulo">
        {rotulo}
        {delta != null && delta !== 0 && (
          <span className={delta > 0 ? 'delta-pos' : 'delta-neg'}>
            {' '}
            · {delta > 0 ? '+' : ''}
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}

type PropsCampo = { rotulo: string; erros?: string[]; dica?: string; children: React.ReactElement };

/** Rótulo, controle e mensagens do servidor juntos, ligados por aria-describedby. */
export function Campo({ rotulo, erros = [], dica, children }: PropsCampo) {
  const id = React.useId();
  const descricao = erros.length || dica ? `${id}-d` : undefined;
  return (
    <label className={`campo ${erros.length ? 'campo-erro' : ''}`}>
      {rotulo}
      {React.cloneElement(children, { 'aria-describedby': descricao, 'aria-invalid': erros.length > 0 || undefined })}
      {descricao && (
        <span id={descricao} className={erros.length ? 'erro-campo' : 'nota'}>
          {erros.length ? erros.join(' ') : dica}
        </span>
      )}
    </label>
  );
}

export const dataHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
export const data = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');
export const minutos = (seg: number | null) => (seg == null ? '—' : `${Math.floor(seg / 60)}:${String(Math.round(seg % 60)).padStart(2, '0')}`);

export const NOME_NIVEL = { INICIANTE: 'Iniciante', INTERMEDIARIO: 'Intermediário', AVANCADO: 'Avançado' } as const;
export const NOME_MODO = { INFANTIL: 'Infantil', ADULTO: 'Adulto', TODOS: 'Todos' } as const;
export const NOME_STATUS = { RASCUNHO: 'Rascunho', EM_REVISAO: 'Em revisão', PUBLICADA: 'Publicada', ARQUIVADA: 'Arquivada' } as const;
