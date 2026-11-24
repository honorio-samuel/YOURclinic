import React from 'react';

import Modal from './modal';
import { mensagemErro, mensagemSucesso } from './toastr';
import { conteudoDoAnexo, enviarAnexo, salvarComo } from '../servicos/anexos';
import { diaMesHora } from '../utils/formatos';

// Envio e visualização de anexos de exame (RF26, RF27).

const ACEITOS = ['pdf', 'jpg', 'jpeg', 'png'];
const LIMITE_MB = 5; // X13; a API confere de novo com o valor vigente

const tamanhoLegivel = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

// Escolhe o arquivo e envia. Quem envia vê só os metadados do que mandou.
export function BotaoEnviarArquivo({ idPaciente, aoEnviar, rotulo = 'Enviar arquivo', classe = 'btn btn-primary', ajuda }) {
  const entrada = React.useRef(null);
  const [enviando, setEnviando] = React.useState(false);

  const escolher = async (e) => {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    const extensao = arquivo.name.toLowerCase().split('.').pop();
    if (!ACEITOS.includes(extensao)) {
      mensagemErro('Envie um PDF, JPG ou PNG.');
      return;
    }
    if (arquivo.size > LIMITE_MB * 1024 * 1024) {
      mensagemErro(`O arquivo passa de ${LIMITE_MB} MB.`);
      return;
    }
    setEnviando(true);
    try {
      const anexo = await enviarAnexo(arquivo, idPaciente);
      mensagemSucesso(`Arquivo enviado: ${anexo.nomeArquivo}, ${tamanhoLegivel(anexo.tamanho)}, em ${diaMesHora(anexo.dataEnvio)}.`);
      aoEnviar?.(anexo);
    } catch (falha) {
      const status = falha.response?.status;
      mensagemErro(
        falha.response?.data?.erro ?? (status === 413 ? `O arquivo passa de ${LIMITE_MB} MB.` : status === 403 ? 'Seu perfil não pode enviar para este paciente.' : 'Não foi possível enviar agora.')
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <input ref={entrada} type='file' className='d-none' accept='.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png' onChange={escolher} tabIndex={-1} aria-hidden='true' />
      <button type='button' className={classe} onClick={() => entrada.current?.click()} disabled={enviando} title={ajuda}>
        {enviando ? 'Enviando…' : rotulo}
      </button>
    </>
  );
}

export async function baixarAnexo(anexo) {
  try {
    salvarComo(await conteudoDoAnexo(anexo.id, true), anexo.nomeArquivo);
  } catch {
    mensagemErro('Não foi possível baixar o arquivo agora.');
  }
}

// O conteúdo abre numa janela da própria tela, a partir do arquivo recebido
// com a sessão de quem pediu.
export function VisualizadorDeAnexo({ anexo, aoFechar }) {
  const [estado, setEstado] = React.useState({ url: null, blob: null, erro: false });

  React.useEffect(() => {
    let url = null;
    let ativo = true;
    conteudoDoAnexo(anexo.id)
      .then((blob) => {
        url = URL.createObjectURL(blob);
        if (ativo) setEstado({ url, blob, erro: false });
      })
      .catch(() => ativo && setEstado({ url: null, blob: null, erro: true }));
    return () => {
      ativo = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [anexo.id]);

  const pdf = estado.blob?.type?.includes('pdf');
  return (
    <Modal
      titulo={anexo.nomeArquivo}
      aoFechar={aoFechar}
      largo
      rodape={
        <>
          <button type='button' className='btn btn-outline-secondary' onClick={aoFechar}>
            Fechar
          </button>
          <button type='button' className='btn btn-primary' disabled={!estado.blob} onClick={() => salvarComo(estado.blob, anexo.nomeArquivo)}>
            Baixar
          </button>
        </>
      }
    >
      {estado.erro && <p className='text-danger mb-0'>Não foi possível abrir o arquivo agora.</p>}
      {!estado.erro && !estado.url && <p className='text-body-secondary mb-0'>Carregando…</p>}
      {estado.url &&
        (pdf ? (
          <iframe title={`Conteúdo de ${anexo.nomeArquivo}`} src={estado.url} className='w-100 border rounded' style={{ height: '65vh' }} />
        ) : (
          <img src={estado.url} alt={`Exame ${anexo.nomeArquivo}`} className='img-fluid d-block mx-auto' />
        ))}
    </Modal>
  );
}
