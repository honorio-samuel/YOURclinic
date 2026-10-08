import React from 'react';

import Card from '../components/card';
import PilulaStatus from '../components/pilula-status';
import Paginacao from '../components/paginacao';

import axios from 'axios';
import { BASE_URL, DATA_DE_HOJE } from '../config/axios';

const ITENS_POR_PAGINA = 6;

async function buscarFila() {
  const { data: consultas } = await axios.get(`${BASE_URL}/consultas`, {
    params: {
      dataHora_gte: `${DATA_DE_HOJE}T00:00:00`,
      dataHora_lte: `${DATA_DE_HOJE}T23:59:59`,
      _sort: 'dataHora',
    },
  });

  if (consultas.length === 0) {
    return [];
  }

  // Paciente e médico herdam de pessoa pelo id; o nome fica em /pessoas.
  const ids = [
    ...new Set(consultas.flatMap((c) => [c.idPaciente, c.idMedico])),
  ];
  const { data: pessoas } = await axios.get(`${BASE_URL}/pessoas`, {
    params: { id: ids },
    paramsSerializer: { indexes: null },
  });
  const nomes = Object.fromEntries(pessoas.map((p) => [p.id, p.nome]));

  return consultas.map((consulta) => ({
    id: consulta.id,
    paciente: nomes[consulta.idPaciente],
    horario: consulta.dataHora.slice(11, 16).replace(':', 'h'),
    medico: nomes[consulta.idMedico],
    status: consulta.status,
  }));
}

function ListagemFilaDia() {
  const [consultas, setConsultas] = React.useState(null);
  const [erro, setErro] = React.useState(false);
  const [pagina, setPagina] = React.useState(1);

  React.useEffect(() => {
    let ativo = true;

    buscarFila()
      .then((fila) => {
        if (ativo) setConsultas(fila);
      })
      .catch(() => {
        if (ativo) setErro(true);
      });

    return () => {
      ativo = false;
    };
  }, []);

  if (erro) {
    return (
      <Card title='Fila de atendimento do dia'>
        <div className='alert alert-danger mb-0' role='alert'>
          Não foi possível carregar a fila de atendimento. Recarregue a página
          para tentar de novo.
        </div>
      </Card>
    );
  }

  const carregando = consultas === null;
  const fila = consultas ?? [];
  const totalPaginas = Math.max(1, Math.ceil(fila.length / ITENS_POR_PAGINA));
  const inicio = (pagina - 1) * ITENS_POR_PAGINA;
  const consultasDaPagina = fila.slice(inicio, inicio + ITENS_POR_PAGINA);

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
            {carregando && (
              <tr>
                <td colSpan='5' className='text-center text-body-secondary'>
                  Carregando…
                </td>
              </tr>
            )}
            {!carregando && fila.length === 0 && (
              <tr>
                <td colSpan='5' className='text-center text-body-secondary'>
                  Nenhuma consulta marcada para hoje.
                </td>
              </tr>
            )}
            {consultasDaPagina.map((consulta) => (
              <tr key={consulta.id}>
                <td>{consulta.paciente}</td>
                <td>{consulta.horario}</td>
                <td>{consulta.medico}</td>
                <td>
                  <PilulaStatus estado={consulta.status} />
                </td>
                {/* A API ainda não informa a hora de chegada do paciente. */}
                <td>—</td>
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

export default ListagemFilaDia;
