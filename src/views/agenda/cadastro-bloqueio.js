import React from 'react';
import { useNavigate } from 'react-router-dom';

import Pagina from '../../components/pagina';
import { CampoSelecao, CampoTexto, Formulario, Rodape, Secao, useFormulario, useSairSemSalvar } from '../../components/formulario';
import { mensagemDeErro, useConfirmacao } from '../../components/confirmacao';
import { mensagemErro, mensagemSucesso } from '../../components/toastr';
import { RegistroIndisponivel } from '../geral/avisos';
import { buscar, criar, listar, pessoasPorId } from '../../servicos/dados';
import { atualizarSeMudou } from '../../servicos/pessoas';
import { useCarregar } from '../../hooks/use-carregar';
import { useCadastro } from '../../navegacao/caminhos';
import { nomeMedico } from '../../utils/formatos';
import { MOTIVO_BLOQUEIO } from '../../utils/rotulos';

const CLINICA = 'CLINICA';
const VAZIO = { medico: '', dataInicio: '', dataFim: '', motivo: '' };
// Consultas que o bloqueio atinge: as que ainda vão acontecer.
const ATINGIDAS = ['AGENDADO', 'NA_RECEPCAO'];

// O campo datetime-local usa "AAAA-MM-DDTHH:mm"; o banco guarda os segundos.
const paraCampo = (iso) => (iso ? iso.slice(0, 16) : '');
const paraBanco = (valor) => (valor ? `${valor}:00` : null);

async function contarAtingidas(v) {
  if (!v.medico || !v.dataInicio || !v.dataFim || v.dataFim <= v.dataInicio) return null;
  const consultas = await listar('consultas', {
    dataHora_gte: paraBanco(v.dataInicio),
    dataHora_lte: paraBanco(v.dataFim),
    ...(v.medico === CLINICA ? {} : { idMedico: v.medico }),
    _campos: 'status',
  });
  return consultas.filter((c) => ATINGIDAS.includes(c.status)).length;
}

