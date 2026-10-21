import React from 'react';

import PilulaStatus from '../../components/pilula-status';
import AcoesLinha from '../../components/acoes-linha';
import { emBreve } from '../../components/confirmacao';
import { rotuloDe, SITUACAO_CADASTRO } from '../../utils/rotulos';

// Partes usadas por mais de uma tela desta pasta.

export const OPCOES_STATUS = [['', 'Todos'], ['ATIVO', 'Ativos'], ['INATIVO', 'Inativos']];

// Coluna de status com a pílula Ativo ⇄ Inativo e a coluna de ações por situação.
export function colunasDeSituacao(alternar, nomeDe, podeAlterar = () => true) {
  return [
    {
      titulo: 'Status',
      render: (l) => (
        <PilulaStatus
          {...rotuloDe(SITUACAO_CADASTRO, l.situacao)}
          transicoes={
            !podeAlterar(l) || !['ATIVO', 'INATIVO'].includes(l.situacao)
              ? null
              : [
                  l.situacao === 'ATIVO'
                    ? { rotulo: 'Inativar', aoEscolher: () => alternar(l, nomeDe(l), 'INATIVO') }
                    : { rotulo: 'Reativar', aoEscolher: () => alternar(l, nomeDe(l), 'ATIVO') },
                ]
          }
        />
      ),
    },
    {
      titulo: 'Ações',
      render: (l) => {
        const alvo = nomeDe(l);
        const ver = { tipo: 'ver', alvo, aoClicar: () => emBreve('O detalhe do cadastro') };
        if (!podeAlterar(l)) return <AcoesLinha acoes={[ver]} />;
        return (
          <AcoesLinha
            acoes={
              l.situacao === 'INATIVO'
                ? [ver, { tipo: 'reativar', alvo, aoClicar: () => alternar(l, alvo, 'ATIVO') }]
                : [
                    ver,
                    { tipo: 'editar', alvo, aoClicar: () => emBreve('A edição do cadastro') },
                    { tipo: 'inativar', alvo, aoClicar: () => alternar(l, alvo, 'INATIVO') },
                  ]
            }
          />
        );
      },
    },
  ];
}
