import React from 'react';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import AcoesLinha from '../../components/acoes-linha';
import { CampoBusca, CampoSelect, Filtros } from '../../components/campos';
import { emBreve, salvarComAviso, useConfirmacao } from '../../components/confirmacao';
import { useCarregar } from '../../hooks/use-carregar';
import { corresponde, moeda } from '../../utils/formatos';
import { rotuloDe, SITUACAO_GUIA } from '../../utils/rotulos';
import { carregarGuias, opcoesOperadora, useEhAdmin } from './comum';

// A-22 (leitura) e S-14 · Guias TISS. A Secretária cria, edita antes da liberação
// e libera depois da crítica prévia.
function Guias() {
  const ehAdmin = useEhAdmin();
  const { dados, carregando, erro, recarregar } = useCarregar(carregarGuias);
  const [modal, confirmar] = useConfirmacao();
  const [busca, setBusca] = React.useState('');
  const [operadora, setOperadora] = React.useState('');
  const [situacao, setSituacao] = React.useState('');

  const liberar = async (g) => {
    const ok = await confirmar({ titulo: `Liberar a guia ${g.numero}?`, texto: 'A crítica prévia confere os oito bloqueios do faturamento antes de liberar.', rotuloConfirmar: 'Liberar' });
    if (ok && (await salvarComAviso('guiasTiss', g.id, { situacao: 'LIBERADA' }, `Guia ${g.numero} liberada.`))) recarregar();
  };
  const cancelar = async (g) => {
    const motivo = await confirmar({ titulo: `Cancelar a guia ${g.numero}?`, texto: 'A guia fica no histórico como cancelada.', campo: 'Motivo do cancelamento', rotuloConfirmar: 'Cancelar guia', perigo: true });
    if (motivo && (await salvarComAviso('guiasTiss', g.id, { situacao: 'CANCELADA', motivoCancelamento: motivo }, `Guia ${g.numero} cancelada.`))) recarregar();
  };

  const linhas = (dados ?? []).filter(
    (g) => corresponde(busca, g.numero, g.paciente) && (!operadora || g.operadora === operadora) && (!situacao || g.situacao === situacao)
  );

  return (
    <Pagina
      titulo='Guias TISS'
      acoes={
        !ehAdmin && (
          <button type='button' className='btn btn-primary' onClick={() => emBreve('A criação de guia')}>
            + Nova guia
          </button>
        )
      }
    >
      <Filtros>
        <CampoBusca id='guiaBusca' rotulo='Buscar por guia ou paciente' valor={busca} aoMudar={setBusca} />
        {ehAdmin && <CampoSelect id='guiaOperadora' rotulo='Operadora' valor={operadora} aoMudar={setOperadora} opcoes={opcoesOperadora(dados)} />}
        <CampoSelect
          id='guiaSituacao'
          rotulo='Situação'
          valor={situacao}
          aoMudar={setSituacao}
          opcoes={[['', 'Todas'], ...Object.entries(SITUACAO_GUIA).map(([k, v]) => [k, v.rotulo])]}
        />
      </Filtros>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={linhas}
        vazio='Nenhuma guia nesta seleção.'
        colunas={[
          { titulo: 'Guia', render: (g) => g.numero },
          { titulo: 'Paciente', render: (g) => g.paciente },
          { titulo: 'Operadora', render: (g) => g.operadora },
          { titulo: 'CID', render: (g) => g.cid ?? '—' },
          { titulo: 'Valor', classe: 'text-end', render: (g) => moeda(g.valor) },
          {
            titulo: 'Situação',
            render: (g) => (
              <PilulaStatus
                {...rotuloDe(SITUACAO_GUIA, g.situacao)}
                transicoes={!ehAdmin && ['RASCUNHO', 'EM_DIGITACAO'].includes(g.situacao) ? [{ rotulo: 'Liberar', aoEscolher: () => liberar(g) }] : null}
              />
            ),
          },
          {
            titulo: 'Ações',
            render: (g) => {
              const alvo = `guia ${g.numero}`;
              const ver = { tipo: 'ver', alvo, aoClicar: () => emBreve('O detalhe da guia') };
              if (ehAdmin || !['RASCUNHO', 'EM_DIGITACAO', 'BLOQUEADA', 'LIBERADA'].includes(g.situacao)) return <AcoesLinha acoes={[ver]} />;
              return (
                <AcoesLinha
                  acoes={[ver, { tipo: 'editar', alvo, aoClicar: () => emBreve('A edição da guia') }, { tipo: 'cancelar', alvo, aoClicar: () => cancelar(g) }]}
                />
              );
            },
          },
        ]}
      />
      {modal}
    </Pagina>
  );
}

export default Guias;
