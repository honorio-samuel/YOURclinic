import React from 'react';
import { useNavigate } from 'react-router-dom';

import Pagina from '../../components/pagina';
import {
  CampoMarcar,
  CampoMoeda,
  CampoSelecao,
  CampoTexto,
  Formulario,
  Rodape,
  Secao,
  useFormulario,
  useSairSemSalvar,
} from '../../components/formulario';
import { mensagemDeErro, useConfirmacao } from '../../components/confirmacao';
import { mensagemErro, mensagemSucesso } from '../../components/toastr';
import { RegistroIndisponivel } from '../geral/avisos';
import { criar, listar } from '../../servicos/dados';
import { atualizarSeMudou } from '../../servicos/pessoas';
import { useCarregar } from '../../hooks/use-carregar';
import { useCadastro } from '../../navegacao/caminhos';
import { mascararDigitos, mascararMoeda, moedaParaNumero, numeroParaMoeda } from '../../utils/mascaras';
import { TIPO_PROCEDIMENTO } from './comum';

const VAZIO = { codigoInterno: '', codigo: '', nome: '', tipo: '', duracaoPadrao: '', precoParticular: '', exigeAutorizacao: false };

const paraFormulario = (p) => ({
  codigoInterno: p.codigoInterno ?? '',
  codigo: p.codigo ?? '',
  nome: p.nome ?? '',
  tipo: p.tipo ?? '',
  duracaoPadrao: p.duracaoPadrao ? String(p.duracaoPadrao) : '',
  precoParticular: numeroParaMoeda(p.precoParticular),
  exigeAutorizacao: Boolean(p.exigeAutorizacao),
});

// A-06 · Cadastro do procedimento e do preço particular (RF12). O preço
// negociado com cada operadora fica no contrato (A-20). O Médico nunca vê o
// preço (RC06).
function CadastroProcedimento() {
  const { id, consulta: leitura, listagem, editar } = useCadastro('procedimentos');
  const navigate = useNavigate();
  const form = useFormulario(VAZIO);
  const { carregar } = form;
  const [modal, confirmar] = useConfirmacao();
  const [salvando, setSalvando] = React.useState(false);

  const { dados, carregando } = useCarregar(() => listar('procedimentos'), []);
  const atual = id ? dados?.find((p) => p.id === id) : null;

  React.useEffect(() => {
    if (atual) carregar(paraFormulario(atual));
  }, [atual, carregar]);

  const sair = useSairSemSalvar(form.sujo, confirmar, () => navigate(listagem));

  if (id && dados && !atual) return <RegistroIndisponivel />;

  const v = form.valores;
  const salvar = async (e) => {
    e.preventDefault();
    const outros = (dados ?? []).filter((p) => p.id !== id);
    const duracao = Number(v.duracaoPadrao);
    const ok = form.validar({
      codigoInterno: v.codigoInterno && outros.some((p) => p.codigoInterno === v.codigoInterno.trim()) ? 'Já existe um procedimento com este código.' : null,
      codigo: !/^\d{8}$/.test(v.codigo)
        ? 'O código TUSS tem 8 dígitos.'
        : outros.some((p) => p.codigo === v.codigo)
        ? 'Já existe um procedimento com este código TUSS.'
        : null,
      nome: v.nome.trim().length >= 3 ? null : 'Informe a descrição.',
      tipo: v.tipo ? null : 'Escolha o tipo.',
      duracaoPadrao: Number.isInteger(duracao) && duracao >= 5 && duracao <= 480 ? null : 'Informe de 5 a 480 minutos.',
      precoParticular: v.precoParticular ? null : 'Informe o preço particular.',
    });
    if (!ok) return;
    setSalvando(true);
    const campos = {
      codigoInterno: v.codigoInterno.trim() || null,
      codigo: v.codigo,
      nome: v.nome.trim(),
      tipo: v.tipo,
      duracaoPadrao: duracao,
      precoParticular: moedaParaNumero(v.precoParticular),
      exigeAutorizacao: v.exigeAutorizacao,
    };
    try {
      if (id) await atualizarSeMudou('procedimentos', id, campos, atual);
      else await criar('procedimentos', { ...campos, situacao: 'ATIVO' });
      mensagemSucesso(id ? 'Procedimento atualizado.' : 'Procedimento cadastrado.');
      navigate(listagem);
    } catch (falha) {
      mensagemErro(mensagemDeErro(falha));
      setSalvando(false);
    }
  };

  const inativo = atual?.situacao === 'INATIVO';
  return (
    <Pagina
      titulo={id ? `Procedimento · ${atual?.nome ?? '…'}` : 'Novo procedimento'}
      acoes={
        leitura &&
        !inativo && (
          <button type='button' className='btn btn-primary' onClick={() => navigate(editar())}>
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
          rotulo='Cadastro do procedimento'
          rodape={<Rodape aoCancelar={sair} salvando={salvando} semSalvar={leitura} rotuloCancelar={leitura ? 'Voltar' : 'Cancelar'} />}
        >
          {inativo && (
            <div className='alert alert-secondary mb-0' role='status'>
              Procedimento inativo: não aparece no agendamento nem nos orçamentos. Para editar, reative na lista.
            </div>
          )}
          <Secao titulo='Identificação'>
            <CampoTexto {...form.campo('codigoInterno')} rotulo='Código interno' opcional largura='col-md-3' placeholder='CON-01' />
            <CampoTexto
              {...form.campo('codigo', mascararDigitos(8))}
              rotulo='Código TUSS'
              inputMode='numeric'
              placeholder='00000000'
              largura='col-md-3'
            />
            <CampoSelecao {...form.campo('tipo')} rotulo='Tipo' opcoes={Object.entries(TIPO_PROCEDIMENTO)} />
            <CampoTexto {...form.campo('nome')} rotulo='Descrição' largura='col-12' />
          </Secao>
          <Secao titulo='Agenda e preço'>
            <CampoTexto
              {...form.campo('duracaoPadrao', mascararDigitos(3))}
              rotulo='Duração padrão (minutos)'
              inputMode='numeric'
              largura='col-md-3'
              ajuda='Ocupa a agenda do médico.'
            />
            <CampoMoeda {...form.campo('precoParticular', mascararMoeda)} rotulo='Preço particular' />
            <CampoMarcar
              {...form.marcar('exigeAutorizacao')}
              rotulo='Exige autorização prévia da operadora'
              ajuda='No atendimento por convênio, a guia só é liberada com a autorização.'
            />
          </Secao>
        </Formulario>
      )}
      {modal}
    </Pagina>
  );
}

export default CadastroProcedimento;
