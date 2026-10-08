import React from 'react';

import Card from '../components/card';
import PilulaStatus from '../components/pilula-status';
import Paginacao from '../components/paginacao';

const ITENS_POR_PAGINA = 6;

// Dados de exemplo, até a tela ser ligada à API.
// "espera" é o tempo em minutos desde a chegada; null para quem não chegou.
const consultas = [
  { id: 1, paciente: 'Ana Beatriz Souza', horario: '08h00', medico: 'Dra. Helena Prado', status: 'FINALIZADO', espera: 12 },
  { id: 2, paciente: 'Bruno Carvalho', horario: '08h30', medico: 'Dr. Rafael Moura', status: 'NAO_COMPARECEU', espera: null },
  { id: 3, paciente: 'Camila Ferreira', horario: '09h00', medico: 'Dra. Helena Prado', status: 'EM_ATENDIMENTO', espera: 18 },
  { id: 4, paciente: 'Diego Martins', horario: '09h30', medico: 'Dra. Lívia Castro', status: 'NA_RECEPCAO', espera: 7 },
  { id: 5, paciente: 'Eduarda Lima', horario: '09h30', medico: 'Dr. Rafael Moura', status: 'CANCELADO', espera: null },
  { id: 6, paciente: 'Felipe Rocha', horario: '10h00', medico: 'Dra. Helena Prado', status: 'AGENDADO', espera: null },
  { id: 7, paciente: 'Gabriela Nunes', horario: '10h00', medico: 'Dra. Lívia Castro', status: 'NA_RECEPCAO', espera: 3 },
  { id: 8, paciente: 'Henrique Barbosa', horario: '10h30', medico: 'Dr. Rafael Moura', status: 'AGENDADO', espera: null },
  { id: 9, paciente: 'Isabela Teixeira', horario: '11h00', medico: 'Dra. Helena Prado', status: 'AGENDADO', espera: null },
  { id: 10, paciente: 'João Pedro Ribeiro', horario: '11h00', medico: 'Dra. Lívia Castro', status: 'CANCELADO', espera: null },
  { id: 11, paciente: 'Larissa Gomes', horario: '11h30', medico: 'Dr. Rafael Moura', status: 'AGENDADO', espera: null },
  { id: 12, paciente: 'Marcelo Azevedo', horario: '14h00', medico: 'Dra. Helena Prado', status: 'AGENDADO', espera: null },
  { id: 13, paciente: 'Natália Pires', horario: '14h30', medico: 'Dra. Lívia Castro', status: 'AGENDADO', espera: null },
  { id: 14, paciente: 'Otávio Mendes', horario: '15h00', medico: 'Dr. Rafael Moura', status: 'AGENDADO', espera: null },
];

function FilaDoDia() {
  const [pagina, setPagina] = React.useState(1);

  const totalPaginas = Math.ceil(consultas.length / ITENS_POR_PAGINA);
  const inicio = (pagina - 1) * ITENS_POR_PAGINA;
  const consultasDaPagina = consultas.slice(inicio, inicio + ITENS_POR_PAGINA);

  return (
    <Card title='Fila de atendimento do dia'>
      <p className='small text-body-secondary'>
        A fila exibe apenas status. Nenhuma coluna, ordenação, cor ou ícone
        pode derivar de conteúdo clínico (RN-22.2, RC02). Não Compareceu é
        marcado a partir de X10 de atraso. Atualiza em até X28 sem recarregar
        (RNF15).
      </p>
      <div className='table-responsive'>
        <table className='table table-hover align-middle'>
          <thead>
            <tr>
              <th scope='col'>Paciente</th>
              <th scope='col'>Horário</th>
              <th scope='col'>Médico</th>
              <th scope='col'>Status</th>
              <th scope='col'>Espera</th>
            </tr>
          </thead>
          <tbody>
            {consultasDaPagina.map((consulta) => (
              <tr key={consulta.id}>
                <td>{consulta.paciente}</td>
                <td>{consulta.horario}</td>
                <td>{consulta.medico}</td>
                <td>
                  <PilulaStatus estado={consulta.status} />
                </td>
                <td>
                  {consulta.espera === null ? '—' : `${consulta.espera} min`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Paginacao
        pagina={pagina}
        totalPaginas={totalPaginas}
        onMudarPagina={setPagina}
      />
    </Card>
  );
}

export default FilaDoDia;
