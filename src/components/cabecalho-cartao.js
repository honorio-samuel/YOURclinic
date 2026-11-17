import React from 'react';

// Cabeçalho dos cartões: chip do ícone, título, contador em pílula cinza e
// legenda como subtítulo; as ações do cartão ficam à direita.
function CabecalhoCartao({ icone: Icone, titulo, contador, legenda, acoes }) {
  return (
    <div className='d-flex flex-wrap align-items-center gap-2'>
      {Icone && (
        <span className='chip-icone text-bg-dark' aria-hidden='true'>
          <Icone fontSize='small' />
        </span>
      )}
      <div className='me-auto'>
        <div className='d-flex align-items-center gap-2'>
          <h2 className='h5 mb-0'>{titulo}</h2>
          {contador !== undefined && <span className='badge rounded-pill bg-body-secondary text-body'>{contador}</span>}
        </div>
        {legenda && <p className='small text-body-secondary mb-0'>{legenda}</p>}
      </div>
      {acoes}
    </div>
  );
}

export default CabecalhoCartao;
