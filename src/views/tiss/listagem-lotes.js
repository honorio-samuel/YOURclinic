import React from 'react';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import Modal from '../../components/modal';
import PilulaStatus from '../../components/pilula-status';
import { CampoSelect, Filtros } from '../../components/campos';
import { mensagemDeErro, useConfirmacao } from '../../components/confirmacao';
import { mensagemErro, mensagemSucesso } from '../../components/toastr';
import { api } from '../../config/axios';
import { listar, porId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { data, moeda } from '../../utils/formatos';
import { rotuloDe } from '../../utils/rotulos';
import { carregarGuias, nomeOperadora, opcoesOperadora, useEhAdmin } from './comum';

// RF55: a recepção escolhe a operadora e as guias liberadas que ainda não
// estão em lote. Cada guia do lote vira um título a receber da operadora; a
// Secretária vê o valor de cada guia, mas não o total do lote (D9).
function JanelaNovoLote({ aoFechar, aoCriar }) {
  const { dados, carregando, erro } = useCarregar(async () => (await carregarGuias()).filter((g) => g.situacao === 'LIBERADA' && g.idLoteCobranca == null));
  const [idConvenio, setIdConvenio] = React.useState('');
  const [marcadas, setMarcadas] = React.useState(() => new Set());
  const [salvando, setSalvando] = React.useState(false);

  const operadoras = [...new Map((dados ?? []).map((g) => [String(g.idConvenio), g.operadora])).entries()];
  const escolhida = idConvenio || operadoras[0]?.[0] || '';
  const guias = (dados ?? []).filter((g) => String(g.idConvenio) === escolhida);
  const escolhidas = guias.filter((g) => marcadas.has(g.id));
  const todas = guias.length > 0 && escolhidas.length === guias.length;

  const trocarOperadora = (v) => {
    setIdConvenio(v);
    setMarcadas(new Set());
  };
  const alternar = (id) =>
    setMarcadas((atual) => {
      const nova = new Set(atual);
      if (nova.has(id)) nova.delete(id);
      else nova.add(id);
      return nova;
    });
  const montar = async () => {
    setSalvando(true);
    try {
      const { data: lote } = await api.post('/tiss/lotes', { idConvenio: escolhida, idsGuias: escolhidas.map((g) => g.id) });
      mensagemSucesso(`Lote ${lote.numero} montado com ${lote.guias} ${lote.guias === 1 ? 'guia' : 'guias'}. Falta enviá-lo à operadora.`);
      aoCriar();
    } catch (e) {
      mensagemErro(mensagemDeErro(e));
      setSalvando(false);
    }
  };

  return (
    <Modal
      titulo='Montar lote de cobrança'
      aoFechar={aoFechar}
      largo
      rodape={
        <>
          <button type='button' className='btn btn-outline-secondary' onClick={aoFechar} disabled={salvando}>
            Voltar
          </button>
          <button type='button' className='btn btn-primary' onClick={montar} disabled={salvando || escolhidas.length === 0}>
            {salvando ? 'Montando…' : `Montar lote${escolhidas.length ? ` (${escolhidas.length})` : ''}`}
          </button>
        </>
      }
    >
      {carregando && <p className='text-body-secondary mb-0'>Carregando as guias liberadas…</p>}
      {erro && <p className='text-danger mb-0'>Não foi possível carregar as guias agora.</p>}
      {dados && operadoras.length === 0 && <p className='mb-0'>Nenhuma guia liberada fora de lote. Libere guias na tela de guias primeiro.</p>}
      {dados && operadoras.length > 0 && (
        <>
          <p className='small text-body-secondary'>Só entram guias liberadas de uma mesma operadora. Cada guia do lote vira um título a receber da operadora.</p>
          <div className='mb-3' style={{ maxWidth: '20rem' }}>
            <CampoSelect id='novoLoteOperadora' rotulo='Operadora' valor={escolhida} aoMudar={trocarOperadora} opcoes={operadoras} />
          </div>
          <div className='table-responsive'>
            <table className='table table-sm align-middle'>
              <caption className='visually-hidden'>Guias liberadas da operadora escolhida</caption>
              <thead>
                <tr>
                  <th scope='col'>
                    <input
                      type='checkbox'
                      className='form-check-input'
                      aria-label='Incluir todas as guias'
                      checked={todas}
                      onChange={() => setMarcadas(todas ? new Set() : new Set(guias.map((g) => g.id)))}
                    />
                  </th>
                  <th scope='col'>Guia</th>
                  <th scope='col'>Emissão</th>
                  <th scope='col'>Paciente</th>
                  <th scope='col'>Item</th>
                  <th scope='col' className='text-end'>
                    Valor
                  </th>
                </tr>
              </thead>
              <tbody>
                {guias.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <input type='checkbox' className='form-check-input' aria-label={`Incluir a guia ${g.numero}`} checked={marcadas.has(g.id)} onChange={() => alternar(g.id)} />
                    </td>
                    <td>{g.numero}</td>
                    <td>{data(g.dataEmissao)}</td>
                    <td>{g.paciente}</td>
                    <td>{g.item}</td>
                    <td className='text-end'>{moeda(g.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}

// A-23 e S-15 · Lotes e protocolos. A Secretária monta e envia os lotes; vê o
// valor de cada guia, mas não o total do lote (D9).
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
  const [montando, setMontando] = React.useState(false);

  // A operadora simulada devolve o protocolo na hora; as guias do lote ficam enviadas.
  const enviar = async (l) => {
    const ok = await confirmar({ titulo: `Enviar o lote ${l.numero}?`, texto: `${l.guias} guias para ${l.operadora}. O protocolo da operadora fica registrado no lote.`, rotuloConfirmar: 'Enviar lote' });
    if (!ok) return;
    try {
      const { data: enviado } = await api.post(`/tiss/lotes/${l.id}/enviar`);
      mensagemSucesso(`Lote ${l.numero} enviado. Protocolo ${enviado.protocolo}.`);
      recarregar();
    } catch (e) {
      mensagemErro(mensagemDeErro(e));
    }
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
        <PilulaStatus
          {...rotuloDe(SITUACAO, l.situacao)}
          transicoes={!ehAdmin && l.situacao === 'A_ENVIAR' ? [{ rotulo: 'Enviar lote', aoEscolher: () => enviar(l) }] : null}
        />
      ),
    }
  );

  return (
    <Pagina
      titulo='Lotes e protocolos'
      acoes={
        !ehAdmin && (
          <button type='button' className='btn btn-primary' onClick={() => setMontando(true)}>
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
      {montando && (
        <JanelaNovoLote
          aoFechar={() => setMontando(false)}
          aoCriar={() => {
            setMontando(false);
            recarregar();
          }}
        />
      )}
      {modal}
    </Pagina>
  );
}

export default Lotes;
