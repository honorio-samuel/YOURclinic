import React from 'react';
import { Link } from 'react-router-dom';

import Modal from '../../components/modal';
import PilulaStatus from '../../components/pilula-status';
import EstadoErro from '../../components/estado-erro';
import { CampoSelecao, CampoTextoLongo, useFormulario } from '../../components/formulario';
import { mensagemDeErro } from '../../components/confirmacao';
import { mensagemErro, mensagemSucesso } from '../../components/toastr';
import { atualizar, criar, listar } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { data, diaMesHora, hora } from '../../utils/formatos';
import { CAMPOS_CLINICOS, carregarRegistros, ROTULO_DO_CAMPO } from './comum';

const ESPERA_DO_RASCUNHO = 1200;
const VAZIO = Object.fromEntries(CAMPOS_CLINICOS.map(([c]) => [c, '']));

async function carregar(idPaciente, idMedico) {
  const [{ registros }, emAtendimento] = await Promise.all([
    carregarRegistros(idPaciente),
    listar('consultas', { idPaciente, idMedico, status: 'EM_ATENDIMENTO' }),
  ]);
  const consulta = emAtendimento[0] ?? null;
  const daConsulta = consulta ? registros.find((r) => r.idConsulta === consulta.id) ?? null : null;
  return { registros, consulta, daConsulta };
}

// M-02b · Registro da consulta em atendimento. O rascunho é salvo sozinho
// enquanto o médico digita (RF23, passo 4). Se a gravação falhar, o texto
// continua na tela (E1); se a consulta tiver sido finalizada por outro
// caminho, o que já estava salvo foi selado e o resto vai por retificação (E2).
function RegistroEmEdicao({ consulta, registro, aoSelar }) {
  const [valores, setValores] = React.useState(() =>
    registro ? Object.fromEntries(CAMPOS_CLINICOS.map(([c]) => [c, registro[c] ?? ''])) : VAZIO
  );
  const [estado, setEstado] = React.useState({ tipo: registro ? 'salvo' : 'novo', texto: '' });
  const [bloqueado, setBloqueado] = React.useState(false);
  // Refs: uma gravação por vez, sempre com o texto e o id mais recentes.
  const pendente = React.useRef(false);
  const emCurso = React.useRef(false);
  const idRegistro = React.useRef(registro?.id ?? null);
  const texto = React.useRef(valores);
  texto.current = valores;
  const salvarDeNovo = React.useRef(null);

  const salvar = React.useCallback(async () => {
    if (!pendente.current || emCurso.current) return;
    emCurso.current = true;
    pendente.current = false;
    setEstado({ tipo: 'salvando', texto: 'Salvando…' });
    try {
      if (idRegistro.current) await atualizar('registrosClinicos', idRegistro.current, texto.current);
      else idRegistro.current = (await criar('registrosClinicos', { idConsulta: consulta.id, ...texto.current })).id;
      const agora = new Date();
      setEstado({ tipo: 'salvo', texto: `Rascunho salvo às ${String(agora.getHours()).padStart(2, '0')}h${String(agora.getMinutes()).padStart(2, '0')}.` });
    } catch (e) {
      if (e.response?.status === 409) {
        setBloqueado(true);
        setEstado({
          tipo: 'erro',
          texto: 'A consulta saiu de atendimento e o registro foi selado com o que estava salvo. O texto abaixo não entrou: use Retificar no registro selado.',
        });
        return;
      }
      pendente.current = true;
      setEstado({ tipo: 'erro', texto: `${mensagemDeErro(e)} O texto continua aqui; tente salvar de novo.` });
      return;
    } finally {
      emCurso.current = false;
    }
    // O que foi digitado durante a gravação vai na seguinte.
    if (pendente.current) setTimeout(() => salvarDeNovo.current?.(), 0);
  }, [consulta.id]);
  salvarDeNovo.current = salvar;

  // Salva um pouco depois da última tecla, e ao sair da aba.
  React.useEffect(() => {
    if (!pendente.current) return undefined;
    const espera = setTimeout(salvar, ESPERA_DO_RASCUNHO);
    return () => clearTimeout(espera);
  }, [valores, salvar]);
  React.useEffect(() => () => salvar(), [salvar]);

  const mudar = (campo, texto) => {
    pendente.current = true;
    setValores((atual) => ({ ...atual, [campo]: texto }));
  };

  return (
    <section className='card card-body' aria-labelledby='registroAtual'>
      <div className='d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2'>
        <h2 id='registroAtual' className='h5 mb-0'>
          Consulta em atendimento · {diaMesHora(consulta.dataHora)}
        </h2>
        <PilulaStatus rotulo='Em edição' tom='info' />
      </div>
      <form noValidate aria-label='Registro clínico da consulta' onSubmit={(e) => e.preventDefault()}>
        <fieldset disabled={bloqueado} className='row g-3'>
          {CAMPOS_CLINICOS.map(([campo, rotulo]) => (
            <CampoTextoLongo
              key={campo}
              id={`registro-${campo}`}
              rotulo={rotulo}
              valor={valores[campo]}
              aoMudar={(texto) => mudar(campo, texto)}
              opcional
              linhas={campo === 'cid' ? 1 : 3}
            />
          ))}
        </fieldset>
      </form>
      <div className='d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3'>
        <p className={`mb-0 small ${estado.tipo === 'erro' ? 'text-danger' : 'text-body-secondary'}`} role='status' aria-live='polite'>
          {estado.tipo === 'novo' ? 'O registro começa a ser salvo quando você escrever.' : estado.texto}
        </p>
        <div className='d-flex flex-wrap gap-2'>
          {!bloqueado && (
            <button
              type='button'
              className='btn btn-outline-primary btn-sm'
              onClick={() => {
                pendente.current = true;
                salvar();
              }}
            >
              Salvar agora
            </button>
          )}
          {bloqueado ? (
            <button type='button' className='btn btn-primary btn-sm' onClick={aoSelar}>
              Ver o registro selado
            </button>
          ) : (
            <Link to='/medico/listagem-atendimentos' className='btn btn-primary btn-sm'>
              Finalizar em Atendimentos do dia
            </Link>
          )}
        </div>
      </div>
      <p className='small text-body-secondary mb-0 mt-2'>Ao finalizar a consulta, o registro é selado e só muda por retificação.</p>
    </section>
  );
}

