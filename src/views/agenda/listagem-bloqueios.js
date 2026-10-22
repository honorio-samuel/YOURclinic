import React from 'react';
import { useNavigate } from 'react-router-dom';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import AcoesLinha from '../../components/acoes-linha';
import { CampoSelect, Filtros } from '../../components/campos';
import { emBreve, useAlternarSituacao, useConfirmacao } from '../../components/confirmacao';
import { mensagemErro, mensagemSucesso } from '../../components/toastr';
import { api } from '../../config/axios';
import { listar, pessoasPorId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { useCaminhosDaListagem } from '../../navegacao/caminhos';
import { useSessao } from '../../sessao/sessao';
import { data, nomeMedico } from '../../utils/formatos';
import { MOTIVO_BLOQUEIO, rotuloDe, SITUACAO_CADASTRO } from '../../utils/rotulos';

// A-11a e S-05b · Bloqueios de agenda. A lixeira só aparece no bloqueio que
// ainda não atingiu nenhuma consulta (A1-R09, hipótese 1).
function Bloqueios() {
  const navigate = useNavigate();
  const caminhos = useCaminhosDaListagem('bloqueios');
  const { sessao } = useSessao();
  const ehAdmin = sessao.usuario.papel === 'ADMINISTRADOR';
  const carregar = async () => {
    const bloqueios = await listar('bloqueiosAgenda', { _sort: 'dataInicio' });
    const pessoas = await pessoasPorId(bloqueios.map((b) => b.idMedico));
    return bloqueios.map((b) => ({ ...b, medico: b.idMedico ? nomeMedico(pessoas[b.idMedico]) : 'Toda a clínica' }));
  };
  const { dados, carregando, erro, recarregar } = useCarregar(carregar);
  const [modalSituacao, alternar] = useAlternarSituacao('bloqueiosAgenda', recarregar);
  const [modalExcluir, confirmar] = useConfirmacao();
  const [medico, setMedico] = React.useState('');
  const [status, setStatus] = React.useState('ATIVO');

  const excluir = async (b) => {
    const ok = await confirmar({
      titulo: 'Excluir este bloqueio?',
      texto: 'Ele ainda não atingiu nenhuma consulta. A exclusão fica registrada no log.',
      rotuloConfirmar: 'Excluir',
      perigo: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/bloqueiosAgenda/${b.id}`);
      mensagemSucesso('Bloqueio excluído.');
      recarregar();
    } catch (e) {
      mensagemErro('Não foi possível excluir agora. Tente de novo.');
    }
  };

  const nomeDoBloqueio = (b) => `bloqueio de ${b.medico} (${MOTIVO_BLOQUEIO[b.motivo] ?? b.motivo})`;
  const linhas = (dados ?? []).filter(
    (b) =>
      (!status || (status === 'ATIVO' ? b.situacao === 'ATIVO' : b.situacao !== 'ATIVO')) &&
      (!medico || String(b.idMedico ?? 'clinica') === medico)
  );
  const afetando = (dados ?? []).filter((b) => b.situacao === 'ATIVO' && b.consultasAfetadas > 0);
  const opcoes = [
    ['', 'Todos os médicos'],
    ...[...new Map((dados ?? []).map((b) => [String(b.idMedico ?? 'clinica'), b.medico])).entries()],
  ];

  return (
    <Pagina
      titulo='Bloqueios de agenda'
      acoes={
        <button type='button' className='btn btn-primary' onClick={() => navigate(caminhos.novo)}>
          + Novo bloqueio
        </button>
      }
    >
      <Filtros>
        <CampoSelect id='bloqueioMedico' rotulo='Médico' valor={medico} aoMudar={setMedico} opcoes={opcoes} />
        <CampoSelect
          id='bloqueioStatus'
          rotulo='Status'
          valor={status}
          aoMudar={setStatus}
          opcoes={[['ATIVO', 'Ativos'], ['INATIVO', 'Inativos'], ['', 'Todos']]}
        />
      </Filtros>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={linhas}
        vazio='Nenhum bloqueio nesta seleção.'
        legenda='A lixeira só aparece enquanto o bloqueio não atingiu nenhuma consulta. Depois disso, inative.'
        colunas={[
          { titulo: 'Médico', render: (b) => b.medico },
          { titulo: 'Início', render: (b) => data(b.dataInicio) },
          { titulo: 'Fim', render: (b) => data(b.dataFim) },
          { titulo: 'Motivo', render: (b) => MOTIVO_BLOQUEIO[b.motivo] ?? b.motivo },
          {
            titulo: 'Status',
            render: (b) => (
              <PilulaStatus
                {...rotuloDe(SITUACAO_CADASTRO, b.situacao)}
                transicoes={[
                  b.situacao === 'ATIVO'
                    ? { rotulo: 'Inativar', aoEscolher: () => alternar(b, nomeDoBloqueio(b), 'INATIVO') }
                    : { rotulo: 'Reativar', aoEscolher: () => alternar(b, nomeDoBloqueio(b), 'ATIVO') },
                ]}
              />
            ),
          },
          {
            titulo: 'Ações',
            render: (b) => {
              const alvo = nomeDoBloqueio(b);
              if (b.situacao !== 'ATIVO')
                return (
                  <AcoesLinha
                    acoes={[
                      { tipo: 'ver', alvo, aoClicar: () => navigate(caminhos.ver(b.id)) },
                      { tipo: 'reativar', alvo, aoClicar: () => alternar(b, alvo, 'ATIVO') },
                    ]}
                  />
                );
              const base = [
                { tipo: 'editar', alvo, aoClicar: () => navigate(caminhos.editar(b.id)) },
                { tipo: 'inativar', alvo, aoClicar: () => alternar(b, alvo, 'INATIVO') },
              ];
              return (
                <AcoesLinha
                  acoes={
                    b.consultasAfetadas > 0
                      ? [{ tipo: 'ver', alvo, aoClicar: () => navigate(caminhos.ver(b.id)) }, ...base]
                      : [...base, { tipo: 'excluir', alvo, aoClicar: () => excluir(b) }]
                  }
                />
              );
            },
          },
        ]}
      />
      {afetando.map((b) => (
        <div key={b.id} className='alert alert-warning d-flex flex-wrap align-items-center justify-content-between gap-2 mb-0' role='status'>
          <span>
            O bloqueio de {b.medico} atinge {b.consultasAfetadas} consultas já agendadas. Trate cada uma antes de salvar.
          </span>
          <button
            type='button'
            className='btn btn-sm btn-primary'
            onClick={() => emBreve(ehAdmin ? 'O reagendamento em lote' : 'O tratamento das consultas afetadas')}
          >
            Tratar consultas afetadas
          </button>
        </div>
      ))}
      {modalSituacao}
      {modalExcluir}
    </Pagina>
  );
}

export default Bloqueios;
