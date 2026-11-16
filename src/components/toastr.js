import toastr from 'toastr';

// O toastr anima em JavaScript, fora do alcance do CSS: para quem pede menos
// movimento ao sistema, o aviso aparece e some de uma vez, sem a barra de tempo.
const semMovimento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

toastr.options = {
  closeButton: true,
  debug: false,
  newestOnTop: false,
  progressBar: !semMovimento,
  positionClass: 'toast-top-right',
  preventDuplicates: false,
  onclick: null,
  showDuration: semMovimento ? 0 : 200,
  hideDuration: semMovimento ? 0 : 200,
  timeOut: '5000',
  extendedTimeOut: '1000',
  showEasing: 'swing',
  hideEasing: 'linear',
  showMethod: 'fadeIn',
  hideMethod: 'fadeOut',
};

export function mostrarMensagem(titulo, mensagem, tipo) {
  toastr[tipo](mensagem, titulo);
}

export function mensagemErro(mensagem) {
  mostrarMensagem('Erro', mensagem, 'error');
}

export function mensagemSucesso(mensagem) {
  mostrarMensagem('Sucesso', mensagem, 'success');
}

export function mensagemAlert(mensagem) {
  mostrarMensagem('Alerta', mensagem, 'warning');
}
