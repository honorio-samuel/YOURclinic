import React from 'react';

import Paginacao from './paginacao';
import EstadoErro from './estado-erro';

const LINHAS_DE_ESQUELETO = 4;

// A coluna sem título, ou chamada "Ações", é a das ações da linha: vai à direita.
const ehDeAcoes = (coluna) => !coluna.titulo || coluna.titulo === 'Ações';

const classeDa = (coluna) => [coluna.classe, ehDeAcoes(coluna) ? 'coluna-acoes' : null].filter(Boolean).join(' ') || undefined;

// Tabela padrão das listagens, dentro de um cartão: cabeçalho, linhas, estados
// de carregando, vazio e erro, e paginação quando passa de uma página.
// colunas: [{ titulo, render(linha), classe }]
// Com "titulo", o cartão ganha cabeçalho: chip do ícone, título, contador (o
// número de linhas, ou o valor de "contador") e a legenda como subtítulo.
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
  icone: Icone,
  contador,
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
    <div className='listagem d-flex flex-column gap-3'>
      <div className='card' aria-busy={carregando ? true : undefined}>
        {titulo && (
          <div className='card-body pb-2 d-flex align-items-center gap-2'>
            {Icone && (
              <span className='chip-icone text-bg-dark' aria-hidden='true'>
                <Icone fontSize='small' />
              </span>
            )}
            <div>
              <div className='d-flex align-items-center gap-2'>
                <h2 className='h5 mb-0'>{titulo}</h2>
                {!carregando && <span className='badge rounded-pill bg-body-secondary text-body'>{contador ?? total}</span>}
              </div>
              {legenda && <p className='small text-body-secondary mb-0'>{legenda}</p>}
            </div>
          </div>
        )}
        <div className='table-responsive'>
          {/* data-rotulo leva o título da coluna a cada célula: no portal, abaixo
              de 992 px, a linha vira cartão e o título aparece ao lado do valor. */}
          <table className='table table-hover align-middle mb-0 listagem-tabela'>
            <thead>
              <tr>
                {colunas.map((coluna, i) => (
                  <th key={i} scope='col' className={classeDa(coluna)}>
                    {coluna.titulo || <span className='visually-hidden'>Ações</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {carregando &&
                Array.from({ length: LINHAS_DE_ESQUELETO }, (_, i) => (
                  <tr key={i} className='placeholder-glow' aria-hidden='true'>
                    {colunas.map((coluna, j) => (
                      <td key={j} className={classeDa(coluna)}>
                        <span className='placeholder rounded-pill w-75' />
                      </td>
                    ))}
                  </tr>
                ))}
              {!carregando && total === 0 && (
                <tr>
                  <td colSpan={colunas.length} className='text-center text-body-secondary py-4'>
                    {vazio}
                  </td>
                </tr>
              )}
              {!carregando &&
                daPagina.map((linha) => (
                  <tr key={chave(linha)}>
                    {colunas.map((coluna, i) => (
                      <td key={i} className={classeDa(coluna)} data-rotulo={ehDeAcoes(coluna) ? undefined : coluna.titulo}>
                        {coluna.render(linha)}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {carregando && (
          <p className='visually-hidden' role='status'>
            Carregando…
          </p>
        )}
        {legenda && !titulo && <p className='small text-body-secondary px-4 pt-2 pb-3 mb-0'>{legenda}</p>}
      </div>
      {!carregando && totalPaginas > 1 && (
        <Paginacao pagina={pagina} totalPaginas={totalPaginas} onMudarPagina={setPagina} />
      )}
    </div>
  );
}

export default Listagem;
