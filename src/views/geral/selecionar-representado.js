import React from 'react';
import { useNavigate } from 'react-router-dom';

import Pagina from '../../components/pagina';
import EstadoErro from '../../components/estado-erro';
import { api } from '../../config/axios';
import { representacoesEncerradas } from '../../servicos/credencial';
import { useCarregar } from '../../hooks/use-carregar';
import { useSessao } from '../../sessao/sessao';

// Representados em vigor e, se não houver nenhum, quantas representações
// acabaram pela maioridade (R-07).
async function carregarRepresentados() {
  const representados = (await api.get('/sessao/representados')).data;
  if (representados.length) return { representados, maioridade: 0 };
  const { maioridade } = await representacoesEncerradas();
  return { representados, maioridade };
}

// R-07 · Acesso encerrado por maioridade. Não mostra o nome do
// ex-representado nem qualquer dado dele (D30, RN-08.2).
function AcessoEncerrado({ maioridade }) {
  const { sair } = useSessao();
  return (
    <Pagina titulo={maioridade ? 'Acesso encerrado por maioridade' : 'Nenhum representado'}>
      <div className='alert alert-info mb-0' role='status'>
        {maioridade
          ? 'A pessoa que você representava completou 18 anos. A partir de agora, ela mesma acessa o portal com a própria conta, e o seu acesso aos dados dela terminou.'
          : 'Esta conta não tem representado em vigor.'}{' '}
        Se precisar de algo, fale com a recepção da clínica.
      </div>
      <div>
        <button type='button' className='btn btn-outline-secondary' onClick={sair}>
          Sair
        </button>
      </div>
    </Pagina>
  );
}

// G-09: o Responsável Legal escolhe de quem são os dados que vai ver.
function SelecionarRepresentado() {
  const { sessao, escolherRepresentado } = useSessao();
  const navigate = useNavigate();
  const [erroEscolha, setErroEscolha] = React.useState(false);
  const { dados, carregando, erro, recarregar } = useCarregar(carregarRepresentados);

  const escolher = async (idPaciente) => {
    setErroEscolha(false);
    try {
      await escolherRepresentado(idPaciente);
      navigate('/portal/inicio');
    } catch (e) {
      setErroEscolha(true);
    }
  };

  if (dados && dados.representados.length === 0) return <AcessoEncerrado maioridade={dados.maioridade} />;

  return (
    <Pagina titulo='Quem você vai acompanhar agora?'>
      {erro && <EstadoErro erro={erro} aoTentarDeNovo={recarregar} />}
      {erroEscolha && <EstadoErro erro={{ status: 404 }} />}
      {carregando && <p className='text-body-secondary'>Carregando…</p>}
      <div className='d-flex flex-column gap-2'>
        {(dados?.representados ?? []).map((r) => (
          <button
            key={r.idPaciente}
            type='button'
            className={`btn btn-outline-primary text-start ${sessao?.idRepresentado === r.idPaciente ? 'active' : ''}`}
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
