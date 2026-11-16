import React from 'react';

import VisibilityIcon from '@mui/icons-material/VisibilityOutlined';
import EditIcon from '@mui/icons-material/EditOutlined';
import EditNoteIcon from '@mui/icons-material/EditNoteOutlined';
import ArchiveIcon from '@mui/icons-material/ArchiveOutlined';
import UnarchiveIcon from '@mui/icons-material/UnarchiveOutlined';
import BlockIcon from '@mui/icons-material/BlockOutlined';
import UndoIcon from '@mui/icons-material/UndoOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import DownloadIcon from '@mui/icons-material/DownloadOutlined';

// Ícones de ação das linhas (BotaoIcone do Figma). Excluir só existe nas três
// hipóteses de A1-R09; nos demais casos a ação é Inativar, Cancelar ou Estornar.
const ICONES = {
  ver: { icone: VisibilityIcon, verbo: 'Ver' },
  editar: { icone: EditIcon, verbo: 'Editar' },
  retificar: { icone: EditNoteIcon, verbo: 'Retificar' },
  inativar: { icone: ArchiveIcon, verbo: 'Inativar' },
  reativar: { icone: UnarchiveIcon, verbo: 'Reativar' },
  cancelar: { icone: BlockIcon, verbo: 'Cancelar' },
  estornar: { icone: UndoIcon, verbo: 'Estornar' },
  excluir: { icone: DeleteIcon, verbo: 'Excluir', perigo: true },
  baixar: { icone: DownloadIcon, verbo: 'Baixar' },
};

// acoes: [{ tipo: 'ver', alvo: 'Ana Souza', aoClicar }]
function AcoesLinha({ acoes }) {
  return (
    <div className='d-flex gap-1 acoes-linha'>
      {acoes.map(({ tipo, alvo, aoClicar }) => {
        const { icone: Icone, verbo, perigo } = ICONES[tipo];
        const rotulo = alvo ? `${verbo}: ${alvo}` : verbo;
        return (
          <button
            key={tipo}
            type='button'
            className={`btn btn-sm botao-icone ${perigo ? 'botao-icone-perigo' : ''}`}
            title={verbo}
            aria-label={rotulo}
            onClick={aoClicar}
          >
            <Icone fontSize='small' aria-hidden='true' />
          </button>
        );
      })}
    </div>
  );
}

export default AcoesLinha;
