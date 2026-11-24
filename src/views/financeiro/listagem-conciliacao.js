import React from 'react';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import AcoesLinha from '../../components/acoes-linha';
import { CampoSelect, Filtros } from '../../components/campos';
import JanelaDetalhe from '../../components/janela-detalhe';
import { mensagemDeErro, useConfirmacao } from '../../components/confirmacao';
import { mensagemErro, mensagemSucesso, mostrarMensagem } from '../../components/toastr';
import { api } from '../../config/axios';
import { listar } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { diaMes, diaMesHora, moeda } from '../../utils/formatos';
import { rotuloDe } from '../../utils/rotulos';

const CONCILIACAO = {
  CONCILIADO: { rotulo: 'Conciliado', tom: 'sucesso' },
  DIVERGENTE: { rotulo: 'Divergente', tom: 'perigo' },
  CONTESTADO: { rotulo: 'Contestado', tom: 'info' },
  PENDENTE: { rotulo: 'Pendente', tom: 'aviso' },
};

const MODALIDADE = {
  DEBITO: 'Débito',
  CREDITO: 'Crédito à vista',
  CREDITO_PARCELADO_LOJISTA: 'Crédito parcelado pela clínica',
  CREDITO_PARCELADO_EMISSOR: 'Crédito parcelado pelo emissor',
};

