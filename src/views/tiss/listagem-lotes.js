import React from 'react';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import { CampoSelect, Filtros } from '../../components/campos';
import { emBreve, salvarComAviso, useConfirmacao } from '../../components/confirmacao';
import { DATA_DE_HOJE } from '../../config/axios';
import { listar, porId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { data, moeda } from '../../utils/formatos';
import { rotuloDe } from '../../utils/rotulos';
import { nomeOperadora, opcoesOperadora, useEhAdmin } from './comum';

// A-23 e S-15 · Lotes e protocolos. A Secretária vê o valor de cada guia, mas
// não o total do lote (D9).
function Lotes() {
  const ehAdmin = useEhAdmin();
  const carregar = async () => {
    const [lotes, guias, convenios] = await Promise.all([listar('lotesCobranca', { _sort: 'numero', _order: 'desc' }), listar('guiasTiss'), listar('convenios')]);
    const convenio = porId(convenios);
    return lotes.map((l) => ({ ...l, operadora: nomeOperadora(convenio[l.idConvenio]), guias: guias.filter((g) => g.idLoteCobranca === l.id).length }));
  };
  const { dados, carregando, erro, recarregar } = useCarregar(carregar);
  const [modal, confirmar] = useConfirmacao();
  const [operadora, setOperadora] = React.useState('');
  const [situacao, setSituacao] = React.useState('');

  const enviar = async (l) => {
    const ok = await confirmar({ titulo: `Enviar o lote ${l.numero}?`, texto: `${l.guias} guias para ${l.operadora}. O protocolo da operadora fica registrado no lote.`, rotuloConfirmar: 'Enviar lote' });
    if (ok && (await salvarComAviso('lotesCobranca', l.id, { situacao: 'ENVIADO', dataEnvio: `${DATA_DE_HOJE}T12:00:00` }, `Lote ${l.numero} enviado.`))) recarregar();
  };

  const SITUACAO = { A_ENVIAR: { rotulo: 'A enviar', tom: 'aviso' }, ENVIADO: { rotulo: 'Enviado', tom: 'info' }, PROTOCOLADO: { rotulo: 'Protocolado', tom: 'sucesso' } };
  const linhas = (dados ?? []).filter((l) => (!operadora || l.operadora === operadora) && (!situacao || l.situacao === situacao));
  const colunas = [
    { titulo: 'Lote', render: (l) => l.numero },
    { titulo: 'Operadora', render: (l) => l.operadora },
    { titulo: 'Guias', classe: 'text-end', render: (l) => l.guias },
  ];
  if (ehAdmin) colunas.push({ titulo: 'Total', classe: 'text-end', render: (l) => moeda(l.valorApresentado) });
  colunas.push(
    { titulo: 'Enviado em', render: (l) => data(l.dataEnvio) },
    { titulo: 'Protocolo', render: (l) => l.protocolo ?? '—' },
    {
      titulo: 'Situação',
      render: (l) => (
        <PilulaStatus {...rotuloDe(SITUACAO, l.situacao)} transicoes={l.situacao === 'A_ENVIAR' ? [{ rotulo: 'Enviar lote', aoEscolher: () => enviar(l) }] : null} />
      ),
    }
  );

  return (
    <Pagina
      titulo='Lotes e protocolos'
      acoes={
        !ehAdmin && (
          <button type='button' className='btn btn-primary' onClick={() => emBreve('A montagem de lote')}>
            + Novo lote
          </button>
        )
      }
    >
      <Filtros>
        <CampoSelect id='loteOperadora' rotulo='Operadora' valor={operadora} aoMudar={setOperadora} opcoes={opcoesOperadora(dados)} />
        <CampoSelect id='loteSituacao' rotulo='Situação' valor={situacao} aoMudar={setSituacao} opcoes={[['', 'Todas'], ...Object.entries(SITUACAO).map(([k, v]) => [k, v.rotulo])]} />
      </Filtros>
      <Listagem carregando={carregando} erro={erro} aoTentarDeNovo={recarregar} linhas={linhas} vazio='Nenhum lote nesta seleção.' colunas={colunas} />
      {modal}
    </Pagina>
  );
}

export default Lotes;
