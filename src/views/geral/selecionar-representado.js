import React from 'react';
import { useNavigate } from 'react-router-dom';

import Pagina from '../../components/pagina';
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
      {carregando && <p className='text-body-secondary'>Carregando…</p>}
      <div className='d-flex flex-column gap-2'>
        {(dados ?? []).map((r) => (
          <button
            key={r.idPaciente}
            type='button'
            className={`btn btn-outline-primary text-start ${
              sessao?.idRepresentado === r.idPaciente ? 'active' : ''
            }`}
            onClick={() => escolher(r.idPaciente)}
          >
            {r.nome}
          </button>
        ))}
      </div>
    </Pagina>
  );
}

export default SelecionarRepresentado;
