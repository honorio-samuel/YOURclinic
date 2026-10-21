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
import { buscar, criar } from '../../servicos/dados';
import { atualizarSeMudou } from '../../servicos/pessoas';
import { useCarregar } from '../../hooks/use-carregar';
import { useCadastro } from '../../navegacao/caminhos';
import { useSessao } from '../../sessao/sessao';
import { mascararDigitos, mascararMoeda, moedaParaNumero, numeroParaMoeda } from '../../utils/mascaras';
import { TIPO_PRODUTO, UNIDADE_PRODUTO } from '../../utils/rotulos';

const VAZIO = { descricao: '', tipo: '', unidade: '', estoqueMinimo: '', controlaLote: true, custoAquisicao: '' };

// A-26 e S-17 · Cadastro do produto. Lote, validade e saldo nascem das
// entradas em Movimentações; aqui fica só o produto. O custo de aquisição é
// só do Administrador (RC06, nível 3): a Secretária não vê nem grava o campo.
function CadastroProduto() {
  const { id, consulta: leitura, listagem, editar } = useCadastro('produtos');
  const { sessao } = useSessao();
  const navigate = useNavigate();
  const ehAdmin = sessao.usuario.papel === 'ADMINISTRADOR';
  const form = useFormulario(VAZIO);
  const { carregar } = form;
  const [modal, confirmar] = useConfirmacao();
  const [salvando, setSalvando] = React.useState(false);

  const { dados: atual, carregando, erro } = useCarregar(() => (id ? buscar('produtos', id) : Promise.resolve(null)), [id]);

  React.useEffect(() => {
    if (atual) {
      carregar({
        descricao: atual.descricao ?? '',
        tipo: atual.tipo ?? '',
        unidade: atual.unidade ?? '',
        estoqueMinimo: atual.estoqueMinimo != null ? String(atual.estoqueMinimo) : '',
        controlaLote: Boolean(atual.controlaLote),
        custoAquisicao: numeroParaMoeda(atual.custoAquisicao),
      });
    }
  }, [atual, carregar]);

  const sair = useSairSemSalvar(form.sujo, confirmar, () => navigate(listagem));

  if (erro?.status === 404) return <RegistroIndisponivel />;

  const v = form.valores;
  const salvar = async (e) => {
    e.preventDefault();
    const ok = form.validar({
      descricao: v.descricao.trim().length >= 3 ? null : 'Informe a descrição.',
      tipo: v.tipo ? null : 'Escolha o tipo.',
      unidade: v.unidade ? null : 'Escolha a unidade.',
      estoqueMinimo: v.estoqueMinimo !== '' ? null : 'Informe o estoque mínimo (pode ser 0).',
    });
    if (!ok) return;
    setSalvando(true);
    const campos = {
      descricao: v.descricao.trim(),
      tipo: v.tipo,
      unidade: v.unidade,
      estoqueMinimo: Number(v.estoqueMinimo),
      controlaLote: v.controlaLote,
      ...(ehAdmin ? { custoAquisicao: moedaParaNumero(v.custoAquisicao) } : {}),
    };
    try {
      if (id) await atualizarSeMudou('produtos', id, campos, atual);
      else await criar('produtos', { ...campos, situacao: 'ATIVO' });
      mensagemSucesso(id ? 'Produto atualizado.' : 'Produto cadastrado.');
      navigate(listagem);
    } catch (falha) {
      mensagemErro(mensagemDeErro(falha));
      setSalvando(false);
    }
  };

  const inativo = atual?.situacao === 'INATIVO';
  return (
    <Pagina
      titulo={id ? `Produto · ${atual?.descricao ?? '…'}` : 'Novo produto'}
      acoes={
        leitura &&
        !inativo && (
          <button type='button' className='btn btn-primary' onClick={() => navigate(editar())}>
            Editar
          </button>
        )
      }
    >
      {carregando && id && !atual ? (
        <p className='text-body-secondary'>Carregando…</p>
      ) : (
        <Formulario
          aoEnviar={salvar}
          somenteLeitura={leitura}
          rotulo='Cadastro do produto'
          rodape={<Rodape aoCancelar={sair} salvando={salvando} semSalvar={leitura} rotuloCancelar={leitura ? 'Voltar' : 'Cancelar'} />}
        >
          {inativo && (
            <div className='alert alert-secondary mb-0' role='status'>
              Produto inativo: não aparece na saída nem nos alertas. Para editar, reative na lista.
            </div>
          )}
          <Secao titulo='Produto'>
            <CampoTexto {...form.campo('descricao')} rotulo='Descrição' largura='col-12' />
            <CampoSelecao {...form.campo('tipo')} rotulo='Tipo' opcoes={Object.entries(TIPO_PRODUTO)} largura='col-md-4' />
            <CampoSelecao {...form.campo('unidade')} rotulo='Unidade' opcoes={Object.entries(UNIDADE_PRODUTO)} largura='col-md-4' />
            <CampoTexto
              {...form.campo('estoqueMinimo', mascararDigitos(6))}
              rotulo='Estoque mínimo'
              inputMode='numeric'
              largura='col-md-4'
              ajuda='Abaixo disso, o produto entra em Alertas.'
            />
            {ehAdmin && (
              <CampoMoeda
                {...form.campo('custoAquisicao', mascararMoeda)}
                rotulo='Custo de aquisição'
                opcional
                largura='col-md-4'
                ajuda='Por unidade. Só o Administrador vê.'
              />
            )}
            <CampoMarcar
              {...form.marcar('controlaLote')}
              rotulo='Controla lote e validade'
              ajuda='Cada entrada registra o número do lote e a validade; a saída é por lote.'
            />
          </Secao>
          {!id && (
            <p className='text-body-secondary mb-0'>Depois de salvar, registre a primeira entrada com lote e validade em Estoque › Movimentações.</p>
          )}
        </Formulario>
      )}
      {modal}
    </Pagina>
  );
}

export default CadastroProduto;
