import React from 'react';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import { CampoSelect, Filtros } from '../../components/campos';
import { salvarComAviso, useConfirmacao } from '../../components/confirmacao';
import { listar, pessoasPorId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { diaMes, moeda } from '../../utils/formatos';
import { rotuloDe } from '../../utils/rotulos';

const SITUACAO_CAIXA = {
  ABERTO: { rotulo: 'Aberto', tom: 'info' },
  FECHADO: { rotulo: 'Fechado', tom: 'sucesso' },
  A_APROVAR: { rotulo: 'A aprovar', tom: 'aviso' },
  RECONTAGEM: { rotulo: 'Em recontagem', tom: 'neutro' },
};
const TURNO = { MANHA: 'manhã', TARDE: 'tarde', NOITE: 'noite' };

// A-16 · Caixas · supervisão. Só aqui aparece o saldo esperado (fechamento cego, D5).
function Caixas() {
  const carregar = async () => {
    const caixas = await listar('caixas', { _sort: 'dataAbertura', _order: 'desc' });
    const pessoas = await pessoasPorId(caixas.map((c) => c.idSecretaria));
    return caixas.map((c) => ({ ...c, operador: pessoas[c.idSecretaria]?.nome ?? '—' }));
  };
  const { dados, carregando, erro, recarregar } = useCarregar(carregar);
  const [modal, confirmar] = useConfirmacao();
  const [situacao, setSituacao] = React.useState('');

  const aprovar = async (c) => {
    const ok = await confirmar({
      titulo: `Aprovar o fechamento de ${c.operador}?`,
      texto: `Diferença de ${moeda(c.divergencia)}. Justificativa: ${c.justificativa ?? 'não informada'}.`,
      rotuloConfirmar: 'Aprovar fechamento',
    });
    if (ok && (await salvarComAviso('caixas', c.id, { situacao: 'FECHADO' }, 'Fechamento aprovado.'))) recarregar();
  };
  const devolver = async (c) => {
    const motivo = await confirmar({
      titulo: 'Devolver para recontagem?',
      texto: 'O turno continua aberto até a nova contagem.',
      campo: 'Motivo da devolução',
      rotuloConfirmar: 'Devolver',
    });
    if (motivo && (await salvarComAviso('caixas', c.id, { situacao: 'RECONTAGEM', motivoDevolucao: motivo }, 'Fechamento devolvido para recontagem.'))) recarregar();
  };

  const linhas = (dados ?? []).filter((c) => !situacao || c.situacao === situacao);
  return (
    <Pagina titulo='Caixas'>
      <Filtros>
        <CampoSelect
          id='caixaSituacao'
          rotulo='Situação'
          valor={situacao}
          aoMudar={setSituacao}
          opcoes={[['', 'Todas'], ...Object.entries(SITUACAO_CAIXA).map(([k, v]) => [k, v.rotulo])]}
        />
      </Filtros>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={linhas}
        vazio='Nenhum caixa nesta seleção.'
        colunas={[
          { titulo: 'Operador', render: (c) => c.operador },
          { titulo: 'Turno', render: (c) => `${diaMes(c.dataAbertura)} · ${TURNO[c.turno] ?? '—'}` },
          { titulo: 'Esperado', classe: 'text-end', render: (c) => moeda(c.saldoApurado) },
          { titulo: 'Contado', classe: 'text-end', render: (c) => moeda(c.saldoContado) },
          { titulo: 'Diferença', classe: 'text-end', render: (c) => (c.divergencia ? moeda(c.divergencia) : '—') },
          {
            titulo: 'Situação',
            render: (c) => (
              <PilulaStatus
                {...rotuloDe(SITUACAO_CAIXA, c.situacao)}
                transicoes={
                  c.situacao === 'A_APROVAR'
                    ? [
                        { rotulo: 'Aprovar fechamento', aoEscolher: () => aprovar(c) },
                        { rotulo: 'Devolver para recontagem', aoEscolher: () => devolver(c) },
                      ]
                    : null
                }
              />
            ),
          },
        ]}
      />
      {modal}
    </Pagina>
  );
}

export default Caixas;
