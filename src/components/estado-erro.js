import React from 'react';

import Faixa from './faixa';

// Mensagens de falha ao carregar. 403 e 404 seguem G-08a e G-08b: a de registro
// é a mesma para "não existe" e "não autorizado".
function EstadoErro({ erro, aoTentarDeNovo }) {
  if (erro?.status === 403) {
    return (
      <Faixa tom='aviso' papel='alert'>
        Seu perfil não tem acesso a esta informação.
      </Faixa>
    );
  }
  if (erro?.status === 404) {
    return (
      <Faixa tom='aviso' papel='alert'>
        Não foi possível abrir este registro. Ele pode não existir ou não estar disponível para o
        seu perfil.
      </Faixa>
    );
  }
  return (
    <Faixa
      tom='perigo'
      papel='alert'
      acoes={
        aoTentarDeNovo && (
          <button type='button' className='btn btn-sm btn-outline-secondary' onClick={aoTentarDeNovo}>
            Tentar de novo
          </button>
        )
      }
    >
      Não foi possível carregar os dados agora.
    </Faixa>
  );
}

export default EstadoErro;
