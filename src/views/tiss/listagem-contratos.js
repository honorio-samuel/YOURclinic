import React from 'react';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import Modal from '../../components/modal';
import PilulaStatus from '../../components/pilula-status';
import AcoesLinha from '../../components/acoes-linha';
import { CampoMoeda, CampoSelecao, CampoTexto, useFormulario } from '../../components/formulario';
import { mensagemDeErro } from '../../components/confirmacao';
import { mensagemErro, mensagemSucesso } from '../../components/toastr';
import { atualizar, criar, listar, porId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { mesAno, moeda } from '../../utils/formatos';
import { mascararMoeda, moedaParaNumero, numeroParaMoeda } from '../../utils/mascaras';
import { nomeOperadora } from './comum';

const MEIOS = [
  ['WEBSERVICE', 'Webservice'],
  ['PORTAL', 'Portal da operadora'],
];
const PRAZOS = [
  ['prazoApresentacao', 'Apresentação do lote (dias)'],
  ['prazoPagamento', 'Pagamento após o protocolo (dias)'],
  ['prazoRecurso', 'Recurso de glosa (dias)'],
];

// RF51: cadastro e edição do contrato com a operadora. A API confere a
// operadora, o número único, a vigência e os prazos.
function JanelaContrato({ contrato, convenios, aoFechar, aoSalvar }) {
  const novo = !contrato;
  const form = useFormulario(
    {
      idConvenio: contrato ? String(contrato.idConvenio) : '',
      numero: contrato?.numero ?? '',
      vigenciaInicio: contrato?.vigenciaInicio ?? '',
      vigenciaFim: contrato?.vigenciaFim ?? '',
      versaoTiss: contrato?.versaoTiss ?? '4.01.00',
      meioTransmissao: contrato?.meioTransmissao ?? 'WEBSERVICE',
      prazoApresentacao: String(contrato?.prazoApresentacao ?? 30),
      prazoPagamento: String(contrato?.prazoPagamento ?? 30),
      prazoRecurso: String(contrato?.prazoRecurso ?? 30),
      situacao: contrato?.situacao ?? 'VIGENTE',
    },
    'contrato-'
  );
  const [salvando, setSalvando] = React.useState(false);
  const v = form.valores;
  const salvar = async () => {
    const prazoRuim = (p) => (/^\d{1,3}$/.test(v[p]) && Number(v[p]) >= 1 && Number(v[p]) <= 365 ? null : 'De 1 a 365 dias.');
    const ok = form.validar({
      idConvenio: v.idConvenio ? null : 'Escolha a operadora.',
      numero: v.numero.trim().length >= 3 ? null : 'Informe o número do contrato.',
      vigenciaInicio: v.vigenciaInicio ? null : 'Informe o início da vigência.',
      vigenciaFim: !v.vigenciaFim ? 'Informe o fim da vigência.' : v.vigenciaFim < v.vigenciaInicio ? 'O fim vem depois do início.' : null,
      versaoTiss: v.versaoTiss.trim() ? null : 'Informe a versão TISS.',
      prazoApresentacao: prazoRuim('prazoApresentacao'),
      prazoPagamento: prazoRuim('prazoPagamento'),
      prazoRecurso: prazoRuim('prazoRecurso'),
    });
    if (!ok) return;
    setSalvando(true);
    const campos = {
      idConvenio: Number(v.idConvenio),
      numero: v.numero.trim(),
      vigenciaInicio: v.vigenciaInicio,
      vigenciaFim: v.vigenciaFim,
      versaoTiss: v.versaoTiss.trim(),
      meioTransmissao: v.meioTransmissao,
      prazoApresentacao: Number(v.prazoApresentacao),
      prazoPagamento: Number(v.prazoPagamento),
      prazoRecurso: Number(v.prazoRecurso),
      situacao: v.situacao,
    };
    try {
      if (novo) await criar('contratosOperadora', campos);
      else await atualizar('contratosOperadora', contrato.id, campos);
      mensagemSucesso(novo ? `Contrato ${campos.numero} cadastrado. Monte a tabela de preços em "Ver".` : `Contrato ${campos.numero} atualizado.`);
      aoSalvar();
    } catch (e) {
      mensagemErro(mensagemDeErro(e));
      setSalvando(false);
    }
  };
  return (
    <Modal
      titulo={novo ? 'Novo contrato com operadora' : `Editar o contrato ${contrato.numero}`}
      aoFechar={aoFechar}
      largo
      rodape={
        <>
          <button type='button' className='btn btn-outline-secondary' onClick={aoFechar} disabled={salvando}>
            Voltar
          </button>
          <button type='button' className='btn btn-primary' onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </>
      }
    >
      <form
        noValidate
        aria-label='Contrato com a operadora'
        className='row g-3'
        onSubmit={(e) => {
          e.preventDefault();
          salvar();
        }}
      >
        <CampoSelecao {...form.campo('idConvenio')} rotulo='Operadora' opcoes={convenios.map((c) => [String(c.id), nomeOperadora(c)])} />
        <CampoTexto {...form.campo('numero')} rotulo='Nº do contrato' largura='col-md-6' maxLength={20} />
        <CampoTexto {...form.campo('vigenciaInicio')} rotulo='Início da vigência' tipo='date' largura='col-md-4' />
        <CampoTexto {...form.campo('vigenciaFim')} rotulo='Fim da vigência' tipo='date' largura='col-md-4' min={v.vigenciaInicio || undefined} />
        <CampoTexto {...form.campo('versaoTiss')} rotulo='Versão TISS' largura='col-md-4' maxLength={10} />
        <CampoSelecao {...form.campo('meioTransmissao')} rotulo='Meio de transmissão' opcoes={MEIOS} />
        {!novo && (
          <CampoSelecao
            {...form.campo('situacao')}
            rotulo='Situação'
            opcoes={[
              ['VIGENTE', 'Vigente'],
              ['ENCERRADO', 'Encerrado'],
            ]}
          />
        )}
        {PRAZOS.map(([nome, rotulo]) => (
          <CampoTexto key={nome} {...form.campo(nome, (x) => x.replace(/\D/g, '').slice(0, 3))} rotulo={rotulo} largura='col-md-4' inputMode='numeric' />
        ))}
      </form>
    </Modal>
  );
}

// RF51: a tabela de preços negociada com a operadora. Cada procedimento aparece
// uma vez por contrato; o valor vale para as guias do contrato.
function JanelaTabela({ contrato, aoFechar }) {
  const carregar = async () => {
    const [itens, procedimentos] = await Promise.all([listar('itensTabelaPreco', { idContratoOperadora: contrato.id }), listar('procedimentos')]);
    return { itens, procedimentos };
  };
  const { dados, carregando, erro, recarregar } = useCarregar(carregar, [contrato.id]);
  const [valores, setValores] = React.useState({});
  const [novoProc, setNovoProc] = React.useState('');
  const [novoValor, setNovoValor] = React.useState('');
  const [salvando, setSalvando] = React.useState(false);

  const proc = porId(dados?.procedimentos ?? []);
  const itens = (dados?.itens ?? []).map((i) => ({ ...i, procedimento: proc[i.idProcedimento] }));
  const fora = (dados?.procedimentos ?? []).filter((p) => !itens.some((i) => i.idProcedimento === p.id));
  const mudados = itens.filter((i) => valores[i.id] !== undefined && moedaParaNumero(valores[i.id]) !== i.valorNegociado);

  const salvarValores = async () => {
    if (mudados.some((i) => !(moedaParaNumero(valores[i.id]) > 0))) {
      mensagemErro('Informe um valor maior que zero.');
      return;
    }
    setSalvando(true);
    try {
      for (const i of mudados) await atualizar('itensTabelaPreco', i.id, { valorNegociado: moedaParaNumero(valores[i.id]) });
      mensagemSucesso(`${mudados.length === 1 ? 'Preço atualizado' : `${mudados.length} preços atualizados`} no contrato ${contrato.numero}.`);
      setValores({});
      recarregar();
    } catch (e) {
      mensagemErro(mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  };
  const incluir = async () => {
    const valor = moedaParaNumero(novoValor);
    if (!novoProc || !(valor > 0)) {
      mensagemErro('Escolha o procedimento e informe o valor negociado.');
      return;
    }
    setSalvando(true);
    try {
      await criar('itensTabelaPreco', {
        idContratoOperadora: contrato.id,
        idProcedimento: Number(novoProc),
        valorNegociado: valor,
        vigenciaInicio: contrato.vigenciaInicio,
        vigenciaFim: contrato.vigenciaFim,
      });
      mensagemSucesso('Procedimento incluído na tabela.');
      setNovoProc('');
      setNovoValor('');
      recarregar();
    } catch (e) {
      mensagemErro(mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      titulo={`Tabela de preços · ${contrato.operadora} · ${contrato.numero}`}
      aoFechar={aoFechar}
      largo
      rodape={
        <>
          <button type='button' className='btn btn-outline-secondary' onClick={aoFechar} disabled={salvando}>
            Fechar
          </button>
          <button type='button' className='btn btn-primary' onClick={salvarValores} disabled={salvando || mudados.length === 0}>
            {salvando ? 'Salvando…' : 'Salvar preços'}
          </button>
        </>
      }
    >
      {carregando && <p className='text-body-secondary mb-0'>Carregando a tabela…</p>}
      {erro && <p className='text-danger mb-0'>Não foi possível abrir a tabela agora.</p>}
      {dados && (
        <>
          <p className='small text-body-secondary'>
            Vigência de {mesAno(contrato.vigenciaInicio)} a {mesAno(contrato.vigenciaFim)}. O preço particular aparece para comparar.
          </p>
          <div className='table-responsive'>
            <table className='table table-sm align-middle'>
              <caption className='visually-hidden'>Procedimentos e preços negociados do contrato</caption>
              <thead>
                <tr>
                  <th scope='col'>Procedimento</th>
                  <th scope='col' className='text-end'>
                    Particular
                  </th>
                  <th scope='col' className='text-end' style={{ width: '12rem' }}>
                    Negociado
                  </th>
                </tr>
              </thead>
              <tbody>
                {itens.length === 0 && (
                  <tr>
                    <td colSpan={3}>Nenhum procedimento na tabela ainda.</td>
                  </tr>
                )}
                {itens.map((i) => (
                  <tr key={i.id}>
                    <td>{i.procedimento ? `${i.procedimento.codigo} · ${i.procedimento.nome}` : '—'}</td>
                    <td className='text-end'>{moeda(i.procedimento?.precoParticular)}</td>
                    <td>
                      <div className='input-group input-group-sm'>
                        <span className='input-group-text'>R$</span>
                        <input
                          className='form-control text-end'
                          inputMode='numeric'
                          aria-label={`Preço negociado de ${i.procedimento?.nome ?? 'procedimento'}`}
                          value={valores[i.id] ?? numeroParaMoeda(i.valorNegociado)}
                          onChange={(e) => setValores((atual) => ({ ...atual, [i.id]: mascararMoeda(e.target.value) }))}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {fora.length > 0 && (
            <div className='row g-3 align-items-end'>
              <CampoSelecao
                id='tabelaNovoProcedimento'
                rotulo='Incluir procedimento'
                opcional
                valor={novoProc}
                aoMudar={setNovoProc}
                opcoes={fora.map((p) => [String(p.id), `${p.codigo} · ${p.nome}`])}
              />
              <CampoMoeda id='tabelaNovoValor' rotulo='Valor negociado' opcional valor={novoValor} aoMudar={(x) => setNovoValor(mascararMoeda(x))} largura='col-md-4' />
              <div className='col-md-2'>
                <button type='button' className='btn btn-outline-primary w-100' onClick={incluir} disabled={salvando}>
                  Incluir
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

// A-20 · Contratos e tabelas.
function Contratos() {
  const carregar = async () => {
    const [contratos, convenios] = await Promise.all([listar('contratosOperadora', { _sort: 'vigenciaInicio', _order: 'desc' }), listar('convenios')]);
    const convenio = porId(convenios);
    return { convenios, contratos: contratos.map((c) => ({ ...c, operadora: nomeOperadora(convenio[c.idConvenio]) })) };
  };
  const { dados, carregando, erro, recarregar } = useCarregar(carregar);
  const [editando, setEditando] = React.useState(null);
  const [tabela, setTabela] = React.useState(null);
  const salvo = () => {
    setEditando(null);
    recarregar();
  };
  return (
    <Pagina
      titulo='Contratos e tabelas'
      acoes={
        <button type='button' className='btn btn-primary' onClick={() => setEditando({ novo: true })} disabled={!dados}>
          + Novo contrato
        </button>
      }
    >
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={dados?.contratos ?? []}
        vazio='Nenhum contrato cadastrado.'
        legenda='Prazos na ordem: apresentação do lote, pagamento após o protocolo e recurso de glosa.'
        colunas={[
          { titulo: 'Operadora', render: (c) => c.operadora },
          { titulo: 'Nº do contrato', render: (c) => c.numero },
          { titulo: 'Vigência', render: (c) => `${mesAno(c.vigenciaInicio)} a ${mesAno(c.vigenciaFim)}` },
          { titulo: 'Versão TISS', render: (c) => c.versaoTiss },
          { titulo: 'Prazos', render: (c) => `${c.prazoApresentacao} · ${c.prazoPagamento} · ${c.prazoRecurso} dias` },
          {
            titulo: 'Status',
            render: (c) => {
              const vigente = ['ATIVO', 'VIGENTE'].includes(c.situacao);
              return <PilulaStatus rotulo={vigente ? 'Vigente' : 'Encerrado'} tom={vigente ? 'sucesso' : 'neutro'} />;
            },
          },
          {
            titulo: 'Ações',
            render: (c) => (
              <AcoesLinha
                acoes={[
                  { tipo: 'ver', alvo: `tabela de preços do contrato ${c.numero}`, aoClicar: () => setTabela(c) },
                  { tipo: 'editar', alvo: `contrato ${c.numero}`, aoClicar: () => setEditando({ contrato: c }) },
                ]}
              />
            ),
          },
        ]}
      />
      {editando && dados && <JanelaContrato contrato={editando.contrato} convenios={dados.convenios} aoFechar={() => setEditando(null)} aoSalvar={salvo} />}
      {tabela && <JanelaTabela contrato={tabela} aoFechar={() => setTabela(null)} />}
    </Pagina>
  );
}

export default Contratos;
