import React from 'react';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import Modal from '../../components/modal';
import PilulaStatus from '../../components/pilula-status';
import EstadoErro from '../../components/estado-erro';
import { CampoMoeda, CampoSelecao, CampoTextoLongo, useFormulario } from '../../components/formulario';
import { mensagemDeErro } from '../../components/confirmacao';
import { mensagemErro, mensagemSucesso } from '../../components/toastr';
import { atualizar, criar, listar } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { diaMesHora, moeda } from '../../utils/formatos';
import { mascararMoeda, moedaParaNumero } from '../../utils/mascaras';
import { rotuloDe, TURNO } from '../../utils/rotulos';
import { agoraDaClinica } from '../agenda/comum';

const SITUACAO_DO_CAIXA = {
  ABERTO: { rotulo: 'Aberto', tom: 'info' },
  FECHADO: { rotulo: 'Fechado', tom: 'sucesso' },
  A_APROVAR: { rotulo: 'Aguardando aprovação', tom: 'aviso' },
  RECONTAGEM: { rotulo: 'Recontagem pedida', tom: 'perigo' },
};
// A devolução nasce da aprovação de um estorno em dinheiro (RF48).
const TIPO_MOVIMENTO = { SANGRIA: 'Sangria', REFORCO: 'Reforço', DEVOLUCAO: 'Devolução' };
const DIVERGENCIA = 'Justifique a diferença no fechamento.';

async function carregarCaixa() {
  const caixas = await listar('caixas', { _sort: 'dataAbertura', _order: 'desc' });
  const atual = caixas.find((c) => ['ABERTO', 'RECONTAGEM'].includes(c.situacao)) ?? null;
  const movimentos = atual ? await listar('movimentosCaixa', { idCaixa: atual.id, _sort: 'dataHora' }) : [];
  return { atual, anteriores: caixas.filter((c) => c !== atual), movimentos };
}

function JanelaAbrir({ aoFechar, aoConcluir }) {
  const form = useFormulario({ fundo: '', turno: 'MANHA' }, 'abrir-');
  const [salvando, setSalvando] = React.useState(false);
  const salvar = async () => {
    const fundo = moedaParaNumero(form.valores.fundo);
    if (!form.validar({ fundo: fundo === null ? 'Informe o fundo de troco (pode ser zero).' : null })) return;
    setSalvando(true);
    try {
      await criar('caixas', { saldoInicial: fundo, turno: form.valores.turno });
      mensagemSucesso('Caixa aberto.');
      aoConcluir();
    } catch (e) {
      mensagemErro(mensagemDeErro(e));
      setSalvando(false);
    }
  };
  return (
    <Modal
      titulo='Abrir caixa'
      aoFechar={aoFechar}
      rodape={
        <>
          <button type='button' className='btn btn-outline-secondary' onClick={aoFechar} disabled={salvando}>
            Voltar
          </button>
          <button type='button' className='btn btn-primary' onClick={salvar} disabled={salvando}>
            {salvando ? 'Abrindo…' : 'Abrir caixa'}
          </button>
        </>
      }
    >
      <form
        noValidate
        className='row g-3'
        aria-label='Abertura do caixa'
        onSubmit={(e) => {
          e.preventDefault();
          salvar();
        }}
      >
        <CampoMoeda {...form.campo('fundo', mascararMoeda)} rotulo='Fundo de troco' largura='col-sm-6' />
        <CampoSelecao {...form.campo('turno')} rotulo='Turno' opcoes={Object.entries(TURNO)} largura='col-sm-6' />
      </form>
    </Modal>
  );
}