// A-15 · Conciliação de recebíveis (RF49).
function Conciliacao() {
  const { dados, carregando, erro, recarregar } = useCarregar(() => listar('pagamentosCartao'));
  const [adquirente, setAdquirente] = React.useState('');
  const [situacao, setSituacao] = React.useState('');
  const [aberta, setAberta] = React.useState(null);
  const [modal, confirmar] = useConfirmacao();

  // O extrato vem da adquirente simulada e confere as transações pendentes.
  const importar = async () => {
    const ok = await confirmar({
      titulo: adquirente ? `Importar o extrato da ${adquirente}?` : 'Importar o extrato das adquirentes?',
      texto: 'O crédito de cada transação pendente é conferido com o líquido esperado. O que não bate fica divergente para tratar.',
      rotuloConfirmar: 'Importar extrato',
    });
    if (!ok) return;
    try {
      const { data: r } = await api.post('/financeiro/conciliacao/extrato', { adquirente: adquirente || null });
      if (r.lidas === 0) mostrarMensagem('Extrato importado', 'Nenhuma transação pendente para conciliar.', 'info');
      else mensagemSucesso(`${r.lidas} ${r.lidas === 1 ? 'transação lida' : 'transações lidas'}: ${r.conciliadas} conciliadas e ${r.divergentes} divergentes.`);
      recarregar();
    } catch (e) {
      mensagemErro(mensagemDeErro(e));
    }
  };
  // A divergência é aceita (vale o valor do extrato) ou contestada na adquirente.
  const tratar = async (p, decisao) => {
    const aceitar = decisao === 'ACEITAR';
    const valores =
      p.valorExtrato != null
        ? `Líquido esperado ${moeda(p.valorLiquido)}; no extrato, ${moeda(p.valorExtrato)}. `
        : 'A adquirente informou um valor diferente do esperado. ';
    const observacao = await confirmar({
      titulo: aceitar ? `Aceitar o extrato do NSU ${p.nsu}?` : `Contestar o NSU ${p.nsu}?`,
      texto: valores + (aceitar ? 'O líquido passa a ser o do extrato e a transação fica conciliada.' : 'A transação fica contestada até a adquirente responder.'),
      campo: 'Observação',
      rotuloConfirmar: aceitar ? 'Aceitar extrato' : 'Contestar',
    });
    if (!observacao) return;
    try {
      await api.post(`/financeiro/conciliacao/${p.id}/tratar`, { decisao, observacao });
      mensagemSucesso(aceitar ? `NSU ${p.nsu} conciliado pelo valor do extrato.` : `NSU ${p.nsu} contestado.`);
      recarregar();
    } catch (e) {
      mensagemErro(mensagemDeErro(e));
    }
  };
  const adquirentes = [...new Set((dados ?? []).map((p) => p.adquirente).filter(Boolean))];
  const linhas = (dados ?? [])
    .filter((p) => (!adquirente || p.adquirente === adquirente) && (!situacao || p.situacaoConciliacao === situacao))
    .sort((a, b) => (b.dataHora ?? '').localeCompare(a.dataHora ?? ''));

  return (
    <Pagina
      titulo='Conciliação de recebíveis'
      acoes={
        <button type='button' className='btn btn-outline-primary' onClick={importar}>
          Importar extrato
        </button>
      }
    >
      <Filtros>
        <CampoSelect id='concAdquirente' rotulo='Adquirente' valor={adquirente} aoMudar={setAdquirente} opcoes={[['', 'Todos'], ...adquirentes.map((a) => [a, a])]} />
        <CampoSelect
          id='concSituacao'
          rotulo='Situação'
          valor={situacao}
          aoMudar={setSituacao}
          opcoes={[['', 'Todas'], ...Object.entries(CONCILIACAO).map(([k, v]) => [k, v.rotulo])]}
        />
      </Filtros>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={linhas}
        vazio='Nenhuma transação nesta seleção.'
        colunas={[
          { titulo: 'Data', render: (p) => diaMes(p.dataHora) },
          { titulo: 'NSU', render: (p) => p.nsu },
          { titulo: 'Bandeira', render: (p) => p.bandeira },
          { titulo: 'Bruto', classe: 'text-end', render: (p) => moeda(p.valorBruto) },
          { titulo: 'Líquido', classe: 'text-end', render: (p) => moeda(p.valorLiquido) },
          {
            titulo: 'Situação',
            render: (p) => (
              <PilulaStatus
                {...rotuloDe(CONCILIACAO, p.situacaoConciliacao)}
                transicoes={
                  p.situacaoConciliacao === 'DIVERGENTE'
                    ? [
                        { rotulo: 'Aceitar o extrato', aoEscolher: () => tratar(p, 'ACEITAR') },
                        { rotulo: 'Contestar', aoEscolher: () => tratar(p, 'CONTESTAR') },
                      ]
                    : null
                }
              />
            ),
          },
          { titulo: 'Ações', render: (p) => <AcoesLinha acoes={[{ tipo: 'ver', alvo: `NSU ${p.nsu}`, aoClicar: () => setAberta(p) }]} /> },
        ]}
      />
      {aberta && (
        <JanelaDetalhe
          titulo={`Transação NSU ${aberta.nsu}`}
          aoFechar={() => setAberta(null)}
          itens={[
            ['Data', diaMesHora(aberta.dataHora)],
            ['Adquirente', aberta.adquirente],
            ['Terminal', aberta.viaTef ? 'Maquininha integrada (TEF)' : 'Maquininha avulsa'],
            ['Bandeira', aberta.bandeira],
            ['Modalidade', MODALIDADE[aberta.modalidade] ?? aberta.modalidade],
            ['Parcelas', aberta.parcelas],
            ['Autorização', aberta.codigoAutorizacao],
            ['Bruto', moeda(aberta.valorBruto)],
            ['Taxa', aberta.valorLiquido != null ? moeda(aberta.valorBruto - aberta.valorLiquido) : null],
            ['Líquido', moeda(aberta.valorLiquido)],
            ['No extrato', aberta.valorExtrato != null ? moeda(aberta.valorExtrato) : undefined],
            ['Conciliação', rotuloDe(CONCILIACAO, aberta.situacaoConciliacao).rotulo],
            [
              'Tratamento',
              aberta.tratamento
                ? `${aberta.tratamento.decisao === 'ACEITAR' ? 'Extrato aceito' : 'Contestado'} em ${diaMesHora(aberta.tratamento.dataHora)}: ${aberta.tratamento.observacao}`
                : undefined,
            ],
          ]}
        />
      )}
      {modal}
    </Pagina>
  );
}

export default Conciliacao;
