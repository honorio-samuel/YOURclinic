import React from 'react';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import { CampoBusca, CampoSelect, Filtros } from '../../components/campos';
import { emBreve, useAlternarSituacao } from '../../components/confirmacao';
import { mensagemErro } from '../../components/toastr';
import { listar, porId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { corresponde } from '../../utils/formatos';
import { PAPEIS } from '../../utils/rotulos';
import { colunasDeSituacao } from './comum';

// A-04 · Cadastro › Equipe · usuários e papéis. Contas de Médico e de portal
// são só leitura aqui: o médico nasce em A-03 e o titular, por convite.
function Equipe() {
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
        <button type='button' className='btn btn-primary' onClick={() => emBreve('O convite de novo usuário')}>
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
          ...colunasDeSituacao(alternar, (u) => u.nome, gerenciavel),
        ]}
      />
      {modal}
    </Pagina>
  );
}

export default Equipe;
