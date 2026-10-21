import React from 'react';
import { useNavigate } from 'react-router-dom';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import { CampoBusca, CampoSelect, Filtros } from '../../components/campos';
import { useAlternarSituacao } from '../../components/confirmacao';
import { mensagemErro, mostrarMensagem } from '../../components/toastr';
import { listar, porId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { caminhoCadastro, useCaminhosDaListagem } from '../../navegacao/caminhos';
import { corresponde } from '../../utils/formatos';
import { PAPEIS } from '../../utils/rotulos';
import { colunasDeSituacao } from './comum';

// A-04 · Cadastro › Equipe · usuários e papéis. Contas de Médico e de portal
// são só leitura aqui: o médico nasce em A-03 e o titular, por convite.
function Equipe() {
  const navigate = useNavigate();
  const caminhos = useCaminhosDaListagem('equipe');
  const carregar = async () => {
    const [usuarios, pessoas] = await Promise.all([listar('usuarios'), listar('pessoas')]);
    const pessoa = porId(pessoas);
    return usuarios
      .map((u) => ({ ...u, nome: pessoa[u.idPessoa]?.nome ?? '—', email: u.email ?? pessoa[u.idPessoa]?.email }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  };
  const { dados, carregando, erro, recarregar } = useCarregar(carregar);
  const [modal, alternarSituacao] = useAlternarSituacao('usuarios', recarregar);
  const [busca, setBusca] = React.useState('');
  const [papel, setPapel] = React.useState('');
  const gerenciavel = (u) => ['ADMINISTRADOR', 'SECRETARIA'].includes(u.papel);
  // Médico e paciente abrem o próprio cadastro; o responsável aparece no do paciente.
  const ver = (u) => {
    if (gerenciavel(u)) navigate(caminhos.ver(u.idPessoa));
    else if (u.papel === 'MEDICO') navigate(caminhoCadastro('ADMINISTRADOR', 'medicos', u.idPessoa, { consulta: true }));
    else if (u.papel === 'PACIENTE') navigate(caminhoCadastro('ADMINISTRADOR', 'pacientes', u.idPessoa, { consulta: true }));
    else mostrarMensagem('Responsável legal', 'Os dados do responsável ficam no cadastro do paciente que ele representa.', 'info');
  };

  // Recusa inativar o último Administrador ativo.
  const alternar = (u, nome, nova) => {
    const admins = (dados ?? []).filter((x) => x.papel === 'ADMINISTRADOR' && x.situacao === 'ATIVO');
    if (nova === 'INATIVO' && u.papel === 'ADMINISTRADOR' && admins.length <= 1) {
      mensagemErro('A clínica precisa de pelo menos um Administrador ativo.');
      return;
    }
    alternarSituacao(u, nome, nova);
  };

  const linhas = (dados ?? []).filter((u) => (!papel || u.papel === papel) && corresponde(busca, u.nome, u.email));

  return (
    <Pagina
      titulo='Equipe · usuários e papéis'
      acoes={
        <button type='button' className='btn btn-primary' onClick={() => navigate(caminhos.novo)}>
          + Novo usuário
        </button>
      }
    >
      <Filtros>
        <CampoBusca id='buscaUsuario' rotulo='Buscar por nome ou e-mail' valor={busca} aoMudar={setBusca} />
        <CampoSelect
          id='papelUsuario'
          rotulo='Papel'
          valor={papel}
          aoMudar={setPapel}
          opcoes={[['', 'Todos'], ...Object.entries(PAPEIS)]}
        />
      </Filtros>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={linhas}
        vazio='Nenhum usuário encontrado.'
        legenda='Contas de Médico são criadas em Médicos; contas de Paciente e de Responsável Legal, por convite.'
        colunas={[
          { titulo: 'Nome', render: (u) => u.nome },
          { titulo: 'E-mail', render: (u) => u.email },
          { titulo: 'Papel', render: (u) => PAPEIS[u.papel] },
          ...colunasDeSituacao(alternar, (u) => u.nome, {
            podeAlterar: gerenciavel,
            aoVer: ver,
            aoEditar: (u) => navigate(caminhos.editar(u.idPessoa)),
          }),
        ]}
      />
      {modal}
    </Pagina>
  );
}

export default Equipe;
