import React from 'react';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import Modal from '../../components/modal';
import PilulaStatus from '../../components/pilula-status';
import AcoesLinha from '../../components/acoes-linha';
import { CampoSelect, Filtros } from '../../components/campos';
import { mensagemDeErro } from '../../components/confirmacao';
import { mensagemErro, mostrarMensagem } from '../../components/toastr';
import { api, DATA_DE_HOJE } from '../../config/axios';
import { criar, listar } from '../../servicos/dados';
import { salvarComo } from '../../servicos/anexos';
import { useCarregar } from '../../hooks/use-carregar';
import { data, diaMes, diaMesHora } from '../../utils/formatos';

const DIMENSOES = [
  'Atendimentos por convênio',
  'Atendimentos por médico',
  'Faturamento por médico',
  'Glosas por motivo',
  'Glosas por operadora',
  'Estoque por item',
  'Recebimentos por meio de pagamento',
];

const celula = (v) => (typeof v === 'number' ? v.toLocaleString('pt-BR') : v);

// A tabela do relatório, para ver sem baixar.
function JanelaRelatorio({ relatorio, aoFechar }) {
  const { dados, carregando, erro } = useCarregar(async () => (await api.get(`/relatorios/${relatorio.id}/dados`)).data, [relatorio.id]);
  return (
    <Modal
      titulo={relatorio.nome}
      aoFechar={aoFechar}
      largo
      rodape={
        <button type='button' className='btn btn-outline-secondary' onClick={aoFechar}>
          Fechar
        </button>
      }
    >
      <p className='small text-body-secondary'>
        De {data(relatorio.periodoInicio)} a {data(relatorio.periodoFim)}. Dados agregados, sem nenhum conteúdo clínico.
      </p>
      {carregando && <p className='text-body-secondary mb-0'>Carregando…</p>}
      {erro && <p className='text-danger mb-0'>Não foi possível abrir o relatório agora.</p>}
      {dados && (
        <>
          <div className='table-responsive'>
            <table className='table table-sm'>
              <caption className='visually-hidden'>{relatorio.nome}</caption>
              <thead>
                <tr>
                  {dados.colunas.map((c, i) => (
                    <th key={c} scope='col' className={i > 0 ? 'text-end' : undefined}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dados.linhas.length === 0 && (
                  <tr>
                    <td colSpan={dados.colunas.length}>Nada no período.</td>
                  </tr>
                )}
                {dados.linhas.map((linha) => (
                  <tr key={linha[0]}>
                    {linha.map((v, i) => (
                      <td key={dados.colunas[i]} className={i > 0 ? 'text-end' : undefined}>
                        {celula(v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {dados.suprimidos > 0 && (
            <p className='small text-body-secondary mb-0'>
              {dados.suprimidos} {dados.suprimidos === 1 ? 'recorte ficou de fora' : 'recortes ficaram de fora'} por ter menos de 5 registros.
            </p>
          )}
        </>
      )}
    </Modal>
  );
}

// A-30 · Relatórios (RF42). Gerados pela API em segundos, só com dados
// agregados; recortes com poucos registros não são exibidos.
function Relatorios() {
  const { dados, carregando, erro, recarregar } = useCarregar(() => listar('relatorios', { _sort: 'id', _order: 'desc' }));
  const [dimensao, setDimensao] = React.useState(DIMENSOES[0]);
  const [de, setDe] = React.useState('2026-09-01');
  const [ate, setAte] = React.useState(DATA_DE_HOJE);
  const [pedindo, setPedindo] = React.useState(false);
  const [aberto, setAberto] = React.useState(null);

  // Enquanto algum relatório gera, a lista se atualiza sozinha.
  const gerando = (dados ?? []).some((r) => r.situacao === 'GERANDO');
  React.useEffect(() => {
    if (!gerando) return undefined;
    const espera = setTimeout(recarregar, 3000);
    return () => clearTimeout(espera);
  }, [gerando, dados, recarregar]);

  const gerar = async () => {
    setPedindo(true);
    try {
      await criar('relatorios', { nome: dimensao, periodoInicio: de, periodoFim: ate });
      mostrarMensagem('Relatório pedido', 'Fica pronto em alguns segundos, na lista abaixo.', 'info');
      recarregar();
    } catch (e) {
      mensagemErro(mensagemDeErro(e));
    } finally {
      setPedindo(false);
    }
  };
  const baixar = async (r) => {
    try {
      const { data: arquivo } = await api.get(`/relatorios/${r.id}/arquivo`, { responseType: 'blob' });
      salvarComo(arquivo, `${r.nome}-${r.periodoInicio}-a-${r.periodoFim}.csv`);
    } catch {
      mensagemErro('Não foi possível baixar o relatório agora.');
    }
  };

  return (
    <Pagina titulo='Relatórios'>
      <Filtros>
        <CampoSelect id='relDimensao' rotulo='Dimensão' valor={dimensao} aoMudar={setDimensao} opcoes={DIMENSOES.map((d) => [d, d])} />
        <div className='filtro'>
          <label htmlFor='relDe' className='form-label'>
            De
          </label>
          <input id='relDe' type='date' className='form-control' value={de} max={ate} onChange={(e) => e.target.value && setDe(e.target.value)} />
        </div>
        <div className='filtro'>
          <label htmlFor='relAte' className='form-label'>
            Até
          </label>
          <input id='relAte' type='date' className='form-control' value={ate} min={de} onChange={(e) => e.target.value && setAte(e.target.value)} />
        </div>
        <button type='button' className='btn btn-primary' onClick={gerar} disabled={pedindo}>
          {pedindo ? 'Pedindo…' : 'Gerar relatório'}
        </button>
      </Filtros>
      <div className='alert alert-info mb-0' role='status'>
        Recortes de atendimento com menos de 5 registros não aparecem no relatório, para não identificar ninguém.
      </div>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={dados ?? []}
        vazio='Nenhum relatório gerado.'
        colunas={[
          { titulo: 'Relatório', render: (r) => r.nome },
          { titulo: 'Período', render: (r) => `${diaMes(r.periodoInicio)} a ${diaMes(r.periodoFim)}` },
          { titulo: 'Gerado em', render: (r) => (r.geradoEm ? diaMesHora(r.geradoEm) : '—') },
          { titulo: 'Situação', render: (r) => <PilulaStatus rotulo={r.situacao === 'PRONTO' ? 'Pronto' : 'Gerando…'} tom={r.situacao === 'PRONTO' ? 'sucesso' : 'info'} /> },
          {
            titulo: 'Ações',
            render: (r) =>
              r.situacao === 'PRONTO' ? (
                <AcoesLinha
                  acoes={[
                    { tipo: 'ver', alvo: r.nome, aoClicar: () => setAberto(r) },
                    { tipo: 'baixar', alvo: `${r.nome} em CSV`, aoClicar: () => baixar(r) },
                  ]}
                />
              ) : null,
          },
        ]}
      />
      {aberto && <JanelaRelatorio relatorio={aberto} aoFechar={() => setAberto(null)} />}
    </Pagina>
  );
}

export default Relatorios;
