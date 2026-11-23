import React from 'react';

import Modal from '../../components/modal';
import { CampoSelecao, CampoTexto, CampoTextoLongo, useFormulario } from '../../components/formulario';
import { mensagemDeErro } from '../../components/confirmacao';
import { mensagemErro, mensagemSucesso, mostrarMensagem } from '../../components/toastr';
import { criar, listar, pessoasPorId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { corresponde, hora } from '../../utils/formatos';

async function carregarEscolhas(comPaciente) {
  const [parametros, pacientes] = await Promise.all([
    listar('parametros', { chave: 'X07' }),
    comPaciente ? [] : listar('pacientes', { situacao: 'ATIVO' }),
  ]);
  const pessoas = await pessoasPorId(pacientes.map((p) => p.id));
  return {
    minutos: Number(parametros[0]?.valor) || 60,
    pacientes: pacientes
      .filter((p) => pessoas[p.id])
      .map((p) => ({ id: p.id, nome: pessoas[p.id].nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
  };
}

// M-02h · Acesso de exceção (RF06). Sem vínculo, o médico pede o acesso com
// uma justificativa que vai ao log; o Administrador é avisado na hora e o
// acesso acaba sozinho. Anotações privadas de outros médicos ficam fora.
// paciente: { id, nome } ou null, quando o médico procura o paciente aqui.
function JanelaExcecao({ paciente, aoFechar, aoConcluir }) {
  const form = useFormulario({ busca: '', paciente: paciente ? String(paciente.id) : '', justificativa: '' }, 'excecao-');
  const v = form.valores;
  const [salvando, setSalvando] = React.useState(false);
  const { dados } = useCarregar(() => carregarEscolhas(Boolean(paciente)), []);
  const opcoes = (dados?.pacientes ?? []).filter((p) => String(p.id) === v.paciente || corresponde(v.busca, p.nome));

  const salvar = async () => {
    const ok = form.validar({
      paciente: v.paciente ? null : 'Escolha o paciente.',
      justificativa: v.justificativa.trim().length >= 20 ? null : 'Descreva a situação que exige o acesso (ao menos 20 caracteres).',
    });
    if (!ok) return;
    setSalvando(true);
    try {
      const acesso = await criar('acessosExcecao', { idPaciente: Number(v.paciente), justificativa: v.justificativa.trim() });
      mensagemSucesso(`Acesso de exceção liberado até ${hora(acesso.expiraEm)}.`);
      if (acesso.padraoAtipico) {
        mostrarMensagem('Pedido repetido', 'Segundo pedido sobre este paciente em 30 dias: o Administrador foi avisado.', 'warning');
      }
      aoConcluir(Number(v.paciente));
    } catch (e) {
      mensagemErro(mensagemDeErro(e));
      setSalvando(false);
    }
  };

  return (
    <Modal
      titulo='Pedir acesso de exceção'
      aoFechar={aoFechar}
      largo
      rodape={
        <>
          <button type='button' className='btn btn-outline-secondary' onClick={aoFechar} disabled={salvando}>
            Voltar
          </button>
          <button type='button' className='btn btn-primary' onClick={salvar} disabled={salvando}>
            {salvando ? 'Pedindo…' : 'Pedir acesso'}
          </button>
        </>
      }
    >
      <form
        noValidate
        aria-label='Pedido de acesso de exceção'
        className='row g-3'
        onSubmit={(e) => {
          e.preventDefault();
          salvar();
        }}
      >
        <div className='col-12'>
          <div className='alert alert-warning mb-0' role='note'>
            O acesso vale por {dados?.minutos ?? 60} minutos, fica no log de auditoria com a justificativa e o Administrador é avisado na
            hora. Ele não mostra anotações privadas de outros médicos.
          </div>
        </div>
        {paciente ? (
          <div className='col-12'>
            <span className='form-label d-block'>Paciente</span>
            <span className='form-control campo-leitura'>{paciente.nome}</span>
          </div>
        ) : (
          <>
            <CampoTexto {...form.campo('busca')} rotulo='Buscar paciente' tipo='search' opcional />
            <CampoSelecao {...form.campo('paciente')} rotulo='Paciente' opcoes={opcoes.map((p) => [String(p.id), p.nome])} />
          </>
        )}
        <CampoTextoLongo
          {...form.campo('justificativa')}
          rotulo='Justificativa'
          linhas={4}
          ajuda='Descreva a situação assistencial. Não repita a justificativa do acesso anterior.'
        />
      </form>
    </Modal>
  );
}

export default JanelaExcecao;
