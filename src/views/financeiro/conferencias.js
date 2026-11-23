import React from 'react';

import Listagem from '../../components/listagem';
import { mensagemDeErro, useConfirmacao } from '../../components/confirmacao';
import { mensagemErro, mensagemSucesso } from '../../components/toastr';
import { conferir, listarConferencias } from '../../servicos/checkout';
import { useCarregar } from '../../hooks/use-carregar';
import { hora, moeda } from '../../utils/formatos';
import { BANDEIRA, MODALIDADE_CARTAO } from '../../utils/rotulos';

// Lançamentos da maquininha avulsa acima do limite, à espera de outro usuário
// (Secretária ou Administrador) que confira com o comprovante. Quem lançou vê
// o item, mas não confere. Some quando não há nada a conferir.
function ConferenciasPos({ aoConferir }) {
  const { dados, erro, recarregar } = useCarregar(listarConferencias);
  const [modal, confirmar] = useConfirmacao();

  if (erro || !dados?.length) return null;

  const decidir = async (p, aprovar) => {
    const resposta = await confirmar(
      aprovar
        ? {
            titulo: `Confirmar o lançamento de ${moeda(p.valor)}?`,
            texto: `${p.paciente}: ${BANDEIRA[p.bandeira] ?? p.bandeira} final ${p.ultimosDigitos}, NSU ${p.nsu}, autorização ${p.codigoAutorizacao}. Confira com o comprovante antes de confirmar.`,
            rotuloConfirmar: 'Confirmar',
          }
        : {
            titulo: 'Recusar o lançamento?',
            texto: 'O valor volta a ficar em aberto na cobrança, e quem lançou vê o motivo.',
            campo: 'Motivo da recusa',
            rotuloConfirmar: 'Recusar',
            perigo: true,
          }
    );
    if (!resposta) return;
    try {
      await conferir(p.id, aprovar ? { aprovar: true } : { aprovar: false, motivo: resposta });
      mensagemSucesso(aprovar ? 'Lançamento confirmado.' : 'Lançamento recusado.');
      recarregar();
      aoConferir?.();
    } catch (e) {
      mensagemErro(mensagemDeErro(e));
    }
  };

  return (
    <>
      <Listagem
        titulo='Maquininha avulsa: lançamentos a conferir'
        linhas={dados}
        legenda='Acima do limite, quem lançou não confere: outra pessoa compara com o comprovante.'
        colunas={[
          { titulo: 'Paciente', render: (p) => p.paciente },
          { titulo: 'Valor', classe: 'text-end', render: (p) => moeda(p.valor) },
          {
            titulo: 'Comprovante',
            render: (p) => (
              <>
                {BANDEIRA[p.bandeira] ?? p.bandeira} final {p.ultimosDigitos} · {MODALIDADE_CARTAO[p.modalidade] ?? p.modalidade}
                {p.parcelas > 1 ? ` em ${p.parcelas}x` : ''}
                <span className='d-block small text-body-secondary'>
                  NSU {p.nsu} · autorização {p.codigoAutorizacao} · {p.adquirente}
                </span>
              </>
            ),
          },
          { titulo: 'Lançado', render: (p) => `${p.lancadoPor ?? '—'}, ${hora(p.dataHora)}` },
          {
            titulo: 'Ações',
            render: (p) =>
              p.lancadoPorMim ? (
                <span className='small text-body-secondary'>Lançado por você: outra pessoa confere</span>
              ) : (
                <div className='d-flex flex-wrap gap-2'>
                  <button type='button' className='btn btn-sm btn-primary' onClick={() => decidir(p, true)}>
                    Confirmar
                  </button>
                  <button type='button' className='btn btn-sm btn-outline-danger' onClick={() => decidir(p, false)}>
                    Recusar
                  </button>
                </div>
              ),
          },
        ]}
      />
      {modal}
    </>
  );
}

export default ConferenciasPos;
