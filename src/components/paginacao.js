import React from 'react';

function Paginacao(props) {
  const primeira = props.pagina <= 1;
  const ultima = props.pagina >= props.totalPaginas;

  return (
    <nav aria-label='Paginação'>
      <ul className='pagination justify-content-center mb-0'>
        <li className={`page-item ${primeira ? 'disabled' : ''}`}>
          <button
            type='button'
            className='page-link'
            disabled={primeira}
            onClick={() => props.onMudarPagina(props.pagina - 1)}
          >
            « Voltar
          </button>
        </li>
        <li className='page-item active' aria-current='page'>
          <span className='page-link'>
            Página {props.pagina} de {props.totalPaginas}
          </span>
        </li>
        <li className={`page-item ${ultima ? 'disabled' : ''}`}>
          <button
            type='button'
            className='page-link'
            disabled={ultima}
            onClick={() => props.onMudarPagina(props.pagina + 1)}
          >
            Avançar »
          </button>
        </li>
      </ul>
    </nav>
  );
}

export default Paginacao;
