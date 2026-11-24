import React from 'react';

import Modal from '../../components/modal';
import { CampoMarcar, CampoSelecao, CampoTexto, CampoTextoLongo, useFormulario } from '../../components/formulario';
import { mensagemDeErro } from '../../components/confirmacao';
import { mensagemErro, mensagemSucesso } from '../../components/toastr';
import { DATA_DE_HOJE } from '../../config/axios';
import { listar } from '../../servicos/dados';
import { registrarAjuste, registrarEntrada, registrarSaida } from '../../servicos/estoque';
import { useSessao } from '../../sessao/sessao';
import { data, hora, moeda, quantidadeComSinal } from '../../utils/formatos';
import { mascararDigitos } from '../../utils/mascaras';
import { UNIDADE_PRODUTO } from '../../utils/rotulos';
import { carregarConsultas, doDia } from '../agenda/comum';
import { MOTIVO_DESCARTE, ORIGEM_ENTRADA, TIPOS_COM_LOTE, loteSugerido, nomeDoLote, vencido } from './comum';

// Janelas de movimentação de estoque (RF37): entrada, saída por lote e ajuste
// de inventário. A API confere tudo de novo; aqui as regras só antecipam o aviso.

// Contas a pagar que podem ser a compra de um item do estoque.
const CATEGORIAS_DE_COMPRA = ['MATERIAL', 'INSUMOS', 'OUTRAS'];
const inteiro = (texto) => (/^\d+$/.test(texto) ? Number(texto) : NaN);
const unidade = (produto) => (produto ? UNIDADE_PRODUTO[produto.unidade] ?? produto.unidade : null);
// "2 frascos de Lidocaína": as unidades do cadastro fazem o plural com s.
const quantas = (n, produto) => `${n} ${unidade(produto).toLowerCase()}${n === 1 ? '' : 's'}`;

function useEnvio() {
  const [salvando, setSalvando] = React.useState(false);
  const enviar = async (fazer) => {
    setSalvando(true);
    try {
      await fazer();
    } catch (e) {
      mensagemErro(mensagemDeErro(e));
      setSalvando(false);
    }
  };
  return [salvando, enviar];
}

function Janela({ titulo, rotulo, rotuloSalvar, salvando, aoSalvar, aoFechar, children }) {
  return (
    <Modal
      titulo={titulo}
      aoFechar={aoFechar}
      largo
      rodape={
        <>
          <button type='button' className='btn btn-outline-secondary' onClick={aoFechar} disabled={salvando}>
            Voltar
          </button>
          <button type='button' className='btn btn-primary' onClick={aoSalvar} disabled={salvando}>
            {salvando ? 'Registrando…' : rotuloSalvar}
          </button>
        </>
      }
    >
      <form
        noValidate
        aria-label={rotulo}
        className='row g-3'
        onSubmit={(e) => {
          e.preventDefault();
          aoSalvar();
        }}
      >
        {children}
      </form>
    </Modal>
  );
}

