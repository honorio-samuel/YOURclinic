import React from 'react';

// Peças dos formulários de cadastro (A-02b e seguintes): campos com rótulo
// visível, erro em texto ligado ao campo por aria-describedby e duas colunas
// a partir de 768 px, como no Figma. Campo obrigatório leva "*" no rótulo e o
// atributo required, que o leitor de tela anuncia; o formulário explica o
// asterisco no topo (D10: nada indicado só por cor).

// Estado do formulário. "campo(nome, mascara)" devolve id, valor, erro e o
// tratador do campo; com "mascara", o valor é formatado enquanto se digita.
// O id do elemento é o nome do campo com o prefixo, para não colidir com
// outros elementos da página.
export function useFormulario(inicial, prefixo = 'campo-') {
  const [valores, setValores] = React.useState(inicial);
  const [erros, setErros] = React.useState({});
  const [sujo, setSujo] = React.useState(false);

  const definir = React.useCallback((nome, valor) => {
    setValores((atual) => ({ ...atual, [nome]: valor }));
    setErros((atual) => (atual[nome] ? { ...atual, [nome]: null } : atual));
    setSujo(true);
  }, []);

  const campo = (nome, mascara) => ({
    id: `${prefixo}${nome}`,
    valor: valores[nome],
    erro: erros[nome],
    aoMudar: (valor) => definir(nome, mascara ? mascara(valor) : valor),
  });

  const marcar = (nome) => ({
    id: `${prefixo}${nome}`,
    marcado: valores[nome],
    aoMudar: (valor) => definir(nome, valor),
  });

  const carregar = React.useCallback((novos) => {
    setValores(novos);
    setErros({});
    setSujo(false);
  }, []);

  // Recebe { campo: mensagem | null }. Mostra os erros e põe o foco no primeiro.
  const validar = (encontrados) => {
    const comErro = Object.fromEntries(Object.entries(encontrados).filter(([, msg]) => msg));
    setErros(comErro);
    const primeiro = Object.keys(comErro)[0];
    if (primeiro) {
      requestAnimationFrame(() => document.getElementById(`${prefixo}${primeiro}`)?.focus());
      return false;
    }
    return true;
  };

  return { valores, erros, sujo, definir, campo, marcar, carregar, validar };
}

function Rotulo({ id, rotulo, opcional }) {
  return (
    <label htmlFor={id} className='form-label'>
      {rotulo}
      {!opcional && (
        <span className='text-danger' aria-hidden='true'>
          {' '}
          *
        </span>
      )}
    </label>
  );
}

function Erro({ id, erro }) {
  if (!erro) return null;
  return (
    <div id={`${id}-erro`} className='invalid-feedback d-block'>
      {erro}
    </div>
  );
}

const descricao = (id, erro, ajuda) =>
  [erro ? `${id}-erro` : null, ajuda ? `${id}-ajuda` : null].filter(Boolean).join(' ') || undefined;

export function CampoTexto({
  id,
  rotulo,
  valor,
  aoMudar,
  erro,
  ajuda,
  opcional = false,
  tipo = 'text',
  largura = 'col-md-6',
  ...resto
}) {
  return (
    <div className={largura}>
      <Rotulo id={id} rotulo={rotulo} opcional={opcional} />
      <input
        id={id}
        type={tipo}
        className={`form-control${erro ? ' is-invalid' : ''}`}
        value={valor ?? ''}
        onChange={(e) => aoMudar(e.target.value)}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descricao(id, erro, ajuda)}
        required={!opcional}
        {...resto}
      />
      {ajuda && (
        <div id={`${id}-ajuda`} className='form-text'>
          {ajuda}
        </div>
      )}
      <Erro id={id} erro={erro} />
    </div>
  );
}

// opcoes: [[valor, rótulo]]. Sem valor escolhido, mostra "Selecione".
export function CampoSelecao({ id, rotulo, valor, aoMudar, opcoes, erro, ajuda, opcional = false, largura = 'col-md-6', ...resto }) {
  return (
    <div className={largura}>
      <Rotulo id={id} rotulo={rotulo} opcional={opcional} />
      <select
        id={id}
        className={`form-select${erro ? ' is-invalid' : ''}`}
        value={valor ?? ''}
        onChange={(e) => aoMudar(e.target.value)}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descricao(id, erro, ajuda)}
        required={!opcional}
        {...resto}
      >
        <option value=''>Selecione</option>
        {opcoes.map(([v, r]) => (
          <option key={v} value={v}>
            {r}
          </option>
        ))}
      </select>
      {ajuda && (
        <div id={`${id}-ajuda`} className='form-text'>
          {ajuda}
        </div>
      )}
      <Erro id={id} erro={erro} />
    </div>
  );
}

