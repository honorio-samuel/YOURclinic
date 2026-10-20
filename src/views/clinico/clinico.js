import React from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import AcoesLinha from '../../components/acoes-linha';
import { CampoBusca, CampoSelect, Filtros } from '../../components/campos';
import { emBreve, salvarComAviso, useConfirmacao } from '../../components/confirmacao';
import { mensagemErro, mensagemSucesso } from '../../components/toastr';
import { RegistroIndisponivel } from '../geral/avisos';
import { api, DATA_DE_HOJE } from '../../config/axios';
import { buscar, listar, pessoasPorId, porId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { useSessao } from '../../sessao/sessao';
import { corresponde, data, diaMesHora, diasEntre } from '../../utils/formatos';
import { VINCULO, rotuloDe } from '../../utils/rotulos';

const JANELA_HISTORICO = 90; // dias (X06)

const ENVIADO_POR = { MEDICO: 'Médico', SECRETARIA: 'Recepção', PACIENTE: 'Paciente', RESPONSAVEL_LEGAL: 'Responsável' };

// Vínculos do médico com a última consulta finalizada de cada paciente.
async function carregarMeusPacientes(idMedico) {
  const [vinculos, consultas] = await Promise.all([listar('vinculos', { idMedico }), listar('consultas', { idMedico, status: 'FINALIZADO', _sort: 'dataHora', _order: 'desc' })]);
  const pessoas = await pessoasPorId(vinculos.map((v) => v.idPaciente));
  const ultima = {};
  for (const c of consultas) if (!ultima[c.idPaciente]) ultima[c.idPaciente] = c.dataHora;
  return vinculos
    .map((v) => {
      const restante = ultima[v.idPaciente] ? JANELA_HISTORICO - diasEntre(ultima[v.idPaciente], DATA_DE_HOJE) : null;
      const estado = v.estado === 'HISTORICO' && restante !== null && restante < 0 ? 'ENCERRADO' : v.estado;
      return { id: v.id, idPaciente: v.idPaciente, paciente: pessoas[v.idPaciente]?.nome ?? '—', ultima: ultima[v.idPaciente], estado, restante };
    })
    .sort((a, b) => a.paciente.localeCompare(b.paciente, 'pt-BR'));
}

// M-02a · Meus pacientes. Prontuário só com vínculo Ativo ou Histórico (RC05).
export function MeusPacientes() {
  const { sessao } = useSessao();
  const navigate = useNavigate();
  const { dados, carregando, erro, recarregar } = useCarregar(() => carregarMeusPacientes(sessao.usuario.idPessoa));
  const [busca, setBusca] = React.useState('');
  const [vinculo, setVinculo] = React.useState('');
  const linhas = (dados ?? []).filter((p) => corresponde(busca, p.paciente) && (!vinculo || p.estado === vinculo));

  return (
    <Pagina titulo='Meus pacientes'>
      <Filtros>
        <CampoBusca id='mpBusca' rotulo='Buscar paciente' valor={busca} aoMudar={setBusca} />
        <CampoSelect id='mpVinculo' rotulo='Vínculo' valor={vinculo} aoMudar={setVinculo} opcoes={[['', 'Todos'], ...Object.entries(VINCULO).map(([k, v]) => [k, v.rotulo])]} />
      </Filtros>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={linhas}
        vazio='Nenhum paciente nesta seleção.'
        colunas={[
          { titulo: 'Paciente', render: (p) => p.paciente },
          { titulo: 'Última consulta', render: (p) => data(p.ultima) },
          {
            titulo: 'Vínculo',
            render: (p) => {
              const r = rotuloDe(VINCULO, p.estado);
              return <PilulaStatus tom={r.tom} rotulo={p.estado === 'HISTORICO' ? `Histórico · ${p.restante} dias` : r.rotulo} />;
            },
          },
          {
            titulo: '',
            render: (p) =>
              ['ATIVO', 'HISTORICO'].includes(p.estado) ? (
                <button type='button' className='btn btn-link btn-sm p-0' onClick={() => navigate(`/medico/pacientes/${p.idPaciente}`)}>
                  Abrir prontuário
                </button>
              ) : (
                <button type='button' className='btn btn-link btn-sm p-0' onClick={() => emBreve('O pedido de acesso de exceção')}>
                  Pedir acesso de exceção
                </button>
              ),
          },
        ]}
      />
    </Pagina>
  );
}

const ABAS = [
  ['anamnese', 'Anamnese'],
  ['prescricao', 'Prescrição'],
  ['anexos', 'Anexos'],
  ['anotacoes', 'Anotações privadas'],
  ['exportacoes', 'Exportações'],
];

// M-02 · Prontuário do paciente, em abas. Sem vínculo válido, a tela é a mesma
// de registro inexistente (G-08b).
export function Prontuario() {
  const { sessao } = useSessao();
  const { id, aba = 'prescricao' } = useParams();
  const idPaciente = Number(id);
  const idMedico = sessao.usuario.idPessoa;
  const { dados, carregando, erro } = useCarregar(async () => {
    const [vinculos, pessoa] = await Promise.all([listar('vinculos', { idMedico, idPaciente }), buscar('pessoas', idPaciente)]);
    const valido = vinculos.some((v) => ['ATIVO', 'HISTORICO'].includes(v.estado));
    return { valido, nome: pessoa.nome };
  }, [idPaciente]);

  if (carregando) return <p className='text-body-secondary'>Carregando…</p>;
  if (erro || !dados?.valido) return <RegistroIndisponivel />;

  return (
    <Pagina titulo={`Prontuário · ${dados.nome}`}>
      <ul className='nav nav-tabs'>
        {ABAS.map(([chave, rotulo]) => (
          <li key={chave} className='nav-item'>
            <NavLink to={`/medico/pacientes/${idPaciente}/${chave}`} className={() => `nav-link ${aba === chave ? 'active' : ''}`}>
              {rotulo}
            </NavLink>
          </li>
        ))}
      </ul>
      {aba === 'anamnese' && (
        <div className='alert alert-info mb-0'>A anamnese e o registro selado entram numa próxima etapa; o desenho está no Figma (M-02b e M-02c).</div>
      )}
      {aba === 'prescricao' && <Prescricao idPaciente={idPaciente} />}
      {aba === 'anexos' && <AnexosClinicos idPaciente={idPaciente} />}
      {aba === 'anotacoes' && <AnotacoesPrivadas idPaciente={idPaciente} idMedico={idMedico} />}
      {aba === 'exportacoes' && <Exportacoes idPaciente={idPaciente} />}
    </Pagina>
  );
}

// M-02d · Prescrição. Item de controle especial aparece destacado.
function Prescricao({ idPaciente }) {
  const { dados, carregando, erro, recarregar } = useCarregar(async () => {
    const prescricoes = await listar('prescricoes', { idPaciente });
    if (prescricoes.length === 0) return [];
    const itens = await listar('itensPrescricao', { idPrescricao: prescricoes.map((p) => p.id) });
    const prescricao = porId(prescricoes);
    return itens.map((i) => ({ ...i, emissao: prescricao[i.idPrescricao]?.dataEmissao }));
  }, [idPaciente]);

  return (
    <>
      <div className='d-flex justify-content-end'>
        <button type='button' className='btn btn-primary' onClick={() => emBreve('A nova prescrição')}>
          + Nova prescrição
        </button>
      </div>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={dados ?? []}
        vazio='Nenhuma prescrição para este paciente.'
        colunas={[
          { titulo: 'Medicamento', render: (i) => `${i.medicamento} ${i.concentracao}` },
          { titulo: 'Posologia', render: (i) => i.posologia },
          { titulo: 'Emitida em', render: (i) => data(i.emissao) },
          {
            titulo: 'Classificação',
            render: (i) => (i.classificacao === 'CONTROLE_ESPECIAL' ? <PilulaStatus rotulo='Controle especial' tom='aviso' /> : 'Comum'),
          },
          {
            titulo: 'Ações',
            render: (i) => (
              <AcoesLinha
                acoes={[
                  { tipo: 'ver', alvo: i.medicamento, aoClicar: () => emBreve('A via de impressão') },
                  { tipo: 'editar', alvo: i.medicamento, aoClicar: () => emBreve('A edição da prescrição') },
                ]}
              />
            ),
          },
        ]}
      />
    </>
  );
}

const SITUACAO_ANEXO = {
  DISPONIVEL: { rotulo: 'Disponível', tom: 'sucesso' },
  A_ACEITAR: { rotulo: 'A aceitar', tom: 'aviso' },
  ACEITO: { rotulo: 'Aceito', tom: 'sucesso' },
  RECUSADO: { rotulo: 'Recusado', tom: 'neutro' },
};

// M-02e · Anexos. Exame enviado pelo titular fica pendente de aceite médico.
function AnexosClinicos({ idPaciente }) {
  const { dados, carregando, erro, recarregar } = useCarregar(() => listar('anexos', { idPaciente, _sort: 'dataEnvio', _order: 'desc' }), [idPaciente]);
  const mudar = async (a, situacao) => {
    if (await salvarComAviso('anexos', a.id, { situacao }, situacao === 'ACEITO' ? 'Exame aceito no prontuário.' : 'Exame recusado.')) recarregar();
  };
  return (
    <Listagem
      carregando={carregando}
      erro={erro}
      aoTentarDeNovo={recarregar}
      linhas={dados ?? []}
      vazio='Nenhum anexo para este paciente.'
      colunas={[
        { titulo: 'Arquivo', render: (a) => a.nomeArquivo },
        { titulo: 'Enviado em', render: (a) => data(a.dataEnvio) },
        { titulo: 'Enviado por', render: (a) => ENVIADO_POR[a.enviadoPor] ?? '—' },
        {
          titulo: 'Situação',
          render: (a) => (
            <PilulaStatus
              {...rotuloDe(SITUACAO_ANEXO, a.situacao)}
              transicoes={a.situacao === 'A_ACEITAR' ? [{ rotulo: 'Aceitar', aoEscolher: () => mudar(a, 'ACEITO') }, { rotulo: 'Recusar', aoEscolher: () => mudar(a, 'RECUSADO') }] : null}
            />
          ),
        },
        {
          titulo: 'Ações',
          render: (a) => (
            <AcoesLinha
              acoes={[
                { tipo: 'ver', alvo: a.nomeArquivo, aoClicar: () => emBreve('A visualização do anexo') },
                { tipo: 'baixar', alvo: a.nomeArquivo, aoClicar: () => emBreve('O download do anexo') },
              ]}
            />
          ),
        },
      ]}
    />
  );
}

// M-02f · Anotações privadas: só o autor vê, edita e exclui (D2).
function AnotacoesPrivadas({ idPaciente, idMedico }) {
  const { dados, carregando, erro, recarregar } = useCarregar(
    () => listar('anotacoesPrivadas', { idPaciente, idMedico, _sort: 'dataHora', _order: 'desc' }),
    [idPaciente, idMedico]
  );
  const [modal, confirmar] = useConfirmacao();
  const excluir = async (a) => {
    const ok = await confirmar({ titulo: 'Excluir esta anotação?', texto: 'Só você a vê. A exclusão não pode ser desfeita.', rotuloConfirmar: 'Excluir', perigo: true });
    if (!ok) return;
    try {
      await api.delete(`/anotacoesPrivadas/${a.id}`);
      mensagemSucesso('Anotação excluída.');
      recarregar();
    } catch (e) {
      mensagemErro('Não foi possível excluir agora. Tente de novo.');
    }
  };
  return (
    <>
      <div className='d-flex flex-wrap justify-content-between align-items-center gap-2'>
        <div className='alert alert-info mb-0 py-2'>Só você vê estas anotações. Elas nunca entram em exportações.</div>
        <button type='button' className='btn btn-primary' onClick={() => emBreve('A nova anotação')}>
          + Nova anotação
        </button>
      </div>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={dados ?? []}
        vazio='Você não tem anotações sobre este paciente.'
        colunas={[
          { titulo: 'Data', render: (a) => data(a.dataHora) },
          { titulo: 'Anotação', render: (a) => a.texto },
          {
            titulo: 'Ações',
            render: (a) => (
              <AcoesLinha
                acoes={[
                  { tipo: 'editar', alvo: `anotação de ${data(a.dataHora)}`, aoClicar: () => emBreve('A edição da anotação') },
                  { tipo: 'excluir', alvo: `anotação de ${data(a.dataHora)}`, aoClicar: () => excluir(a) },
                ]}
              />
            ),
          },
        ]}
      />
      {modal}
    </>
  );
}

const TIPO_EXPORTACAO = {
  PRONTUARIO_COMPLETO: 'Prontuário completo',
  PRONTUARIO: 'Prontuário completo',
  HISTORICO_ATENDIMENTOS: 'Histórico de atendimentos',
  HISTORICO: 'Histórico de atendimentos',
};

// M-02g · Exportações (RF29, RF30). Anotações privadas nunca entram (RC04).
function Exportacoes({ idPaciente }) {
  const { dados, carregando, erro, recarregar } = useCarregar(
    () => listar('exportacoes', { idPaciente, _sort: 'dataSolicitacao', _order: 'desc' }),
    [idPaciente]
  );
  const pronto = (e) => ['CONCLUIDA', 'PRONTO'].includes(e.situacao);
  return (
    <>
      <div className='d-flex flex-wrap justify-content-end gap-2'>
        <button type='button' className='btn btn-outline-primary' onClick={() => emBreve('A exportação do histórico')}>
          Exportar histórico
        </button>
        <button type='button' className='btn btn-primary' onClick={() => emBreve('A exportação do prontuário completo')}>
          Exportar prontuário completo
        </button>
      </div>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={dados ?? []}
        vazio='Nenhuma exportação pedida.'
        colunas={[
          { titulo: 'Documento', render: (e) => TIPO_EXPORTACAO[e.tipo] ?? e.tipo },
          { titulo: 'Pedido em', render: (e) => diaMesHora(e.dataSolicitacao) },
          { titulo: 'Situação', render: (e) => <PilulaStatus rotulo={pronto(e) ? 'Pronto' : 'Gerando'} tom={pronto(e) ? 'sucesso' : 'info'} /> },
          {
            titulo: 'Ações',
            render: (e) =>
              !pronto(e) ? null : <AcoesLinha acoes={[{ tipo: 'baixar', alvo: TIPO_EXPORTACAO[e.tipo], aoClicar: () => emBreve('O download pelo link que expira') }]} />,
          },
        ]}
      />
    </>
  );
}

// M-06 · Pendências clínicas: o que outros papéis esperam do médico.
export function PendenciasClinicas() {
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

const SITUACAO_ANEXO_RECEPCAO = {
  DISPONIVEL: { rotulo: 'Disponível ao médico', tom: 'sucesso' },
  A_ACEITAR: { rotulo: 'Aguardando o médico', tom: 'aviso' },
  ACEITO: { rotulo: 'Aceito pelo médico', tom: 'sucesso' },
  RECUSADO: { rotulo: 'Recusado pelo médico', tom: 'neutro' },
};

// S-01d · Paciente · anexos, só metadados. Sem conteúdo, sem miniatura e sem Baixar.
export function AnexosRecepcao() {
  const { id } = useParams();
  const idPaciente = Number(id);
  const { dados, carregando, erro, recarregar } = useCarregar(async () => {
    const [pessoa, anexos] = await Promise.all([buscar('pessoas', idPaciente), listar('anexos', { idPaciente, _sort: 'dataEnvio', _order: 'desc' })]);
    return { nome: pessoa.nome, anexos };
  }, [idPaciente]);

  if (erro?.status === 404) return <RegistroIndisponivel />;
  return (
    <Pagina
      titulo={`Paciente · ${dados?.nome ?? '…'}`}
      acoes={
        <button type='button' className='btn btn-primary' onClick={() => emBreve('O envio de arquivo')}>
          Enviar arquivo
        </button>
      }
    >
      <div className='alert alert-info mb-0' role='status'>
        O conteúdo dos anexos é do médico e do paciente. Aqui aparecem só os dados de envio.
      </div>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={dados?.anexos ?? []}
        vazio='Nenhum anexo enviado para este paciente.'
        colunas={[
          { titulo: 'Arquivo', render: (a) => a.nomeArquivo },
          { titulo: 'Enviado em', render: (a) => data(a.dataEnvio) },
          { titulo: 'Enviado por', render: (a) => ENVIADO_POR[a.enviadoPor] ?? '—' },
          { titulo: 'Situação', render: (a) => <PilulaStatus {...rotuloDe(SITUACAO_ANEXO_RECEPCAO, a.situacao)} /> },
        ]}
      />
    </Pagina>
  );
}