// Entrada: produto, lote, validade, quantidade e origem. Sendo compra, o
// Administrador liga o título a pagar (RF50).
function JanelaEntrada({ produtos, inicial, aoFechar, aoConcluir }) {
  const { sessao } = useSessao();
  const ehAdmin = sessao.usuario.papel === 'ADMINISTRADOR';
  const ativos = produtos.filter((p) => p.situacao === 'ATIVO');
  const form = useFormulario(
    { idProduto: inicial.idProduto ? String(inicial.idProduto) : '', numeroLote: '', validade: '', quantidade: '', origem: 'COMPRA', idTituloPagar: '' },
    'entrada-'
  );
  const { definir } = form;
  const v = form.valores;
  const [salvando, enviar] = useEnvio();
  const [titulos, setTitulos] = React.useState([]);

  React.useEffect(() => {
    if (!ehAdmin) return;
    listar('titulosPagar', { _sort: 'vencimento', _order: 'desc' })
      .then((lista) => setTitulos(lista.filter((t) => CATEGORIAS_DE_COMPRA.includes(t.categoria) && t.situacao !== 'ESTORNADO')))
      .catch(() => setTitulos([]));
  }, [ehAdmin]);

  const produto = ativos.find((p) => String(p.id) === v.idProduto);
  const comLote = Boolean(produto && (produto.controlaLote || TIPOS_COM_LOTE.includes(produto.tipo)));
  const existente = comLote ? produto.lotes.find((l) => (l.numero ?? '').toUpperCase() === v.numeroLote.trim().toUpperCase()) : null;
  const validade = existente ? existente.validade : v.validade;

  const salvar = () => {
    const quantidade = inteiro(v.quantidade);
    let erroValidade = null;
    if (comLote && !existente) {
      if (!v.validade) erroValidade = 'Informe a validade.';
      else if (v.validade < DATA_DE_HOJE) erroValidade = 'A validade já passou: lote vencido não entra no estoque.';
    }
    const ok = form.validar({
      idProduto: produto ? null : 'Escolha o produto.',
      numeroLote: !comLote || v.numeroLote.trim() ? null : 'Informe o número do lote.',
      validade: erroValidade,
      quantidade: quantidade > 0 ? null : 'Informe a quantidade.',
      origem: v.origem ? null : 'Escolha a origem.',
    });
    if (!ok) return;
    enviar(async () => {
      const r = await registrarEntrada({
        idProduto: produto.id,
        ...(comLote ? { numeroLote: v.numeroLote.trim(), validade } : {}),
        quantidade,
        origem: v.origem,
        ...(ehAdmin && v.origem === 'COMPRA' && v.idTituloPagar ? { idTituloPagar: Number(v.idTituloPagar) } : {}),
      });
      mensagemSucesso(`Entrada registrada. ${produto.descricao}, ${nomeDoLote(r.lote)}: ${r.lote.quantidade} em estoque.`);
      aoConcluir();
    });
  };

  return (
    <Janela titulo='Registrar entrada' rotulo='Entrada no estoque' rotuloSalvar='Registrar entrada' salvando={salvando} aoSalvar={salvar} aoFechar={aoFechar}>
      <CampoSelecao
        {...form.campo('idProduto')}
        aoMudar={(id) => {
          definir('idProduto', id);
          definir('numeroLote', '');
          definir('validade', '');
        }}
        rotulo='Produto'
        opcoes={ativos.map((p) => [String(p.id), p.descricao])}
        largura='col-12'
      />
      {comLote && (
        <>
          <CampoTexto
            {...form.campo('numeroLote')}
            rotulo='Lote'
            list='entrada-lotes-cadastrados'
            maxLength={30}
            autoComplete='off'
            largura='col-sm-6'
            ajuda={existente ? `Lote já cadastrado, com ${existente.quantidade} em estoque.` : 'Número impresso na embalagem.'}
          />
          <datalist id='entrada-lotes-cadastrados'>
            {produto.lotes
              .filter((l) => l.numero && !vencido(l))
              .map((l) => (
                <option key={l.id} value={l.numero} />
              ))}
          </datalist>
          <CampoTexto
            {...form.campo('validade')}
            valor={validade}
            tipo='date'
            rotulo='Validade'
            min={DATA_DE_HOJE}
            disabled={Boolean(existente)}
            largura='col-sm-6'
            ajuda={existente ? 'A validade é a do lote já cadastrado.' : null}
          />
        </>
      )}
      {produto && !comLote && <p className='col-12 mb-0 text-body-secondary'>Este produto não controla lote: a entrada soma ao saldo único dele.</p>}
      <CampoTexto
        {...form.campo('quantidade', mascararDigitos(6))}
        rotulo={produto ? `Quantidade (${unidade(produto)})` : 'Quantidade'}
        inputMode='numeric'
        largura='col-sm-6'
      />
      <CampoSelecao {...form.campo('origem')} rotulo='Origem' opcoes={Object.entries(ORIGEM_ENTRADA)} largura='col-sm-6' />
      {ehAdmin && v.origem === 'COMPRA' && (
        <CampoSelecao
          {...form.campo('idTituloPagar')}
          rotulo='Título a pagar da compra'
          opcional
          opcoes={titulos.map((t) => [String(t.id), `${t.fornecedor} · ${moeda(t.valor)} · vence ${data(t.vencimento)}`])}
          largura='col-12'
          ajuda='Opcional. Liga a entrada ao custo da compra em Contas a pagar.'
        />
      )}
    </Janela>
  );
}