// RF47: sangria e reforço, sempre com motivo.
function JanelaMovimento({ caixa, tipo, aoFechar, aoConcluir }) {
  const form = useFormulario({ valor: '', motivo: '' }, 'movimento-');
  const [salvando, setSalvando] = React.useState(false);
  const salvar = async () => {
    const valor = moedaParaNumero(form.valores.valor);
    const ok = form.validar({
      valor: valor ? null : 'Informe o valor.',
      motivo: form.valores.motivo.trim().length >= 5 ? null : 'Informe o motivo.',
    });
    if (!ok) return;
    setSalvando(true);
    try {
      await criar('movimentosCaixa', { idCaixa: caixa.id, tipo, valor, motivo: form.valores.motivo.trim() });
      mensagemSucesso(`${TIPO_MOVIMENTO[tipo]} de ${moeda(valor)} registrada.`);
      aoConcluir();
    } catch (e) {
      mensagemErro(mensagemDeErro(e));
      setSalvando(false);
    }
  };
  return (
    <Modal
      titulo={tipo === 'SANGRIA' ? 'Registrar sangria' : 'Registrar reforço'}
      aoFechar={aoFechar}
      rodape={
        <>
          <button type='button' className='btn btn-outline-secondary' onClick={aoFechar} disabled={salvando}>
            Voltar
          </button>
          <button type='button' className='btn btn-primary' onClick={salvar} disabled={salvando}>
            {salvando ? 'Registrando…' : 'Registrar'}
          </button>
        </>
      }
    >
      <form
        noValidate
        className='row g-3'
        aria-label={TIPO_MOVIMENTO[tipo]}
        onSubmit={(e) => {
          e.preventDefault();
          salvar();
        }}
      >
        <p className='col-12 mb-0'>
          {tipo === 'SANGRIA' ? 'Dinheiro que sai da gaveta, como o depósito no cofre.' : 'Dinheiro que entra na gaveta para troco.'}
        </p>
        <CampoMoeda {...form.campo('valor', mascararMoeda)} rotulo='Valor' largura='col-sm-6' />
        <CampoTextoLongo {...form.campo('motivo')} rotulo='Motivo' linhas={2} />
      </form>
    </Modal>
  );
}

// Fechamento cego (D5): a Secretária informa o que contou e não vê o
// esperado nem o valor da diferença. Se houver diferença, só fica sabendo que
// ela existe e justifica.
function JanelaFechar({ caixa, aoFechar, aoConcluir }) {
  const recontagem = caixa.situacao === 'RECONTAGEM';
  const form = useFormulario({ contado: '', justificativa: '' }, 'fechar-');
  const [divergente, setDivergente] = React.useState(false);
  const [salvando, setSalvando] = React.useState(false);
  const salvar = async () => {
    const contado = moedaParaNumero(form.valores.contado);
    const ok = form.validar({
      contado: contado === null ? 'Informe o valor contado.' : null,
      justificativa: divergente && form.valores.justificativa.trim().length < 5 ? 'Explique a diferença.' : null,
    });
    if (!ok) return;
    setSalvando(true);
    try {
      const campos = { saldoContado: contado, justificativa: divergente ? form.valores.justificativa.trim() : null };
      if (!recontagem) campos.dataFechamento = `${agoraDaClinica()}:00`;
      const r = await atualizar('caixas', caixa.id, campos);
      mensagemSucesso(
        r.situacao === 'FECHADO' ? 'Caixa fechado.' : 'Caixa fechado com diferença. O Administrador aprova o fechamento.'
      );
      aoConcluir();
    } catch (e) {
      const mensagem = mensagemDeErro(e);
      if (mensagem === DIVERGENCIA) {
        setDivergente(true);
        requestAnimationFrame(() => document.getElementById('fechar-justificativa')?.focus());
      } else {
        mensagemErro(mensagem);
      }
      setSalvando(false);
    }
  };
  return (
    <Modal
      titulo={recontagem ? 'Informar nova contagem' : 'Fechar caixa'}
      aoFechar={aoFechar}
      rodape={
        <>
          <button type='button' className='btn btn-outline-secondary' onClick={aoFechar} disabled={salvando}>
            Voltar
          </button>
          <button type='button' className='btn btn-primary' onClick={salvar} disabled={salvando}>
            {salvando ? 'Fechando…' : recontagem ? 'Enviar contagem' : 'Fechar caixa'}
          </button>
        </>
      }
    >
      <form
        noValidate
        className='row g-3'
        aria-label='Fechamento do caixa'
        onSubmit={(e) => {
          e.preventDefault();
          salvar();
        }}
      >
        <p className='col-12 mb-0'>Conte todo o dinheiro da gaveta, com o fundo de troco, e informe o total.</p>
        <CampoMoeda {...form.campo('contado', mascararMoeda)} rotulo='Valor contado' largura='col-sm-6' />
        {divergente && (
          <>
            <div className='col-12'>
              <div className='alert alert-warning mb-0' role='alert'>
                Há divergência. Informe a justificativa.
              </div>
            </div>
            <CampoTextoLongo {...form.campo('justificativa')} rotulo='Justificativa' linhas={3} />
          </>
        )}
      </form>
    </Modal>
  );
}

