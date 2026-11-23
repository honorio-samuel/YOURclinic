import React from 'react';

import Listagem from '../../components/listagem';
import Modal from '../../components/modal';
import AcoesLinha from '../../components/acoes-linha';
import { CampoTextoLongo, useFormulario } from '../../components/formulario';
import { mensagemDeErro, useConfirmacao } from '../../components/confirmacao';
import { mensagemErro, mensagemSucesso } from '../../components/toastr';
import { api } from '../../config/axios';
import { atualizar, criar, listar } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { data } from '../../utils/formatos';

function JanelaAnotacao({ anotacao, idPaciente, aoFechar, aoConcluir }) {
  const form = useFormulario({ texto: anotacao?.texto ?? '' }, 'anotacao-');
  const [salvando, setSalvando] = React.useState(false);
  const salvar = async () => {
    if (!form.validar({ texto: form.valores.texto.trim() ? null : 'Escreva a anotação.' })) return;
    setSalvando(true);
    try {
      if (anotacao) await atualizar('anotacoesPrivadas', anotacao.id, { texto: form.valores.texto.trim() });
      else await criar('anotacoesPrivadas', { idPaciente, texto: form.valores.texto.trim() });
      mensagemSucesso(anotacao ? 'Anotação atualizada.' : 'Anotação registrada.');
      aoConcluir();
    } catch (e) {
      mensagemErro(mensagemDeErro(e));
      setSalvando(false);
    }
  };
  return (
    <Modal
      titulo={anotacao ? 'Editar anotação' : 'Nova anotação'}
      aoFechar={aoFechar}
      rodape={
        <>
          <button type='button' className='btn btn-outline-secondary' onClick={aoFechar} disabled={salvando}>
            Voltar
          </button>
          <button type='button' className='btn btn-primary' onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </>
      }
    >
      <form
        noValidate
        aria-label='Anotação privada'
        className='row g-3'
        onSubmit={(e) => {
          e.preventDefault();
          salvar();
        }}
      >
        <CampoTextoLongo
          {...form.campo('texto')}
          rotulo='Anotação'
          linhas={5}
          ajuda='Só você vê. Não entra no prontuário legal nem em exportações.'
        />
      </form>
    </Modal>
  );
}

// M-02f · Anotações privadas: só o autor vê, edita e exclui (D2, RF28).
function AnotacoesPrivadas({ idPaciente, idMedico }) {
  const { dados, carregando, erro, recarregar } = useCarregar(
    () => listar('anotacoesPrivadas', { idPaciente, idMedico, _sort: 'dataHora', _order: 'desc' }),
    [idPaciente, idMedico]
  );
  const [modal, confirmar] = useConfirmacao();
  const [janela, setJanela] = React.useState(null);
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
        <button type='button' className='btn btn-primary' onClick={() => setJanela({})}>
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
                  { tipo: 'editar', alvo: `anotação de ${data(a.dataHora)}`, aoClicar: () => setJanela({ anotacao: a }) },
                  { tipo: 'excluir', alvo: `anotação de ${data(a.dataHora)}`, aoClicar: () => excluir(a) },
                ]}
              />
            ),
          },
        ]}
      />
      {janela && (
        <JanelaAnotacao
          anotacao={janela.anotacao}
          idPaciente={idPaciente}
          aoFechar={() => setJanela(null)}
          aoConcluir={() => {
            setJanela(null);
            recarregar();
          }}
        />
      )}
      {modal}
    </>
  );
}

export default AnotacoesPrivadas;
