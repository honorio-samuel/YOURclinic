import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import Pagina from '../../components/pagina';
import { CampoTexto, Formulario, Rodape, Secao, useFormulario, useSairSemSalvar } from '../../components/formulario';
import { mensagemDeErro, useConfirmacao } from '../../components/confirmacao';
import { mensagemErro, mensagemSucesso } from '../../components/toastr';
import { RegistroIndisponivel } from '../geral/avisos';
import { criar, listar } from '../../servicos/dados';
import { atualizarSeMudou } from '../../servicos/pessoas';
import { useCarregar } from '../../hooks/use-carregar';
import { mascararDigitos } from '../../utils/mascaras';

const VAZIO = { nome: '', razaoSocial: '', registroAns: '' };

// A-05 · Cadastro do convênio (RF11). Preços e prazos por operadora ficam no
// contrato, em Faturamento TISS › Contratos e tabelas (A-20).
function CadastroConvenio({ modo }) {
  const { id: idTexto } = useParams();
  const id = idTexto ? Number(idTexto) : null;
  const navigate = useNavigate();
  const leitura = modo === 'ver';
  const form = useFormulario(VAZIO);
  const { carregar } = form;
  const [modal, confirmar] = useConfirmacao();
  const [salvando, setSalvando] = React.useState(false);

  // A lista inteira serve para conferir o registro ANS antes de gravar.
  const { dados, carregando } = useCarregar(() => listar('convenios'), []);
  const atual = id ? dados?.find((c) => c.id === id) : null;

  React.useEffect(() => {
    if (atual) carregar({ nome: atual.nome ?? '', razaoSocial: atual.razaoSocial ?? '', registroAns: atual.registroAns ?? '' });
  }, [atual, carregar]);

  const sair = useSairSemSalvar(form.sujo, confirmar, () => navigate(id && !leitura ? `/admin/convenios/${id}` : '/admin/listagem-convenios'));

  if (id && dados && !atual) return <RegistroIndisponivel />;

  const v = form.valores;
  const salvar = async (e) => {
    e.preventDefault();
    const repetido = (dados ?? []).some((c) => c.id !== id && c.registroAns === v.registroAns);
    const ok = form.validar({
      nome: v.nome.trim().length >= 2 ? null : 'Informe o nome do convênio.',
      razaoSocial: v.razaoSocial.trim().length >= 3 ? null : 'Informe a razão social da operadora.',
      registroAns: !/^\d{6}$/.test(v.registroAns)
        ? 'O registro ANS tem 6 dígitos.'
        : repetido
        ? 'Já existe um convênio com este registro ANS.'
        : null,
    });
    if (!ok) return;
    setSalvando(true);
    const campos = { nome: v.nome.trim(), razaoSocial: v.razaoSocial.trim(), registroAns: v.registroAns };
    try {
      let idSalvo = id;
      if (id) await atualizarSeMudou('convenios', id, campos, atual);
      else idSalvo = (await criar('convenios', { ...campos, situacao: 'ATIVO' })).id;
      mensagemSucesso(id ? 'Convênio atualizado.' : 'Convênio cadastrado.');
      navigate(`/admin/convenios/${idSalvo}`);
    } catch (falha) {
      mensagemErro(mensagemDeErro(falha));
      setSalvando(false);
    }
  };

  const inativo = atual?.situacao === 'INATIVO';
  return (
    <Pagina
      titulo={id ? `Convênio · ${atual?.nome ?? '…'}` : 'Novo convênio'}
      acoes={
        leitura &&
        !inativo && (
          <button type='button' className='btn btn-primary' onClick={() => navigate(`/admin/convenios/${id}/editar`)}>
            Editar
          </button>
        )
      }
    >
      {carregando && !dados ? (
        <p className='text-body-secondary'>Carregando…</p>
      ) : (
        <Formulario
          aoEnviar={salvar}
          somenteLeitura={leitura}
          rotulo='Cadastro do convênio'
          rodape={<Rodape aoCancelar={sair} salvando={salvando} semSalvar={leitura} rotuloCancelar={leitura ? 'Voltar' : 'Cancelar'} />}
        >
          {inativo && (
            <div className='alert alert-secondary mb-0' role='status'>
              Convênio inativo: não aparece no agendamento nem no cadastro de pacientes. Para editar, reative na lista.
            </div>
          )}
          <Secao>
            <CampoTexto {...form.campo('nome')} rotulo='Nome do convênio' ajuda='Como aparece para a recepção e o paciente.' />
            <CampoTexto {...form.campo('razaoSocial')} rotulo='Operadora (razão social)' />
            <CampoTexto
              {...form.campo('registroAns', mascararDigitos(6))}
              rotulo='Registro ANS'
              inputMode='numeric'
              placeholder='000000'
              largura='col-md-3'
            />
          </Secao>
          {!id && (
            <p className='text-body-secondary mb-0'>Depois de salvar, cadastre o contrato e a tabela de preços em Faturamento TISS › Contratos e tabelas.</p>
          )}
        </Formulario>
      )}
      {modal}
    </Pagina>
  );
}

export default CadastroConvenio;