// S-09 · Meu caixa (RF47). Abrir o turno, registrar sangria e reforço e
// fechar informando o valor contado. Sem saldo esperado, sem diferença e sem
// soma do que entrou (RC06, D5).
function MeuCaixa() {
  const { dados, carregando, erro, recarregar } = useCarregar(carregarCaixa);
  const [janela, setJanela] = React.useState(null);
  const fechar = () => setJanela(null);
  const concluir = () => {
    setJanela(null);
    recarregar();
  };

  if (erro) {
    return (
      <Pagina titulo='Meu caixa'>
        <EstadoErro erro={erro} aoTentarDeNovo={recarregar} />
      </Pagina>
    );
  }

  const atual = dados?.atual;
  return (
    <Pagina
      titulo='Meu caixa'
      acoes={
        dados &&
        !atual && (
          <button type='button' className='btn btn-primary' onClick={() => setJanela({ tipo: 'abrir' })}>
            Abrir caixa
          </button>
        )
      }
    >
      {carregando && !dados ? (
        <p className='text-body-secondary'>Carregando…</p>
      ) : atual ? (
        <section className='card card-body' aria-labelledby='caixaAtual'>
          <div className='d-flex flex-wrap justify-content-between align-items-start gap-2'>
            <div>
              <h2 id='caixaAtual' className='h5 mb-1'>
                Caixa {atual.situacao === 'ABERTO' ? 'aberto' : 'em recontagem'}
              </h2>
              <p className='mb-0 text-body-secondary'>
                Desde {diaMesHora(atual.dataAbertura)} · turno {(TURNO[atual.turno] ?? '').toLowerCase()} · fundo de troco{' '}
                {moeda(atual.saldoInicial)}
              </p>
            </div>
            <PilulaStatus {...rotuloDe(SITUACAO_DO_CAIXA, atual.situacao)} />
          </div>
          {atual.situacao === 'RECONTAGEM' && (
            <div className='alert alert-warning mt-3 mb-0' role='status'>
              O Administrador devolveu o fechamento para recontagem
              {atual.motivoDevolucao ? `: ${atual.motivoDevolucao}` : '.'}
            </div>
          )}
          <div className='d-flex flex-wrap gap-2 mt-3'>
            {atual.situacao === 'ABERTO' ? (
              <>
                <button type='button' className='btn btn-outline-primary' onClick={() => setJanela({ tipo: 'SANGRIA' })}>
                  Registrar sangria
                </button>
                <button type='button' className='btn btn-outline-primary' onClick={() => setJanela({ tipo: 'REFORCO' })}>
                  Registrar reforço
                </button>
                <button type='button' className='btn btn-primary ms-sm-auto' onClick={() => setJanela({ tipo: 'fechar' })}>
                  Fechar caixa
                </button>
              </>
            ) : (
              <button type='button' className='btn btn-primary' onClick={() => setJanela({ tipo: 'fechar' })}>
                Informar nova contagem
              </button>
            )}
          </div>
        </section>
      ) : (
        <div className='alert alert-info mb-0' role='status'>
          Nenhum caixa aberto. Abra o caixa para receber em dinheiro no checkout.
        </div>
      )}
      {atual && (
        <Listagem
          titulo='Sangrias e reforços deste turno'
          linhas={dados.movimentos}
          vazio='Nenhuma sangria ou reforço neste turno.'
          colunas={[
            { titulo: 'Quando', render: (m) => diaMesHora(m.dataHora) },
            { titulo: 'Tipo', render: (m) => TIPO_MOVIMENTO[m.tipo] ?? m.tipo },
            { titulo: 'Valor', classe: 'text-end', render: (m) => moeda(m.valor) },
            { titulo: 'Motivo', render: (m) => m.motivo },
          ]}
        />
      )}
      {dados && (
        <Listagem
          titulo='Turnos anteriores'
          linhas={dados.anteriores}
          vazio='Nenhum turno anterior.'
          colunas={[
            { titulo: 'Abertura', render: (c) => diaMesHora(c.dataAbertura) },
            { titulo: 'Fechamento', render: (c) => (c.dataFechamento ? diaMesHora(c.dataFechamento) : '—') },
            { titulo: 'Turno', render: (c) => TURNO[c.turno] ?? '—' },
            { titulo: 'Situação', render: (c) => <PilulaStatus {...rotuloDe(SITUACAO_DO_CAIXA, c.situacao)} /> },
          ]}
        />
      )}
      {janela?.tipo === 'abrir' && <JanelaAbrir aoFechar={fechar} aoConcluir={concluir} />}
      {['SANGRIA', 'REFORCO'].includes(janela?.tipo) && (
        <JanelaMovimento caixa={atual} tipo={janela.tipo} aoFechar={fechar} aoConcluir={concluir} />
      )}
      {janela?.tipo === 'fechar' && <JanelaFechar caixa={atual} aoFechar={fechar} aoConcluir={concluir} />}
    </Pagina>
  );
}

export default MeuCaixa;
