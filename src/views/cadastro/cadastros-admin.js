import React from 'react';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import AcoesLinha from '../../components/acoes-linha';
import { CampoBusca, CampoSelect, Filtros } from '../../components/campos';
import { emBreve, useAlternarSituacao } from '../../components/confirmacao';
import { mensagemErro } from '../../components/toastr';
import { listar, porId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { corresponde, moeda, nomeMedico } from '../../utils/formatos';
import { PAPEIS, SITUACAO_CADASTRO, rotuloDe } from '../../utils/rotulos';

const OPCOES_STATUS = [['', 'Todos'], ['ATIVO', 'Ativos'], ['INATIVO', 'Inativos']];

// Coluna de status com a pílula Ativo ⇄ Inativo e a coluna de ações por situação.
function colunasDeSituacao(alternar, nomeDe, podeAlterar = () => true) {
  return [
    {
      titulo: 'Status',
      render: (l) => (
        <PilulaStatus
          {...rotuloDe(SITUACAO_CADASTRO, l.situacao)}
          transicoes={
            !podeAlterar(l) || !['ATIVO', 'INATIVO'].includes(l.situacao)
              ? null
              : [
                  l.situacao === 'ATIVO'
                    ? { rotulo: 'Inativar', aoEscolher: () => alternar(l, nomeDe(l), 'INATIVO') }
                    : { rotulo: 'Reativar', aoEscolher: () => alternar(l, nomeDe(l), 'ATIVO') },
                ]
          }
        />
      ),
    },
    {
      titulo: 'Ações',
      render: (l) => {
        const alvo = nomeDe(l);
        const ver = { tipo: 'ver', alvo, aoClicar: () => emBreve('O detalhe do cadastro') };
        if (!podeAlterar(l)) return <AcoesLinha acoes={[ver]} />;
        return (
          <AcoesLinha
            acoes={
              l.situacao === 'INATIVO'
                ? [ver, { tipo: 'reativar', alvo, aoClicar: () => alternar(l, alvo, 'ATIVO') }]
                : [
                    ver,
                    { tipo: 'editar', alvo, aoClicar: () => emBreve('A edição do cadastro') },
                    { tipo: 'inativar', alvo, aoClicar: () => alternar(l, alvo, 'INATIVO') },
                  ]
            }
          />
        );
      },
    },
  ];
}

const CONTA = {
  ATIVO: 'Ativa',
  INATIVO: 'Inativa',
  CONVITE_PENDENTE: 'Convite pendente',
};

// A-03 · Cadastro › Médicos.
export function Medicos() {
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

// A-04 · Cadastro › Equipe · usuários e papéis. Contas de Médico e de portal
// são só leitura aqui: o médico nasce em A-03 e o titular, por convite.
export function Equipe() {
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

// A-05 · Cadastro › Convênios.
export function Convenios() {
  const { dados, carregando, erro, recarregar } = useCarregar(() => listar('convenios', { _sort: 'nome' }));
  const [modal, alternar] = useAlternarSituacao('convenios', recarregar);
  const [busca, setBusca] = React.useState('');
  const [status, setStatus] = React.useState('');
  const linhas = (dados ?? []).filter(
    (c) => (!status || c.situacao === status) && corresponde(busca, c.nome, c.razaoSocial, c.registroAns)
  );

  return (
    <Pagina
      titulo='Convênios'
      acoes={
        <button type='button' className='btn btn-primary' onClick={() => emBreve('O cadastro de convênio')}>
          + Novo convênio
        </button>
      }
    >
      <Filtros>
        <CampoBusca id='buscaConvenio' rotulo='Buscar por nome ou operadora' valor={busca} aoMudar={setBusca} />
        <CampoSelect id='statusConvenio' rotulo='Status' valor={status} aoMudar={setStatus} opcoes={OPCOES_STATUS} />
      </Filtros>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={linhas}
        vazio='Nenhum convênio encontrado.'
        colunas={[
          { titulo: 'Nome', render: (c) => c.nome ?? c.razaoSocial },
          { titulo: 'Operadora', render: (c) => c.razaoSocial },
          { titulo: 'Registro ANS', render: (c) => c.registroAns },
          ...colunasDeSituacao(alternar, (c) => c.nome ?? c.razaoSocial),
        ]}
      />
      {modal}
    </Pagina>
  );
}

const TIPO_PROCEDIMENTO = { CONSULTA: 'Consulta', PROCEDIMENTO: 'Procedimento', EXAME: 'Exame' };

// A-06 · Cadastro › Procedimentos e preços. O preço negociado por operadora
// fica no contrato (A-20).
export function Procedimentos() {
  const { dados, carregando, erro, recarregar } = useCarregar(() => listar('procedimentos', { _sort: 'nome' }));
  const [modal, alternar] = useAlternarSituacao('procedimentos', recarregar);
  const [busca, setBusca] = React.useState('');
  const [tipo, setTipo] = React.useState('');
  const linhas = (dados ?? []).filter(
    (p) => (!tipo || p.tipo === tipo) && corresponde(busca, p.codigoInterno, p.codigo, p.nome)
  );

  return (
    <Pagina
      titulo='Procedimentos e preços'
      acoes={
        <button type='button' className='btn btn-primary' onClick={() => emBreve('O cadastro de procedimento')}>
          + Novo procedimento
        </button>
      }
    >
      <Filtros>
        <CampoBusca id='buscaProcedimento' rotulo='Buscar por código, TUSS ou descrição' valor={busca} aoMudar={setBusca} />
        <CampoSelect
          id='tipoProcedimento'
          rotulo='Tipo'
          valor={tipo}
          aoMudar={setTipo}
          opcoes={[['', 'Todos'], ...Object.entries(TIPO_PROCEDIMENTO)]}
        />
      </Filtros>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={linhas}
        vazio='Nenhum procedimento encontrado.'
        colunas={[
          { titulo: 'Código', render: (p) => p.codigoInterno ?? '—' },
          { titulo: 'TUSS', render: (p) => p.codigo },
          { titulo: 'Descrição', render: (p) => p.nome },
          { titulo: 'Duração', render: (p) => `${p.duracaoPadrao} min` },
          { titulo: 'Preço part.', classe: 'text-end', render: (p) => moeda(p.precoParticular) },
          ...colunasDeSituacao(alternar, (p) => p.nome),
        ]}
      />
      {modal}
    </Pagina>
  );
}
