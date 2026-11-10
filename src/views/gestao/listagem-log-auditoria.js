import React from 'react';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import { CampoSelect, Filtros } from '../../components/campos';
import { salvarComAviso, useConfirmacao } from '../../components/confirmacao';
import { DATA_DE_HOJE } from '../../config/axios';
import { listar, pessoasPorId, porId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { diaMesHora, nomeMedico } from '../../utils/formatos';
import { PAPEIS } from '../../utils/rotulos';

const ACAO_LOG = {
  LOGIN: 'Entrada no sistema',
  LOGOUT: 'Saída do sistema',
  LER: 'Leitura',
  CRIAR: 'Criação',
  EDITAR: 'Alteração',
  EXCLUIR: 'Exclusão',
  ALTERAR_SENHA: 'Troca de senha',
  SELECIONAR_REPRESENTADO: 'Escolha de representado',
  CONSULTAR: 'Consulta',
  ACESSO_NEGADO: 'Acesso negado',
  ACESSO_EXCECAO: 'Acesso de exceção',
  ACESSO_EXCECAO_ATIPICO: 'Acesso de exceção · atípico',
  ORCAMENTO_EXCECAO: 'Orçamento · exceção',
  EXPORTAR: 'Exportação',
  RETIFICAR: 'Retificação',
};
const COLECAO = {
  prontuarios: 'Prontuário',
  pacientes: 'Paciente',
  consultas: 'Consulta',
  vinculos: 'Vínculo',
  registrosClinicos: 'Registro clínico',
  orcamentos: 'Orçamento',
  usuarios: 'Usuário',
  relatorios: 'Relatório',
  anexos: 'Anexo',
};
const alvoLegivel = (alvo) => {
  if (!alvo) return '—';
  const [colecao, id] = alvo.split(/[:/]/);
  return `${COLECAO[colecao] ?? colecao}${id ? ` ${id}` : ''}`;
};

// A-31 · Log de auditoria (somente leitura) e acessos de exceção em curso, que o
// Administrador pode revogar antes do fim da janela.
function LogAuditoria() {
  const carregar = async () => {
    const [logs, usuarios, excecoes] = await Promise.all([listar('logsAuditoria', { _sort: 'dataHora', _order: 'desc' }), listar('usuarios'), listar('acessosExcecao')]);
    const usuario = porId(usuarios);
    const emCurso = excecoes.filter((e) => e.expiraEm && e.expiraEm > `${DATA_DE_HOJE}T00:00:00` && !e.revogado);
    const pessoas = await pessoasPorId([...usuarios.map((u) => u.idPessoa), ...emCurso.flatMap((e) => [e.idMedico, e.idPaciente])]);
    return {
      logs: logs.map((l) => ({ ...l, usuario: pessoas[usuario[l.idUsuario]?.idPessoa]?.nome ?? '—' })),
      emCurso: emCurso.map((e) => ({ ...e, medico: nomeMedico(pessoas[e.idMedico]), paciente: pessoas[e.idPaciente]?.nome ?? '—' })),
    };
  };
  const { dados, carregando, erro, recarregar } = useCarregar(carregar);
  const [modal, confirmar] = useConfirmacao();
  const [acao, setAcao] = React.useState('');
  const [papel, setPapel] = React.useState('');

  const revogar = async (e) => {
    const ok = await confirmar({ titulo: `Revogar o acesso de exceção de ${e.medico}?`, texto: `O acesso ao prontuário de ${e.paciente} termina agora. A revogação fica no log.`, rotuloConfirmar: 'Revogar', perigo: true });
    // Revogar é encurtar o prazo: o acesso termina agora.
    if (ok && (await salvarComAviso('acessosExcecao', e.id, { expiraEm: `${DATA_DE_HOJE}T00:00:00`, revisado: true }, 'Acesso de exceção revogado.'))) recarregar();
  };

  const logs = (dados?.logs ?? []).filter((l) => (!acao || l.acao === acao) && (!papel || l.papel === papel));
  return (
    <Pagina titulo='Log de auditoria'>
      <Filtros>
        <CampoSelect id='logPapel' rotulo='Papel' valor={papel} aoMudar={setPapel} opcoes={[['', 'Todos'], ...Object.entries(PAPEIS)]} />
        <CampoSelect id='logAcao' rotulo='Ação' valor={acao} aoMudar={setAcao} opcoes={[['', 'Todas'], ...Object.entries(ACAO_LOG)]} />
      </Filtros>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={logs}
        vazio='Nenhum registro nesta seleção.'
        colunas={[
          { titulo: 'Data e hora', render: (l) => diaMesHora(l.dataHora) },
          { titulo: 'Usuário', render: (l) => l.usuario },
          { titulo: 'Papel', render: (l) => PAPEIS[l.papel] ?? l.papel },
          { titulo: 'Ação', render: (l) => ACAO_LOG[l.acao] ?? l.acao },
          { titulo: 'Registro', render: (l) => alvoLegivel(l.registroAlvo) },
        ]}
      />
      <Listagem
        titulo='Acessos de exceção em curso'
        carregando={carregando}
        linhas={dados?.emCurso ?? []}
        vazio='Nenhum acesso de exceção em curso.'
        colunas={[
          { titulo: 'Médico', render: (e) => e.medico },
          { titulo: 'Paciente', render: (e) => e.paciente },
          { titulo: 'Expira em', render: (e) => diaMesHora(e.expiraEm) },
          {
            titulo: '',
            render: (e) => (
              <button type='button' className='btn btn-sm btn-outline-danger' onClick={() => revogar(e)}>
                Revogar
              </button>
            ),
          },
        ]}
      />
      {modal}
    </Pagina>
  );
}

export default LogAuditoria;
