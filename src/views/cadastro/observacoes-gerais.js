import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import Pagina from '../../components/pagina';
import { CampoTextoLongo, Formulario, Rodape, Secao, useFormulario, useSairSemSalvar } from '../../components/formulario';
import { mensagemDeErro, useConfirmacao } from '../../components/confirmacao';
import { mensagemErro, mensagemSucesso } from '../../components/toastr';
import { RegistroIndisponivel } from '../geral/avisos';
import { atualizar, buscar } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import AbasPaciente from './abas-paciente';

// Os quatro pares de exemplo da RC07: o que é informação de recepção e o
// que é conteúdo clínico, que pertence ao prontuário.
const PERTENCE = [
  'Precisa de auxílio para chegar até a sala.',
  'Costuma chegar com atraso; agendar com folga.',
  'Prefere contato por mensagem.',
  'Vem acompanhado da filha, que assina a recepção.',
];
const NAO_PERTENCE = ['Dificuldade de marcha por sequela.', 'Paciente ansioso, evita consultas.', 'Déficit auditivo.', 'Quadro demencial.'];

const LIMITE = 500;

function Exemplos({ titulo, itens }) {
  return (
    <div className='col-md-6'>
      <div className='card h-100'>
        <div className='card-body'>
          <h2 className='h6'>{titulo}</h2>
          <ul className='small mb-0 ps-3'>
            {itens.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// S-01c · Observações Gerais do paciente (RF15, RC07). Só a Secretária vê e
// escreve; o Administrador nunca recebe este campo (A3-R17).
function ObservacoesGerais() {
  const { id } = useParams();
  const idPaciente = Number(id);
  const navigate = useNavigate();
  const form = useFormulario({ observacoesGerais: '' });
  const { carregar } = form;
  const [modal, confirmar] = useConfirmacao();
  const [salvando, setSalvando] = React.useState(false);

  const { dados, carregando, erro } = useCarregar(async () => {
    const [pessoa, paciente] = await Promise.all([buscar('pessoas', idPaciente), buscar('pacientes', idPaciente)]);
    return { nome: pessoa.nome, paciente };
  }, [idPaciente]);

  React.useEffect(() => {
    if (dados) carregar({ observacoesGerais: dados.paciente.observacoesGerais ?? '' });
  }, [dados, carregar]);

  const sair = useSairSemSalvar(form.sujo, confirmar, () => navigate(`/secretaria/pacientes/${idPaciente}`));

  if (erro?.status === 404) return <RegistroIndisponivel />;

  const texto = form.valores.observacoesGerais;
  const salvar = async (e) => {
    e.preventDefault();
    if (!form.validar({ observacoesGerais: texto.length > LIMITE ? `Use no máximo ${LIMITE} caracteres.` : null })) return;
    setSalvando(true);
    try {
      await atualizar('pacientes', idPaciente, { observacoesGerais: texto.trim() || null });
      mensagemSucesso('Observações salvas.');
      carregar({ observacoesGerais: texto.trim() });
    } catch (falha) {
      mensagemErro(mensagemDeErro(falha));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Pagina titulo={`Paciente · ${dados?.nome ?? '…'}`} tituloAba='Observações gerais'>
      <AbasPaciente id={idPaciente} ativa='observacoes' />
      <div className='alert alert-warning mb-0 d-flex gap-2' role='note'>
        <span aria-hidden='true'>⚠</span>
        <span>Use este campo só para informações de recepção. Conteúdo clínico pertence ao prontuário e é do médico.</span>
      </div>
      <div className='row g-3'>
        <Exemplos titulo='Pertence aqui' itens={PERTENCE} />
        <Exemplos titulo='Não pertence aqui' itens={NAO_PERTENCE} />
      </div>
      {carregando && !dados ? (
        <p className='text-body-secondary'>Carregando…</p>
      ) : (
        <Formulario
          aoEnviar={salvar}
          rotulo='Observações gerais'
          rodape={<Rodape aoCancelar={sair} salvando={salvando} rotuloSalvar='Salvar observações' />}
        >
          <Secao>
            <CampoTextoLongo
              {...form.campo('observacoesGerais')}
              rotulo='Observações gerais'
              opcional
              linhas={4}
              maxLength={LIMITE}
              ajuda={`${texto.length} de ${LIMITE} caracteres.`}
            />
          </Secao>
        </Formulario>
      )}
      {modal}
    </Pagina>
  );
}

export default ObservacoesGerais;
