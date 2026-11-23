import React from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';

import Pagina from '../../components/pagina';
import { buscar } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { useSessao } from '../../sessao/sessao';
import { hora } from '../../utils/formatos';
import Anamnese from './prontuario-anamnese';
import Prescricao from './prontuario-prescricao';
import AnexosClinicos from './prontuario-anexos';
import AnotacoesPrivadas from './prontuario-anotacoes';
import Exportacoes from './prontuario-exportacoes';
import JanelaExcecao from './acesso-excecao';
import { acessoAoProntuario } from './comum';

const ABAS = [
  ['anamnese', 'Anamnese'],
  ['prescricao', 'Prescrição'],
  ['anexos', 'Anexos'],
  ['anotacoes', 'Anotações privadas'],
  ['exportacoes', 'Exportações'],
];

// Sem vínculo nem exceção, a tela não mostra nada do prontuário e oferece o
// acesso de exceção (RF06, passo 1).
function SemAcesso({ paciente, aoLiberar }) {
  const [pedindo, setPedindo] = React.useState(false);
  return (
    <Pagina titulo='Prontuário indisponível' tituloAba='Prontuário'>
      <div className='alert alert-secondary mb-0' role='status'>
        Você não tem vínculo ativo com {paciente.nome}. Em situação assistencial que exija, peça o acesso de exceção: ele fica no log
        de auditoria e o Administrador é avisado.
      </div>
      <div>
        <button type='button' className='btn btn-primary' onClick={() => setPedindo(true)}>
          Pedir acesso de exceção
        </button>
      </div>
      {pedindo && (
        <JanelaExcecao
          paciente={paciente}
          aoFechar={() => setPedindo(false)}
          aoConcluir={() => {
            setPedindo(false);
            aoLiberar();
          }}
        />
      )}
    </Pagina>
  );
}

// M-02 · Prontuário do paciente, em abas. O acesso vem do vínculo Ativo ou
// Histórico, ou de uma exceção vigente (RC05); a API confere de novo a cada
// pedido.
function Prontuario() {
  const { sessao } = useSessao();
  const navigate = useNavigate();
  const { id, aba = 'anamnese' } = useParams();
  const idPaciente = Number(id);
  const idMedico = sessao.usuario.idPessoa;
  const { dados, carregando, erro, recarregar } = useCarregar(async () => {
    const [acesso, pessoa] = await Promise.all([acessoAoProntuario(idMedico, idPaciente), buscar('pessoas', idPaciente)]);
    return { ...acesso, nome: pessoa.nome };
  }, [idPaciente]);

  if (carregando && !dados) return <p className='text-body-secondary'>Carregando…</p>;
  if (erro || !dados) {
    return (
      <Pagina titulo='Prontuário indisponível' tituloAba='Prontuário'>
        <div className='alert alert-secondary mb-0'>Este prontuário não está disponível.</div>
        <div>
          <button type='button' className='btn btn-outline-secondary' onClick={() => navigate('/medico/listagem-pacientes')}>
            Voltar a Meus pacientes
          </button>
        </div>
      </Pagina>
    );
  }
  if (!dados.liberado) return <SemAcesso paciente={{ id: idPaciente, nome: dados.nome }} aoLiberar={recarregar} />;

  return (
    <Pagina titulo={`Prontuário · ${dados.nome}`} tituloAba='Prontuário'>
      {!dados.vinculo && dados.excecao && (
        <div className='alert alert-warning mb-0' role='status'>
          Acesso de exceção até {hora(dados.excecao.expiraEm)}. Tudo o que você fizer aqui fica marcado e no log de auditoria.
        </div>
      )}
      <ul className='nav nav-tabs'>
        {ABAS.map(([chave, rotulo]) => (
          <li key={chave} className='nav-item'>
            <NavLink
              to={`/medico/prontuario/${idPaciente}/${chave}`}
              className={() => `nav-link ${aba === chave ? 'active' : ''}`}
              aria-current={aba === chave ? 'page' : undefined}
            >
              {rotulo}
            </NavLink>
          </li>
        ))}
      </ul>
      {aba === 'anamnese' && <Anamnese idPaciente={idPaciente} idMedico={idMedico} />}
      {aba === 'prescricao' && <Prescricao idPaciente={idPaciente} idMedico={idMedico} />}
      {aba === 'anexos' && <AnexosClinicos idPaciente={idPaciente} />}
      {aba === 'anotacoes' && <AnotacoesPrivadas idPaciente={idPaciente} idMedico={idMedico} />}
      {aba === 'exportacoes' && <Exportacoes idPaciente={idPaciente} />}
    </Pagina>
  );
}

export default Prontuario;
