import React from 'react';
import { useNavigate } from 'react-router-dom';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import AcoesLinha from '../../components/acoes-linha';
import { CampoBusca, CampoSelect, Filtros } from '../../components/campos';
import { useAlternarSituacao } from '../../components/confirmacao';
import { listar, porId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { useSessao } from '../../sessao/sessao';
import { corresponde, data, soDigitos } from '../../utils/formatos';
import { SITUACAO_CADASTRO, rotuloDe } from '../../utils/rotulos';

async function carregarPacientes() {
  const [pacientes, pessoas] = await Promise.all([listar('pacientes'), listar('pessoas')]);
  const pessoa = porId(pessoas);
  return pacientes
    .filter((p) => pessoa[p.id])
    .map((p) => ({
      id: p.id,
      nome: p.nomeSocial ? `${p.nomeSocial} (${pessoa[p.id].nome})` : pessoa[p.id].nome,
      cpf: p.pendenteDeCpf ? 'CPF pendente' : pessoa[p.id].cpf,
      nascimento: pessoa[p.id].dataNascimento,
      telefone: pessoa[p.id].telefone,
      situacao: p.situacao,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

// A-02a e S-01a · Cadastro › Pacientes. Sem campo clínico e sem Observações
// Gerais (RC02); a pílula alterna Ativo e Inativo, sem Excluir.
function Pacientes() {
  const { sessao } = useSessao();
  const navigate = useNavigate();
  const ehSecretaria = sessao.usuario.papel === 'SECRETARIA';
  const { dados, carregando, erro, recarregar } = useCarregar(carregarPacientes);
  const [modal, alternar] = useAlternarSituacao('pacientes', recarregar);
  const [busca, setBusca] = React.useState('');
  const [status, setStatus] = React.useState('');

  const digitos = soDigitos(busca);
  const linhas = (dados ?? []).filter(
    (p) =>
      (!status || p.situacao === status) &&
      (corresponde(busca, p.nome) || (digitos.length >= 3 && soDigitos(p.cpf).includes(digitos)))
  );

  const base = ehSecretaria ? '/secretaria/pacientes' : '/admin/pacientes';
  const ver = (p) => navigate(`${base}/${p.id}`);

  return (
    <Pagina
      titulo='Pacientes'
      acoes={
        <button type='button' className='btn btn-primary' onClick={() => navigate(`${base}/novo`)}>
          + Novo paciente
        </button>
      }
    >
      <Filtros>
        <CampoBusca id='buscaPaciente' rotulo='Buscar por nome ou CPF' valor={busca} aoMudar={setBusca} />
        <CampoSelect
          id='statusPaciente'
          rotulo='Status'
          valor={status}
          aoMudar={setStatus}
          opcoes={[['', 'Todos'], ['ATIVO', 'Ativos'], ['INATIVO', 'Inativos']]}
        />
      </Filtros>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={linhas}
        vazio='Nenhum paciente encontrado.'
        colunas={[
          { titulo: 'Nome', render: (p) => p.nome },
          { titulo: 'CPF', render: (p) => p.cpf },
          { titulo: 'Nascimento', render: (p) => data(p.nascimento) },
          { titulo: 'Telefone', render: (p) => p.telefone },
          {
            titulo: 'Status',
            render: (p) => (
              <PilulaStatus
                {...rotuloDe(SITUACAO_CADASTRO, p.situacao)}
                transicoes={[
                  p.situacao === 'ATIVO'
                    ? { rotulo: 'Inativar', aoEscolher: () => alternar(p, p.nome, 'INATIVO') }
                    : { rotulo: 'Reativar', aoEscolher: () => alternar(p, p.nome, 'ATIVO') },
                ]}
              />
            ),
          },
          {
            titulo: 'Ações',
            render: (p) => (
              <AcoesLinha
                acoes={
                  p.situacao === 'ATIVO'
                    ? [
                        { tipo: 'ver', alvo: p.nome, aoClicar: () => ver(p) },
                        { tipo: 'editar', alvo: p.nome, aoClicar: () => navigate(`${base}/${p.id}/editar`) },
                        { tipo: 'inativar', alvo: p.nome, aoClicar: () => alternar(p, p.nome, 'INATIVO') },
                      ]
                    : [
                        { tipo: 'ver', alvo: p.nome, aoClicar: () => ver(p) },
                        { tipo: 'reativar', alvo: p.nome, aoClicar: () => alternar(p, p.nome, 'ATIVO') },
                      ]
                }
              />
            ),
          },
        ]}
      />
      {modal}
    </Pagina>
  );
}

export default Pacientes;
