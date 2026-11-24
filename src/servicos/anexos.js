import { api } from '../config/axios';

// Anexos de exame (RF26, RF27). O arquivo vai em base64 para a API, que
// confere o tipo real, o tamanho e a varredura. O conteúdo volta como blob,
// com a sessão de quem pediu: não existe link público do arquivo.

function paraBase64(arquivo) {
  return new Promise((pronto, falha) => {
    const leitor = new FileReader();
    leitor.onload = () => pronto(String(leitor.result).split(',')[1] ?? '');
    leitor.onerror = () => falha(leitor.error);
    leitor.readAsDataURL(arquivo);
  });
}

export async function enviarAnexo(arquivo, idPaciente) {
  const conteudo = await paraBase64(arquivo);
  const { data } = await api.post('/anexos/envio', { idPaciente, nomeArquivo: arquivo.name, conteudo });
  return data;
}

export async function conteudoDoAnexo(id, baixar = false) {
  const { data } = await api.get(`/anexos/${id}/arquivo${baixar ? '?baixar' : ''}`, { responseType: 'blob' });
  return data;
}

export function salvarComo(blob, nome) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
