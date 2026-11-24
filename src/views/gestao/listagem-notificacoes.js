import React from 'react';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import AcoesLinha from '../../components/acoes-linha';
import { CampoSelect, Filtros } from '../../components/campos';
import Modal from '../../components/modal';
import { CampoMarcar, CampoSelecao, CampoTextoLongo } from '../../components/formulario';
import { mensagemDeErro, salvarComAviso } from '../../components/confirmacao';
import { mensagemErro, mensagemSucesso } from '../../components/toastr';
import { FALHAS } from '../../components/notificacoes-com-falha';
import { listar, pessoasPorId } from '../../servicos/dados';
import { registrarAvisoPorTelefone, reenviarNotificacao } from '../../servicos/notificacoes';
import { useCarregar } from '../../hooks/use-carregar';
import { diaMesHora } from '../../utils/formatos';
import { CANAL, EVENTO_NOTIFICACAO, rotuloDe, SITUACAO_NOTIFICACAO } from '../../utils/rotulos';

// RF59: texto, canal e situação de cada aviso. O texto só leva quem, quando,
// com quem e onde (RF21); a API recusa outros campos.
function JanelaModelos({ aoFechar }) {
  const { dados, carregando, erro, recarregar } = useCarregar(() => listar('modelosNotificacao', { _sort: 'id' }));
  const [editando, setEditando] = React.useState(null);
  const [salvando, setSalvando] = React.useState(false);
  const mudar = (campo) => (valor) => setEditando((atual) => ({ ...atual, [campo]: valor }));
  const salvar = async () => {
    setSalvando(true);
    const ok = await salvarComAviso(
      'modelosNotificacao',
      editando.id,
      { texto: editando.texto.trim(), canal: editando.canal, ativo: editando.ativo },
      'Modelo atualizado. Vale para os próximos avisos.'
    );
    setSalvando(false);
    if (ok) {
      setEditando(null);
      recarregar();
    }
  };
  return (
    <Modal
      titulo={editando ? `Modelo · ${EVENTO_NOTIFICACAO[editando.evento] ?? editando.evento}` : 'Modelos e canais'}
      aoFechar={aoFechar}
      largo
      rodape={
        editando ? (
          <>
            <button type='button' className='btn btn-outline-secondary' onClick={() => setEditando(null)} disabled={salvando}>
              Voltar
            </button>
            <button type='button' className='btn btn-primary' onClick={salvar} disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </>
        ) : (
          <button type='button' className='btn btn-outline-secondary' onClick={aoFechar}>
            Fechar
          </button>
        )
      }
    >
      {carregando && <p className='text-body-secondary mb-0'>Carregando os modelos…</p>}
      {erro && <p className='text-danger mb-0'>Não foi possível carregar os modelos agora.</p>}
      {editando && (
        <form
          noValidate
          aria-label='Modelo do aviso'
          className='row g-3'
          onSubmit={(e) => {
            e.preventDefault();
            salvar();
          }}
        >
          <CampoSelecao
            id='modeloCanal'
            rotulo='Canal preferido'
            valor={editando.canal}
            aoMudar={mudar('canal')}
            opcoes={Object.entries(CANAL)}
            ajuda='Sem o contato deste canal, o aviso vai pelo outro.'
          />
          <CampoMarcar id='modeloAtivo' rotulo='Enviar este aviso' marcado={editando.ativo} aoMudar={mudar('ativo')} />
          <CampoTextoLongo
            id='modeloTexto'
            rotulo='Texto'
            valor={editando.texto}
            aoMudar={mudar('texto')}
            linhas={4}
            maxLength={300}
            ajuda='Use {paciente}, {data}, {hora}, {medico} e {local}. O aviso não leva conteúdo clínico.'
          />
        </form>
      )}
      {!editando && dados && (
        <div className='table-responsive'>
          <table className='table table-sm align-middle'>
            <caption className='visually-hidden'>Modelos de aviso por evento</caption>
            <thead>
              <tr>
                <th scope='col'>Evento</th>
                <th scope='col'>Canal</th>
                <th scope='col'>Texto</th>
                <th scope='col'>Situação</th>
                <th scope='col'>Ações</th>
              </tr>
            </thead>
            <tbody>
              {dados.map((m) => (
                <tr key={m.id}>
                  <td>{EVENTO_NOTIFICACAO[m.evento] ?? m.evento}</td>
                  <td>{CANAL[m.canal] ?? m.canal}</td>
                  <td className='small'>{m.texto}</td>
                  <td>
                    <PilulaStatus rotulo={m.ativo ? 'Ativo' : 'Desligado'} tom={m.ativo ? 'sucesso' : 'neutro'} />
                  </td>
                  <td>
                    <AcoesLinha acoes={[{ tipo: 'editar', alvo: `modelo ${EVENTO_NOTIFICACAO[m.evento] ?? m.evento}`, aoClicar: () => setEditando({ ...m }) }]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

// A-32 · Notificações. Reenvio manual das que falharam (RF59).
function Notificacoes() {
  const carregar = async () => {
    const notificacoes = await listar('notificacoes', { _sort: 'dataEnvio', _order: 'desc' });
    const pessoas = await pessoasPorId(notificacoes.map((n) => n.idPessoa));
    return notificacoes.map((n) => ({ ...n, destinatario: pessoas[n.idPessoa]?.nome ?? '—' }));
  };
  const { dados, carregando, erro, recarregar } = useCarregar(carregar);
  const [evento, setEvento] = React.useState('');
  const [canal, setCanal] = React.useState('');
  const [situacao, setSituacao] = React.useState('');

  const [aberta, setAberta] = React.useState(null);
  const [modelos, setModelos] = React.useState(false);
  const tratar = async (n, acao) => {
    try {
      if (acao === 'reenviar') await reenviarNotificacao(n.id);
      else await registrarAvisoPorTelefone(n.id);
      mensagemSucesso(acao === 'reenviar' ? `Notificação reenviada para ${n.destinatario}.` : 'Aviso por telefone registrado.');
      recarregar();
    } catch (e) {
      mensagemErro(mensagemDeErro(e));
    }
  };
  const linhas = (dados ?? []).filter((n) => (!evento || n.evento === evento) && (!canal || n.canal === canal) && (!situacao || n.situacao === situacao));

  return (
    <Pagina
      titulo='Notificações'
      acoes={
        <button type='button' className='btn btn-outline-primary' onClick={() => setModelos(true)}>
          Modelos e canais
        </button>
      }
    >
      <Filtros>
        <CampoSelect id='notEvento' rotulo='Evento' valor={evento} aoMudar={setEvento} opcoes={[['', 'Todos'], ...Object.entries(EVENTO_NOTIFICACAO)]} />
        <CampoSelect id='notCanal' rotulo='Canal' valor={canal} aoMudar={setCanal} opcoes={[['', 'Todos'], ...Object.entries(CANAL)]} />
        <CampoSelect
          id='notSituacao'
          rotulo='Situação'
          valor={situacao}
          aoMudar={setSituacao}
          opcoes={[['', 'Todas'], ...Object.entries(SITUACAO_NOTIFICACAO).map(([k, v]) => [k, v.rotulo])]}
        />
      </Filtros>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={linhas}
        vazio='Nenhuma notificação nesta seleção.'
        colunas={[
          { titulo: 'Evento', render: (n) => EVENTO_NOTIFICACAO[n.evento] ?? n.evento },
          { titulo: 'Canal', render: (n) => CANAL[n.canal] ?? n.canal },
          { titulo: 'Destinatário', render: (n) => n.destinatario },
          { titulo: 'Enviado em', render: (n) => diaMesHora(n.dataEnvio) },
          {
            titulo: 'Situação',
            render: (n) => (
              <PilulaStatus
                {...rotuloDe(SITUACAO_NOTIFICACAO, n.situacao)}
                transicoes={
                  FALHAS.includes(n.situacao)
                    ? [
                        { rotulo: 'Reenviar', aoEscolher: () => tratar(n, 'reenviar') },
                        { rotulo: 'Avisei por telefone', aoEscolher: () => tratar(n, 'telefone') },
                      ]
                    : null
                }
              />
            ),
          },
          { titulo: 'Ações', render: (n) => <AcoesLinha acoes={[{ tipo: 'ver', alvo: `notificação para ${n.destinatario}`, aoClicar: () => setAberta(n) }]} /> },
        ]}
      />
      {aberta && (
        <Modal
          titulo={EVENTO_NOTIFICACAO[aberta.evento] ?? aberta.evento}
          aoFechar={() => setAberta(null)}
          rodape={
            <button type='button' className='btn btn-outline-secondary' onClick={() => setAberta(null)}>
              Fechar
            </button>
          }
        >
          {/* RN-59.1: o histórico mostra o envio, nunca conteúdo do prontuário. */}
          <dl className='row mb-0'>
            <dt className='col-sm-4'>Destinatário</dt>
            <dd className='col-sm-8'>{aberta.destinatario}</dd>
            <dt className='col-sm-4'>Canal</dt>
            <dd className='col-sm-8'>{CANAL[aberta.canal] ?? aberta.canal}</dd>
            <dt className='col-sm-4'>Endereço</dt>
            <dd className='col-sm-8'>{aberta.destino ?? 'Sem contato cadastrado'}</dd>
            <dt className='col-sm-4'>Enviado em</dt>
            <dd className='col-sm-8'>{diaMesHora(aberta.dataEnvio)}</dd>
            <dt className='col-sm-4'>Situação</dt>
            <dd className='col-sm-8'>{rotuloDe(SITUACAO_NOTIFICACAO, aberta.situacao).rotulo}</dd>
            <dt className='col-sm-4'>Tentativas</dt>
            <dd className='col-sm-8'>{aberta.tentativas ?? 0}</dd>
            {aberta.reenvio && (
              <>
                <dt className='col-sm-4'>Tratada em</dt>
                <dd className='col-sm-8'>{diaMesHora(aberta.reenvio.dataHora)}</dd>
              </>
            )}
          </dl>
        </Modal>
      )}
      {modelos && <JanelaModelos aoFechar={() => setModelos(false)} />}
    </Pagina>
  );
}

export default Notificacoes;
