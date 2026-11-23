import { DATA_DE_HOJE } from '../../config/axios';
import { listar, pessoasPorId } from '../../servicos/dados';
import { nomeMedico } from '../../utils/formatos';

// Partes usadas por mais de uma tela desta pasta.

export const ENVIADO_POR = { MEDICO: 'Médico', SECRETARIA: 'Recepção', PACIENTE: 'Paciente', RESPONSAVEL_LEGAL: 'Responsável' };

// Campos do registro clínico (RF23), na ordem da tela.
export const CAMPOS_CLINICOS = [
  ['queixas', 'Queixas'],
  ['exameFisico', 'Exame físico geral'],
  ['diagnostico', 'Diagnóstico'],
  ['cid', 'CID'],
  ['conduta', 'Conduta'],
];
export const ROTULO_DO_CAMPO = { ...Object.fromEntries(CAMPOS_CLINICOS), prescricao: 'Prescrição' };

export const CLASSIFICACAO = { COMUM: 'Comum', ANTIMICROBIANO: 'Antimicrobiano', CONTROLE_ESPECIAL: 'Controle especial' };

// RF25, passo 3.
export const AVISO_CONTROLE_ESPECIAL =
  'Receita de controle especial: a validade legal depende de assinatura digital ICP-Brasil e da numeração do sistema nacional de controle de receituários, que este protótipo não emite.';

// "Agora" da clínica, como a API conta o acesso de exceção: o dia de
// referência com a hora do relógio ("AAAA-MM-DDTHH:mm:ss").
export const agoraLocal = () => `${DATA_DE_HOJE}T${new Date().toTimeString().slice(0, 8)}`;

// Acesso ao prontuário: vínculo Ativo ou Histórico, ou exceção vigente (RC05).
export async function acessoAoProntuario(idMedico, idPaciente) {
  const [vinculos, excecoes] = await Promise.all([
    listar('vinculos', { idMedico, idPaciente }),
    listar('acessosExcecao', { idPaciente, _sort: 'expiraEm', _order: 'desc' }),
  ]);
  const vinculo = vinculos.find((v) => ['ATIVO', 'HISTORICO'].includes(v.estado)) ?? null;
  const excecao = excecoes.find((a) => a.expiraEm > agoraLocal()) ?? null;
  return { vinculo, excecao, liberado: Boolean(vinculo || excecao) };
}

// Prontuário do paciente com os registros, as retificações e os autores.
export async function carregarRegistros(idPaciente) {
  const [prontuario] = await listar('prontuarios', { idPaciente });
  if (!prontuario) return { prontuario: null, registros: [] };
  const registros = await listar('registrosClinicos', { idProntuario: prontuario.id, _sort: 'dataHora', _order: 'desc' });
  const ids = registros.map((r) => r.id);
  const [retificacoes, consultas] = await Promise.all([
    ids.length ? listar('retificacoes', { idRegistroClinico: ids, _sort: 'dataHora' }) : [],
    ids.length ? listar('consultas', { id: registros.map((r) => r.idConsulta) }) : [],
  ]);
  const consultaDe = Object.fromEntries(consultas.map((c) => [c.id, c]));
  const autorDe = (r) => r.idMedico ?? consultaDe[r.idConsulta]?.idMedico ?? null;
  const pessoas = await pessoasPorId([...registros.map(autorDe), ...retificacoes.map((x) => x.idMedico)]);
  return {
    prontuario,
    registros: registros.map((r) => {
      const deste = retificacoes.filter((x) => x.idRegistroClinico === r.id);
      const vigente = (campo) => deste.filter((x) => x.campo === campo).at(-1)?.textoCorrigido ?? r[campo] ?? '';
      return {
        ...r,
        idAutor: autorDe(r),
        // Registro de outro médico da equipe: a consulta dele não chega até aqui.
        autor: autorDe(r) ? nomeMedico(pessoas[autorDe(r)]) : 'Outro médico da equipe',
        vigente: Object.fromEntries([...CAMPOS_CLINICOS.map(([c]) => [c, vigente(c)]), ['prescricao', vigente('prescricao')]]),
        retificacoes: deste.map((x) => ({ ...x, autor: nomeMedico(pessoas[x.idMedico ?? autorDe(r)]) })),
      };
    }),
  };
}
