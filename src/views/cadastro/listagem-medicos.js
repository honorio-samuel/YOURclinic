import React from 'react';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import { CampoBusca, CampoSelect, Filtros } from '../../components/campos';
import { emBreve, useAlternarSituacao } from '../../components/confirmacao';
import { listar, porId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { corresponde, nomeMedico } from '../../utils/formatos';
import { colunasDeSituacao, OPCOES_STATUS } from './comum';

const CONTA = {
  ATIVO: 'Ativa',
  INATIVO: 'Inativa',
  CONVITE_PENDENTE: 'Convite pendente',
};

// A-03 · Cadastro › Médicos.
function Medicos() {
  const carregar = async () => {
    const [medicos, pessoas, usuarios] = await Promise.all([
      listar('medicos'),
      listar('pessoas'),
      listar('usuarios', { papel: 'MEDICO' }),
    ]);
    const pessoa = porId(pessoas);
    const conta = Object.fromEntries(usuarios.map((u) => [u.idPessoa, u.situacao]));
    return medicos
      .map((m) => ({ ...m, nome: nomeMedico(pessoa[m.id]), conta: CONTA[conta[m.id]] ?? 'Sem conta' }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  };
  const { dados, carregando, erro, recarregar } = useCarregar(carregar);
  const [modal, alternar] = useAlternarSituacao('medicos', recarregar);
  const [busca, setBusca] = React.useState('');
  const [status, setStatus] = React.useState('');
  const linhas = (dados ?? []).filter(
    (m) => (!status || m.situacao === status) && corresponde(busca, m.nome, m.crm, m.ufCrm)
  );

  return (
    <Pagina
      titulo='Médicos'
      acoes={
        <button type='button' className='btn btn-primary' onClick={() => emBreve('O cadastro de médico')}>
          + Novo médico
        </button>
      }
    >
      <Filtros>
        <CampoBusca id='buscaMedico' rotulo='Buscar por nome ou registro' valor={busca} aoMudar={setBusca} />
        <CampoSelect id='statusMedico' rotulo='Status' valor={status} aoMudar={setStatus} opcoes={OPCOES_STATUS} />
      </Filtros>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={linhas}
        vazio='Nenhum médico encontrado.'
        colunas={[
          { titulo: 'Nome', render: (m) => m.nome },
          { titulo: 'Registro', render: (m) => `CRM ${m.crm}/${m.ufCrm}` },
          { titulo: 'Especialidade', render: (m) => m.especialidade },
          { titulo: 'Conta', render: (m) => m.conta },
          ...colunasDeSituacao(alternar, (m) => m.nome),
        ]}
      />
      {modal}
    </Pagina>
  );
}

export default Medicos;
