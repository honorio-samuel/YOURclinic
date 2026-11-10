import React from 'react';
import { Link } from 'react-router-dom';

import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';

import { buscar } from '../servicos/dados';
import { useSessao } from '../sessao/sessao';

// Faixa fixa no portal do Responsável Legal: diz de quem são os dados da tela.
function FaixaRepresentado() {
  const { sessao } = useSessao();
  const [nome, setNome] = React.useState('');
  const id = sessao?.idRepresentado;

  React.useEffect(() => {
    let ativo = true;
    if (id) {
      buscar('pessoas', id)
        .then((p) => ativo && setNome(p.nome))
        .catch(() => ativo && setNome(''));
    }
    return () => {
      ativo = false;
    };
  }, [id]);

  if (sessao?.usuario?.papel !== 'RESPONSAVEL_LEGAL' || !id) return null;

  return (
    <div className='faixa-representado d-flex align-items-center gap-2 px-3 py-2 mb-3'>
      <SupervisorAccountIcon fontSize='small' aria-hidden='true' />
      <span>
        Representando: <strong>{nome || '…'}</strong>
      </span>
      <span aria-hidden='true'>·</span>
      <Link to='/portal/representado'>Trocar</Link>
    </div>
  );
}

export default FaixaRepresentado;
