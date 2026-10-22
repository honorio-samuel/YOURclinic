import React from 'react';

import Paginacao from './paginacao';
import EstadoErro from './estado-erro';

// Tabela padrão das listagens (seção 8 do pedido): cabeçalho, linhas, estados de
// carregando, vazio e erro, e paginação quando passa de uma página.
// colunas: [{ titulo, render(linha), classe }]
function Listagem({
  colunas,
  linhas,
  carregando,
  erro,
  aoTentarDeNovo,
  vazio = 'Nenhum registro encontrado.',
  itensPorPagina = 10,
  chave = (linha) => linha.id,
  titulo,
  legenda,
}) {
  const [pagina, setPagina] = React.useState(1);
  const total = linhas?.length ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / itensPorPagina));

  React.useEffect(() => {
    if (pagina > totalPaginas) setPagina(1);
  }, [pagina, totalPaginas]);

  if (erro) return <EstadoErro erro={erro} aoTentarDeNovo={aoTentarDeNovo} />;

  const inicio = (pagina - 1) * itensPorPagina;
  const daPagina = (linhas ?? []).slice(inicio, inicio + itensPorPagina);

  return (
    <div className='d-flex flex-column gap-2'>
      {titulo && <h2 className='h5 mb-0'>{titulo}</h2>}
      <div className='card'>
        <div className='table-responsive'>
          <table className='table table-hover align-middle mb-0'>
            <thead>
              <tr>
                {colunas.map((coluna, i) => (
                  <th key={i} scope='col' className={coluna.classe}>
                    {coluna.titulo || <span className='visually-hidden'>Ações</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {carregando && (
                <tr>
                  <td colSpan={colunas.length} className='text-center text-body-secondary'>
                    Carregando…
                  </td>
                </tr>
              )}
              {!carregando && total === 0 && (
                <tr>
                  <td colSpan={colunas.length} className='text-center text-body-secondary'>
                    {vazio}
                  </td>
                </tr>
              )}
              {!carregando &&
                daPagina.map((linha) => (
                  <tr key={chave(linha)}>
                    {colunas.map((coluna, i) => (
                      <td key={i} className={coluna.classe}>
                        {coluna.render(linha)}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      {legenda && <p className='small text-body-secondary mb-0'>{legenda}</p>}
      {!carregando && totalPaginas > 1 && (
        <Paginacao pagina={pagina} totalPaginas={totalPaginas} onMudarPagina={setPagina} />
      )}
    </div>
  );
}

export default Listagem;
