import React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import Pagina from '../../components/pagina';
import { CampoSelecao, CampoTexto, Formulario, Rodape, Secao, useFormulario, useSairSemSalvar } from '../../components/formulario';
import { mensagemDeErro, useConfirmacao } from '../../components/confirmacao';
import { mensagemErro, mensagemSucesso } from '../../components/toastr';
import { DATA_DE_HOJE } from '../../config/axios';
import { criar, listar, pessoasPorId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { caminhoCadastro, prefixoDoPapel } from '../../navegacao/caminhos';
import { useSessao } from '../../sessao/sessao';
import { corresponde, diaMes, soDigitos } from '../../utils/formatos';
import { CANAL_ORIGEM, TIPO_ATENDIMENTO } from '../../utils/rotulos';
import { carregarMedicosAtivos, ERROS_DE_HORARIO } from './comum';
import EscolhaDeHorario from './escolha-de-horario';

const VAZIO = {
  busca: '',
  paciente: '',
  medico: '',
  procedimento: '',
  data: '',
  horario: '',
  atendimento: 'PARTICULAR',
  convenio: '',
  carteirinha: '',
  canal: 'RECEPCAO',
};

async function carregarEscolhas() {
  const [pacientes, medicos, procedimentos, convenios] = await Promise.all([
    listar('pacientes', { situacao: 'ATIVO' }),
    carregarMedicosAtivos(),
    listar('procedimentos', { situacao: 'ATIVO', _sort: 'nome' }),
    listar('convenios', { situacao: 'ATIVO', _sort: 'nome' }),
  ]);
  const pessoas = await pessoasPorId(pacientes.map((p) => p.id));
  return {
    pacientes: pacientes
      .filter((p) => pessoas[p.id])
      .map((p) => ({
        id: p.id,
        nome: p.nomeSocial ? `${p.nomeSocial} (${pessoas[p.id].nome})` : pessoas[p.id].nome,
        cpf: p.pendenteDeCpf ? null : pessoas[p.id].cpf,
        idConvenio: p.idConvenio,
        numeroCarteirinha: p.numeroCarteirinha,
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    medicos,
    procedimentos,
    convenios,
  };
}

// A-08a e S-03a · Novo agendamento (RF16, RF17). Busca o paciente por nome ou
// CPF (ou cadastra na hora), escolhe o médico primeiro e só mostra horários
// livres. A-08b e S-03b: se o horário for ocupado entre a escolha e a
// confirmação, avisa sem dizer por quem e relê os horários (RF18).
function CadastroAgendamento() {
  const { sessao } = useSessao();
  const papel = sessao.usuario.papel;
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const form = useFormulario({
    ...VAZIO,
    paciente: params.get('paciente') ?? '',
    medico: params.get('medico') ?? '',
    procedimento: params.get('procedimento') ?? '',
    data: params.get('data') ?? '',
    horario: params.get('hora') ?? '',
  });
  const { definir } = form;
  const v = form.valores;
  const [modal, confirmar] = useConfirmacao();
  const [salvando, setSalvando] = React.useState(false);
  const [conflito, setConflito] = React.useState(null);
  const [versaoHorarios, setVersaoHorarios] = React.useState(0);
  const { dados, carregando, erro, recarregar } = useCarregar(carregarEscolhas);
  const agenda = `${prefixoDoPapel(papel)}/agenda`;
  const sair = useSairSemSalvar(form.sujo, confirmar, () => navigate(agenda));

  // O convênio do cadastro vem sugerido; a escolha vale só para esta consulta (RF17).
  const sugerirConvenio = React.useCallback(
    (idPaciente) => {
      const p = dados?.pacientes.find((x) => String(x.id) === String(idPaciente));
      const ativo = p?.idConvenio && dados.convenios.some((c) => c.id === p.idConvenio);
      definir('atendimento', ativo ? 'CONVENIO' : 'PARTICULAR');
      definir('convenio', ativo ? String(p.idConvenio) : '');
      definir('carteirinha', ativo ? p.numeroCarteirinha ?? '' : '');
    },
    [dados, definir]
  );

  // Paciente que chega pela URL (cadastrado agora há pouco, por exemplo).
  const inicial = React.useRef(params.get('paciente'));
  React.useEffect(() => {
    if (dados && inicial.current) {
      sugerirConvenio(inicial.current);
      inicial.current = null;
    }
  }, [dados, sugerirConvenio]);

  const medico = dados?.medicos.find((m) => String(m.id) === v.medico);
  const paciente = dados?.pacientes.find((p) => String(p.id) === v.paciente);
  const daBusca = (dados?.pacientes ?? []).filter(
    (p) => String(p.id) === v.paciente || corresponde(v.busca, p.nome, p.cpf, soDigitos(p.cpf))
  );
  const convenio = v.atendimento === 'CONVENIO';

  // Trocar o médico tira o horário escolhido. Trocar o tipo muda a duração:
  // o horário fica se ainda couber, porque a lista relida tira o que não cabe.
  const mudaHorario = (nome, limpar = true) => ({
    ...form.campo(nome),
    aoMudar: (valor) => {
      definir(nome, valor);
      if (limpar) definir('horario', '');
      setConflito(null);
    },
  });

  const salvar = async (e) => {
    e.preventDefault();
    const ok = form.validar({
      paciente: v.paciente ? null : 'Escolha o paciente.',
      medico: v.medico ? null : 'Escolha o médico.',
      procedimento: v.procedimento ? null : 'Escolha o tipo de atendimento.',
      data: !v.data ? 'Escolha a data.' : v.data < DATA_DE_HOJE ? 'Escolha uma data a partir de hoje.' : null,
      horario: v.horario ? null : 'Escolha um horário livre.',
      convenio: convenio && !v.convenio ? 'Escolha o convênio.' : null,
      carteirinha: convenio && v.carteirinha.trim().length < 3 ? 'Informe o número da carteirinha.' : null,
    });
    if (!ok) return;
    setSalvando(true);
    try {
      await criar('consultas', {
        idPaciente: Number(v.paciente),
        idMedico: Number(v.medico),
        idProcedimento: Number(v.procedimento),
        dataHora: `${v.data}T${v.horario}:00`,
        status: 'AGENDADO',
        idConvenio: convenio ? Number(v.convenio) : null,
        numeroCarteirinha: convenio ? v.carteirinha.trim() : null,
        canalOrigem: v.canal,
      });
      mensagemSucesso(
        `Consulta agendada: ${paciente.nome}, ${diaMes(v.data)} às ${v.horario.replace(':', 'h')} com ${medico.nome}. O paciente recebe a confirmação.`
      );
      navigate(`${agenda}?visao=dia&data=${v.data}`);
    } catch (falha) {
      const mensagem = mensagemDeErro(falha);
      setSalvando(false);
      if (ERROS_DE_HORARIO.includes(mensagem)) {
        setConflito(mensagem);
        definir('horario', '');
        setVersaoHorarios((n) => n + 1);
        requestAnimationFrame(() => document.getElementById('campo-horario')?.focus());
      } else {
        mensagemErro(mensagem);
      }
    }
  };

  return (
    <Pagina titulo='Novo agendamento'>
      {erro ? (
        <div className='alert alert-danger d-flex flex-wrap align-items-center gap-2' role='alert'>
          Não foi possível carregar pacientes e médicos.
          <button type='button' className='btn btn-sm btn-outline-danger' onClick={recarregar}>
            Tentar de novo
          </button>
        </div>
      ) : carregando && !dados ? (
        <p className='text-body-secondary'>Carregando…</p>
      ) : (
        <Formulario
          aoEnviar={salvar}
          rotulo='Novo agendamento'
          rodape={<Rodape aoCancelar={sair} salvando={salvando} rotuloSalvar='Agendar' />}
        >
          <Secao titulo='Paciente'>
            <CampoTexto
              {...form.campo('busca')}
              rotulo='Buscar por nome ou CPF'
              tipo='search'
              opcional
              ajuda={v.busca ? `${daBusca.length} ${daBusca.length === 1 ? 'paciente encontrado' : 'pacientes encontrados'}.` : null}
            />
            <CampoSelecao
              {...form.campo('paciente')}
              aoMudar={(valor) => {
                definir('paciente', valor);
                sugerirConvenio(valor);
                setConflito(null);
              }}
              rotulo='Paciente'
              opcoes={daBusca.map((p) => [String(p.id), `${p.nome} · ${p.cpf ? `CPF ${p.cpf}` : 'CPF pendente'}`])}
            />
            <div className='col-12'>
              <Link to={`${caminhoCadastro(papel, 'pacientes')}?agendar`}>Paciente sem cadastro? Cadastrar agora</Link>
            </div>
          </Secao>
          <Secao titulo='Consulta'>
            <CampoSelecao
              {...mudaHorario('medico')}
              rotulo='Médico'
              opcoes={(dados?.medicos ?? []).map((m) => [String(m.id), `${m.nome} · ${m.especialidade}`])}
            />
            <CampoSelecao
              {...mudaHorario('procedimento', false)}
              rotulo='Tipo de atendimento'
              ajuda='O tipo define a duração e quantos horários seguidos a consulta ocupa.'
              opcoes={(dados?.procedimentos ?? []).map((p) => [String(p.id), `${p.nome} · ${p.duracaoPadrao} min`])}
            />
            {conflito && (
              <div className='col-12'>
                <div className='alert alert-warning mb-0' role='alert'>
                  {conflito} A lista de horários foi atualizada.
                </div>
              </div>
            )}
            <EscolhaDeHorario
              idData='campo-data'
              idHorario='campo-horario'
              idMedico={v.medico}
              idProcedimento={v.procedimento}
              data={v.data}
              aoMudarData={(valor) => {
                definir('data', valor);
                setConflito(null);
              }}
              horario={v.horario}
              aoMudarHorario={(valor) => definir('horario', valor)}
              erroData={form.erros.data}
              erroHorario={form.erros.horario}
              versao={versaoHorarios}
            />
          </Secao>
          <Secao titulo='Convênio e canal'>
            <CampoSelecao
              {...form.campo('atendimento')}
              rotulo='Atendimento'
              opcoes={Object.entries(TIPO_ATENDIMENTO)}
              ajuda='Vale só para esta consulta; o cadastro do paciente não muda.'
            />
            <CampoSelecao
              {...form.campo('canal')}
              rotulo='Canal'
              opcoes={['RECEPCAO', 'TELEFONE'].map((c) => [c, CANAL_ORIGEM[c]])}
            />
            {convenio && (
              <>
                <CampoSelecao
                  {...form.campo('convenio')}
                  rotulo='Convênio'
                  opcoes={(dados?.convenios ?? []).map((c) => [String(c.id), c.nome])}
                />
                <CampoTexto {...form.campo('carteirinha')} rotulo='Número da carteirinha' autoComplete='off' />
                <p className='col-12 small text-body-secondary mb-0'>
                  A consulta fica com o convênio a conferir até a recepção conferir a carteirinha. A verificação de
                  elegibilidade é opcional agora e pode ser feita em Faturamento TISS › Elegibilidade.
                </p>
              </>
            )}
          </Secao>
        </Formulario>
      )}
      {modal}
    </Pagina>
  );
}

export default CadastroAgendamento;
