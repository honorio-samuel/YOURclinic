import { DATA_DE_HOJE } from '../config/axios';
import { atualizar, buscar, criar, listar } from './dados';
import { atualizarSeMudou, ErroDeCadastro, garantirPapel, pessoaParaNovoCadastro, pessoaPorCpf } from './pessoas';
import { mascararCpf } from '../utils/mascaras';

// Cadastro do paciente (A-02b e S-01b): pessoa, paciente e, quando há, o
// responsável legal com a representação em vigor (RF07, RF08).

export const PACIENTE_VAZIO = {
  nome: '',
  nomeSocial: '',
  cpf: '',
  dataNascimento: '',
  telefone: '',
  email: '',
  tipoAtendimento: 'PARTICULAR',
  idConvenio: '',
  numeroCarteirinha: '',
  semCpf: false,
  justificativaSemCpf: '',
  representado: false,
  respNome: '',
  respCpf: '',
  respEmail: '',
  grauParentesco: '',
  natureza: '',
};

const vigente = (r) => (!r.inicioVigencia || r.inicioVigencia <= DATA_DE_HOJE) && (!r.fimVigencia || r.fimVigencia >= DATA_DE_HOJE);

// Carrega o cadastro e devolve os valores do formulário mais o original, para
// gravar só o que mudou. "comContas" (Administrador) traz a situação do portal.
export async function carregarPaciente(id, { comContas }) {
  const [pessoa, paciente, representacoes] = await Promise.all([
    buscar('pessoas', id),
    buscar('pacientes', id),
    listar('representacoes', { idPaciente: id }),
  ]);
  const representacao = representacoes.find(vigente) ?? null;
  const responsavel = representacao ? await buscar('pessoas', representacao.idResponsavelLegal) : null;
  let contas = [];
  if (comContas) {
    contas = await listar('usuarios', { idPessoa: [id, responsavel?.id].filter(Boolean) });
  }
  const valores = {
    nome: pessoa.nome ?? '',
    nomeSocial: paciente.nomeSocial ?? '',
    cpf: pessoa.cpf ?? '',
    dataNascimento: pessoa.dataNascimento ?? '',
    telefone: pessoa.telefone ?? '',
    email: pessoa.email ?? '',
    tipoAtendimento: paciente.tipoAtendimento ?? 'PARTICULAR',
    idConvenio: paciente.idConvenio ? String(paciente.idConvenio) : '',
    numeroCarteirinha: paciente.numeroCarteirinha ?? '',
    semCpf: Boolean(paciente.pendenteDeCpf),
    justificativaSemCpf: paciente.justificativaSemCpf ?? '',
    representado: Boolean(representacao),
    respNome: responsavel?.nome ?? '',
    respCpf: responsavel?.cpf ?? '',
    respEmail: responsavel?.email ?? '',
    grauParentesco: representacao?.grauParentesco ?? '',
    natureza: representacao?.natureza ?? '',
  };
  return {
    valores,
    original: { pessoa, paciente, representacao, responsavel },
    contaPaciente: contas.find((c) => c.idPessoa === id) ?? null,
    contaResponsavel: responsavel ? contas.find((c) => c.idPessoa === responsavel.id) ?? null : null,
  };
}

function dadosDaPessoa(v) {
  return {
    nome: v.nome.trim(),
    cpf: v.semCpf ? null : mascararCpf(v.cpf),
    dataNascimento: v.dataNascimento,
    telefone: v.telefone,
    email: v.email.trim() || null,
  };
}

function dadosDoPaciente(v) {
  const convenio = v.tipoAtendimento === 'CONVENIO';
  return {
    nomeSocial: v.nomeSocial.trim() || null,
    pendenteDeCpf: v.semCpf,
    justificativaSemCpf: v.semCpf ? v.justificativaSemCpf.trim() : null,
    tipoAtendimento: v.tipoAtendimento,
    idConvenio: convenio ? Number(v.idConvenio) : null,
    numeroCarteirinha: convenio ? v.numeroCarteirinha.trim() : null,
  };
}

// Responsável que já tem cadastro (outro filho, por exemplo) é reaproveitado
// pelo CPF; o nome digitado só vale para quem ainda não existe.
async function registrarRepresentacao(idPaciente, v) {
  const cpf = mascararCpf(v.respCpf);
  let responsavel = await pessoaPorCpf(cpf);
  if (responsavel?.id === idPaciente) throw new ErroDeCadastro('O responsável não pode ser o próprio paciente.');
  if (!responsavel) {
    responsavel = await criar('pessoas', { nome: v.respNome.trim(), cpf, email: v.respEmail.trim() || null });
  } else if (v.respEmail.trim() && !responsavel.email) {
    await atualizar('pessoas', responsavel.id, { email: v.respEmail.trim() });
  }
  await garantirPapel('responsaveisLegais', responsavel.id, { documentoComprobatorio: null, situacao: 'ATIVO' });
  await criar('representacoes', {
    idPaciente,
    idResponsavelLegal: responsavel.id,
    grauParentesco: v.grauParentesco,
    natureza: v.natureza,
    inicioVigencia: DATA_DE_HOJE,
    fimVigencia: null,
    documento: null,
  });
}

// Grava o cadastro. Devolve o id do paciente.
export async function salvarPaciente(id, v, original) {
  if (!id) {
    const idPessoa = await pessoaParaNovoCadastro('pacientes', dadosDaPessoa(v), 'um paciente');
    await criar('pacientes', { id: idPessoa, situacao: 'ATIVO', ...dadosDoPaciente(v) });
    if (v.representado) {
      try {
        await registrarRepresentacao(idPessoa, v);
      } catch (e) {
        // O paciente já existe: a tela abre a edição para completar o responsável.
        const motivo = e.mensagemParaUsuario ?? e.response?.data?.erro ?? 'tente de novo';
        const erro = new ErroDeCadastro(`O paciente foi cadastrado, mas o responsável não: ${motivo}`);
        erro.idCriado = idPessoa;
        throw erro;
      }
    }
    return idPessoa;
  }
  await atualizarSeMudou('pessoas', id, dadosDaPessoa(v), original.pessoa);
  await atualizarSeMudou('pacientes', id, dadosDoPaciente(v), original.paciente);
  if (original.representacao) {
    await atualizarSeMudou(
      'representacoes',
      original.representacao.id,
      { grauParentesco: v.grauParentesco, natureza: v.natureza },
      original.representacao
    );
    if (v.respEmail.trim() !== (original.responsavel?.email ?? '')) {
      await atualizar('pessoas', original.responsavel.id, { email: v.respEmail.trim() || null });
    }
  } else if (v.representado) {
    await registrarRepresentacao(id, v);
  }
  return id;
}

// A-02b: só o Administrador encerra a representação. Encerrada hoje, o
// último dia de vigência é ontem.
export function encerrarRepresentacao(representacao) {
  const ontem = new Date(`${DATA_DE_HOJE}T00:00:00Z`);
  ontem.setUTCDate(ontem.getUTCDate() - 1);
  return atualizar('representacoes', representacao.id, { fimVigencia: ontem.toISOString().slice(0, 10) });
}
