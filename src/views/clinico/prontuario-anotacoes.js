import React from 'react';

import Listagem from '../../components/listagem';
import AcoesLinha from '../../components/acoes-linha';
import { emBreve, useConfirmacao } from '../../components/confirmacao';
import { mensagemErro, mensagemSucesso } from '../../components/toastr';
import { api } from '../../config/axios';
import { listar } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { data } from '../../utils/formatos';

// M-02f · Anotações privadas: só o autor vê, edita e exclui (D2).
function AnotacoesPrivadas({ idPaciente, idMedico }) {
  const { dados, carregando, erro, recarregar } = useCarregar(
    () => listar('anotacoesPrivadas', { idPaciente, idMedico, _sort: 'dataHora', _order: 'desc' }),
    [idPaciente, idMedico]
  );
  const [modal, confirmar] = useConfirmacao();
  const excluir = async (a) => {
    const ok = await confirmar({ titulo: 'Excluir esta anotação?', texto: 'Só você a vê. A exclusão não pode ser desfeita.', rotuloConfirmar: 'Excluir', perigo: true });
    if (!ok) return;
    try {
      await api.delete(`/anotacoesPrivadas/${a.id}`);
      mensagemSucesso('Anotação excluída.');
      recarregar();
    } catch (e) {
      mensagemErro('Não foi possível excluir agora. Tente de novo.');
    }
  };
  return (
    <>
      <div className='d-flex flex-wrap justify-content-between align-items-center gap-2'>
        <div className='alert alert-info mb-0 py-2'>Só você vê estas anotações. Elas nunca entram em exportações.</div>
        <button type='button' className='btn btn-primary' onClick={() => emBreve('A nova anotação')}>
          + Nova anotação
        </button>
      </div>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={dados ?? []}
        vazio='Você não tem anotações sobre este paciente.'
        colunas={[
          { titulo: 'Data', render: (a) => data(a.dataHora) },
          { titulo: 'Anotação', render: (a) => a.texto },
          {
            titulo: 'Ações',
            render: (a) => (
              <AcoesLinha
                acoes={[
                  { tipo: 'editar', alvo: `anotação de ${data(a.dataHora)}`, aoClicar: () => emBreve('A edição da anotação') },
                  { tipo: 'excluir', alvo: `anotação de ${data(a.dataHora)}`, aoClicar: () => excluir(a) },
                ]}
              />
            ),
          },
        ]}
      />
      {modal}
    </>
  );
}

export default AnotacoesPrivadas;
