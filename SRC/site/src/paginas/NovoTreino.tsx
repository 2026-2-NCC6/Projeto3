import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ErroApi } from '../api/cliente';
import type { ErroValidacao } from '../api/tipos';
import { useSessao } from '../auth/Sessao';
import { EditorConteudo } from '../componentes/EditorConteudo';
import { Aviso, Campo, mensagemDeErro, useCarregar } from '../componentes/ui';
import { conteudoPadrao } from '../treinos/conteudo';

const paraSlug = (nome: string) =>
  nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

/** RF14: cria o treino como rascunho (versão 1). */
export function NovoTreino() {
  const { api } = useSessao();
  const navegar = useNavigate();
  const { dados: categorias } = useCarregar(() => api.categorias(), [api]);
  const [nome, setNome] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTocado, setSlugTocado] = useState(false);
  const [categoria, setCategoria] = useState('');
  const [conteudo, setConteudo] = useState(conteudoPadrao);
  const [erro, setErro] = useState<string | null>(null);
  const [erros, setErros] = useState<ErroValidacao[]>([]);
  const [enviando, setEnviando] = useState(false);

  async function criar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const r = await api.criarTreino({ nome: nome.trim(), slug, categoriaSlug: categoria || undefined, conteudo, notasAlteracao: 'Primeira versão' });
      navegar(`/treinos/${r.slug}`);
    } catch (err) {
      setErro(mensagemDeErro(err));
      if (err instanceof ErroApi && Array.isArray(err.detalhes)) setErros(err.detalhes as ErroValidacao[]);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={criar}>
      <header className="cabecalho">
        <div>
          <div className="sobrelinha">
            <Link to="/treinos">Treinos</Link> / novo
          </div>
          <h1>Novo treino</h1>
        </div>
      </header>

      <div className="grade grade-3">
        <Campo rotulo="Nome do treino">
          <input
            required
            minLength={3}
            maxLength={120}
            value={nome}
            onChange={(e) => {
              setNome(e.target.value);
              if (!slugTocado) setSlug(paraSlug(e.target.value));
            }}
          />
        </Campo>
        <Campo rotulo="Endereço (slug)" dica="Identifica o treino no app e na API. Não muda depois.">
          <input
            required
            className="mono"
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            minLength={3}
            maxLength={80}
            value={slug}
            onChange={(e) => {
              setSlugTocado(true);
              setSlug(e.target.value);
            }}
          />
        </Campo>
        <Campo rotulo="Categoria">
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="">Sem categoria</option>
            {categorias?.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.nome}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <div style={{ marginTop: 32 }}>
        <EditorConteudo valor={conteudo} aoMudar={setConteudo} erros={erros} />
      </div>

      <div className="barra-acoes">
        {erro && (
          <div style={{ flexBasis: '100%' }}>
            <Aviso tipo="erro">{erro}</Aviso>
          </div>
        )}
        <button className="botao primario" disabled={enviando}>
          {enviando ? 'Criando…' : 'Criar rascunho'}
        </button>
        <Link to="/treinos" className="botao">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
