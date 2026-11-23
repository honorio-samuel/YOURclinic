import React from 'react';
import { useNavigate } from 'react-router-dom';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import { CampoBusca, CampoSelect, Filtros } from '../../components/campos';
import { DATA_DE_HOJE } from '../../config/axios';
import { listar, pessoasPorId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { useSessao } from '../../sessao/sessao';
import { corresponde, data, diasEntre } from '../../utils/formatos';
import { rotuloDe, VINCULO } from '../../utils/rotulos';
import JanelaExcecao from './acesso-excecao';

const JANELA_HISTORICO = 90; // dias (X06)

// Vínculos do médico com a última consulta finalizada de cada paciente.
async function carregarMeusPacientes(idMedico) {
  const [vinculos, consultas] = await Promise.all([listar('vinculos', { idMedico }), listar('consultas', { idMedico, status: 'FINALIZADO', _sort: 'dataHora', _order: 'desc' })]);
  const pessoas = await pessoasPorId(vinculos.map((v) => v.idPaciente));
  const ultima = {};
  for (const c of consultas) if (!ultima[c.idPaciente]) ultima[c.idPaciente] = c.dataHora;
  return vinculos
    .map((v) => {
      const restante = ultima[v.idPaciente] ? JANELA_HISTORICO - diasEntre(ultima[v.idPaciente], DATA_DE_HOJE) : null;
      const estado = v.estado === 'HISTORICO' && restante !== null && restante < 0 ? 'ENCERRADO' : v.estado;
      return { id: v.id, idPaciente: v.idPaciente, paciente: pessoas[v.idPaciente]?.nome ?? '—', ultima: ultima[v.idPaciente], estado, restante };
    })
    .sort((a, b) => a.paciente.localeCompare(b.paciente, 'pt-BR'));
}

// M-02a · Meus pacientes. Prontuário só com vínculo Ativo ou Histórico (RC05).
function MeusPacientes() {
  const { sessao } = useSessao();
  const navigate = useNavigate();
  const { dados, carregando, erro, recarregar } = useCarregar(() => carregarMeusPacientes(sessao.usuario.idPessoa));
  const [busca, setBusca] = React.useState('');
  const [vinculo, setVinculo] = React.useState('');
  // Pedido de acesso de exceção (M-02h): null, {} para procurar o paciente ou { paciente }.
  const [excecao, setExcecao] = React.useState(null);
  const linhas = (dados ?? []).filter((p) => corresponde(busca, p.paciente) && (!vinculo || p.estado === vinculo));

  return (
    <Pagina
      titulo='Meus pacientes'
      acoes={
        <button type='button' className='btn btn-outline-primary' onClick={() => setExcecao({})}>
          Pedir acesso de exceção
        </button>
      }
    >
      <Filtros>
        <CampoBusca id='mpBusca' rotulo='Buscar paciente' valor={busca} aoMudar={setBusca} />
        <CampoSelect id='mpVinculo' rotulo='Vínculo' valor={vinculo} aoMudar={setVinculo} opcoes={[['', 'Todos'], ...Object.entries(VINCULO).map(([k, v]) => [k, v.rotulo])]} />
      </Filtros>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={linhas}
        vazio='Nenhum paciente nesta seleção.'
        colunas={[
          { titulo: 'Paciente', render: (p) => p.paciente },
          { titulo: 'Última consulta', render: (p) => data(p.ultima) },
          {
            titulo: 'Vínculo',
            render: (p) => {
              const r = rotuloDe(VINCULO, p.estado);
              return <PilulaStatus tom={r.tom} rotulo={p.estado === 'HISTORICO' ? `Histórico · ${p.restante} dias` : r.rotulo} />;
            },
          },
          {
            titulo: '',
            render: (p) =>
              ['ATIVO', 'HISTORICO'].includes(p.estado) ? (
                <button type='button' className='btn btn-link btn-sm p-0' onClick={() => navigate(`/medico/prontuario/${p.idPaciente}`)}>
                  Abrir prontuário
                </button>
              ) : (
                <button type='button' className='btn btn-link btn-sm p-0' onClick={() => setExcecao({ paciente: { id: p.idPaciente, nome: p.paciente } })}>
                  Pedir acesso de exceção
                </button>
              ),
          },
        ]}
      />
      {excecao && (
        <JanelaExcecao
          paciente={excecao.paciente ?? null}
          aoFechar={() => setExcecao(null)}
          aoConcluir={(idPaciente) => navigate(`/medico/prontuario/${idPaciente}`)}
        />
      )}
    </Pagina>
  );
}

export default MeusPacientes;
