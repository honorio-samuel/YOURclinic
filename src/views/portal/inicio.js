import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import { DATA_DE_HOJE } from '../../config/axios';
import { listar } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { diaMes, diaMesHora, moeda, primeiroNome } from '../../utils/formatos';
import { carregarCobrancasDoTitular, carregarConsultasDoTitular, ExigeRepresentado, useTitular } from './comum';

// P-01 e R-01 · Início: consulta de hoje, próximas consultas e pendências.
function InicioPortal() {
  const { id, ehResponsavel, sessao } = useTitular();
  const navigate = useNavigate();
  const { dados, carregando, erro, recarregar } = useCarregar(async () => {
    if (!id) return null;
    const [consultas, orcamentos, cobrancas] = await Promise.all([carregarConsultasDoTitular(id), listar('orcamentos', { idPaciente: id, etapa: 'ACEITE' }), carregarCobrancasDoTitular(id)]);
    const hoje = consultas.find((c) => c.dataHora.startsWith(DATA_DE_HOJE) && !['CANCELADO'].includes(c.status));
    const proximas = consultas.filter((c) => c.status === 'AGENDADO' && c.dataHora.slice(0, 10) > DATA_DE_HOJE).slice(0, 3);
    const pendencias = [
      ...orcamentos.map((o) => ({ id: `o${o.id}`, pendencia: 'Orçamento aguardando aceite', detalhe: `válido até ${diaMes(o.validade)}`, acao: 'Abrir', rota: `/portal/orcamentos/${o.id}` })),
      ...cobrancas.filter((c) => c.situacao === 'ABERTA').map((c) => ({ id: `c${c.id}`, pendencia: 'Cobrança em aberto', detalhe: moeda(c.valorTotal), acao: 'Pagar', rota: '/portal/listagem-cobrancas' })),
    ];
    return { hoje, proximas, pendencias };
  }, [id]);

  return (
    <ExigeRepresentado>
      <Pagina titulo={ehResponsavel ? 'Início' : `Olá, ${primeiroNome(sessao.usuario.nome)}`}>
        {dados?.hoje && (
          <div className='card'>
            <div className='card-body d-flex flex-wrap align-items-center gap-3'>
              <h2 className='h5 mb-0 w-100'>{ehResponsavel ? 'Consulta de hoje' : 'Minha consulta de hoje'}</h2>
              <span>
                {diaMesHora(dados.hoje.dataHora).split(' · ')[1]} · {dados.hoje.medico}
              </span>
              <PilulaStatus estado={dados.hoje.status} />
            </div>
          </div>
        )}
        <Listagem
          titulo='Próximas consultas'
          carregando={carregando}
          erro={erro}
          aoTentarDeNovo={recarregar}
          linhas={dados?.proximas ?? []}
          vazio='Nenhuma consulta marcada.'
          colunas={[
            { titulo: 'Data e hora', render: (c) => diaMesHora(c.dataHora) },
            { titulo: 'Médico', render: (c) => c.medico },
            { titulo: 'Tipo', render: (c) => c.tipo },
            { titulo: '', render: () => <Link to='/portal/listagem-agendamentos'>Ver</Link> },
          ]}
        />
        <Listagem
          titulo='Pendências'
          carregando={carregando}
          linhas={dados?.pendencias ?? []}
          vazio='Nada pendente.'
          colunas={[
            { titulo: 'Pendência', render: (p) => p.pendencia },
            { titulo: 'Detalhe', render: (p) => p.detalhe },
            {
              titulo: '',
              render: (p) => (
                <button type='button' className='btn btn-link btn-sm p-0' onClick={() => navigate(p.rota)}>
                  {p.acao}
                </button>
              ),
            },
          ]}
        />
      </Pagina>
    </ExigeRepresentado>
  );
}

export default InicioPortal;
