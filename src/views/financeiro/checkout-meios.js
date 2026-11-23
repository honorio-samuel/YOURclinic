import React from 'react';

import QrCode2Icon from '@mui/icons-material/QrCode2';

import { CampoMoeda, CampoSelecao, CampoTexto, useFormulario } from '../../components/formulario';
import { mensagemDeErro } from '../../components/confirmacao';
import { mensagemErro, mensagemSucesso, mostrarMensagem } from '../../components/toastr';
import { confirmarTef, consultarPix, maximoDeParcelas, novaChave, receber } from '../../servicos/checkout';
import { hora, moeda } from '../../utils/formatos';
import { mascararDigitos, mascararMoeda, moedaParaNumero } from '../../utils/mascaras';
import { BANDEIRA, MODALIDADE_CARTAO } from '../../utils/rotulos';

// Painéis de cada meio do checkout (S-07a a S-07d). Recebem a cobrança (d),
// o valor deste meio e aoAtualizar, que troca a cobrança pela da resposta.
// Nenhum painel tem campo de número de cartão, validade ou código de
// segurança (RN-43.4).

const PARCELADAS = ['CREDITO_PARCELADO_LOJISTA', 'CREDITO_PARCELADO_EMISSOR'];

function opcoesDeModalidade(maximo) {
  return Object.entries(MODALIDADE_CARTAO).filter(([m]) => maximo >= 2 || !PARCELADAS.includes(m));
}

// RN-43.3: o valor de cada parcela e se há acréscimo, antes de confirmar.
function opcoesDeParcelas(valor, maximo, modalidade) {
  return Array.from({ length: Math.max(0, maximo - 1) }, (_, i) => i + 2).map((n) => [
    String(n),
    modalidade === 'CREDITO_PARCELADO_LOJISTA'
      ? `${n}x de ${moeda(Math.round((valor / n) * 100) / 100)}, sem acréscimo`
      : `${n}x, com os juros do banco do paciente na fatura`,
  ]);
}

const semValor = () => mensagemErro('Informe o valor a receber neste meio.');

