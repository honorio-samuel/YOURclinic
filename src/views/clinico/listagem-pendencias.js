import React from 'react';
import { useNavigate } from 'react-router-dom';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import Modal from '../../components/modal';
import { CampoTexto, CampoTextoLongo, useFormulario } from '../../components/formulario';
import { salvarComAviso } from '../../components/confirmacao';
import { listar, pessoasPorId, porId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { useSessao } from '../../sessao/sessao';
import { data } from '../../utils/formatos';

// O texto clínico que o médico entrega: a justificativa da autorização (com o
// CID) ou a fundamentação do recurso de glosa. Fica só com ele (RC10).
function JanelaTextoClinico({ pendencia, tipo, aoFechar, aoSalvar }) {
  const autorizacao = tipo === 'autorizacao';
  const form = useFormulario({ texto: '', cid: pendencia.cid ?? '' }, 'clinico-');
  const [salvando, setSalvando] = React.useState(false);
  const salvar = async () => {
    if (!form.validar({ texto: form.valores.texto.trim().length >= 20 ? null : 'Escreva ao menos 20 caracteres.' })) return;
    setSalvando(true);
    const ok = autorizacao
      ? await salvarComAviso('autorizacoes', pendencia.id, { justificativa: form.valores.texto.trim(), cid: form.valores.cid.trim() || null }, 'Justificativa enviada. O pedido segue para a operadora.')
      : await salvarComAviso('recursosGlosa', pendencia.id, { fundamentacaoClinica: form.valores.texto.trim(), aguardaFundamentacao: false }, 'Fundamentação registrada. A recepção envia o recurso.');
    if (ok) aoSalvar();
    else setSalvando(false);
  };
  return (
    <Modal
      titulo={autorizacao ? `Justificar a autorização · ${pendencia.item}` : `Fundamentar o recurso · ${pendencia.item}`}
      aoFechar={aoFechar}
      largo
      rodape={
        <>
          <button type='button' className='btn btn-outline-secondary' onClick={aoFechar} disabled={salvando}>
            Voltar
          </button>
          <button type='button' className='btn btn-primary' onClick={salvar} disabled={salvando}>
            {salvando ? 'Enviando…' : 'Enviar'}
          </button>
        </>
      }
    >
      <form
        noValidate
        aria-label={autorizacao ? 'Justificativa da autorização' : 'Fundamentação do recurso'}
        className='row g-3'
        onSubmit={(e) => {
          e.preventDefault();
          salvar();
        }}
      >
        <p className='col-12 mb-0'>Paciente: {pendencia.paciente}. O texto fica com você; recepção e administração não o leem.</p>
        {autorizacao && <CampoTexto {...form.campo('cid')} rotulo='CID' opcional largura='col-sm-4' maxLength={8} />}
        <CampoTextoLongo
          {...form.campo('texto')}
          rotulo={autorizacao ? 'Justificativa clínica' : 'Fundamentação clínica'}
          linhas={5}
          ajuda={autorizacao ? 'Indicação clínica do procedimento para a operadora.' : 'Por que o item glosado era necessário, para a operadora rever.'}
        />
      </form>
    </Modal>
  );
}

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
    const aut = autorizacoes.filter((a) => consulta[a.idConsulta]).map((a) => ({ id: a.id, idPaciente: consulta[a.idConsulta].idPaciente, item: proc[consulta[a.idConsulta].idProcedimento]?.nome ?? '—', desde: a.dataSolicitacao, cid: a.cid }));
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
  const [aberta, setAberta] = React.useState(null);
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
        colunas={colunas('Procedimento', 'Preencher', (x) => setAberta({ tipo: 'autorizacao', pendencia: x }))}
      />
      <Listagem
        titulo='Recursos de glosa a fundamentar'
        carregando={carregando}
        linhas={dados?.rec ?? []}
        vazio='Nenhum recurso esperando fundamentação.'
        colunas={colunas('Item glosado', 'Fundamentar', (x) => setAberta({ tipo: 'recurso', pendencia: x }))}
      />
      <Listagem
        titulo='Exames enviados pelo titular'
        carregando={carregando}
        linhas={dados?.exa ?? []}
        vazio='Nenhum exame esperando avaliação.'
        colunas={colunas('Arquivo', 'Avaliar', (x) => navigate(`/medico/prontuario/${x.idPaciente}/anexos`))}
      />
      {aberta && (
        <JanelaTextoClinico
          tipo={aberta.tipo}
          pendencia={aberta.pendencia}
          aoFechar={() => setAberta(null)}
          aoSalvar={() => {
            setAberta(null);
            recarregar();
          }}
        />
      )}
    </Pagina>
  );
}

export default PendenciasClinicas;
