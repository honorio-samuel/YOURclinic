import React from 'react';
import { useNavigate } from 'react-router-dom';

import Pagina from '../../components/pagina';
import PilulaStatus from '../../components/pilula-status';
import { CampoMoeda, CampoSelecao, CampoTexto, Formulario, Rodape, Secao, useFormulario, useSairSemSalvar } from '../../components/formulario';
import { mensagemDeErro, useConfirmacao } from '../../components/confirmacao';
import { mensagemErro, mensagemSucesso } from '../../components/toastr';
import { RegistroIndisponivel } from '../geral/avisos';
import { buscar, criar } from '../../servicos/dados';
import { atualizarSeMudou } from '../../servicos/pessoas';
import { useCarregar } from '../../hooks/use-carregar';
import { useCadastro } from '../../navegacao/caminhos';
import { useSessao } from '../../sessao/sessao';
import { mascararMoeda, moedaParaNumero, numeroParaMoeda } from '../../utils/mascaras';
import { CATEGORIA_DESPESA, rotuloDe, SITUACAO_TITULO } from '../../utils/rotulos';

const VAZIO = { fornecedor: '', categoria: '', vencimento: '', valor: '' };

// A-14 · Cadastro de conta a pagar (RF50), só do Administrador. A conta nova
// nasce em aberto. Depois de paga, não se edita: o pagamento se corrige pelo
// estorno, na listagem.
function CadastroContaPagar() {
  const { id, consulta, listagem, editar } = useCadastro('contas-pagar');
  const { sessao } = useSessao();
  const navigate = useNavigate();
  const form = useFormulario(VAZIO);
  const { carregar } = form;
  const [modal, confirmar] = useConfirmacao();
  const [salvando, setSalvando] = React.useState(false);

  const { dados: atual, carregando, erro } = useCarregar(() => (id ? buscar('titulosPagar', id) : Promise.resolve(null)), [id]);

  React.useEffect(() => {
    if (atual) {
      carregar({
        fornecedor: atual.fornecedor ?? '',
        categoria: atual.categoria ?? '',
        vencimento: atual.vencimento ?? '',
        valor: numeroParaMoeda(atual.valor),
      });
    }
  }, [atual, carregar]);

  const sair = useSairSemSalvar(form.sujo, confirmar, () => navigate(listagem));

  if (erro?.status === 404) return <RegistroIndisponivel />;

  const fechada = Boolean(atual) && atual.situacao !== 'ABERTO';
  const leitura = consulta || fechada;
  const v = form.valores;

  const salvar = async (e) => {
    e.preventDefault();
    const ok = form.validar({
      fornecedor: v.fornecedor.trim().length >= 3 ? null : 'Informe o fornecedor.',
      categoria: v.categoria ? null : 'Escolha a categoria.',
      vencimento: v.vencimento ? null : 'Informe o vencimento.',
      valor: moedaParaNumero(v.valor) > 0 ? null : 'Informe o valor.',
    });
    if (!ok) return;
    setSalvando(true);
    const campos = { fornecedor: v.fornecedor.trim(), categoria: v.categoria, vencimento: v.vencimento, valor: moedaParaNumero(v.valor) };
    try {
      if (id) await atualizarSeMudou('titulosPagar', id, campos, atual);
      else await criar('titulosPagar', { ...campos, situacao: 'ABERTO', idAdministrador: sessao.usuario.idPessoa, idPagamentoCartao: null });
      mensagemSucesso(id ? 'Conta atualizada.' : 'Conta a pagar cadastrada.');
      navigate(listagem);
    } catch (falha) {
      mensagemErro(mensagemDeErro(falha));
      setSalvando(false);
    }
  };

  return (
    <Pagina
      titulo={id ? `Conta a pagar · ${atual?.fornecedor ?? '…'}` : 'Nova conta a pagar'}
      acoes={
        consulta &&
        !fechada && (
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
          rotulo='Cadastro de conta a pagar'
          rodape={<Rodape aoCancelar={sair} salvando={salvando} semSalvar={leitura} rotuloCancelar={leitura ? 'Voltar' : 'Cancelar'} />}
        >
          {fechada && (
            <div className='alert alert-secondary mb-0 d-flex flex-wrap align-items-center gap-2' role='status'>
              <PilulaStatus {...rotuloDe(SITUACAO_TITULO, atual.situacao)} />
              <span>Conta {atual.situacao === 'PAGO' ? 'paga' : 'encerrada'}: não se edita. Para corrigir um pagamento, estorne pela listagem.</span>
            </div>
          )}
          <Secao>
            <CampoTexto {...form.campo('fornecedor')} rotulo='Fornecedor' />
            <CampoSelecao {...form.campo('categoria')} rotulo='Categoria' opcoes={Object.entries(CATEGORIA_DESPESA)} />
            <CampoTexto {...form.campo('vencimento')} tipo='date' rotulo='Vencimento' largura='col-md-3' />
            <CampoMoeda {...form.campo('valor', mascararMoeda)} rotulo='Valor' />
          </Secao>
        </Formulario>
      )}
      {modal}
    </Pagina>
  );
}

export default CadastroContaPagar;