// A-11a e S-05b · Cadastro de bloqueio de agenda (RF14). Motivo de lista
// fechada, sem motivo clínico. Sem médico, vale para a clínica inteira. As
// consultas atingidas são tratadas depois, na listagem (RF20).
function CadastroBloqueio() {
  const { id, consulta, listagem, editar } = useCadastro('bloqueios');
  const navigate = useNavigate();
  const form = useFormulario(VAZIO);
  const { carregar } = form;
  const [modal, confirmar] = useConfirmacao();
  const [salvando, setSalvando] = React.useState(false);
  const [atingidas, setAtingidas] = React.useState(null);

  const { dados, carregando, erro } = useCarregar(async () => {
    const [medicos, atual] = await Promise.all([listar('medicos', { situacao: 'ATIVO' }), id ? buscar('bloqueiosAgenda', id) : null]);
    const pessoas = await pessoasPorId(medicos.map((m) => m.id));
    // Em ordem de nome, sem contar o "Dr." ou "Dra.".
    const opcoes = medicos
      .sort((a, b) => (pessoas[a.id]?.nome ?? '').localeCompare(pessoas[b.id]?.nome ?? '', 'pt-BR'))
      .map((m) => [String(m.id), nomeMedico(pessoas[m.id])]);
    return { opcoes: [[CLINICA, 'Toda a clínica'], ...opcoes], atual };
  }, [id]);
  const atual = dados?.atual;

  React.useEffect(() => {
    if (atual) {
      carregar({
        medico: atual.idMedico ? String(atual.idMedico) : CLINICA,
        dataInicio: paraCampo(atual.dataInicio),
        dataFim: paraCampo(atual.dataFim),
        motivo: atual.motivo ?? '',
      });
    }
  }, [atual, carregar]);

  // Prévia das consultas atingidas, refeita quando médico ou período mudam.
  const v = form.valores;
  React.useEffect(() => {
    let ativo = true;
    contarAtingidas(v)
      .then((n) => ativo && setAtingidas(n))
      .catch(() => ativo && setAtingidas(null));
    return () => {
      ativo = false;
    };
  }, [v.medico, v.dataInicio, v.dataFim]); // eslint-disable-line react-hooks/exhaustive-deps

  const sair = useSairSemSalvar(form.sujo, confirmar, () => navigate(listagem));

  if (erro?.status === 404) return <RegistroIndisponivel />;

  const encerrado = Boolean(atual) && atual.situacao !== 'ATIVO';
  const leitura = consulta || encerrado;

  const salvar = async (e) => {
    e.preventDefault();
    const ok = form.validar({
      medico: v.medico ? null : 'Escolha o médico ou toda a clínica.',
      dataInicio: v.dataInicio ? null : 'Informe o início.',
      dataFim: !v.dataFim ? 'Informe o fim.' : v.dataInicio && v.dataFim <= v.dataInicio ? 'O fim vem depois do início.' : null,
      motivo: v.motivo ? null : 'Escolha o motivo.',
    });
    if (!ok) return;
    setSalvando(true);
    const campos = {
      idMedico: v.medico === CLINICA ? null : Number(v.medico),
      dataInicio: paraBanco(v.dataInicio),
      dataFim: paraBanco(v.dataFim),
      motivo: v.motivo,
      consultasAfetadas: atingidas ?? 0,
    };
    try {
      if (id) await atualizarSeMudou('bloqueiosAgenda', id, campos, atual);
      else await criar('bloqueiosAgenda', { ...campos, situacao: 'ATIVO' });
      mensagemSucesso(
        atingidas
          ? `Bloqueio salvo. ${atingidas} ${atingidas === 1 ? 'consulta precisa' : 'consultas precisam'} ser reagendada${atingidas === 1 ? '' : 's'}.`
          : 'Bloqueio salvo.'
      );
      navigate(listagem);
    } catch (falha) {
      mensagemErro(mensagemDeErro(falha));
      setSalvando(false);
    }
  };

  return (
    <Pagina
      titulo={id ? 'Bloqueio de agenda' : 'Novo bloqueio de agenda'}
      acoes={
        consulta &&
        !encerrado && (
          <button type='button' className='btn btn-primary' onClick={() => navigate(editar())}>
            Editar
          </button>
        )
      }
    >
      {carregando && !dados ? (
        <p className='text-body-secondary'>Carregando…</p>
      ) : (
        <Formulario
          aoEnviar={salvar}
          somenteLeitura={leitura}
          rotulo='Cadastro de bloqueio de agenda'
          rodape={<Rodape aoCancelar={sair} salvando={salvando} semSalvar={leitura} rotuloCancelar={leitura ? 'Voltar' : 'Cancelar'} />}
        >
          {encerrado && (
            <div className='alert alert-secondary mb-0' role='status'>
              Bloqueio inativo ou encerrado: não se edita.
            </div>
          )}
          <Secao>
            <CampoSelecao {...form.campo('medico')} rotulo='Médico' opcoes={dados?.opcoes ?? []} />
            <CampoSelecao {...form.campo('motivo')} rotulo='Motivo' opcoes={Object.entries(MOTIVO_BLOQUEIO)} />
            <CampoTexto {...form.campo('dataInicio')} tipo='datetime-local' rotulo='Início' />
            <CampoTexto {...form.campo('dataFim')} tipo='datetime-local' rotulo='Fim' min={v.dataInicio || undefined} />
          </Secao>
          <div aria-live='polite'>
            {atingidas > 0 && (
              <div className='alert alert-warning mb-0' role='status'>
                {atingidas} {atingidas === 1 ? 'consulta agendada será atingida' : 'consultas agendadas serão atingidas'} por este bloqueio e
                {atingidas === 1 ? ' precisará' : ' precisarão'} ser reagendada{atingidas === 1 ? '' : 's'}.
              </div>
            )}
            {atingidas === 0 && !leitura && <p className='text-body-secondary mb-0'>Nenhuma consulta agendada neste período.</p>}
          </div>
        </Formulario>
      )}
      {modal}
    </Pagina>
  );
}

export default CadastroBloqueio;
