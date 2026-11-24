'use strict';

// RF59: modelo e canal de cada aviso. O texto leva só quem, quando, com quem
// e onde (RF21); nada de conteúdo clínico.

const CAMPOS_DO_MODELO = ['{paciente}', '{data}', '{hora}', '{medico}', '{local}'];
const CANAIS = ['WHATSAPP', 'SMS', 'EMAIL'];

const MODELOS_PADRAO = [
  ['CONFIRMACAO_AGENDAMENTO', 'Olá, {paciente}. Sua consulta com {medico} está marcada para {data} às {hora}, em {local}.'],
  ['LEMBRETE_CONSULTA', 'Lembrete: consulta com {medico} em {data} às {hora}, em {local}. Para remarcar, use o portal.'],
  ['REMARCACAO_CONSULTA', 'Sua consulta com {medico} foi remarcada para {data} às {hora}, em {local}.'],
  ['CANCELAMENTO_CONSULTA', 'Sua consulta de {data} às {hora} com {medico} foi cancelada pela clínica. Fale conosco para remarcar.'],
  ['CANCELAMENTO_PELO_TITULAR', 'Cancelamento confirmado: consulta de {data} às {hora} com {medico}.'],
  ['COBRANCA_DISPONIVEL', 'Olá, {paciente}. Há uma cobrança disponível no portal da clínica.'],
  ['PAGAMENTO_CONFIRMADO', 'Pagamento confirmado. O recibo fica no portal da clínica.'],
  ['ORCAMENTO_DISPONIVEL', 'Olá, {paciente}. Seu orçamento está disponível no portal da clínica.'],
].map(([evento, texto]) => ({ evento, texto, canal: 'WHATSAPP', ativo: true }));

function validarModelo(novo) {
  if (typeof novo.texto !== 'string' || novo.texto.trim().length < 10 || novo.texto.length > 300) return 'O texto vai de 10 a 300 caracteres.';
  const desconhecido = (novo.texto.match(/\{[^}]*\}/g) ?? []).find((c) => !CAMPOS_DO_MODELO.includes(c));
  if (desconhecido) return `O campo ${desconhecido} não existe. Use ${CAMPOS_DO_MODELO.join(', ')}.`;
  if (!CANAIS.includes(novo.canal)) return 'Escolha o canal.';
  if (typeof novo.ativo !== 'boolean') return 'Informe se o aviso está ativo.';
  return null;
}

module.exports = { CAMPOS_DO_MODELO, CANAIS, MODELOS_PADRAO, validarModelo };
