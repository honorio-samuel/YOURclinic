import React from 'react';
import { Link } from 'react-router-dom';

import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import PendingActionsOutlinedIcon from '@mui/icons-material/PendingActionsOutlined';
import TodayOutlinedIcon from '@mui/icons-material/TodayOutlined';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import { DATA_DE_HOJE } from '../../config/axios';
import { MENUS } from '../../navegacao/menus';
import { listar } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { diaMes, diaMesHora, moeda, primeiroNome } from '../../utils/formatos';
import { carregarCobrancasDoTitular, carregarConsultasDoTitular, ExigeRepresentado, useTitular } from './comum';

// Os atalhos são os itens do menu do papel, menos a própria tela e a de dados.
const FORA_DOS_ATALHOS = ['/portal/inicio', '/portal/dados'];

// P-01 e R-01 · Início: atalhos, consulta de hoje, próximas consultas e pendências.
function InicioPortal() {
  const { id, ehResponsavel, sessao } = useTitular();
  const atalhos = MENUS[sessao.usuario.papel].filter((item) => !FORA_DOS_ATALHOS.includes(item.rota));
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
      {/* A saudação leva o nome; a aba do navegador, não (RNF04). */}
      <Pagina saudacao titulo={ehResponsavel ? 'Início' : `Olá, ${primeiroNome(sessao.usuario.nome)}`} tituloAba='Início'>
        <nav aria-label='Atalhos' className='row row-cols-2 row-cols-lg-4 g-3'>
          {atalhos.map(({ rotulo, rota, icone: Icone }) => (
            <div key={rota} className='col'>
              {/* No celular o chip fica acima do rótulo, que assim cabe em duas colunas. */}
              <Link
                to={rota}
                className='card card-body atalho h-100 flex-sm-row align-items-start align-items-sm-center gap-2 gap-sm-3 p-3 rounded-3 text-body text-decoration-none fw-semibold'
              >
                <span className='chip-icone bg-info-subtle' aria-hidden='true'>
                  <Icone fontSize='small' />
                </span>
                {rotulo}
              </Link>
            </div>
          ))}
        </nav>
        {/* Cartão branco, e não faixa colorida: a pílula de status precisa
            aparecer em qualquer um dos seis estados. */}
        {dados?.hoje && (
          <div className='card card-body flex-row flex-wrap align-items-center gap-3'>
            <span className='chip-icone bg-info-subtle' aria-hidden='true'>
              <TodayOutlinedIcon fontSize='small' />
            </span>
            <div className='faixa-texto'>
              <h2 className='h5 mb-0'>{ehResponsavel ? 'Consulta de hoje' : 'Minha consulta de hoje'}</h2>
              <span className='text-body-secondary'>
                {diaMesHora(dados.hoje.dataHora).split(' · ')[1]} · {dados.hoje.medico}
              </span>
            </div>
            <PilulaStatus estado={dados.hoje.status} />
          </div>
        )}
        <Listagem
          titulo='Próximas consultas'
          icone={EventNoteOutlinedIcon}
          carregando={carregando}
          erro={erro}
          aoTentarDeNovo={recarregar}
          linhas={dados?.proximas ?? []}
          vazio='Nenhuma consulta marcada.'
          colunas={[
            { titulo: 'Data e hora', render: (c) => diaMesHora(c.dataHora) },
            { titulo: 'Médico', render: (c) => c.medico },
            { titulo: 'Tipo', render: (c) => c.tipo },
            {
              titulo: '',
              render: (c) => (
                <Link to='/portal/listagem-agendamentos' className='btn btn-sm btn-outline-secondary' aria-label={`Ver: consulta de ${diaMesHora(c.dataHora)}`}>
                  Ver
                </Link>
              ),
            },
          ]}
        />
        <Listagem
          titulo='Pendências'
          icone={PendingActionsOutlinedIcon}
          carregando={carregando}
          linhas={dados?.pendencias ?? []}
          vazio='Nada pendente.'
          colunas={[
            { titulo: 'Pendência', render: (p) => p.pendencia },
            { titulo: 'Detalhe', render: (p) => p.detalhe },
            {
              titulo: '',
              render: (p) => (
                <Link to={p.rota} className='btn btn-sm btn-outline-secondary' aria-label={`${p.acao}: ${p.pendencia}, ${p.detalhe}`}>
                  {p.acao}
                </Link>
              ),
            },
          ]}
        />
      </Pagina>
    </ExigeRepresentado>
  );
}

export default InicioPortal;