// Saída por lote (RF37): para o paciente atendido hoje ou descarte. A
// sugestão é o lote que vence primeiro; lote vencido só sai por descarte
// (RN-38.1); item de controle especial pede a conferência manual (RN-37.3).
function JanelaSaida({ produtos, inicial, aoFechar, aoConcluir }) {
  const { sessao } = useSessao();
  const ehMedico = sessao.usuario.papel === 'MEDICO';
  const idPessoa = sessao.usuario.idPessoa;
  const ativos = produtos.filter((p) => p.situacao === 'ATIVO' && p.saldo > 0);
  const [consultas, setConsultas] = React.useState(null);

  React.useEffect(() => {
    const aceitos = ehMedico ? ['EM_ATENDIMENTO', 'FINALIZADO'] : ['NA_RECEPCAO', 'EM_ATENDIMENTO', 'FINALIZADO'];
    carregarConsultas({ ...doDia(DATA_DE_HOJE), ...(ehMedico ? { idMedico: idPessoa } : {}) })
      .then((lista) => setConsultas(lista.filter((c) => aceitos.includes(c.status))))
      .catch(() => setConsultas([]));
  }, [ehMedico, idPessoa]);

  const destinoInicial = inicial.destino ?? 'DISPENSACAO';
  const produtoInicial = ativos.find((p) => p.id === inicial.idProduto);
  const sugeridoInicial = produtoInicial && destinoInicial === 'DISPENSACAO' ? loteSugerido(produtoInicial.lotes) : null;
  const form = useFormulario(
    {
      idProduto: produtoInicial ? String(produtoInicial.id) : '',
      destino: destinoInicial,
      idConsulta: '',
      motivoDescarte: inicial.motivoDescarte ?? '',
      idLote: inicial.idLote ? String(inicial.idLote) : sugeridoInicial ? String(sugeridoInicial.id) : '',
      justificativa: '',
      quantidade: '',
      conferencia: false,
    },
    'saida-'
  );
  const { definir } = form;
  const v = form.valores;
  const [salvando, enviar] = useEnvio();

  const produto = ativos.find((p) => String(p.id) === v.idProduto);
  const paraPaciente = v.destino === 'DISPENSACAO';
  const sugerido = produto ? loteSugerido(produto.lotes) : null;
  const lotes = produto ? produto.lotes.filter((l) => l.quantidade > 0 && (!paraPaciente || !vencido(l))) : [];
  const vencidos = produto ? produto.lotes.filter((l) => l.quantidade > 0 && vencido(l)) : [];
  const lote = lotes.find((l) => String(l.id) === v.idLote);
  const trocou = Boolean(paraPaciente && sugerido && lote && lote.id !== sugerido.id);

  const escolherProduto = (id) => {
    definir('idProduto', id);
    const p = ativos.find((x) => String(x.id) === id);
    const s = p ? loteSugerido(p.lotes) : null;
    definir('idLote', paraPaciente && s ? String(s.id) : '');
    definir('justificativa', '');
    definir('conferencia', false);
  };
  const escolherDestino = (destino) => {
    definir('destino', destino);
    definir('justificativa', '');
    if (destino === 'DISPENSACAO' && (!lote || vencido(lote))) definir('idLote', sugerido ? String(sugerido.id) : '');
  };
  const escolherLote = (id) => {
    definir('idLote', id);
    const l = produto?.lotes.find((x) => String(x.id) === id);
    if (!paraPaciente && l && vencido(l) && !v.motivoDescarte) definir('motivoDescarte', 'VENCIMENTO');
  };

  const salvar = () => {
    const quantidade = inteiro(v.quantidade);
    let erroLote = null;
    if (!lote) erroLote = paraPaciente && produto && lotes.length === 0 ? 'Não há lote na validade para entregar ao paciente.' : 'Escolha o lote.';
    let erroQuantidade = null;
    if (!(quantidade > 0)) erroQuantidade = 'Informe a quantidade.';
    else if (lote && quantidade > lote.quantidade) erroQuantidade = `O ${nomeDoLote(lote)} tem só ${lote.quantidade}.`;
    let erroJustificativa = null;
    if (trocou && v.justificativa.trim().length < 5) erroJustificativa = `Explique por que não usar o ${nomeDoLote(sugerido)}, que vence antes.`;
    if (!paraPaciente && v.motivoDescarte === 'OUTRO' && v.justificativa.trim().length < 5) erroJustificativa = 'Descreva o motivo do descarte.';
    const ok = form.validar({
      idProduto: produto ? null : 'Escolha o produto.',
      idConsulta: !paraPaciente || v.idConsulta ? null : 'Escolha o paciente.',
      motivoDescarte: paraPaciente || v.motivoDescarte ? null : 'Escolha o motivo do descarte.',
      idLote: erroLote,
      justificativa: erroJustificativa,
      quantidade: erroQuantidade,
      conferencia: produto?.controleEspecial && !v.conferencia ? 'Registre a conferência manual antes da saída.' : null,
    });
    if (!ok) return;
    const consulta = consultas?.find((c) => String(c.id) === v.idConsulta);
    const justificativa = v.justificativa.trim();
    enviar(async () => {
      await registrarSaida({
        idLote: lote.id,
        quantidade,
        destino: v.destino,
        ...(paraPaciente
          ? { idConsulta: consulta.id, ...(trocou ? { justificativa } : {}) }
          : { motivoDescarte: v.motivoDescarte, ...(justificativa ? { justificativa } : {}) }),
        ...(produto.controleEspecial ? { conferenciaManual: true } : {}),
      });
      // RN-37.1: a confirmação do ato é o único lugar em que a Secretária vê o paciente.
      mensagemSucesso(
        paraPaciente
          ? `Saída registrada: ${quantas(quantidade, produto)} de ${produto.descricao} (${nomeDoLote(lote)}) para ${consulta.paciente}.`
          : `Descarte registrado: ${quantas(quantidade, produto)} de ${produto.descricao} (${nomeDoLote(lote)}).`
      );
      aoConcluir();
    });
  };

  const rotuloDoLote = (l) =>
    [
      l.numero ?? 'Sem lote',
      l.validade ? `${vencido(l) ? 'venceu' : 'vence'} ${data(l.validade)}` : null,
      `${l.quantidade} disponíveis`,
      paraPaciente && sugerido && l.id === sugerido.id ? 'sugerido, vence primeiro' : null,
    ]
      .filter(Boolean)
      .join(' · ');

  return (
    <Janela titulo='Registrar saída' rotulo='Saída do estoque' rotuloSalvar={paraPaciente ? 'Registrar saída' : 'Registrar descarte'} salvando={salvando} aoSalvar={salvar} aoFechar={aoFechar}>
      <CampoSelecao {...form.campo('idProduto')} aoMudar={escolherProduto} rotulo='Produto' opcoes={ativos.map((p) => [String(p.id), p.descricao])} largura='col-12' />
      <CampoSelecao
        {...form.campo('destino')}
        aoMudar={escolherDestino}
        rotulo='Destino'
        opcoes={[
          ['DISPENSACAO', 'Paciente atendido hoje'],
          ['DESCARTE', 'Descarte'],
        ]}
        largura='col-sm-6'
      />
      {paraPaciente ? (
        <CampoSelecao
          {...form.campo('idConsulta')}
          rotulo='Paciente'
          opcoes={(consultas ?? []).map((c) => [String(c.id), ehMedico ? `${hora(c.dataHora)} · ${c.paciente}` : `${hora(c.dataHora)} · ${c.paciente} · ${c.medico}`])}
          largura='col-sm-6'
          ajuda={consultas && consultas.length === 0 ? 'Ninguém atendido hoje ainda.' : ehMedico ? 'Seus atendimentos de hoje.' : 'Quem está ou esteve na clínica hoje.'}
        />
      ) : (
        <CampoSelecao {...form.campo('motivoDescarte')} rotulo='Motivo do descarte' opcoes={Object.entries(MOTIVO_DESCARTE)} largura='col-sm-6' />
      )}
      {produto && (
        <CampoSelecao
          {...form.campo('idLote')}
          aoMudar={escolherLote}
          rotulo='Lote'
          opcoes={lotes.map((l) => [String(l.id), rotuloDoLote(l)])}
          largura='col-12'
          ajuda={paraPaciente ? 'A sugestão é o lote que vence primeiro. Para usar outro, explique o motivo.' : null}
        />
      )}
      {paraPaciente && vencidos.length > 0 && (
        <div className='col-12'>
          <div className='alert alert-warning mb-0' role='status'>
            Lote vencido não sai para paciente: {vencidos.map((l) => `${l.numero ?? 'sem lote'} (venceu em ${data(l.validade)})`).join(', ')}. Use o descarte.
          </div>
        </div>
      )}
      {(trocou || (!paraPaciente && v.motivoDescarte === 'OUTRO')) && (
        <CampoTextoLongo {...form.campo('justificativa')} rotulo={trocou ? 'Motivo da troca de lote' : 'Descrição do motivo'} linhas={2} />
      )}
      <CampoTexto
        {...form.campo('quantidade', mascararDigitos(6))}
        rotulo={produto ? `Quantidade (${unidade(produto)})` : 'Quantidade'}
        inputMode='numeric'
        largura='col-sm-6'
        ajuda={lote ? `Até ${lote.quantidade}.` : null}
      />
      {produto?.controleEspecial && (
        <>
          <CampoMarcar
            {...form.marcar('conferencia')}
            rotulo='Conferência manual feita: item, lote e quantidade conferidos'
            ajuda='Item de controle especial. A conferência fica registrada com o seu usuário.'
          />
          {form.erros.conferencia && <div className='col-12 invalid-feedback d-block mt-0'>{form.erros.conferencia}</div>}
        </>
      )}
    </Janela>
  );
}

