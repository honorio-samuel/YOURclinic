import React from 'react';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import Modal from '../../components/modal';
import PilulaStatus from '../../components/pilula-status';
import AcoesLinha from '../../components/acoes-linha';
import { CampoSelecao, CampoTextoLongo, useFormulario } from '../../components/formulario';
import { mensagemDeErro, useConfirmacao } from '../../components/confirmacao';
import { mensagemErro, mensagemSucesso } from '../../components/toastr';
import { api } from '../../config/axios';
import { atualizar, criar, listar, pessoasPorId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { useSessao } from '../../sessao/sessao';
import { data } from '../../utils/formatos';
import { ETAPA_ORCAMENTO, rotuloDe } from '../../utils/rotulos';
import { carregarOrcamentos, DetalheItens } from './orcamentos-comum';

const EDITAVEL = ['ESCOPO', 'DEVOLVIDO'];
const QUANTIDADES = Array.from({ length: 20 }, (_, i) => [String(i + 1), String(i + 1)]);

// Pacientes com vínculo Ativo ou Histórico com o médico: só para eles há
// orçamento (a API confere o alcance de novo).
async function carregarOpcoes(idMedico) {
  const [vinculos, procedimentos] = await Promise.all([listar('vinculos', { idMedico }), listar('procedimentos', { situacao: 'ATIVO', _sort: 'nome' })]);
  const comVinculo = vinculos.filter((v) => ['ATIVO', 'HISTORICO'].includes(v.estado));
  const pessoas = await pessoasPorId(comVinculo.map((v) => v.idPaciente));
  return {
    pacientes: comVinculo
      .map((v) => [String(v.idPaciente), pessoas[v.idPaciente]?.nome ?? '—'])
      .sort((a, b) => a[1].localeCompare(b[1], 'pt-BR')),
    procedimentos: procedimentos.map((p) => [String(p.id), p.nome]),
  };
}

// M-04 · Escopo clínico (RF31, etapa 1): procedimentos do catálogo,
// quantidade e justificativa clínica. Nenhum preço aparece nem é gravado.
function JanelaEscopo({ orcamento, idMedico, aoFechar, aoConcluir }) {
  const { dados: opcoes } = useCarregar(() => carregarOpcoes(idMedico), [idMedico]);
  const form = useFormulario(
    { idPaciente: orcamento ? String(orcamento.idPaciente) : '', justificativaClinica: orcamento?.justificativaClinica ?? '', novoProcedimento: '' },
    'escopo-'
  );
  const { definir } = form;
  const v = form.valores;
  const [itens, setItens] = React.useState(() =>
    (orcamento?.itens ?? []).map((i) => ({ chave: `i${i.id}`, id: i.id, idProcedimento: i.idProcedimento, descricao: i.descricao, quantidade: i.quantidade }))
  );
  const [idOrcamento, setIdOrcamento] = React.useState(orcamento?.id ?? null);
  const [salvando, setSalvando] = React.useState(false);
  const [erroItens, setErroItens] = React.useState(null);

  const incluir = (idProcedimento) => {
    definir('novoProcedimento', '');
    if (!idProcedimento) return;
    if (itens.some((i) => String(i.idProcedimento) === idProcedimento)) {
      setErroItens('Este procedimento já está no orçamento. Mude a quantidade.');
      return;
    }
    const nome = opcoes?.procedimentos.find(([id]) => id === idProcedimento)?.[1];
    setItens((atual) => [...atual, { chave: `n${Date.now()}`, id: null, idProcedimento: Number(idProcedimento), descricao: nome, quantidade: 1 }]);
    setErroItens(null);
  };
  const mudarQuantidade = (chave, quantidade) => setItens((atual) => atual.map((i) => (i.chave === chave ? { ...i, quantidade: Number(quantidade) } : i)));
  const tirar = (chave) => setItens((atual) => atual.filter((i) => i.chave !== chave));

  // Grava o orçamento e acerta os itens com o que está na tela.
  const gravar = async () => {
    let id = idOrcamento;
    if (!id) {
      const novo = await criar('orcamentos', { idPaciente: Number(v.idPaciente), justificativaClinica: v.justificativaClinica.trim() });
      id = novo.id;
      setIdOrcamento(id);
    } else {
      await atualizar('orcamentos', id, { idPaciente: Number(v.idPaciente), justificativaClinica: v.justificativaClinica.trim() });
    }
    const originais = orcamento?.itens ?? [];
    for (const o of originais) {
      // Numa nova tentativa, o item já pode ter saído.
      if (!itens.some((i) => i.id === o.id)) await api.delete(`/itensOrcamento/${o.id}`).catch((e) => e.response?.status === 404 || Promise.reject(e));
    }
    const gravados = [];
    try {
      for (const i of itens) {
        if (!i.id) gravados.push({ ...i, id: (await criar('itensOrcamento', { idOrcamento: id, idProcedimento: i.idProcedimento, quantidade: i.quantidade })).id });
        else {
          if (originais.find((o) => o.id === i.id)?.quantidade !== i.quantidade) await atualizar('itensOrcamento', i.id, { quantidade: i.quantidade });
          gravados.push(i);
        }
      }
    } finally {
      // O que já foi gravado guarda o id, para a próxima tentativa não duplicar.
      setItens([...gravados, ...itens.slice(gravados.length)]);
    }
    return id;
  };

  const salvar = async (enviar) => {
    const ok = form.validar({
      idPaciente: v.idPaciente ? null : 'Escolha o paciente.',
      justificativaClinica: !enviar || v.justificativaClinica.trim().length >= 10 ? null : 'Escreva a justificativa clínica.',
    });
    const semItens = enviar && itens.length === 0;
    setErroItens(semItens ? 'Inclua ao menos um procedimento.' : null);
    if (!ok || semItens) return;
    setSalvando(true);
    try {
      const id = await gravar();
      if (enviar) await atualizar('orcamentos', id, { etapa: 'VALORES' });
      mensagemSucesso(enviar ? 'Escopo enviado para a etapa de valores.' : 'Rascunho do orçamento salvo.');
      aoConcluir();
    } catch (e) {
      mensagemErro(mensagemDeErro(e));
      setSalvando(false);
    }
  };

  const disponiveis = (opcoes?.procedimentos ?? []).filter(([id]) => !itens.some((i) => String(i.idProcedimento) === id));

  return (
    <Modal
      titulo={orcamento ? `Orçamento de ${orcamento.paciente}` : 'Novo orçamento'}
      aoFechar={aoFechar}
      largo
      rodape={
        <>
          <button type='button' className='btn btn-outline-secondary me-auto' onClick={aoFechar} disabled={salvando}>
            Voltar
          </button>
          <button type='button' className='btn btn-outline-primary' onClick={() => salvar(false)} disabled={salvando}>
            Salvar rascunho
          </button>
          <button type='button' className='btn btn-primary' onClick={() => salvar(true)} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Enviar para valores'}
          </button>
        </>
      }
    >
      <form
        noValidate
        aria-label='Escopo clínico do orçamento'
        className='row g-3'
        onSubmit={(e) => {
          e.preventDefault();
          salvar(false);
        }}
      >
        {orcamento?.observacaoDevolucao && orcamento.etapa === 'DEVOLVIDO' && (
          <div className='col-12'>
            <div className='alert alert-warning mb-0' role='status'>
              Devolvido pela Secretária: {orcamento.observacaoDevolucao}
            </div>
          </div>
        )}
        <CampoSelecao
          {...form.campo('idPaciente')}
          rotulo='Paciente'
          opcoes={opcoes?.pacientes ?? []}
          largura='col-12'
          ajuda={opcoes ? 'Pacientes com vínculo com você.' : 'Carregando…'}
        />
        <fieldset className='col-12'>
          <legend className='form-label fs-6 mb-2'>Procedimentos</legend>
          {itens.length > 0 && (
            <ul className='list-unstyled d-flex flex-column gap-2 mb-2'>
              {itens.map((i) => (
                <li key={i.chave} className='d-flex flex-wrap align-items-center gap-2'>
                  <span className='flex-grow-1'>{i.descricao}</span>
                  <label htmlFor={`escopo-qtd-${i.chave}`} className='visually-hidden'>
                    Quantidade de {i.descricao}
                  </label>
                  <select id={`escopo-qtd-${i.chave}`} className='form-select form-select-sm w-auto' value={String(i.quantidade)} onChange={(e) => mudarQuantidade(i.chave, e.target.value)}>
                    {QUANTIDADES.map(([valor, rotulo]) => (
                      <option key={valor} value={valor}>
                        {rotulo}
                      </option>
                    ))}
                  </select>
                  <button type='button' className='btn btn-sm btn-outline-danger' onClick={() => tirar(i.chave)} aria-label={`Tirar ${i.descricao}`}>
                    Tirar
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className='row g-2'>
            <CampoSelecao
              {...form.campo('novoProcedimento')}
              aoMudar={incluir}
              rotulo='Incluir procedimento do catálogo'
              opcional
              opcoes={disponiveis}
              largura='col-12'
              ajuda='Escolha para incluir; a quantidade começa em 1.'
            />
          </div>
          {erroItens && <div className='invalid-feedback d-block'>{erroItens}</div>}
        </fieldset>
        <CampoTextoLongo
          {...form.campo('justificativaClinica')}
          rotulo='Justificativa clínica'
          linhas={3}
          ajuda='Fica com você: a Secretária e o Administrador não a veem. Obrigatória para enviar.'
        />
      </form>
    </Modal>
  );
}

// M-04 · Orçamentos · etapa 1 · escopo clínico. Nenhuma coluna de preço: o
// Médico não vê nem define valores. O Ver das etapas seguintes abre só o escopo.
function OrcamentosMedico() {
  const { sessao } = useSessao();
  const idMedico = sessao.usuario.idPessoa;
  const { dados, carregando, erro, recarregar } = useCarregar(() => carregarOrcamentos({ idMedico }));
  const [modal, confirmar] = useConfirmacao();
  const [aberto, setAberto] = React.useState(null);
  const [editando, setEditando] = React.useState(null);

  const enviar = async (o) => {
    const ok = await confirmar({ titulo: 'Enviar para valores?', texto: 'A Secretária aplica os preços. Depois disso, o escopo não pode mais ser editado.', rotuloConfirmar: 'Enviar para valores' });
    if (!ok) return;
    try {
      await atualizar('orcamentos', o.id, { etapa: 'VALORES' });
      mensagemSucesso('Escopo enviado para a etapa de valores.');
      setAberto(null);
      recarregar();
    } catch (e) {
      mensagemErro(mensagemDeErro(e));
    }
  };
  const concluir = () => {
    setEditando(null);
    setAberto(null);
    recarregar();
  };

  return (
    <Pagina
      titulo='Orçamentos'
      acoes={
        <button type='button' className='btn btn-primary' onClick={() => setEditando({ novo: true })}>
          + Novo orçamento
        </button>
      }
    >
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={dados ?? []}
        vazio='Você ainda não criou orçamentos.'
        colunas={[
          { titulo: 'Paciente', render: (o) => o.paciente },
          { titulo: 'Criado em', render: (o) => data(o.dataEmissao) },
          { titulo: 'Itens', classe: 'text-end', render: (o) => o.itens.length },
          { titulo: 'Situação', render: (o) => <PilulaStatus {...rotuloDe(ETAPA_ORCAMENTO, o.etapa)} /> },
          {
            titulo: 'Ações',
            render: (o) => {
              const alvo = `orçamento de ${o.paciente}`;
              const ver = { tipo: 'ver', alvo, aoClicar: () => setAberto(o) };
              return <AcoesLinha acoes={EDITAVEL.includes(o.etapa) ? [ver, { tipo: 'editar', alvo, aoClicar: () => setEditando(o) }] : [ver]} />;
            },
          },
        ]}
      />
      {aberto && (
        <>
          {aberto.observacaoDevolucao && aberto.etapa === 'DEVOLVIDO' && (
            <div className='alert alert-warning mb-0' role='status'>
              Devolvido com a observação: {aberto.observacaoDevolucao}
            </div>
          )}
          <DetalheItens orcamento={aberto} comValores={false} aoFechar={() => setAberto(null)} />
          {aberto.justificativaClinica && (
            <p className='mb-0'>
              <strong>Justificativa clínica:</strong> {aberto.justificativaClinica}
            </p>
          )}
          {EDITAVEL.includes(aberto.etapa) && (
            <div className='d-flex justify-content-end gap-2'>
              <button type='button' className='btn btn-outline-primary' onClick={() => setEditando(aberto)}>
                Editar escopo
              </button>
              <button type='button' className='btn btn-primary' onClick={() => enviar(aberto)}>
                Enviar para valores
              </button>
            </div>
          )}
        </>
      )}
      {editando && (
        <JanelaEscopo orcamento={editando.novo ? null : editando} idMedico={idMedico} aoFechar={() => setEditando(null)} aoConcluir={concluir} />
      )}
      {modal}
    </Pagina>
  );
}

export default OrcamentosMedico;
