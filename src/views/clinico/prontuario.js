import React from 'react';
import { NavLink, useParams } from 'react-router-dom';

import Pagina from '../../components/pagina';
import { RegistroIndisponivel } from '../geral/avisos';
import { buscar, listar } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { useSessao } from '../../sessao/sessao';
import Prescricao from './prontuario-prescricao';
import AnexosClinicos from './prontuario-anexos';
import AnotacoesPrivadas from './prontuario-anotacoes';
import Exportacoes from './prontuario-exportacoes';

const ABAS = [
  ['anamnese', 'Anamnese'],
  ['prescricao', 'Prescrição'],
  ['anexos', 'Anexos'],
  ['anotacoes', 'Anotações privadas'],
  ['exportacoes', 'Exportações'],
];

// M-02 · Prontuário do paciente, em abas. Sem vínculo válido, a tela é a mesma
// de registro inexistente (G-08b).
function Prontuario() {
  const { sessao } = useSessao();
  const { id, aba = 'prescricao' } = useParams();
  const idPaciente = Number(id);
  const idMedico = sessao.usuario.idPessoa;
  const { dados, carregando, erro } = useCarregar(async () => {
    const [vinculos, pessoa] = await Promise.all([listar('vinculos', { idMedico, idPaciente }), buscar('pessoas', idPaciente)]);
    const valido = vinculos.some((v) => ['ATIVO', 'HISTORICO'].includes(v.estado));
    return { valido, nome: pessoa.nome };
  }, [idPaciente]);

  if (carregando) return <p className='text-body-secondary'>Carregando…</p>;
  if (erro || !dados?.valido) return <RegistroIndisponivel />;

  return (
    <Pagina titulo={`Prontuário · ${dados.nome}`}>
      <ul className='nav nav-tabs'>
        {ABAS.map(([chave, rotulo]) => (
          <li key={chave} className='nav-item'>
            <NavLink to={`/medico/pacientes/${idPaciente}/${chave}`} className={() => `nav-link ${aba === chave ? 'active' : ''}`}>
              {rotulo}
            </NavLink>
          </li>
        ))}
      </ul>
      {aba === 'anamnese' && (
        <div className='alert alert-info mb-0'>A anamnese e o registro selado entram numa próxima etapa; o desenho está no Figma (M-02b e M-02c).</div>
      )}
      {aba === 'prescricao' && <Prescricao idPaciente={idPaciente} />}
      {aba === 'anexos' && <AnexosClinicos idPaciente={idPaciente} />}
      {aba === 'anotacoes' && <AnotacoesPrivadas idPaciente={idPaciente} idMedico={idMedico} />}
      {aba === 'exportacoes' && <Exportacoes idPaciente={idPaciente} />}
    </Pagina>
  );
}

export default Prontuario;
