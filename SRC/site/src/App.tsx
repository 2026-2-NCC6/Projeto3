import type React from 'react';
import { Navigate, NavLink, Outlet, Route, Routes } from 'react-router-dom';
import { podeAutorar, useSessao } from './auth/Sessao';
import { Entrar } from './paginas/Entrar';
import { Resultados } from './paginas/Resultados';
import { Treinos } from './paginas/Treinos';
import { NovoTreino } from './paginas/NovoTreino';
import { Treino } from './paginas/Treino';
import { Admin } from './paginas/Admin';

const PAPEL = { JOGADOR: 'Jogador', AUTOR: 'Autor de treinos', ADMIN: 'Administrador' } as const;

function Moldura() {
  const { conta, sair } = useSessao();
  if (!conta) return <Navigate to="/entrar" replace />;
  return (
    <div className="moldura">
      <aside className="lateral">
        <div className="marca">
          <img src="/bola.svg" alt="" />
          Tennis Analytics
        </div>
        <nav className="menu" aria-label="Principal">
          <NavLink to="/resultados">Resultados</NavLink>
          {podeAutorar(conta) && <NavLink to="/treinos">Treinos</NavLink>}
          {conta.papel === 'ADMIN' && <NavLink to="/admin">Administração</NavLink>}
        </nav>
        <div className="conta-lateral">
          <span>
            <strong>{conta.nome}</strong>
            {PAPEL[conta.papel]}
          </span>
          <button className="botao pequeno" onClick={() => void sair()}>
            Sair
          </button>
        </div>
      </aside>
      <main className="conteudo">
        <Outlet />
      </main>
    </div>
  );
}

/** Rotas de autoria e admin também são barradas no servidor; aqui só evitamos a tela vazia. */
function Exige({ ok, children }: { ok: boolean; children: React.ReactElement }) {
  return ok ? children : <Navigate to="/resultados" replace />;
}

export function App() {
  const { carregando, conta } = useSessao();
  if (carregando) return null;
  return (
    <Routes>
      <Route path="/entrar" element={conta ? <Navigate to="/" replace /> : <Entrar />} />
      <Route element={<Moldura />}>
        <Route index element={<Navigate to={podeAutorar(conta) ? '/treinos' : '/resultados'} replace />} />
        <Route path="/resultados" element={<Resultados />} />
        <Route path="/treinos" element={<Exige ok={podeAutorar(conta)}><Treinos /></Exige>} />
        <Route path="/treinos/novo" element={<Exige ok={podeAutorar(conta)}><NovoTreino /></Exige>} />
        <Route path="/treinos/:slug" element={<Exige ok={podeAutorar(conta)}><Treino /></Exige>} />
        <Route path="/admin" element={<Exige ok={conta?.papel === 'ADMIN'}><Admin /></Exige>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