export function PainelDinheiro({ id, valor, aoAtualizar }) {
  const [recebido, setRecebido] = React.useState('');
  const [erro, setErro] = React.useState(null);
  const [salvando, setSalvando] = React.useState(false);
  const numero = moedaParaNumero(recebido);
  const troco = numero !== null && valor ? Math.round((numero - valor) * 100) / 100 : null;

  const registrar = async () => {
    if (!valor) return semValor();
    if (numero === null || numero < valor) {
      setErro('O valor recebido não cobre o valor a pagar.');
      document.getElementById('dinheiroRecebido')?.focus();
      return undefined;
    }
    setSalvando(true);
    try {
      const r = await receber(id, 'dinheiro', { valor, valorRecebido: numero });
      mensagemSucesso(`Recebido em dinheiro: ${moeda(valor)}.${r.pagamento.troco ? ` Troco: ${moeda(r.pagamento.troco)}.` : ''}`);
      setRecebido('');
      aoAtualizar(r);
    } catch (e) {
      mensagemErro(mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
    return undefined;
  };

  return (
    <div className='row g-3'>
      <CampoMoeda
        id='dinheiroRecebido'
        rotulo='Valor entregue pelo paciente'
        valor={recebido}
        aoMudar={(v) => {
          setRecebido(mascararMoeda(v));
          setErro(null);
        }}
        erro={erro}
        largura='col-sm-6'
      />
      <div className='col-sm-6 d-flex align-items-end'>
        <p className='mb-2 fs-5' aria-live='polite'>
          {troco !== null && troco >= 0 ? `Troco: ${moeda(troco)}` : ''}
        </p>
      </div>
      <div className='col-12'>
        <button type='button' className='btn btn-primary' onClick={registrar} disabled={salvando}>
          {salvando ? 'Registrando…' : 'Registrar recebimento'}
        </button>
      </div>
    </div>
  );
}

// RF44: QR dinâmico. A tela consulta o PSP sozinha, com intervalo crescente,
// até o pagamento chegar ou o QR expirar.
export function PainelPix({ id, valor, d, aoAtualizar }) {
  const pendente = [...d.pagamentos].reverse().find((p) => p.meio === 'PIX' && p.situacao === 'PENDENTE');
  const [aviso, setAviso] = React.useState(null);
  const [ocupado, setOcupado] = React.useState(false);
  const idPendente = pendente?.id;
  const atualizar = React.useRef(aoAtualizar);
  atualizar.current = aoAtualizar;

  const consultar = React.useCallback(
    async (acao = 'verificar') => {
      if (!idPendente) return;
      const r = await consultarPix(idPendente, acao);
      atualizar.current(r);
      const s = r.pagamento.situacao;
      if (s === 'CONFIRMADO') mensagemSucesso(`Pix recebido: ${moeda(r.pagamento.valor)}.`);
      if (s === 'EXPIRADO') setAviso('O QR Code expirou sem pagamento. Gere um novo para tentar de novo.');
      if (s === 'CANCELADO') setAviso('QR Code cancelado. O valor voltou a ficar livre para outro meio.');
    },
    [idPendente]
  );

  React.useEffect(() => {
    if (!idPendente) return undefined;
    let ativo = true;
    let tentativa = 0;
    let espera;
    const intervalos = [3000, 3000, 4000, 5000, 8000, 10000];
    const proxima = () => {
      espera = setTimeout(async () => {
        try {
          await consultar();
        } catch {
          // Sem resposta agora: tenta de novo no próximo intervalo.
        }
        tentativa += 1;
        if (ativo) proxima();
      }, intervalos[Math.min(tentativa, intervalos.length - 1)]);
    };
    proxima();
    return () => {
      ativo = false;
      clearTimeout(espera);
    };
  }, [idPendente, consultar]);

  const gerar = async () => {
    if (!valor) return semValor();
    setOcupado(true);
    setAviso(null);
    try {
      aoAtualizar(await receber(id, 'pix', { valor }));
    } catch (e) {
      mensagemErro(mensagemDeErro(e));
    } finally {
      setOcupado(false);
    }
    return undefined;
  };

  const agir = async (acao) => {
    setOcupado(true);
    try {
      await consultar(acao);
    } catch (e) {
      mensagemErro(mensagemDeErro(e));
    } finally {
      setOcupado(false);
    }
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(pendente.brcode);
      mostrarMensagem('Copiado', 'Código Pix copiado.', 'success');
    } catch {
      document.getElementById('pixCopiaECola')?.select();
    }
  };

  if (!pendente) {
    return (
      <div className='d-flex flex-column align-items-start gap-2'>
        {aviso && (
          <div className='alert alert-info mb-0' role='status'>
            {aviso}
          </div>
        )}
        <button type='button' className='btn btn-primary' onClick={gerar} disabled={ocupado}>
          {ocupado ? 'Gerando…' : `Gerar QR Code de ${valor ? moeda(valor) : '…'}`}
        </button>
      </div>
    );
  }

  return (
    <div className='d-flex flex-wrap gap-3 align-items-start'>
      <div className='qr-simulado' role='img' aria-label='QR Code da cobrança, simulado'>
        <QrCode2Icon aria-hidden='true' />
      </div>
      <div className='flex-grow-1 min-w-0'>
        <p className='mb-1' aria-live='polite'>
          <strong>Aguardando o pagamento</strong> de {moeda(pendente.valor)}. A tela atualiza sozinha.
        </p>
        <p className='small text-body-secondary'>O QR Code expira às {hora(pendente.expiracao)}.</p>
        <label htmlFor='pixCopiaECola' className='form-label'>
          Pix copia e cola
        </label>
        <textarea id='pixCopiaECola' readOnly className='form-control font-monospace small' rows='3' value={pendente.brcode ?? ''} />
        <div className='d-flex flex-wrap gap-2 mt-2'>
          <button type='button' className='btn btn-outline-primary btn-sm' onClick={copiar}>
            Copiar código
          </button>
          <button type='button' className='btn btn-outline-primary btn-sm' onClick={() => agir('verificar')} disabled={ocupado}>
            Verificar agora
          </button>
          <button type='button' className='btn btn-outline-danger btn-sm' onClick={() => agir('cancelar')} disabled={ocupado}>
            Cancelar QR Code
          </button>
        </div>
        <p className='small text-body-secondary mt-2 mb-0'>
          Ambiente de demonstração: o provedor do Pix é simulado e este código não vale em banco.
        </p>
      </div>
    </div>
  );
}

function CampoParcelamento({ id, valor, maximo, modalidade, aoMudarModalidade, parcelas, aoMudarParcelas }) {
  const parcelado = PARCELADAS.includes(modalidade);
  return (
    <>
      <CampoSelecao
        id={`${id}-modalidade`}
        rotulo='Modalidade'
        valor={modalidade}
        aoMudar={aoMudarModalidade}
        opcoes={opcoesDeModalidade(maximo)}
        ajuda={maximo < 2 ? 'Este valor não pode ser parcelado.' : null}
      />
      {parcelado && (
        <CampoSelecao
          id={`${id}-parcelas`}
          rotulo='Parcelas'
          valor={parcelas}
          aoMudar={aoMudarParcelas}
          opcoes={opcoesDeParcelas(valor, maximo, modalidade)}
          ajuda={
            modalidade === 'CREDITO_PARCELADO_LOJISTA'
              ? 'A clínica recebe parcela a parcela.'
              : 'A clínica recebe de uma vez; o banco do paciente cobra os juros.'
          }
        />
      )}
    </>
  );
}

// RF45: o valor vai ao terminal, que devolve bandeira, final, NSU e
// autorização. A tela fica travada até o desfecho, para não cobrar em dobro.
export function PainelTef({ id, valor, d, aoAtualizar }) {
  const [modalidade, setModalidade] = React.useState('DEBITO');
  const [parcelas, setParcelas] = React.useState('2');
  const [terminal, setTerminal] = React.useState(null);
  const [resultado, setResultado] = React.useState(null);
  const maximo = maximoDeParcelas(valor ?? 0, d.parcelas);
  const parcelado = PARCELADAS.includes(modalidade);
  const caixaDoTerminal = React.useRef(null);

  React.useEffect(() => {
    if (terminal) caixaDoTerminal.current?.focus();
  }, [terminal]);

  const enviar = async () => {
    if (!valor) return semValor();
    if (parcelado && maximo < 2) return mensagemErro('Este valor não pode ser parcelado.');
    setResultado(null);
    setTerminal('Solicite ao paciente que insira ou aproxime o cartão no terminal.');
    try {
      let r = await receber(id, 'tef', { valor, modalidade, parcelas: parcelado ? Number(parcelas) : undefined, chave: novaChave() });
      if (r.pagamento.situacao === 'INDEFINIDO') {
        setTerminal('Aguarde a confirmação. Não passe o cartão novamente.');
        await new Promise((pronto) => setTimeout(pronto, 2000));
        r = await confirmarTef(r.pagamento.id);
      }
      aoAtualizar(r);
      const p = r.pagamento;
      if (p.situacao === 'CONFIRMADO') mensagemSucesso(`Cartão aprovado: ${BANDEIRA[p.bandeira] ?? p.bandeira} final ${p.ultimosDigitos}.`);
      if (p.situacao === 'NEGADO') setResultado({ tom: 'danger', texto: 'Transação não autorizada pelo banco emissor. Tente outro cartão ou outro meio.' });
      if (p.situacao === 'NAO_REALIZADO') setResultado({ tom: 'info', texto: 'Nenhuma cobrança foi feita. Pode tentar novamente.' });
    } catch (e) {
      mensagemErro(mensagemDeErro(e));
    } finally {
      setTerminal(null);
    }
    return undefined;
  };

  return (
    <div className='row g-3'>
      <CampoParcelamento
        id='tef'
        valor={valor ?? 0}
        maximo={maximo}
        modalidade={modalidade}
        aoMudarModalidade={setModalidade}
        parcelas={parcelas}
        aoMudarParcelas={setParcelas}
      />
      {resultado && (
        <div className='col-12'>
          <div className={`alert alert-${resultado.tom} mb-0`} role='alert'>
            {resultado.texto}
          </div>
        </div>
      )}
      <div className='col-12'>
        <button type='button' className='btn btn-primary' onClick={enviar} disabled={Boolean(terminal)}>
          Enviar {valor ? moeda(valor) : ''} ao terminal
        </button>
      </div>
      {terminal && (
        <>
          <div className='modal d-block' role='alertdialog' aria-modal='true' aria-labelledby='tefTitulo' aria-describedby='tefTexto'>
            <div className='modal-dialog modal-dialog-centered'>
              <div className='modal-content' tabIndex='-1' ref={caixaDoTerminal}>
                <div className='modal-body text-center p-4'>
                  <div className='spinner-border text-primary mb-3' aria-hidden='true' />
                  <h2 id='tefTitulo' className='h5'>
                    Maquininha integrada
                  </h2>
                  <p id='tefTexto' className='mb-0' aria-live='assertive'>
                    {terminal}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className='modal-backdrop show' />
        </>
      )}
    </div>
  );
}

const POS_VAZIO = { adquirente: '', modalidade: 'CREDITO', parcelas: '2', bandeira: '', ultimosDigitos: '', nsu: '', codigoAutorizacao: '' };

// RF46: lançamento do comprovante da maquininha avulsa. Não confirma nada com
// o adquirente: a conciliação confere depois, e acima do limite outro usuário
// confere antes da baixa.
export function PainelPos({ id, valor, d, aoAtualizar }) {
  const form = useFormulario(POS_VAZIO, 'pos-');
  const v = form.valores;
  const [salvando, setSalvando] = React.useState(false);
  const maximo = maximoDeParcelas(valor ?? 0, d.parcelas);
  const parcelado = PARCELADAS.includes(v.modalidade);
  const acimaDoLimite = valor > d.limiteSemConferencia;

  const salvar = async (e) => {
    e.preventDefault();
    if (!valor) return semValor();
    const ok = form.validar({
      adquirente: v.adquirente ? null : 'Escolha o adquirente.',
      bandeira: v.bandeira ? null : 'Escolha a bandeira.',
      ultimosDigitos: /^\d{4}$/.test(v.ultimosDigitos) ? null : 'Informe os quatro últimos dígitos do cartão.',
      nsu: /^\d{4,12}$/.test(v.nsu) ? null : 'Informe o NSU do comprovante.',
      codigoAutorizacao: /^[A-Z0-9]{4,12}$/.test(v.codigoAutorizacao) ? null : 'Informe o código de autorização do comprovante.',
    });
    if (!ok) return undefined;
    setSalvando(true);
    try {
      const r = await receber(id, 'pos', { ...v, valor, parcelas: parcelado ? Number(v.parcelas) : undefined });
      if (r.pagamento.situacao === 'AGUARDANDO_CONFERENCIA') {
        mostrarMensagem('Lançamento registrado', 'Outro usuário confere com o comprovante antes da baixa.', 'info');
      } else {
        mensagemSucesso('Lançamento registrado. A conciliação confirma com o adquirente depois.');
      }
      form.carregar(POS_VAZIO);
      aoAtualizar(r);
    } catch (falha) {
      mensagemErro(mensagemDeErro(falha));
    } finally {
      setSalvando(false);
    }
    return undefined;
  };

  return (
    <form noValidate onSubmit={salvar} aria-label='Lançamento da maquininha avulsa' className='row g-3'>
      <div className='col-12'>
        <p className='valor-maquininha mb-0'>
          Digite na maquininha: <strong>{valor ? moeda(valor) : '—'}</strong>
        </p>
      </div>
      <div className='col-12'>
        <div className='alert alert-warning mb-0' role='note'>
          Este meio não confirma a transação com o adquirente: o lançamento fica pendente de conciliação.
          {acimaDoLimite && ` Acima de ${moeda(d.limiteSemConferencia)}, outro usuário confere com o comprovante antes da baixa.`}
        </div>
      </div>
      <CampoSelecao {...form.campo('adquirente')} rotulo='Adquirente' opcoes={d.adquirentes.map((a) => [a, a])} />
      <CampoParcelamento
        id='pos'
        valor={valor ?? 0}
        maximo={maximo}
        modalidade={v.modalidade}
        aoMudarModalidade={(m) => form.definir('modalidade', m)}
        parcelas={v.parcelas}
        aoMudarParcelas={(p) => form.definir('parcelas', p)}
      />
      <CampoSelecao {...form.campo('bandeira')} rotulo='Bandeira' opcoes={d.bandeiras.map((b) => [b, BANDEIRA[b] ?? b])} />
      <CampoTexto
        {...form.campo('ultimosDigitos', mascararDigitos(4))}
        rotulo='Quatro últimos dígitos do cartão'
        inputMode='numeric'
        autoComplete='off'
        largura='col-md-6'
      />
      <CampoTexto {...form.campo('nsu', mascararDigitos(12))} rotulo='NSU' inputMode='numeric' autoComplete='off' largura='col-md-6' />
      <CampoTexto
        {...form.campo('codigoAutorizacao', (t) => t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12))}
        rotulo='Código de autorização'
        autoComplete='off'
        largura='col-md-6'
      />
      <div className='col-12'>
        <button type='submit' className='btn btn-primary' disabled={salvando}>
          {salvando ? 'Registrando…' : 'Registrar lançamento'}
        </button>
      </div>
    </form>
  );
}