// Ajuste de inventário: a contagem física contra o saldo, com motivo. O do
// Administrador vale na hora; o da Secretária vira pedido para ele aprovar.
function JanelaAjuste({ produtos, inicial, aoFechar, aoConcluir }) {
  const { sessao } = useSessao();
  const ehAdmin = sessao.usuario.papel === 'ADMINISTRADOR';
  const comLotes = produtos.filter((p) => p.lotes.length > 0);
  const form = useFormulario(
    { idProduto: inicial.idProduto ? String(inicial.idProduto) : '', idLote: inicial.idLote ? String(inicial.idLote) : '', contada: '', justificativa: '' },
    'ajuste-'
  );
  const { definir } = form;
  const v = form.valores;
  const [salvando, enviar] = useEnvio();

  const produto = comLotes.find((p) => String(p.id) === v.idProduto);
  const lote = produto?.lotes.find((l) => String(l.id) === v.idLote);
  const contada = inteiro(v.contada);
  const diferenca = lote && Number.isInteger(contada) ? contada - lote.quantidade : null;

  const salvar = () => {
    let erroContada = null;
    if (!Number.isInteger(contada)) erroContada = 'Informe a quantidade contada.';
    else if (diferenca === 0) erroContada = 'A contagem bate com o saldo: não há o que ajustar.';
    const ok = form.validar({
      idProduto: produto ? null : 'Escolha o produto.',
      idLote: lote ? null : 'Escolha o lote.',
      contada: erroContada,
      justificativa: v.justificativa.trim().length >= 5 ? null : 'Informe o motivo do ajuste.',
    });
    if (!ok) return;
    enviar(async () => {
      const r = await registrarAjuste({ idLote: lote.id, quantidadeContada: contada, justificativa: v.justificativa.trim() });
      mensagemSucesso(
        ehAdmin
          ? `Ajuste registrado. ${produto.descricao}, ${nomeDoLote(lote)}: saldo ${r.lote.quantidade}.`
          : 'Pedido de ajuste enviado. O saldo muda depois da aprovação do Administrador.'
      );
      aoConcluir();
    });
  };

  return (
    <Janela
      titulo={ehAdmin ? 'Ajuste de inventário' : 'Pedir ajuste de inventário'}
      rotulo='Ajuste de inventário'
      rotuloSalvar={ehAdmin ? 'Registrar ajuste' : 'Enviar pedido'}
      salvando={salvando}
      aoSalvar={salvar}
      aoFechar={aoFechar}
    >
      <p className='col-12 mb-0'>
        {ehAdmin
          ? 'O ajuste corrige o saldo pela contagem física e fica no histórico com o motivo.'
          : 'O pedido vai para o Administrador. O saldo só muda depois da aprovação.'}
      </p>
      <CampoSelecao
        {...form.campo('idProduto')}
        aoMudar={(id) => {
          definir('idProduto', id);
          const p = comLotes.find((x) => String(x.id) === id);
          definir('idLote', p?.lotes.length === 1 ? String(p.lotes[0].id) : '');
        }}
        rotulo='Produto'
        opcoes={comLotes.map((p) => [String(p.id), p.descricao])}
        largura='col-12'
      />
      {produto && (
        <CampoSelecao
          {...form.campo('idLote')}
          rotulo='Lote'
          opcoes={produto.lotes.map((l) => [String(l.id), [l.numero ?? 'Sem lote', `saldo ${l.quantidade}`, l.validade ? `vence ${data(l.validade)}` : null].filter(Boolean).join(' · ')])}
          largura='col-12'
        />
      )}
      <CampoTexto
        {...form.campo('contada', mascararDigitos(6))}
        rotulo='Quantidade contada'
        inputMode='numeric'
        largura='col-sm-6'
        ajuda={lote ? `Saldo no sistema: ${lote.quantidade}.` : null}
      />
      <div className='col-sm-6'>
        <span className='form-label d-block'>Diferença</span>
        <output className='form-control-plaintext' aria-live='polite'>
          {diferenca === null ? '—' : quantidadeComSinal(diferenca)}
        </output>
      </div>
      <CampoTextoLongo {...form.campo('justificativa')} rotulo='Motivo do ajuste' linhas={2} />
    </Janela>
  );
}

// Abre uma das janelas: abrir('entrada' | 'saida' | 'ajuste', { idProduto, ... }).
export function useJanelaDeEstoque(produtos, aoMudar) {
  const [aberta, setAberta] = React.useState(null);
  const fechar = () => setAberta(null);
  const concluir = () => {
    setAberta(null);
    aoMudar();
  };
  const props = { produtos: produtos ?? [], inicial: aberta?.inicial ?? {}, aoFechar: fechar, aoConcluir: concluir };
  let janela = null;
  if (aberta?.tipo === 'entrada') janela = <JanelaEntrada {...props} />;
  if (aberta?.tipo === 'saida') janela = <JanelaSaida {...props} />;
  if (aberta?.tipo === 'ajuste') janela = <JanelaAjuste {...props} />;
  const abrir = React.useCallback((tipo, inicial = {}) => setAberta({ tipo, inicial }), []);
  return [janela, abrir];
}
