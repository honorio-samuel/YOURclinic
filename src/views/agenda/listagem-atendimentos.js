import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import { DATA_DE_HOJE } from '../../config/axios';
import { listar, porId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { useSessao } from '../../sessao/sessao';
import { data, diasEntre, hora } from '../../utils/formatos';
import { carregarProdutos } from '../estoque/comum';
import { carregarConsultas, doDia, useMudarStatus } from './comum';

// RN-38.3: o alerta de validade chega ao Médico no contexto do atendimento,
// para ser visto quando ele vai entregar o item (o de estoque mínimo não é dele).
async function carregarAvisosDeEstoque() {
  const [alertas, produtos] = await Promise.all([listar('alertasEstoque', { situacao: 'ABERTO' }), carregarProdutos()]);
  const produto = porId(produtos);
  return alertas
    .map((a) => ({ id: a.id, tipo: a.tipo, produto: produto[a.idProduto]?.descricao, lote: produto[a.idProduto]?.lotes.find((l) => l.id === a.idLote) }))
    .filter((a) => a.produto && a.lote);
}

function AvisosDeEstoque({ avisos }) {
  if (!avisos?.length) return null;
  return (
    <div className='alert alert-warning mb-0' role='status'>
      <p className='mb-1 fw-semibold'>Avisos do estoque</p>
      <ul className='mb-1 ps-3'>
        {avisos.map((a) => {
          const dias = diasEntre(DATA_DE_HOJE, a.lote.validade);
          return (
            <li key={a.id}>
              {a.produto}, lote {a.lote.numero}:{' '}
              {a.tipo === 'VENCIDO' ? `venceu em ${data(a.lote.validade)}, só sai por descarte.` : `vence em ${dias} ${dias === 1 ? 'dia' : 'dias'}, use este lote primeiro.`}
            </li>
          );
        })}
      </ul>
      <Link to='/medico/listagem-produtos'>Abrir o estoque</Link>
    </div>
  );
}

// M-01 Atendimentos do dia. O Médico vê só os próprios atendimentos e não vê valores.
function AtendimentosDoDia() {
  const { sessao } = useSessao();
  const navigate = useNavigate();
  const idMedico = sessao.usuario.idPessoa;
  const { dados, carregando, erro, recarregar } = useCarregar(() =>
    carregarConsultas({ ...doDia(DATA_DE_HOJE), idMedico })
  );
  const [modal, mudar] = useMudarStatus(recarregar);
  const avisos = useCarregar(carregarAvisosDeEstoque);

  const transicoes = (c) => {
    if (c.status === 'NA_RECEPCAO') return [{ rotulo: 'Chamar paciente', aoEscolher: () => mudar(c, 'EM_ATENDIMENTO') }];
    if (c.status === 'EM_ATENDIMENTO')
      return [
        {
          rotulo: 'Finalizar e selar',
          aoEscolher: () =>
            mudar(c, 'FINALIZADO', {
              titulo: `Finalizar o atendimento de ${c.paciente}?`,
              texto: 'O registro clínico é selado. Correções depois disso só por retificação versionada.',
              rotuloConfirmar: 'Finalizar e selar',
            }),
        },
        {
          rotulo: 'Voltar para a recepção',
          aoEscolher: () =>
            mudar(c, 'NA_RECEPCAO', {
              titulo: 'Voltar o paciente para a recepção?',
              texto: 'A mudança fica destacada no log. O vínculo já ativado não muda.',
              campo: 'Motivo',
              rotuloConfirmar: 'Voltar para a recepção',
            }),
        },
      ];
    if (c.status === 'FINALIZADO')
      return [
        {
          rotulo: 'Voltar para Em atendimento',
          aoEscolher: () =>
            mudar(c, 'EM_ATENDIMENTO', {
              titulo: 'Voltar o atendimento para Em atendimento?',
              texto: 'A mudança fica destacada no log. O registro continua selado e só muda por retificação.',
              campo: 'Motivo',
              rotuloConfirmar: 'Voltar para Em atendimento',
            }),
        },
      ];
    return null;
  };

  return (
    <Pagina titulo='Atendimentos do dia'>
      <AvisosDeEstoque avisos={avisos.dados} />
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={dados ?? []}
        itensPorPagina={50}
        vazio='Nenhum atendimento marcado para hoje.'
        colunas={[
          { titulo: 'Paciente', render: (c) => c.paciente },
          { titulo: 'Horário', render: (c) => hora(c.dataHora) },
          { titulo: 'Tipo', render: (c) => c.tipo },
          { titulo: 'Status', render: (c) => <PilulaStatus estado={c.status} transicoes={transicoes(c)} /> },
          {
            titulo: 'Prontuário',
            render: (c) =>
              ['EM_ATENDIMENTO', 'FINALIZADO'].includes(c.status) ? (
                <button type='button' className='btn btn-link btn-sm p-0' onClick={() => navigate(`/medico/prontuario/${c.idPaciente}`)}>
                  Abrir
                </button>
              ) : (
                '—'
              ),
          },
        ]}
      />
      {modal}
    </Pagina>
  );
}

export default AtendimentosDoDia;
