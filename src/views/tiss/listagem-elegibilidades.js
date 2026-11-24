import React from 'react';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import { CampoBusca, CampoSelect, Filtros } from '../../components/campos';
import { mensagemDeErro } from '../../components/confirmacao';
import { mensagemErro, mensagemSucesso, mostrarMensagem } from '../../components/toastr';
import { api, DATA_DE_HOJE } from '../../config/axios';
import { listar, pessoasPorId, porId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { corresponde, data } from '../../utils/formatos';
import { rotuloDe } from '../../utils/rotulos';
import { nomeOperadora, opcoesOperadora, useEhAdmin } from './comum';

const ELEGIBILIDADE = {
  ELEGIVEL: { rotulo: 'Elegível', tom: 'sucesso' },
  A_VERIFICAR: { rotulo: 'A verificar', tom: 'aviso' },
  INELEGIVEL: { rotulo: 'Inelegível', tom: 'perigo' },
  NAO_ELEGIVEL: { rotulo: 'Inelegível', tom: 'perigo' },
};
const AUTORIZACAO = {
  APROVADA: { rotulo: 'Autorizada', tom: 'sucesso' },
  AUTORIZADA: { rotulo: 'Autorizada', tom: 'sucesso' },
  EM_ANALISE: { rotulo: 'Em análise', tom: 'info' },
  PARCIAL: { rotulo: 'Parcial', tom: 'aviso' },
  PENDENTE_JUSTIFICATIVA: { rotulo: 'Aguarda o médico', tom: 'info' },
  NEGADA: { rotulo: 'Negada', tom: 'perigo' },
  NAO_EXIGE: { rotulo: 'Não exige', tom: 'neutro' },
};

// A-21 e S-13 · Elegibilidade e autorização das próximas consultas por convênio.
// O CID aparece só como código.
function Elegibilidade() {
  const ehAdmin = useEhAdmin();
  const carregar = async () => {
    const [consultas, elegibilidades, autorizacoes, convenios, procedimentos] = await Promise.all([
      listar('consultas', { status: 'AGENDADO', dataHora_gte: `${DATA_DE_HOJE}T00:00:00`, _sort: 'dataHora' }),
      listar('elegibilidades', { _sort: 'dataConsulta', _order: 'desc' }),
      listar('autorizacoes'),
      listar('convenios'),
      listar('procedimentos'),
    ]);
    const comConvenio = consultas.filter((c) => c.idConvenio);
    const pessoas = await pessoasPorId(comConvenio.map((c) => c.idPaciente));
    const convenio = porId(convenios);
    const proc = porId(procedimentos);
    return comConvenio.map((c) => {
      // A consulta mais recente à operadora vale.
      const eleg = elegibilidades.filter((e) => e.idPaciente === c.idPaciente && e.idConvenio === c.idConvenio).sort((a, b) => b.id - a.id)[0];
      const aut = autorizacoes.find((a) => a.idConsulta === c.id);
      return {
        ...c,
        paciente: pessoas[c.idPaciente]?.nome ?? '—',
        operadora: nomeOperadora(convenio[c.idConvenio]),
        procedimento: proc[c.idProcedimento]?.nome ?? '—',
        cid: aut?.cid ?? '—',
        elegibilidade: eleg?.situacao ?? 'A_VERIFICAR',
        autorizacao: aut?.situacao ?? (proc[c.idProcedimento]?.exigeAutorizacao ? 'PENDENTE_JUSTIFICATIVA' : 'NAO_EXIGE'),
      };
    });
  };
  const { dados, carregando, erro, recarregar } = useCarregar(carregar);
  const [busca, setBusca] = React.useState('');
  const [operadora, setOperadora] = React.useState('');
  const [situacao, setSituacao] = React.useState('');
  // RF52: a resposta vem da operadora (simulada na API) e fica registrada.
  const verificar = async (l) => {
    try {
      const { data: r } = await api.post('/tiss/elegibilidade', { idConsulta: l.id });
      if (r.situacao === 'ELEGIVEL') mensagemSucesso(`${l.paciente}: elegível até ${data(r.validade)}. Protocolo ${r.protocolo}.`);
      else mostrarMensagem('Inelegível', `${l.paciente}: ${r.motivo ?? 'a operadora recusou.'} Combine o atendimento particular ou a atualização do plano.`, 'warning');
      recarregar();
    } catch (e) {
      mensagemErro(mensagemDeErro(e));
    }
  };
  const linhas = (dados ?? []).filter(
    (l) => corresponde(busca, l.paciente) && (!operadora || l.operadora === operadora) && (!situacao || l.elegibilidade === situacao)
  );

  return (
    <Pagina titulo={ehAdmin ? 'Elegibilidade e autorizações' : 'Elegibilidade e autorização'}>
      <Filtros>
        <CampoBusca id='elegBusca' rotulo='Buscar por paciente' valor={busca} aoMudar={setBusca} />
        <CampoSelect id='elegOperadora' rotulo='Operadora' valor={operadora} aoMudar={setOperadora} opcoes={opcoesOperadora(dados)} />
        <CampoSelect
          id='elegSituacao'
          rotulo='Elegibilidade'
          valor={situacao}
          aoMudar={setSituacao}
          opcoes={[['', 'Todas'], ...Object.entries(ELEGIBILIDADE).map(([k, v]) => [k, v.rotulo])]}
        />
      </Filtros>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={linhas}
        vazio='Nenhuma consulta por convênio nesta seleção.'
        colunas={[
          { titulo: 'Paciente', render: (l) => l.paciente },
          { titulo: 'Operadora', render: (l) => l.operadora },
          { titulo: 'Procedimento', render: (l) => l.procedimento },
          { titulo: 'CID', render: (l) => l.cid },
          {
            titulo: 'Elegibilidade',
            render: (l) => (
              <PilulaStatus
                {...rotuloDe(ELEGIBILIDADE, l.elegibilidade)}
                transicoes={!ehAdmin && l.elegibilidade !== 'ELEGIVEL' ? [{ rotulo: 'Verificar na operadora', aoEscolher: () => verificar(l) }] : null}
              />
            ),
          },
          { titulo: 'Autorização', render: (l) => <PilulaStatus {...rotuloDe(AUTORIZACAO, l.autorizacao)} /> },
        ]}
      />
    </Pagina>
  );
}

export default Elegibilidade;
