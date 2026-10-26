import { Link, useNavigate } from 'react-router-dom';
import { useSessao } from '../auth/Sessao';
import { Aviso, Chip, data, NOME_STATUS, useCarregar } from '../componentes/ui';

/** RF14/RF16: treinos do autor (admin vê todos) com a versão publicada e a mais recente. */
export function Treinos() {
  const { api, conta } = useSessao();
  const navegar = useNavigate();
  const { dados, erro, carregando } = useCarregar(() => api.meusTreinos(), [api]);
  const admin = conta?.papel === 'ADMIN';

  return (
    <>
      <header className="cabecalho">
        <div>
          <div className="sobrelinha">{admin ? 'Todos os treinos' : 'Sua autoria'}</div>
          <h1>Treinos</h1>
        </div>
        <Link to="/treinos/novo" className="botao primario">
          Novo treino
        </Link>
      </header>

      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {!carregando && dados?.length === 0 && (
        <div className="vazio">
          Você ainda não criou treinos. <Link to="/treinos/novo">Crie o primeiro</Link>: ele nasce como rascunho e só chega ao app depois de publicado.
        </div>
      )}

      {!!dados?.length && (
        <div className="tabela-rolagem">
          <table>
            <thead>
              <tr>
                <th>Treino</th>
                {admin && <th>Autor</th>}
                <th>No app</th>
                <th>Versão mais recente</th>
                <th>Atualizado</th>
              </tr>
            </thead>
            <tbody>
              {dados.map((t) => (
                <tr key={t.slug} className="clicavel" onClick={() => navegar(`/treinos/${t.slug}`)}>
                  <td>
                    <Link to={`/treinos/${t.slug}`} onClick={(e) => e.stopPropagation()}>
                      {t.nome}
                    </Link>
                    <div className="nota mono">
                      {t.slug}
                      {t.origem === 'PLATAFORMA_MAE' && ' · plataforma mãe'}
                      {t.categoria && ` · ${t.categoria.nome}`}
                    </div>
                  </td>
                  {admin && <td>{t.autor}</td>}
                  <td>{t.publicada ? <span className="mono">v{t.publicada}</span> : <span className="nota">não publicado</span>}</td>
                  <td>
                    <span className="mono">v{t.ultima.numero}</span> <Chip valor={t.ultima.status} rotulo={NOME_STATUS[t.ultima.status]} />
                  </td>
                  <td>{data(t.ultima.publicadoEm ?? t.ultima.criadoEm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
