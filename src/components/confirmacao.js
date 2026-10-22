import React from 'react';

import { atualizar } from '../servicos/dados';
import { mensagemErro, mensagemSucesso, mostrarMensagem } from './toastr';

// Modal de confirmação (Modal/Confirmacao e Modal/ComMotivo do Figma). Toda ação
// que muda dado pede confirmação (PR-22).
// Uso: const [modal, confirmar] = useConfirmacao(); ... if (await confirmar({...}))
// Com "campo" (rótulo do motivo), devolve o texto digitado em vez de true.
export function useConfirmacao() {
  const [pedido, setPedido] = React.useState(null);
  const [texto, setTexto] = React.useState('');

  const confirmar = React.useCallback((opcoes) => {
    setTexto('');
    return new Promise((resolver) => setPedido({ ...opcoes, resolver }));
  }, []);

  const fechar = (resposta) => {
    pedido?.resolver(resposta && pedido.campo ? texto.trim() : resposta);
    setPedido(null);
  };

  const modal = pedido && (
    <>
      <div className='modal d-block' role='dialog' aria-modal='true' aria-labelledby='tituloConfirmacao' tabIndex='-1'>
        <div className='modal-dialog modal-dialog-centered'>
          <div className='modal-content'>
            <div className='modal-header'>
              <h2 className='modal-title h5' id='tituloConfirmacao'>
                {pedido.titulo}
              </h2>
            </div>
            <div className='modal-body'>
              <p className={pedido.campo ? '' : 'mb-0'}>{pedido.texto}</p>
              {pedido.campo && (
                <>
                  <label htmlFor='campoMotivo' className='form-label'>
                    {pedido.campo}
                  </label>
                  <textarea
                    id='campoMotivo'
                    className='form-control'
                    rows='3'
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                  />
                </>
              )}
            </div>
            <div className='modal-footer'>
              <button type='button' className='btn btn-outline-secondary' onClick={() => fechar(false)}>
                Voltar
              </button>
              <button
                type='button'
                className={`btn ${pedido.perigo ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => fechar(true)}
                disabled={pedido.campo && !texto.trim()}
                autoFocus={!pedido.campo}
              >
                {pedido.rotuloConfirmar ?? 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className='modal-backdrop show' />
    </>
  );

  return [modal, confirmar];
}

// Grava uma mudança e avisa o resultado. Devolve true quando salvou.
export async function salvarComAviso(colecao, id, campos, sucesso) {
  try {
    await atualizar(colecao, id, campos);
    mensagemSucesso(sucesso);
    return true;
  } catch (e) {
    mensagemErro(mensagemDeErro(e));
    return false;
  }
}

// Texto para o usuário a partir da resposta de erro da API: 409 e 422 trazem a
// regra em { erro }.
export function mensagemDeErro(e) {
  if (e.mensagemParaUsuario) return e.mensagemParaUsuario;
  const status = e.response?.status;
  if (status === 403) return 'Seu perfil não pode fazer esta alteração.';
  if (status === 404) return 'Este registro não está mais disponível.';
  if ((status === 409 || status === 422) && e.response?.data?.erro) return e.response.data.erro;
  return 'Não foi possível salvar agora. Tente de novo.';
}

// Ações que dependem de telas que ainda não foram implementadas.
export function emBreve(oQue) {
  mostrarMensagem('Próxima etapa', `${oQue} entra numa próxima etapa do app.`, 'info');
}

// Inativar e reativar cadastros: muda só a situação; nada é apagado.
export function useAlternarSituacao(colecao, recarregar) {
  const [modal, confirmar] = useConfirmacao();

  const alternar = async (linha, nome, nova) => {
    const inativar = nova === 'INATIVO';
    const ok = await confirmar({
      titulo: inativar ? `Inativar ${nome}?` : `Reativar ${nome}?`,
      texto: inativar
        ? 'O cadastro deixa de aparecer nas escolhas do dia a dia, mas continua guardado e pode ser reativado.'
        : 'O cadastro volta a aparecer nas escolhas do dia a dia.',
      rotuloConfirmar: inativar ? 'Inativar' : 'Reativar',
    });
    if (!ok) return;
    try {
      await atualizar(colecao, linha.id, { situacao: nova });
      mensagemSucesso(inativar ? `${nome} foi inativado.` : `${nome} foi reativado.`);
      recarregar();
    } catch (e) {
      mensagemErro(mensagemDeErro(e));
    }
  };

  return [modal, alternar];
}
