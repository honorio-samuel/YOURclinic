import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import Pagina from '../../components/pagina';
import PilulaStatus from '../../components/pilula-status';
import {
  CampoMarcar,
  CampoSelecao,
  CampoTexto,
  CampoTextoLongo,
  Formulario,
  Rodape,
  Secao,
  useFormulario,
  useSairSemSalvar,
} from '../../components/formulario';
import { mensagemDeErro, useConfirmacao } from '../../components/confirmacao';
import { mensagemErro, mensagemSucesso } from '../../components/toastr';
import { RegistroIndisponivel } from '../geral/avisos';
import { DATA_DE_HOJE } from '../../config/axios';
import { criar, listar } from '../../servicos/dados';
import { convidar } from '../../servicos/pessoas';
import { carregarPaciente, encerrarRepresentacao, PACIENTE_VAZIO, salvarPaciente } from '../../servicos/pacientes';
import { useCarregar } from '../../hooks/use-carregar';
import { useSessao } from '../../sessao/sessao';
import { soDigitos } from '../../utils/formatos';
import {
  erroCpf,
  erroData,
  erroEmail,
  erroNomeCompleto,
  erroTelefone,
  idade,
  mascararCpf,
  mascararTelefone,
} from '../../utils/mascaras';
import { CONTA, rotuloDe, TIPO_ATENDIMENTO } from '../../utils/rotulos';
import AbasPaciente from './abas-paciente';
import SecaoResponsavel from './secao-responsavel';
import PedidoTitular from './pedido-titular';

function validar(v, temRepresentacao) {
  const erros = {
    nome: erroNomeCompleto(v.nome),
    cpf: v.semCpf ? null : erroCpf(v.cpf),
    justificativaSemCpf:
      v.semCpf && v.justificativaSemCpf.trim().length < 10 ? 'Explique, em pelo menos 10 caracteres, por que falta o CPF.' : null,
    dataNascimento: erroData(v.dataNascimento),
    telefone: erroTelefone(v.telefone),
    email: erroEmail(v.email),
    idConvenio: v.tipoAtendimento === 'CONVENIO' && !v.idConvenio ? 'Escolha o convênio.' : null,
    numeroCarteirinha:
      v.tipoAtendimento === 'CONVENIO' && v.numeroCarteirinha.trim().length < 3 ? 'Informe o número da carteirinha.' : null,
  };
  if (v.representado && !temRepresentacao) {
    erros.respNome = erroNomeCompleto(v.respNome);
    erros.respCpf =
      erroCpf(v.respCpf) ?? (!v.semCpf && soDigitos(v.respCpf) === soDigitos(v.cpf) ? 'O CPF do responsável é o mesmo do paciente.' : null);
  }
  if (v.representado) {
    erros.grauParentesco = v.grauParentesco ? null : 'Escolha o grau de parentesco.';
    erros.natureza = v.natureza ? null : 'Escolha a natureza da representação.';
    erros.respEmail = erroEmail(v.respEmail);
  }
  return erros;
}

