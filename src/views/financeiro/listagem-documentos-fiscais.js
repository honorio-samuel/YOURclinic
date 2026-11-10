import React from 'react';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import AcoesLinha from '../../components/acoes-linha';
import { CampoBusca, CampoSelect, Filtros } from '../../components/campos';
import { emBreve } from '../../components/confirmacao';
import { listar, porId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { useSessao } from '../../sessao/sessao';
import { corresponde, data, moeda } from '../../utils/formatos';
import { rotuloDe } from '../../utils/rotulos';
import { carregarCobrancasComPaciente } from './comum';

const SITUACAO_DOCUMENTO = {
  EMITIDO: { rotulo: 'Emitido', tom: 'sucesso' },
  PENDENTE: { rotulo: 'Pendente', tom: 'aviso' },
  CANCELADO: { rotulo: 'Cancelado', tom: 'neutro' },
};

// A-19 Recibos e NFS-e (Administrador emite NFS-e) e S-11 Recibos (Secretária
// emite recibo). Nenhum documento traz CID ou diagnóstico.
function DocumentosFiscais() {
  const { sessao } = useSessao();
  const ehAdmin = sessao.usuario.papel === 'ADMINISTRADOR';
  const carregar = async () => {
    const [documentos, titulos, cobrancas] = await Promise.all([
      listar('documentosFiscais', ehAdmin ? { _sort: 'id', _order: 'desc' } : { tipo: 'RECIBO', _sort: 'id', _order: 'desc' }),
      listar('titulosReceber'),
      carregarCobrancasComPaciente(),
    ]);
    const titulo = porId(titulos);
    const cobranca = porId(cobrancas);
    return documentos.map((d) => {
      const cob = cobranca[titulo[d.idTituloReceber]?.idCobranca];
      return { ...d, pagador: cob?.paciente ?? '—', paciente: cob?.paciente ?? '—' };
    });
  };
  const { dados, carregando, erro, recarregar } = useCarregar(carregar);
  const [busca, setBusca] = React.useState('');
  const [tipo, setTipo] = React.useState('');
  const [situacao, setSituacao] = React.useState('');
  const linhas = (dados ?? []).filter(
    (d) => corresponde(busca, d.numero, d.pagador) && (!tipo || d.tipo === tipo) && (!situacao || d.situacao === situacao)
  );

  const acoes = (d) => {
    const alvo = d.numero ? `documento ${d.numero}` : 'documento pendente';
    const ver = { tipo: 'ver', alvo, aoClicar: () => emBreve('A visualização do documento') };
    if (d.situacao !== 'EMITIDO') return <AcoesLinha acoes={[ver]} />;
    return <AcoesLinha acoes={[ver, { tipo: 'baixar', alvo, aoClicar: () => emBreve('O download do documento') }]} />;
  };

  return (
    <Pagina
      titulo={ehAdmin ? 'Recibos e NFS-e' : 'Recibos'}
      acoes={
        <button type='button' className='btn btn-primary' onClick={() => emBreve(ehAdmin ? 'A emissão de NFS-e' : 'A emissão de recibo')}>
          {ehAdmin ? 'Emitir NFS-e' : 'Emitir recibo'}
        </button>
      }
    >
      <Filtros>
        <CampoBusca id='docBusca' rotulo='Buscar por número ou pagador' valor={busca} aoMudar={setBusca} />
        {ehAdmin && <CampoSelect id='docTipo' rotulo='Tipo' valor={tipo} aoMudar={setTipo} opcoes={[['', 'Todos'], ['RECIBO', 'Recibo'], ['NFSE', 'NFS-e']]} />}
        {ehAdmin && (
          <CampoSelect
            id='docSituacao'
            rotulo='Situação'
            valor={situacao}
            aoMudar={setSituacao}
            opcoes={[['', 'Todas'], ...Object.entries(SITUACAO_DOCUMENTO).map(([k, v]) => [k, v.rotulo])]}
          />
        )}
      </Filtros>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={linhas}
        vazio='Nenhum documento nesta seleção.'
        colunas={
          ehAdmin
            ? [
                { titulo: 'Número', render: (d) => d.numero ?? '—' },
                { titulo: 'Tipo', render: (d) => (d.tipo === 'NFSE' ? 'NFS-e' : 'Recibo') },
                { titulo: 'Pagador', render: (d) => d.pagador },
                { titulo: 'Valor', classe: 'text-end', render: (d) => moeda(d.valor) },
                { titulo: 'Emissão', render: (d) => data(d.dataEmissao) },
                { titulo: 'Situação', render: (d) => <PilulaStatus {...rotuloDe(SITUACAO_DOCUMENTO, d.situacao)} /> },
                { titulo: 'Ações', render: acoes },
              ]
            : [
                { titulo: 'Número', render: (d) => d.numero },
                { titulo: 'Pagador', render: (d) => d.pagador },
                { titulo: 'Paciente', render: (d) => d.paciente },
                { titulo: 'Valor', classe: 'text-end', render: (d) => moeda(d.valor) },
                { titulo: 'Situação', render: (d) => <PilulaStatus {...rotuloDe(SITUACAO_DOCUMENTO, d.situacao)} /> },
                { titulo: 'Ações', render: acoes },
              ]
        }
      />
    </Pagina>
  );
}

export default DocumentosFiscais;
