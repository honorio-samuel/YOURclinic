import React from 'react';

import Card from '../components/card';
import FormGroup from '../components/form-group';
import Paginacao from '../components/paginacao';

import { useNavigate } from 'react-router-dom';

import axios from 'axios';
import { BASE_URL } from '../config/axios';

const ITENS_POR_PAGINA = 6;

const semAcento = (texto) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const soDigitos = (texto) => texto.replace(/\D/g, '');

async function buscarPacientes() {
  const [pacientes, pessoas, consultas] = await Promise.all([
    axios.get(`${BASE_URL}/pacientes`),
    axios.get(`${BASE_URL}/pessoas`),
    axios.get(`${BASE_URL}/consultas`, {
      params: { _sort: 'dataHora', _order: 'desc' },
    }),
  ]);

  // Paciente herda de pessoa pelo id; nome, CPF, nascimento e telefone ficam
  // em /pessoas.
  const pessoaPorId = Object.fromEntries(pessoas.data.map((p) => [p.id, p]));

  // O banco falso não guarda o tipo de atendimento no paciente. Ele sai do
  // convênio da consulta mais recente (a lista vem da mais nova para a mais
  // antiga).
  const tipoPorPaciente = {};
  consultas.data.forEach((consulta) => {
    if (!(consulta.idPaciente in tipoPorPaciente)) {
      tipoPorPaciente[consulta.idPaciente] = consulta.idConvenio
        ? 'Convênio'
        : 'Particular';
    }
  });

  return pacientes.data
    .map((paciente) => {
      const pessoa = pessoaPorId[paciente.id];

      return {
        id: paciente.id,
        nome: pessoa.nome,
        cpf: paciente.pendenteDeCpf ? 'Pendente de CPF' : pessoa.cpf,
        nascimento: pessoa.dataNascimento.split('-').reverse().join('/'),
        telefone: pessoa.telefone,
        tipo: tipoPorPaciente[paciente.id] ?? '—',
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

function ListagemCadastro() {
  const navigate = useNavigate();

  const cadastrar = () => {
    navigate(`/cadastro-pacientes`);
  };

  const abrir = (id) => {
    navigate(`/cadastro-pacientes/${id}`);
  };

  const [dados, setDados] = React.useState(null);
  const [erro, setErro] = React.useState(false);
  const [busca, setBusca] = React.useState('');
  const [pagina, setPagina] = React.useState(1);

  React.useEffect(() => {
    let ativo = true;

    buscarPacientes()
      .then((pacientes) => {
        if (ativo) setDados(pacientes);
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
      <Card title='Pacientes'>
        <div className='alert alert-danger mb-0' role='alert'>
          Não foi possível carregar os pacientes. Recarregue a página para
          tentar de novo.
        </div>
      </Card>
    );
  }

  const carregando = dados === null;
  const termo = semAcento(busca.trim());
  const digitos = soDigitos(busca);
  const filtrados = (dados ?? []).filter(
    (dado) =>
      semAcento(dado.nome).includes(termo) ||
      (digitos !== '' && soDigitos(dado.cpf ?? '').includes(digitos))
  );
  const totalPaginas = Math.max(
    1,
    Math.ceil(filtrados.length / ITENS_POR_PAGINA)
  );
  const inicio = (pagina - 1) * ITENS_POR_PAGINA;
  const dadosDaPagina = filtrados.slice(inicio, inicio + ITENS_POR_PAGINA);

  return (
    <Card title='Pacientes'>
      <p className='small text-body-secondary'>
        CPF é chave única e impede cadastro duplicado (RN-07.1). Nenhum campo
        de natureza clínica pode existir neste cadastro (RC02).
      </p>
      <div className='row g-3 align-items-end mb-3'>
        <div className='col-md-6'>
          <FormGroup label='Buscar por nome ou CPF' htmlFor='inputBusca'>
            <input
              type='search'
              id='inputBusca'
              className='form-control'
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setPagina(1);
              }}
            />
          </FormGroup>
        </div>
        <div className='col-auto'>
          <button
            type='button'
            className='btn btn-primary'
            onClick={() => cadastrar()}
          >
            + Novo paciente
          </button>
        </div>
      </div>
      <div className='table-responsive'>
        <table className='table table-hover align-middle'>
          <thead>
            <tr>
              <th scope='col'>Nome</th>
              <th scope='col'>CPF</th>
              <th scope='col'>Nascimento</th>
              <th scope='col'>Telefone</th>
              <th scope='col'>Tipo</th>
              <th scope='col'>Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando && (
              <tr>
                <td colSpan='6' className='text-center text-body-secondary'>
                  Carregando…
                </td>
              </tr>
            )}
            {!carregando && filtrados.length === 0 && (
              <tr>
                <td colSpan='6' className='text-center text-body-secondary'>
                  Nenhum paciente encontrado.
                </td>
              </tr>
            )}
            {dadosDaPagina.map((dado) => (
              <tr key={dado.id}>
                <td>{dado.nome}</td>
                <td>{dado.cpf}</td>
                <td>{dado.nascimento}</td>
                <td>{dado.telefone}</td>
                <td>{dado.tipo}</td>
                <td>
                  <button
                    type='button'
                    className='btn btn-link btn-sm p-0'
                    onClick={() => abrir(dado.id)}
                  >
                    Abrir
                  </button>
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

export default ListagemCadastro;
