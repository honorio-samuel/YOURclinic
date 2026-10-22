import React from 'react';

import Modal from '../../components/modal';
import { CampoSelecao, CampoTextoLongo } from '../../components/formulario';
import { mensagemDeErro } from '../../components/confirmacao';
import { mensagemErro, mensagemSucesso } from '../../components/toastr';
import { DATA_DE_HOJE } from '../../config/axios';
import { criar } from '../../servicos/dados';
import { TIPO_SOLICITACAO } from '../../utils/rotulos';

// Os quatro pedidos que a recepção registra pelo titular (S-01b, RF39). A
// eliminação de dados segue pelo Administrador (A-33).
const TIPOS = ['ACESSO', 'CORRECAO', 'PORTABILIDADE', 'REVOGACAO'].map((t) => [t, TIPO_SOLICITACAO[t]]);

function PedidoTitular({ idPaciente, aoFechar }) {
  const [tipo, setTipo] = React.useState('');
  const [detalhe, setDetalhe] = React.useState('');
  const [erro, setErro] = React.useState(null);
  const [salvando, setSalvando] = React.useState(false);

  const registrar = async () => {
    if (!tipo) {
      setErro('Escolha o pedido.');
      document.getElementById('pedidoTipo')?.focus();
      return;
    }
    setSalvando(true);
    try {
      await criar('solicitacoesTitular', {
        tipo,
        descricao: detalhe.trim() || null,
        dataSolicitacao: DATA_DE_HOJE,
        dataResposta: null,
        situacao: 'ABERTA',
        idPaciente,
      });
      mensagemSucesso(`Pedido de ${TIPO_SOLICITACAO[tipo].toLowerCase()} registrado. O Administrador responde pelo painel de solicitações.`);
      aoFechar();
    } catch (e) {
      mensagemErro(mensagemDeErro(e));
      setSalvando(false);
    }
  };

  return (
    <Modal
      titulo='Registrar pedido do titular'
      aoFechar={aoFechar}
      rodape={
        <>
          <button type='button' className='btn btn-outline-secondary' onClick={aoFechar} disabled={salvando}>
            Cancelar
          </button>
          <button type='button' className='btn btn-primary' onClick={registrar} disabled={salvando}>
            {salvando ? 'Registrando…' : 'Registrar pedido'}
          </button>
        </>
      }
    >
      <div className='row g-3'>
        <CampoSelecao
          id='pedidoTipo'
          rotulo='Pedido'
          valor={tipo}
          aoMudar={(v) => {
            setTipo(v);
            setErro(null);
          }}
          opcoes={TIPOS}
          erro={erro}
          largura='col-12'
        />
        <CampoTextoLongo
          id='pedidoDetalhe'
          rotulo='O que o titular pediu'
          valor={detalhe}
          aoMudar={setDetalhe}
          opcional
          ajuda='Sem dado clínico: o pedido vai para a fila do Administrador.'
        />
      </div>
    </Modal>
  );
}

export default PedidoTitular;
