import React from 'react';
import { Link } from 'react-router-dom';

import SupervisorAccountOutlinedIcon from '@mui/icons-material/SupervisorAccountOutlined';

import Faixa from './faixa';
import { useSessao } from '../sessao/sessao';

// Faixa do portal do Responsável Legal: diz de quem são os dados da tela.
// O nome vem na sessão, junto com a escolha do representado.
function FaixaRepresentado() {
  const { sessao } = useSessao();
  const representado = sessao?.representado;

  if (sessao?.usuario?.papel !== 'RESPONSAVEL_LEGAL' || !representado) return null;

  return (
    <Faixa
      tom='neutro'
      icone={SupervisorAccountOutlinedIcon}
      acoes={
        <Link to='/portal/representado' className='btn btn-sm btn-outline-secondary'>
          Trocar
        </Link>
      }
    >
      Representando: <strong>{representado.nome}</strong>
    </Faixa>
  );
}

export default FaixaRepresentado;
