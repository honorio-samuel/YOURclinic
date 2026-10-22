import React from 'react';
import { useNavigate } from 'react-router-dom';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import { CampoSelect, Filtros } from '../../components/campos';
import { DATA_DE_HOJE } from '../../config/axios';
import { listar, pessoasPorId, porId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { moeda } from '../../utils/formatos';
import { rotuloDe, SITUACAO_TITULO } from '../../utils/rotulos';
import { carregarCobrancasComPaciente } from './comum';

// S-08 · Cobranças do dia, item a item. Sem soma do dia, sem subtotal por meio
// ou por médico e sem gráfico (RC06, regra de derivação).
function CobrancasDoDia() {
  const navigate = useNavigate();
  const carregar = async () => {
    const [cobrancas, procedimentos] = await Promise.all([carregarCobrancasComPaciente(), listar('procedimentos')]);
    const proc = porId(procedimentos);
    const medicos = await pessoasPorId(cobrancas.map((c) => c.consulta?.idMedico));
    return cobrancas
      .filter((c) => c.dataEmissao === DATA_DE_HOJE)
      .map((c) => ({
        ...c,
        idMedico: c.consulta?.idMedico,
        medico: medicos[c.consulta?.idMedico]?.nome,
        procedimento: c.consulta?.idConvenio ? 'Coparticipação' : proc[c.consulta?.idProcedimento]?.nome ?? '—',
      }));
  };
  const { dados, carregando, erro, recarregar } = useCarregar(carregar);
  const [medico, setMedico] = React.useState('');
  const [situacao, setSituacao] = React.useState('');
  const opcoesMedico = [['', 'Todos os médicos'], ...[...new Map((dados ?? []).filter((c) => c.idMedico).map((c) => [String(c.idMedico), c.medico])).entries()]];
  const linhas = (dados ?? []).filter((c) => (!medico || String(c.idMedico) === medico) && (!situacao || c.situacao === situacao));

  return (
    <Pagina titulo='Cobranças do dia'>
      <Filtros>
        <CampoSelect id='cobMedico' rotulo='Médico' valor={medico} aoMudar={setMedico} opcoes={opcoesMedico} />
        <CampoSelect id='cobSituacao' rotulo='Situação' valor={situacao} aoMudar={setSituacao} opcoes={[['', 'Todas'], ['ABERTA', 'Em aberto'], ['PAGA', 'Paga']]} />
      </Filtros>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={linhas}
        vazio='Nenhuma cobrança emitida hoje nesta seleção.'
        colunas={[
          { titulo: 'Paciente', render: (c) => c.paciente },
          { titulo: 'Procedimento', render: (c) => c.procedimento },
          { titulo: 'Valor de tabela', classe: 'text-end', render: (c) => moeda(c.valorTotal) },
          { titulo: 'Situação', render: (c) => <PilulaStatus {...rotuloDe(SITUACAO_TITULO, c.situacao)} /> },
          {
            titulo: '',
            render: (c) =>
              c.situacao === 'PAGA' ? (
                <button type='button' className='btn btn-link btn-sm p-0' onClick={() => navigate('/secretaria/listagem-recibos')}>
                  Recibo
                </button>
              ) : (
                <button type='button' className='btn btn-sm btn-outline-primary' onClick={() => navigate('/secretaria/checkout')}>
                  Receber
                </button>
              ),
          },
        ]}
      />
    </Pagina>
  );
}

export default CobrancasDoDia;
