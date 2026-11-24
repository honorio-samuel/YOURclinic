import React from 'react';

import Modal from './modal';
import Listagem from './listagem';
import { mensagemDeErro } from './confirmacao';
import { mensagemErro, mensagemSucesso } from './toastr';
import { listar, pessoasPorId } from '../servicos/dados';
import { registrarAvisoPorTelefone, reenviarNotificacao } from '../servicos/notificacoes';
import { useCarregar } from '../hooks/use-carregar';
import { diaMesHora } from '../utils/formatos';
import { CANAL, EVENTO_NOTIFICACAO } from '../utils/rotulos';

export const FALHAS = ['FALHA', 'FALHOU'];

// S-06 · "Notificações sem entrega": reenviar ou registrar que avisou por
// telefone (RF59). Mostra o aviso e o contato, nunca conteúdo clínico.
function NotificacoesComFalha({ aoFechar, aoMudar }) {
  const { dados, carregando, erro, recarregar } = useCarregar(async () => {
    const lista = await listar('notificacoes', { situacao: FALHAS, _sort: 'dataEnvio', _order: 'desc' });
    const pessoas = await pessoasPorId(lista.map((n) => n.idPessoa));
    return lista.map((n) => ({ ...n, pessoa: pessoas[n.idPessoa] }));
  });
  const [ocupado, setOcupado] = React.useState(null);

  const agir = async (n, acao) => {
    setOcupado(n.id);
    try {
      if (acao === 'reenviar') {
        await reenviarNotificacao(n.id);
        mensagemSucesso(`Aviso reenviado para ${n.pessoa?.nome ?? 'o paciente'}.`);
      } else {
        await registrarAvisoPorTelefone(n.id);
        mensagemSucesso('Aviso por telefone registrado.');
      }
      recarregar();
      aoMudar?.();
    } catch (e) {
      mensagemErro(mensagemDeErro(e));
    } finally {
      setOcupado(null);
    }
  };

  return (
    <Modal
      titulo='Notificações sem entrega'
      aoFechar={aoFechar}
      largo
      rodape={
        <button type='button' className='btn btn-outline-secondary' onClick={aoFechar}>
          Fechar
        </button>
      }
    >
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={dados ?? []}
        vazio='Nenhuma notificação pendente. Tudo entregue.'
        colunas={[
          { titulo: 'Paciente', render: (n) => n.pessoa?.nome ?? '—' },
          { titulo: 'Aviso', render: (n) => EVENTO_NOTIFICACAO[n.evento] ?? n.evento },
          { titulo: 'Canal', render: (n) => `${CANAL[n.canal] ?? n.canal}${n.destino ? '' : ' · sem contato'}` },
          { titulo: 'Tentativas', classe: 'text-end', render: (n) => n.tentativas ?? 0 },
          { titulo: 'Última', render: (n) => diaMesHora(n.dataEnvio) },
          {
            titulo: 'Telefone',
            render: (n) => n.pessoa?.telefone ?? '—',
          },
          {
            titulo: '',
            render: (n) => (
              <div className='d-flex flex-wrap gap-2'>
                <button type='button' className='btn btn-sm btn-outline-primary' disabled={ocupado === n.id || !n.destino} onClick={() => agir(n, 'reenviar')}>
                  Reenviar
                </button>
                <button type='button' className='btn btn-sm btn-outline-secondary' disabled={ocupado === n.id} onClick={() => agir(n, 'telefone')}>
                  Avisei por telefone
                </button>
              </div>
            ),
          },
        ]}
      />
    </Modal>
  );
}

export default NotificacoesComFalha;
