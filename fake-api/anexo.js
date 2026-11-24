'use strict';

// Anexos de exame (RF26, RF27). O tipo vale pelo conteúdo, não pela extensão
// (RNF08); a varredura antivírus é simulada pela assinatura de teste EICAR. Os
// exames do banco sintético não têm arquivo: a API gera um de demonstração.

const zlib = require('node:zlib');

const TIPOS = {
  'application/pdf': ['pdf'],
  'image/png': ['png'],
  'image/jpeg': ['jpg', 'jpeg'],
};

// Tipo MIME real pelos primeiros bytes.
function detectarTipo(buffer) {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  return null;
}

function tipoPelaExtensao(nome) {
  const extensao = String(nome ?? '').toLowerCase().split('.').pop();
  return Object.keys(TIPOS).find((tipo) => TIPOS[tipo].includes(extensao)) ?? null;
}

// Arquivo de teste padrão dos antivírus: a varredura simulada o reprova.
const EICAR = 'EICAR-STANDARD-ANTIVIRUS-TEST-FILE';
const reprovadoNaVarredura = (buffer) => buffer.includes(EICAR, 0, 'latin1');

// Só o nome do arquivo, sem caminho nem caracteres de controle.
function nomeSeguro(nome) {
  const base = String(nome ?? '').split(/[\\/]/).pop().replace(/[\u0000-\u001f<>:"|?*]/g, '').trim();
  return base.slice(0, 120) || 'arquivo';
}

// PDF mínimo de uma página, com texto em Helvetica (WinAnsi: os acentos do
// português cabem em latin1).
function pdfDeDemonstracao(linhas) {
  const escapar = (t) => t.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const texto = linhas
    .map((linha, i) => `BT /F1 ${i === 0 ? 16 : 11} Tf 64 ${770 - i * 24} Td (${escapar(linha)}) Tj ET`)
    .join('\n');
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(texto, 'latin1')} >>\nstream\n${texto}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ];
  let corpo = '%PDF-1.4\n';
  const posicoes = [];
  objetos.forEach((objeto, i) => {
    posicoes.push(Buffer.byteLength(corpo, 'latin1'));
    corpo += `${i + 1} 0 obj\n${objeto}\nendobj\n`;
  });
  const xref = Buffer.byteLength(corpo, 'latin1');
  corpo += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n${posicoes.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('')}`;
  corpo += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(corpo, 'latin1');
}

// PNG de demonstração: degradê cinza com um quadro ao centro.
function pngDeDemonstracao(largura = 480, altura = 320) {
  const crc = (dados) => {
    let c = ~0;
    for (const byte of dados) {
      c ^= byte;
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return (~c) >>> 0;
  };
  const bloco = (tipo, dados) => {
    const tamanho = Buffer.alloc(4);
    tamanho.writeUInt32BE(dados.length);
    const tipoEDados = Buffer.concat([Buffer.from(tipo, 'latin1'), dados]);
    const soma = Buffer.alloc(4);
    soma.writeUInt32BE(crc(tipoEDados));
    return Buffer.concat([tamanho, tipoEDados, soma]);
  };
  const cabecalho = Buffer.alloc(13);
  cabecalho.writeUInt32BE(largura, 0);
  cabecalho.writeUInt32BE(altura, 4);
  cabecalho.writeUInt8(8, 8); // 8 bits
  cabecalho.writeUInt8(2, 9); // RGB
  const linhas = [];
  for (let y = 0; y < altura; y++) {
    const linha = Buffer.alloc(1 + largura * 3);
    for (let x = 0; x < largura; x++) {
      const dentro = x > largura * 0.3 && x < largura * 0.7 && y > altura * 0.2 && y < altura * 0.8;
      const tom = dentro ? 200 - Math.round((y / altura) * 60) : 60 + Math.round((x / largura) * 80);
      linha.writeUInt8(tom, 1 + x * 3);
      linha.writeUInt8(tom, 2 + x * 3);
      linha.writeUInt8(tom + (dentro ? 10 : 0), 3 + x * 3);
    }
    linhas.push(linha);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco('IHDR', cabecalho),
    bloco('IDAT', zlib.deflateSync(Buffer.concat(linhas))),
    bloco('IEND', Buffer.alloc(0)),
  ]);
}

// Arquivo de demonstração para um exame do banco sintético.
function arquivoDeDemonstracao(anexo) {
  if (anexo.tipoMime === 'application/pdf') {
    return pdfDeDemonstracao([
      'YOURClinic · exame de demonstração',
      `Arquivo: ${anexo.nomeArquivo}`,
      `Enviado em: ${anexo.dataEnvio.slice(8, 10)}/${anexo.dataEnvio.slice(5, 7)}/${anexo.dataEnvio.slice(0, 4)}`,
      'Conteúdo fictício, gerado pela API local para a apresentação.',
    ]);
  }
  return pngDeDemonstracao();
}

module.exports = { TIPOS, detectarTipo, tipoPelaExtensao, reprovadoNaVarredura, nomeSeguro, arquivoDeDemonstracao };
