import React from 'react';

import Modal from './modal';

// Janela de leitura: pares de rótulo e valor, sem edição. Item com valor
// undefined não aparece; null aparece como "—".
function JanelaDetalhe({ titulo, itens, aoFechar, children }) {
  return (
    <Modal
      titulo={titulo}
      aoFechar={aoFechar}
      rodape={
        <button type='button' className='btn btn-outline-secondary' onClick={aoFechar}>
          Fechar
        </button>
      }
    >
      <dl className='row mb-0'>
        {itens
          .filter(([, valor]) => valor !== undefined)
          .map(([rotulo, valor]) => (
            <React.Fragment key={rotulo}>
              <dt className='col-sm-4'>{rotulo}</dt>
              <dd className='col-sm-8'>{valor ?? '—'}</dd>
            </React.Fragment>
          ))}
      </dl>
      {children}
    </Modal>
  );
}

export default JanelaDetalhe;
