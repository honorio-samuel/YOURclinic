import React from 'react';
import { Link } from 'react-router-dom';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import { DATA_DE_HOJE } from '../../config/axios';
import { listar } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { data, diasEntre } from '../../utils/formatos';
import { STATUS_CONSULTA } from '../../utils/rotulos';
import { PRAZO_TITULAR } from './comum';

// A-01 · Início › Painel do dia. Contagens sem nome de paciente e as pendências
// que esperam o Administrador; cada uma leva à tela onde é tratada.
function PainelDoDia() {
  const carregar = async () => {
    const [consultas, estornos, caixas, orcamentos, recursos, solicitacoes, excecoes, contratos] = await Promise.all([
      listar('consultas', { dataHora_gte: `${DATA_DE_HOJE}T00:00:00`, dataHora_lte: `${DATA_DE_HOJE}T23:59:59` }),
      listar('estornos', { situacao: 'A_APROVAR' }),
      listar('caixas', { situacao: 'A_APROVAR' }),
      listar('orcamentos', { etapa: 'APROVACAO' }),
      listar('recursosGlosa', { situacao: 'MANTIDO' }),
      listar('solicitacoesTitular', { situacao: ['ABERTA', 'EM_ANALISE'] }),
      listar('acessosExcecao').then((lista) => lista.filter((e) => !e.revisado)),
      listar('contratosOperadora', { situacao: ['ATIVO', 'VIGENTE'] }),
    ]);
    const porStatus = {};
    for (const c of consultas) porStatus[c.status] = (porStatus[c.status] ?? 0) + 1;
    const menorPrazo = solicitacoes.length
      ? Math.min(...solicitacoes.map((s) => PRAZO_TITULAR - diasEntre(s.dataSolicitacao, DATA_DE_HOJE)))
      : null;
    const vencendo = contratos.filter((c) => diasEntre(DATA_DE_HOJE, c.vigenciaFim) <= 90);
    const pendencias = [
      { id: 1, pendencia: 'Estornos a aprovar', itens: estornos.length, prazo: '—', rota: '/admin/estornos' },
      { id: 2, pendencia: 'Divergências de caixa', itens: caixas.length, prazo: '—', rota: '/admin/caixas' },
      { id: 3, pendencia: 'Orçamentos a aprovar', itens: orcamentos.length, prazo: '—', rota: '/admin/orcamentos' },
      { id: 4, pendencia: 'Recursos de glosa mantidos', itens: recursos.length, prazo: '—', rota: '/admin/recursos' },
      { id: 5, pendencia: 'Solicitações de titulares', itens: solicitacoes.length, prazo: menorPrazo === null ? '—' : `${menorPrazo} dias`, rota: '/admin/solicitacoes' },
      { id: 6, pendencia: 'Acessos de exceção a revisar', itens: excecoes.length, prazo: '—', rota: '/admin/log' },
      { id: 7, pendencia: 'Contratos perto do fim da vigência', itens: vencendo.length, prazo: vencendo.length ? data(vencendo[0].vigenciaFim) : '—', rota: '/admin/contratos' },
    ];
    return { total: consultas.length, porStatus, pendencias };
  };
  const { dados, carregando, erro, recarregar } = useCarregar(carregar);

  return (
    <Pagina titulo='Painel do dia'>
      <div className='row g-3'>
        {['AGENDADO', 'NA_RECEPCAO', 'EM_ATENDIMENTO', 'FINALIZADO'].map((s) => (
          <div key={s} className='col-6 col-md-3'>
            <div className='card h-100'>
              <div className='card-body'>
                <div className='display-6 fw-light'>{carregando ? '…' : dados?.porStatus[s] ?? 0}</div>
                <div className='small text-body-secondary'>{STATUS_CONSULTA[s].rotulo} hoje</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <Listagem
        titulo='Pendências'
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={dados?.pendencias ?? []}
        colunas={[
          { titulo: 'Pendência', render: (p) => p.pendencia },
          { titulo: 'Itens', classe: 'text-end', render: (p) => p.itens },
          { titulo: 'Prazo', render: (p) => p.prazo },
          { titulo: '', render: (p) => <Link to={p.rota}>Abrir</Link> },
        ]}
      />
      <p className='small text-body-secondary mb-0'>
        {dados ? `${dados.total} consultas marcadas para hoje.` : ''} A fila completa está em{' '}
        <Link to='/admin/fila'>Fila do dia</Link>.
      </p>
    </Pagina>
  );
}

export default PainelDoDia;
