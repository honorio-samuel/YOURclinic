import React from 'react';
import { useNavigate } from 'react-router-dom';

import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';

import Pagina from '../../components/pagina';
import Avatar from '../../components/avatar';
import Esqueleto from '../../components/esqueleto';
import EstadoErro from '../../components/estado-erro';
import { api } from '../../config/axios';
import { useCarregar } from '../../hooks/use-carregar';
import { useSessao } from '../../sessao/sessao';

// G-09: o Responsável Legal escolhe de quem são os dados que vai ver.
function SelecionarRepresentado() {
  const { sessao, escolherRepresentado } = useSessao();
  const navigate = useNavigate();
  const [erroEscolha, setErroEscolha] = React.useState(false);
  const { dados, carregando, erro, recarregar } = useCarregar(
    async () => (await api.get('/sessao/representados')).data
  );

  const escolher = async (idPaciente) => {
    setErroEscolha(false);
    try {
      await escolherRepresentado(idPaciente);
      navigate('/portal/inicio');
    } catch (e) {
      setErroEscolha(true);
    }
  };

  return (
    <Pagina titulo='Quem você vai acompanhar agora?'>
      {erro && <EstadoErro erro={erro} aoTentarDeNovo={recarregar} />}
      {erroEscolha && <EstadoErro erro={{ status: 404 }} />}
      <div className='col-lg-6 d-flex flex-column gap-2'>
        {carregando && (
          <div className='card card-body'>
            <Esqueleto linhas={2} />
          </div>
        )}
        {(dados ?? []).map((r) => {
          // O representado atual leva a marca de conferido, e não só uma cor.
          const atual = sessao?.idRepresentado === r.idPaciente;
          return (
            <button
              key={r.idPaciente}
              type='button'
              className='card card-body atalho flex-row align-items-center gap-3 p-3 text-start fw-semibold'
              aria-current={atual ? 'true' : undefined}
              onClick={() => escolher(r.idPaciente)}
            >
              <Avatar nome={r.nome} />
              <span className='flex-grow-1'>{r.nome}</span>
              {atual && <CheckCircleOutlinedIcon className='text-success' />}
            </button>
          );
        })}
      </div>
    </Pagina>
  );
}

export default SelecionarRepresentado;