// A-02b e S-01b · Cadastro do paciente: novo, consulta e edição. O
// Administrador não vê Observações Gerais nem anexos (A3-R17), então não tem
// abas; a Secretária não encerra a representação nem lê as contas de acesso.
function CadastroPaciente({ modo }) {
  const { id: idTexto } = useParams();
  const id = idTexto ? Number(idTexto) : null;
  const { sessao } = useSessao();
  const navigate = useNavigate();
  const ehSecretaria = sessao.usuario.papel === 'SECRETARIA';
  const base = ehSecretaria ? '/secretaria/pacientes' : '/admin/pacientes';
  const leitura = modo === 'ver';
  const form = useFormulario(PACIENTE_VAZIO);
  const { carregar } = form;
  const [modal, confirmar] = useConfirmacao();
  const [salvando, setSalvando] = React.useState(false);
  const [pedidoAberto, setPedidoAberto] = React.useState(false);

  const { dados, carregando, erro, recarregar } = useCarregar(async () => {
    const [convenios, cadastro] = await Promise.all([
      listar('convenios', { _sort: 'nome' }),
      id ? carregarPaciente(id, { comContas: !ehSecretaria }) : null,
    ]);
    return { convenios, cadastro };
  }, [id]);

  React.useEffect(() => {
    if (dados?.cadastro) carregar(dados.cadastro.valores);
  }, [dados, carregar]);

  const v = form.valores;
  const original = dados?.cadastro?.original;
  const representacao = original?.representacao ?? null;
  const menorDeIdade = (idade(v.dataNascimento) ?? 99) < 18;
  const inativo = original?.paciente.situacao === 'INATIVO';
  const { definir } = form;

  // Menor de 18 anos sempre tem responsável legal.
  React.useEffect(() => {
    if (menorDeIdade && !leitura) definir('representado', true);
  }, [menorDeIdade, leitura, definir]);

  const sair = useSairSemSalvar(form.sujo, confirmar, () => navigate(id && !leitura ? `${base}/${id}` : base));

  if (erro?.status === 404) return <RegistroIndisponivel />;

  const salvar = async (e) => {
    e.preventDefault();
    if (!form.validar(validar(v, Boolean(representacao)))) return;
    setSalvando(true);
    try {
      const idSalvo = await salvarPaciente(id, v, original);
      mensagemSucesso(id ? 'Cadastro atualizado.' : 'Paciente cadastrado.');
      navigate(`${base}/${idSalvo}`);
    } catch (falha) {
      mensagemErro(mensagemDeErro(falha));
      if (falha.idCriado) navigate(`${base}/${falha.idCriado}/editar`);
      setSalvando(false);
    }
  };

  // Convite do portal: ao responsável quando há representação; senão, ao paciente.
  const convidarPortal = async () => {
    const pelaRepresentacao = Boolean(representacao);
    const alvo = pelaRepresentacao
      ? { idPessoa: original.responsavel.id, nome: original.responsavel.nome, email: original.responsavel.email, papel: 'RESPONSAVEL_LEGAL' }
      : { idPessoa: id, nome: original.pessoa.nome, email: original.pessoa.email, papel: 'PACIENTE' };
    if (!alvo.email) {
      mensagemErro(`Cadastre o e-mail ${pelaRepresentacao ? 'do responsável' : 'do paciente'} antes de convidar.`);
      return;
    }
    const ok = await confirmar({
      titulo: 'Convidar para o portal?',
      texto: `O convite vai para ${alvo.email}. ${pelaRepresentacao ? 'O responsável legal' : 'O paciente'} define a senha pelo link do convite.`,
      rotuloConfirmar: 'Enviar convite',
    });
    if (!ok) return;
    try {
      await convidar(alvo);
      mensagemSucesso(`Convite enviado para ${alvo.email}.`);
      recarregar();
    } catch (falha) {
      mensagemErro(mensagemDeErro(falha));
    }
  };

  // RF29: o histórico sai em PDF, sem conteúdo clínico.
  const pedirHistorico = async () => {
    try {
      await criar('exportacoes', {
        tipo: 'HISTORICO',
        formato: 'PDF',
        dataSolicitacao: `${DATA_DE_HOJE}T${new Date().toTimeString().slice(0, 8)}`,
        idProntuario: null,
        idSolicitacaoTitular: null,
        idPaciente: id,
      });
      mensagemSucesso('Histórico pedido. O PDF fica pronto em alguns minutos.');
    } catch (falha) {
      mensagemErro(mensagemDeErro(falha));
    }
  };

  const encerrar = async () => {
    const ok = await confirmar({
      titulo: 'Encerrar a representação?',
      texto: `${original.responsavel.nome} deixa de agir em nome do paciente no portal a partir de hoje. O histórico da representação fica guardado.`,
      rotuloConfirmar: 'Encerrar',
      perigo: true,
    });
    if (!ok) return;
    try {
      await encerrarRepresentacao(representacao);
      mensagemSucesso('Representação encerrada.');
      recarregar();
    } catch (falha) {
      mensagemErro(mensagemDeErro(falha));
    }
  };

  const contaPortal = representacao ? dados?.cadastro?.contaResponsavel : dados?.cadastro?.contaPaciente;
  const titulo = id ? `Paciente · ${original?.pessoa.nome ?? '…'}` : 'Novo paciente';
  const opcoesConvenio = (dados?.convenios ?? [])
    .filter((c) => c.situacao === 'ATIVO' || String(c.id) === v.idConvenio)
    .map((c) => [String(c.id), c.nome ?? c.razaoSocial]);

  return (
    <Pagina
      titulo={titulo}
      tituloAba={id ? 'Cadastro do paciente' : 'Novo paciente'}
      acoes={
        leitura &&
        !inativo && (
          <button type='button' className='btn btn-primary' onClick={() => navigate(`${base}/${id}/editar`)}>
            Editar
          </button>
        )
      }
    >
      {ehSecretaria && <AbasPaciente id={id} ativa='dados' />}
      {carregando && !dados ? (
        <p className='text-body-secondary'>Carregando…</p>
      ) : (
        <Formulario
          aoEnviar={salvar}
          somenteLeitura={leitura}
          rotulo='Cadastro do paciente'
          rodape={
            <>
              <Rodape
                aoCancelar={sair}
                salvando={salvando}
                semSalvar={leitura}
                rotuloCancelar={leitura ? 'Voltar' : 'Cancelar'}
                esquerda={
                  id &&
                  !inativo && (
                    <>
                      <button type='button' className='btn btn-outline-primary' onClick={convidarPortal} disabled={salvando}>
                        Convidar para o portal
                      </button>
                      <button type='button' className='btn btn-outline-primary' onClick={pedirHistorico} disabled={salvando}>
                        Baixar histórico
                      </button>
                    </>
                  )
                }
              />
              {id && !ehSecretaria && (
                <p className='mb-0 d-flex align-items-center gap-2'>
                  Acesso ao portal{representacao ? ' (responsável)' : ''}:
                  {contaPortal ? <PilulaStatus {...rotuloDe(CONTA, contaPortal.situacao)} /> : <span>sem conta</span>}
                </p>
              )}
              {id && ehSecretaria && !inativo && (
                <button type='button' className='btn btn-link p-0 align-self-start' onClick={() => setPedidoAberto(true)}>
                  Registrar pedido do titular (acesso, correção, portabilidade, revogação)
                </button>
              )}
            </>
          }
        >
          {inativo && (
            <div className='alert alert-secondary mb-0' role='status'>
              Paciente inativo. Para editar, reative o cadastro na lista de pacientes.
            </div>
          )}
          <Secao>
            <CampoTexto {...form.campo('nome')} rotulo='Nome completo' autoComplete='off' />
            <CampoTexto
              {...form.campo('cpf', mascararCpf)}
              rotulo='CPF'
              inputMode='numeric'
              placeholder='000.000.000-00'
              disabled={v.semCpf}
              opcional={v.semCpf}
            />
            <CampoTexto {...form.campo('dataNascimento')} tipo='date' rotulo='Data de nascimento' max={DATA_DE_HOJE} />
            <CampoTexto
              {...form.campo('telefone', mascararTelefone)}
              tipo='tel'
              rotulo='Telefone'
              inputMode='numeric'
              placeholder='(00) 00000-0000'
            />
            <CampoTexto {...form.campo('email')} tipo='email' rotulo='E-mail' opcional ajuda='Necessário para o convite do portal.' />
            <CampoSelecao {...form.campo('tipoAtendimento')} rotulo='Tipo de atendimento' opcoes={Object.entries(TIPO_ATENDIMENTO)} />
            {v.tipoAtendimento === 'CONVENIO' && (
              <>
                <CampoSelecao {...form.campo('idConvenio')} rotulo='Convênio' opcoes={opcoesConvenio} />
                <CampoTexto {...form.campo('numeroCarteirinha')} rotulo='Número da carteirinha' autoComplete='off' />
              </>
            )}
            <CampoTexto {...form.campo('nomeSocial')} rotulo='Nome social' opcional autoComplete='off' />
            <CampoMarcar {...form.marcar('semCpf')} rotulo='Paciente sem CPF: cadastro por exceção justificada' />
            {v.semCpf && (
              <CampoTextoLongo
                {...form.campo('justificativaSemCpf')}
                rotulo='Por que o CPF não foi informado'
                linhas={2}
                ajuda='O CPF fica pendente e aparece assim na lista de pacientes.'
              />
            )}
            <CampoMarcar
              {...form.marcar('representado')}
              rotulo='Paciente menor de idade ou legalmente incapaz'
              disabled={menorDeIdade || Boolean(representacao)}
              ajuda={menorDeIdade ? 'Menor de 18 anos: o responsável legal é obrigatório.' : undefined}
            />
          </Secao>
          {v.representado && (
            <SecaoResponsavel
              form={form}
              existente={original?.responsavel && representacao ? original.responsavel : null}
              podeEncerrar={!ehSecretaria && !leitura && Boolean(representacao)}
              aoEncerrar={encerrar}
            />
          )}
        </Formulario>
      )}
      {pedidoAberto && <PedidoTitular idPaciente={id} aoFechar={() => setPedidoAberto(false)} />}
      {modal}
    </Pagina>
  );
}

export default CadastroPaciente;