// M-02c · Registro selado, na versão vigente, com as retificações.
function RegistroSelado({ registro, euSouAutor, aoRetificar }) {
  return (
    <article className='card card-body' aria-label={`Registro de ${data(registro.dataHora)}`}>
      <div className='d-flex flex-wrap justify-content-between align-items-center gap-2'>
        <h3 className='h6 mb-0'>
          {data(registro.dataHora)} · {registro.autor}
        </h3>
        <div className='d-flex flex-wrap gap-2'>
          {registro.sobExcecao && <PilulaStatus rotulo='Sob acesso de exceção' tom='aviso' />}
          <PilulaStatus rotulo={registro.selado ? 'Selado' : 'Em edição'} tom={registro.selado ? 'neutro' : 'info'} />
        </div>
      </div>
      <dl className='row mb-0 mt-3'>
        {CAMPOS_CLINICOS.map(([campo, rotulo]) => (
          <React.Fragment key={campo}>
            <dt className='col-sm-3'>{rotulo}</dt>
            <dd className='col-sm-9'>{registro.vigente[campo] || '—'}</dd>
          </React.Fragment>
        ))}
        {registro.vigente.prescricao && (
          <>
            <dt className='col-sm-3'>Correção da prescrição</dt>
            <dd className='col-sm-9'>{registro.vigente.prescricao}</dd>
          </>
        )}
      </dl>
      {registro.retificacoes.length > 0 && (
        <details className='mt-2'>
          <summary>
            {registro.retificacoes.length} {registro.retificacoes.length === 1 ? 'retificação' : 'retificações'}
          </summary>
          <ul className='mt-2 mb-0'>
            {registro.retificacoes.map((x) => (
              <li key={x.id} className='mb-2'>
                {diaMesHora(x.dataHora)} · {x.autor} · {ROTULO_DO_CAMPO[x.campo] ?? 'Registro'}: {x.motivo}
                <span className='d-block small text-body-secondary'>Antes: {x.textoAnterior || '—'}</span>
                <span className='d-block small'>Depois: {x.textoCorrigido}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {registro.selado && euSouAutor && (
        <div className='mt-3'>
          <button type='button' className='btn btn-sm btn-outline-primary' onClick={() => aoRetificar(registro)}>
            Retificar
          </button>
        </div>
      )}
    </article>
  );
}

// RF24: retificar cria versão nova, com motivo; a anterior fica no histórico.
function JanelaRetificar({ registro, aoFechar, aoConcluir }) {
  const form = useFormulario({ campo: 'conduta', texto: registro.vigente.conduta ?? '', motivo: '' }, 'retificar-');
  const { definir } = form;
  const v = form.valores;
  const [salvando, setSalvando] = React.useState(false);

  const salvar = async () => {
    const ok = form.validar({
      texto: v.texto.trim() ? null : 'Escreva o texto corrigido.',
      motivo: v.motivo.trim().length >= 5 ? null : 'Informe o motivo da retificação.',
    });
    if (!ok) return;
    setSalvando(true);
    try {
      await criar('retificacoes', { idRegistroClinico: registro.id, campo: v.campo, textoCorrigido: v.texto.trim(), motivo: v.motivo.trim() });
      mensagemSucesso('Retificação registrada. O texto anterior continua no histórico.');
      aoConcluir();
    } catch (e) {
      mensagemErro(mensagemDeErro(e));
      setSalvando(false);
    }
  };

  return (
    <Modal
      titulo={`Retificar o registro de ${data(registro.dataHora)}`}
      aoFechar={aoFechar}
      largo
      rodape={
        <>
          <button type='button' className='btn btn-outline-secondary' onClick={aoFechar} disabled={salvando}>
            Voltar
          </button>
          <button type='button' className='btn btn-primary' onClick={salvar} disabled={salvando}>
            {salvando ? 'Registrando…' : 'Registrar retificação'}
          </button>
        </>
      }
    >
      <form
        noValidate
        aria-label='Retificação'
        className='row g-3'
        onSubmit={(e) => {
          e.preventDefault();
          salvar();
        }}
      >
        <p className='col-12 mb-0'>O registro selado não muda: a retificação vira a versão vigente e as anteriores ficam visíveis.</p>
        <CampoSelecao
          {...form.campo('campo')}
          aoMudar={(campo) => {
            definir('campo', campo);
            definir('texto', registro.vigente[campo] ?? '');
          }}
          rotulo='O que corrigir'
          opcoes={Object.entries(ROTULO_DO_CAMPO)}
          largura='col-sm-6'
        />
        <CampoTextoLongo
          {...form.campo('texto')}
          rotulo='Texto corrigido'
          linhas={4}
          ajuda={v.campo === 'prescricao' ? 'Descreva a correção da prescrição; os itens emitidos continuam no histórico.' : null}
        />
        <CampoTextoLongo {...form.campo('motivo')} rotulo='Motivo' linhas={2} ajuda='Cada retificação deste registro precisa de um motivo próprio.' />
      </form>
    </Modal>
  );
}

// M-02b e M-02c · Aba Anamnese do prontuário (RF23, RF24).
function Anamnese({ idPaciente, idMedico }) {
  const { dados, carregando, erro, recarregar } = useCarregar(() => carregar(idPaciente, idMedico), [idPaciente, idMedico]);
  const [retificando, setRetificando] = React.useState(null);

  if (erro) return <EstadoErro erro={erro} aoTentarDeNovo={recarregar} />;
  if (carregando && !dados) return <p className='text-body-secondary mb-0'>Carregando…</p>;

  const { consulta, daConsulta } = dados;
  const anteriores = dados.registros.filter((r) => !(daConsulta && r.id === daConsulta.id && !r.selado));

  return (
    <>
      {consulta && (!daConsulta || !daConsulta.selado) ? (
        <RegistroEmEdicao key={consulta.id} consulta={consulta} registro={daConsulta} aoSelar={recarregar} />
      ) : consulta ? (
        <div className='alert alert-info mb-0' role='status'>
          O registro desta consulta já foi selado ({hora(daConsulta.dataSelagem ?? daConsulta.dataHora)}). Para corrigir, use Retificar.
        </div>
      ) : (
        <p className='text-body-secondary mb-0'>Nenhuma consulta sua em atendimento com este paciente agora. O registro é feito durante o atendimento.</p>
      )}
      <h2 className='h5 mb-0'>Registros</h2>
      {anteriores.length === 0 ? (
        <p className='text-body-secondary mb-0'>Nenhum registro anterior neste prontuário.</p>
      ) : (
        anteriores.map((r) => (
          <RegistroSelado key={r.id} registro={r} euSouAutor={r.idAutor === idMedico} aoRetificar={setRetificando} />
        ))
      )}
      {retificando && (
        <JanelaRetificar
          registro={retificando}
          aoFechar={() => setRetificando(null)}
          aoConcluir={() => {
            setRetificando(null);
            recarregar();
          }}
        />
      )}
    </>
  );
}

export default Anamnese;