export function CampoTextoLongo({ id, rotulo, valor, aoMudar, erro, ajuda, opcional = false, linhas = 3, largura = 'col-12', ...resto }) {
  return (
    <div className={largura}>
      <Rotulo id={id} rotulo={rotulo} opcional={opcional} />
      <textarea
        id={id}
        className={`form-control${erro ? ' is-invalid' : ''}`}
        rows={linhas}
        value={valor ?? ''}
        onChange={(e) => aoMudar(e.target.value)}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descricao(id, erro, ajuda)}
        required={!opcional}
        {...resto}
      />
      {ajuda && (
        <div id={`${id}-ajuda`} className='form-text'>
          {ajuda}
        </div>
      )}
      <Erro id={id} erro={erro} />
    </div>
  );
}

export function CampoMarcar({ id, rotulo, marcado, aoMudar, ajuda, largura = 'col-12', ...resto }) {
  return (
    <div className={largura}>
      <div className='form-check'>
        <input
          id={id}
          type='checkbox'
          className='form-check-input'
          checked={Boolean(marcado)}
          onChange={(e) => aoMudar(e.target.checked)}
          aria-describedby={ajuda ? `${id}-ajuda` : undefined}
          {...resto}
        />
        <label htmlFor={id} className='form-check-label'>
          {rotulo}
        </label>
      </div>
      {ajuda && (
        <div id={`${id}-ajuda`} className='form-text ms-4'>
          {ajuda}
        </div>
      )}
    </div>
  );
}

// Parte do formulário em cartão (o SubCard do projeto de referência). Com
// título, é um fieldset com legend, que o leitor de tela lê antes de cada
// campo do grupo.
export function Secao({ titulo, children }) {
  if (!titulo) {
    return (
      <div className='card card-body'>
        <div className='row g-3'>{children}</div>
      </div>
    );
  }
  return (
    <fieldset className='card card-body'>
      <legend className='h5 mb-3'>{titulo}</legend>
      <div className='row g-3'>{children}</div>
    </fieldset>
  );
}

// Barra do pé: ações secundárias à esquerda; Cancelar e Salvar à direita.
export function Rodape({ esquerda, aoCancelar, salvando, rotuloSalvar = 'Salvar', rotuloCancelar = 'Cancelar', semSalvar = false }) {
  return (
    <div className='d-flex flex-wrap justify-content-between align-items-center gap-2'>
      <div className='d-flex flex-wrap gap-2'>{esquerda}</div>
      <div className='d-flex flex-wrap gap-2 ms-auto'>
        <button type='button' className='btn btn-outline-secondary' onClick={aoCancelar} disabled={salvando}>
          {rotuloCancelar}
        </button>
        {!semSalvar && (
          <button type='submit' className='btn btn-primary' disabled={salvando}>
            {salvando ? 'Salvando…' : rotuloSalvar}
          </button>
        )}
      </div>
    </div>
  );
}

// Em modo leitura os campos ficam desabilitados de uma vez; o rodapé fica
// fora do fieldset para que as ações continuem disponíveis.
export function Formulario({ aoEnviar, somenteLeitura = false, children, rodape, rotulo }) {
  return (
    <form noValidate onSubmit={aoEnviar} aria-label={rotulo} className='d-flex flex-column gap-3'>
      {!somenteLeitura && (
        <p className='mb-0'>
          Campos com <span className='text-danger'>*</span> são obrigatórios.
        </p>
      )}
      <fieldset disabled={somenteLeitura} className='d-flex flex-column gap-3'>
        {children}
      </fieldset>
      {rodape}
    </form>
  );
}

// Pergunta antes de sair de um formulário com alterações não salvas.
export function useSairSemSalvar(sujo, confirmar, sair) {
  return async () => {
    if (
      sujo &&
      !(await confirmar({
        titulo: 'Descartar as alterações?',
        texto: 'O que foi preenchido e ainda não foi salvo vai se perder.',
        rotuloConfirmar: 'Descartar',
        perigo: true,
      }))
    ) {
      return;
    }
    sair();
  };
}
