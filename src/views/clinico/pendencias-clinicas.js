import React from 'react';
import { useNavigate } from 'react-router-dom';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import { emBreve } from '../../components/confirmacao';
import { listar, pessoasPorId, porId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { useSessao } from '../../sessao/sessao';
import { data } from '../../utils/formatos';

// M-06 · Pendências clínicas: o que outros papéis esperam do médico.
function PendenciasClinicas() {
  const { sessao } = useSessao();
  const navigate = useNavigate();
  const idMedico = sessao.usuario.idPessoa;
  const carregar = async () => {
    const [consultas, autorizacoes, recursos, glosas, guias, vinculos, procedimentos] = await Promise.all([
      listar('consultas', { idMedico }),
      listar('autorizacoes', { situacao: 'PENDENTE_JUSTIFICATIVA' }),
      listar('recursosGlosa'),
      listar('glosas'),
      listar('guiasTiss'),
      listar('vinculos', { idMedico }),
      listar('procedimentos'),
    ]);
    const consulta = porId(consultas);
    const glosa = porId(glosas);
    const guia = porId(guias);
    const proc = porId(procedimentos);
    const meusPacientes = vinculos.filter((v) => ['ATIVO', 'HISTORICO'].includes(v.estado)).map((v) => v.idPaciente);
    const anexos = meusPacientes.length ? await listar('anexos', { situacao: 'A_ACEITAR', idPaciente: meusPacientes }) : [];
    const aut = autorizacoes.filter((a) => consulta[a.idConsulta]).map((a) => ({ id: a.id, idPaciente: consulta[a.idConsulta].idPaciente, item: proc[consulta[a.idConsulta].idProcedimento]?.nome ?? '—', desde: a.dataSolicitacao }));
    const rec = recursos
      .filter((r) => r.aguardaFundamentacao && r.idMedico === idMedico)
      .map((r) => {
        const c = consulta[guia[glosa[r.idGlosa]?.idGuiaTiss]?.idConsulta];
        return { id: r.id, idPaciente: c?.idPaciente, item: proc[c?.idProcedimento]?.nome ?? '—', desde: glosa[r.idGlosa]?.dataDemonstrativo };
      });
    const exa = anexos.map((a) => ({ id: a.id, idPaciente: a.idPaciente, item: a.nomeArquivo, desde: a.dataEnvio }));
    const pessoas = await pessoasPorId([...aut, ...rec, ...exa].map((x) => x.idPaciente));
    const comNome = (lista) => lista.map((x) => ({ ...x, paciente: pessoas[x.idPaciente]?.nome ?? '—' }));
    return { aut: comNome(aut), rec: comNome(rec), exa: comNome(exa) };
  };
  const { dados, carregando, erro, recarregar } = useCarregar(carregar);
  const colunas = (rotuloItem, acao, aoClicar) => [
    { titulo: 'Paciente', render: (x) => x.paciente },
    { titulo: rotuloItem, render: (x) => x.item },
    { titulo: 'Desde', render: (x) => data(x.desde) },
    {
      titulo: '',
      render: (x) => (
        <button type='button' className='btn btn-sm btn-outline-primary' onClick={() => aoClicar(x)}>
          {acao}
        </button>
      ),
    },
  ];

  return (
    <Pagina titulo='Pendências clínicas'>
      <Listagem
        titulo='Autorizações prévias a justificar'
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={dados?.aut ?? []}
        vazio='Nenhuma autorização esperando justificativa.'
        colunas={colunas('Procedimento', 'Preencher', () => emBreve('A justificativa da autorização'))}
      />
      <Listagem
        titulo='Recursos de glosa a fundamentar'
        carregando={carregando}
        linhas={dados?.rec ?? []}
        vazio='Nenhum recurso esperando fundamentação.'
        colunas={colunas('Item glosado', 'Anexar', () => emBreve('A fundamentação do recurso'))}
      />
      <Listagem
        titulo='Exames enviados pelo titular'
        carregando={carregando}
        linhas={dados?.exa ?? []}
        vazio='Nenhum exame esperando avaliação.'
        colunas={colunas('Arquivo', 'Avaliar', (x) => navigate(`/medico/pacientes/${x.idPaciente}/anexos`))}
      />
    </Pagina>
  );
}

export default PendenciasClinicas;
