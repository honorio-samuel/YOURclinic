import React from 'react';
import { useNavigate } from 'react-router-dom';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import AcoesLinha from '../../components/acoes-linha';
import { CampoBusca, CampoSelect, Filtros } from '../../components/campos';
import { salvarComAviso, useConfirmacao } from '../../components/confirmacao';
import { listar } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { useCaminhosDaListagem } from '../../navegacao/caminhos';
import { corresponde, data, moeda } from '../../utils/formatos';
import { CATEGORIA_DESPESA, rotuloDe, SITUACAO_TITULO } from '../../utils/rotulos';
import { situacaoDoTitulo } from './comum';

// A-14 · Contas a pagar. Título pago não é editado, só estornado (RN-50.1).
function ContasPagar() {
  const navigate = useNavigate();
  const caminhos = useCaminhosDaListagem('contas-pagar');
  const { dados, carregando, erro, recarregar } = useCarregar(async () =>
    (await listar('titulosPagar', { _sort: 'vencimento' })).map((t) => ({ ...t, situacaoEfetiva: situacaoDoTitulo(t) }))
  );
  const [modal, confirmar] = useConfirmacao();
  const [busca, setBusca] = React.useState('');
  const [categoria, setCategoria] = React.useState('');
  const [situacao, setSituacao] = React.useState('');

  const pagar = async (t) => {
    const ok = await confirmar({
      titulo: `Registrar o pagamento de ${t.fornecedor}?`,
      texto: `${moeda(t.valor)} com vencimento em ${data(t.vencimento)}. Depois de pago, o título só pode ser estornado.`,
      rotuloConfirmar: 'Registrar pagamento',
    });
    if (ok && (await salvarComAviso('titulosPagar', t.id, { situacao: 'PAGO' }, 'Pagamento registrado.'))) recarregar();
  };
  const estornar = async (t) => {
    const motivo = await confirmar({
      titulo: `Estornar o pagamento de ${t.fornecedor}?`,
      texto: 'O lançamento original continua no histórico.',
      campo: 'Motivo do estorno',
      rotuloConfirmar: 'Estornar',
      perigo: true,
    });
    if (motivo && (await salvarComAviso('titulosPagar', t.id, { situacao: 'ESTORNADO', motivoEstorno: motivo }, 'Pagamento estornado.'))) recarregar();
  };

  const linhas = (dados ?? []).filter(
    (t) => corresponde(busca, t.fornecedor) && (!categoria || t.categoria === categoria) && (!situacao || t.situacaoEfetiva === situacao)
  );

  return (
    <Pagina
      titulo='Contas a pagar'
      acoes={
        <button type='button' className='btn btn-primary' onClick={() => navigate(caminhos.novo)}>
          + Nova conta
        </button>
      }
    >
      <Filtros>
        <CampoBusca id='pagarBusca' rotulo='Buscar por fornecedor' valor={busca} aoMudar={setBusca} />
        <CampoSelect id='pagarCategoria' rotulo='Categoria' valor={categoria} aoMudar={setCategoria} opcoes={[['', 'Todas'], ...Object.entries(CATEGORIA_DESPESA)]} />
        <CampoSelect
          id='pagarSituacao'
          rotulo='Situação'
          valor={situacao}
          aoMudar={setSituacao}
          opcoes={[['', 'Todas'], ['ABERTO', 'Aberto'], ['VENCIDO', 'Vencido'], ['PAGO', 'Pago'], ['ESTORNADO', 'Estornado']]}
        />
      </Filtros>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={linhas}
        vazio='Nenhuma conta nesta seleção.'
        colunas={[
          { titulo: 'Fornecedor', render: (t) => t.fornecedor },
          { titulo: 'Categoria', render: (t) => CATEGORIA_DESPESA[t.categoria] ?? t.categoria },
          { titulo: 'Vencimento', render: (t) => data(t.vencimento) },
          { titulo: 'Valor', classe: 'text-end', render: (t) => moeda(t.valor) },
          {
            titulo: 'Situação',
            render: (t) => (
              <PilulaStatus
                {...rotuloDe(SITUACAO_TITULO, t.situacaoEfetiva)}
                transicoes={['ABERTO', 'VENCIDO'].includes(t.situacaoEfetiva) ? [{ rotulo: 'Registrar pagamento', aoEscolher: () => pagar(t) }] : null}
              />
            ),
          },
          {
            titulo: 'Ações',
            render: (t) => {
              const alvo = `conta de ${t.fornecedor}`;
              const ver = { tipo: 'ver', alvo, aoClicar: () => navigate(caminhos.ver(t.id)) };
              if (t.situacao === 'PAGO') return <AcoesLinha acoes={[ver, { tipo: 'estornar', alvo, aoClicar: () => estornar(t) }]} />;
              if (t.situacao === 'ESTORNADO') return <AcoesLinha acoes={[ver]} />;
              return <AcoesLinha acoes={[ver, { tipo: 'editar', alvo, aoClicar: () => navigate(caminhos.editar(t.id)) }]} />;
            },
          },
        ]}
      />
      {modal}
    </Pagina>
  );
}

export default ContasPagar;
