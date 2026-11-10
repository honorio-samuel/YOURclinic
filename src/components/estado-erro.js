import React from 'react';

// Mensagens de falha ao carregar. 403 e 404 seguem G-08a e G-08b: a de registro
// é a mesma para "não existe" e "não autorizado".
function EstadoErro({ erro, aoTentarDeNovo }) {
  if (erro?.status === 403) {
    return (
      <div className='alert alert-warning mb-0' role='alert'>
        Seu perfil não tem acesso a esta informação.
      </div>
    );
  }
  if (erro?.status === 404) {
    return (
      <div className='alert alert-warning mb-0' role='alert'>
        Não foi possível abrir este registro. Ele pode não existir ou não estar
        disponível para o seu perfil.
      </div>
    );
  }
  return (
    <div className='alert alert-danger mb-0 d-flex flex-wrap align-items-center gap-3' role='alert'>
      <span>Não foi possível carregar os dados agora.</span>
      {aoTentarDeNovo && (
        <button type='button' className='btn btn-sm btn-outline-danger' onClick={aoTentarDeNovo}>
          Tentar de novo
        </button>
      )}
    </div>
  );
}

export default EstadoErro;
