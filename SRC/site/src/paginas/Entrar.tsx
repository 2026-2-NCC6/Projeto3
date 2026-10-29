import { FormEvent, useState } from 'react';
import { useSessao } from '../auth/Sessao';
import { Aviso, Campo, mensagemDeErro } from '../componentes/ui';
import { LinhasQuadra } from '../componentes/Quadra';

export function Entrar() {
  const { entrar } = useSessao();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await entrar(email.trim(), senha);
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="entrar">
      <div className="lado-quadra">
        <svg viewBox="0 0 241 261" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <LinhasQuadra cor="#CBE81F" />
        </svg>
        <h1>
          Monte o treino.
          <br />
          <em>A máquina lança.</em>
        </h1>
      </div>
      <form onSubmit={enviar} aria-labelledby="titulo-entrar">
        <div>
          <div className="sobrelinha">Tennis Analytics</div>
          <h2 id="titulo-entrar">Entrar</h2>
          <p className="nota">Use a mesma conta do app. Autores criam e publicam treinos; administradores gerenciam o sistema.</p>
        </div>
        <Campo rotulo="E-mail">
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Campo>
        <Campo rotulo="Senha">
          <input type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
        </Campo>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <button className="botao primario" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
        <p className="nota">Ainda não tem conta? Crie pelo app; o cadastro exige ser maior de idade.</p>
      </form>
    </div>
  );
}
