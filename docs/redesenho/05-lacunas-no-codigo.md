# 05 · Lacunas no código

Relatório sobre o app React como estava em `main`, no commit `6112afa`, antes de qualquer edição. A seção "Situação em 20/10/2026", no fim, diz o que os branches `feat/telas-listagem-redesenho` (front) e `feat/api-protegida` (API local) já resolvem.

Base da leitura: `main` no commit `6112afa`. O app não foi executado; tudo aqui vem da leitura do código-fonte, do CSS compilado do Yeti 5.3.8 e de uma requisição GET à API simulada. As razões de contraste foram calculadas com os valores desse CSS.

## O mais urgente

**A API simulada entrega tudo a qualquer pessoa.** `https://yourclinic-api.onrender.com` responde sem autenticação e sem distinção de papel. Um GET em `/db` devolve as 52 coleções, entre elas:

| Coleção | Campos que chamam atenção | Regra |
|---|---|---|
| `usuarios` | `login`, `senha`, `papel` | RNF01: senha nunca é devolvida, e é guardada só como hash |
| `registrosClinicos` | `queixas`, `exameFisico`, `diagnostico`, `cid`, `conduta` | RC02, RC05 |
| `anotacoesPrivadas` | `texto` | RC02, A5-R14 |
| `prescricoes`, `itensPrescricao` | `medicamento`, `posologia` | RC02 |
| `pacientes` | `observacoesGerais` | A3-R17: nunca vai ao Administrador |
| `pessoas` | `cpf`, `telefone`, `email`, `endereco` | RC01 |
| `produtos` | `custoAquisicao` | RC06, nível 3 |
| `caixas` | `saldoApurado`, `divergencia` | RC06; fechamento cego |
| `logsAuditoria` | todos | RF40: só o Administrador lê |

Só os nomes das coleções e dos campos foram lidos; nenhum valor foi aberto nem copiado. Não foi testado se a API aceita escrita.

O que fazer:

1. Confirmar que todos os dados são sintéticos. Se o campo `senha` guardar algo que alguém usa em outro lugar, trocar essa senha.
2. Pôr no servidor um middleware que exija sessão e recuse por papel antes de buscar o registro, gravando a negação. A RC03 exige isso mesmo no backend simulado.
3. Tirar `senha` das respostas e nunca servir ao navegador um campo que o papel não pode ver. Esconder na tela não basta.

## Lacunas apontadas no pedido, confirmadas

| # | Onde | O que acontece | Regra | O que fazer |
|---|---|---|---|---|
| 1 | [App.js:17](https://github.com/honorio-samuel/YOURclinic/blob/6112afa/src/App.js) e [App.js:21](https://github.com/honorio-samuel/YOURclinic/blob/6112afa/src/App.js) | Usuário "Mariana Alves" e papel "Secretária" fixos; um único `MenuLateral` | RF01, RF04 | Contexto de sessão com papel vindo do servidor; menu por papel |
| 2 | [rotas.js](https://github.com/honorio-samuel/YOURclinic/blob/6112afa/src/rotas.js) | Nenhuma guarda de rota; não existem telas de login, acesso negado nem sessão expirada | RF04, RC03, RNF03 | Guarda por papel em cada rota; telas G-01 a G-11 |
| 3 | [listagem-cadastro.js:24](https://github.com/honorio-samuel/YOURclinic/blob/6112afa/src/views/listagem-cadastro.js) | Três GET sem filtro: todos os pacientes, todas as pessoas e todas as consultas. A coluna Tipo sai da consulta mais recente (linha 41); busca e paginação acontecem no navegador | RC01, RNF04, RNF12 | Busca e paginação no servidor, devolvendo só as colunas da tabela. Rever a coluna Tipo: na v2.1 o convênio é da consulta (RF17), não do paciente |
| 4 | [pilula-status.js:8](https://github.com/honorio-samuel/YOURclinic/blob/6112afa/src/components/pilula-status.js) | Finalizado: branco sobre `bg-success` = 2,85. Cancelado: branco sobre `bg-danger` = 3,82 | RNF18 | Com os tokens novos ficam em 4,59 e 4,53. Os outros quatro estados já passam (5,08 a 12,63) |
| 5 | [App.js:2](https://github.com/honorio-samuel/YOURclinic/blob/6112afa/src/App.js) | O Yeti entra pré-compilado | — | Ver "Como aplicar os tokens" |
| 6 | [index.html:2](https://github.com/honorio-samuel/YOURclinic/blob/6112afa/public/index.html) e [index.html:27](https://github.com/honorio-samuel/YOURclinic/blob/6112afa/public/index.html) | `lang="en"`; título "React App"; `manifest.json` com "Create React App Sample" | WCAG 3.1.1 e 2.4.2 | `lang="pt-BR"`; título por rota, sem nome de paciente (RNF04) |
| 7 | [listagem-filadia.js](https://github.com/honorio-samuel/YOURclinic/blob/6112afa/src/views/listagem-filadia.js) | Sem filtro de médico; carrega uma vez e não atualiza (linha 49); status só para leitura; paginada de 6 em 6 (linhas 10 e 131); a coluna Espera é sempre "—" (linha 125) | RF22, RNF15, X28 | Lista completa do dia, filtro por médico, atualização em até X28, pílula com as transições do papel. A API não guarda o carimbo de cada transição (A4-R16), então a espera não tem como ser calculada |

## Outras lacunas encontradas

| # | Onde | O que acontece | Regra | O que fazer |
|---|---|---|---|---|
| 8 | [listagem-cadastro.js:124](https://github.com/honorio-samuel/YOURclinic/blob/6112afa/src/views/listagem-cadastro.js), [listagem-filadia.js:86](https://github.com/honorio-samuel/YOURclinic/blob/6112afa/src/views/listagem-filadia.js) | Texto de regra exibido ao usuário, com RN-07.1, RC02, RN-22.2, X10, X28 e RNF15 | Seção 9 do pedido | Levar para comentário de código ou documentação. A "RN-07.1" citada como unicidade do CPF é, na v2.1, a regra de não ter campo clínico |
| 9 | [listagem-filadia.js:29](https://github.com/honorio-samuel/YOURclinic/blob/6112afa/src/views/listagem-filadia.js) | Busca o registro inteiro de cada pessoa (CPF, telefone, e-mail, endereço) para usar só o nome | RC01 | A fila precisa de nome, horário, médico e status |
| 10 | [rotas.js:26](https://github.com/honorio-samuel/YOURclinic/blob/6112afa/src/rotas.js) | A rota `/listagem-usuarios` existe, fora do menu e sem guarda; o componente está vazio | RF03 | Proteger para o Administrador ou remover até existir |
| 11 | [navbar.js](https://github.com/honorio-samuel/YOURclinic/blob/6112afa/src/components/navbar.js) | O bloco do usuário não é um menu: faltam Meu perfil, Alterar senha e Sair | RF02 | Menu do avatar (G-10) |
| 12 | [menu-lateral.js](https://github.com/honorio-samuel/YOURclinic/blob/6112afa/src/components/menu-lateral.js) | Cinco itens fixos, sem submenus; todos com `render='true'` | RF04 | Árvore do [03-mapa-de-navegacao.md](03-mapa-de-navegacao.md), em `nav nav-pills flex-column` com `collapse` aberto por clique |
| 13 | Listagens | Só o link "Abrir" em pacientes; nenhuma ação na fila; sem estado vazio próprio | Seção 8 do pedido | Coluna de status com seta e ícones de ação por entidade |
| 14 | CSS do Yeti | A primeira regra importa a Open Sans de `fonts.googleapis.com` | RNF04, desempenho | Hospedar a fonte junto do app; cada carregamento hoje faz uma requisição a terceiro |
| 15 | [index.css:3](https://github.com/honorio-samuel/YOURclinic/blob/6112afa/src/index.css) | Define uma pilha de fontes de sistema que o Yeti sobrescreve logo depois | — | Remover |
| 16 | [card.js:6](https://github.com/honorio-samuel/YOURclinic/blob/6112afa/src/components/card.js), [sub-card.js:6](https://github.com/honorio-samuel/YOURclinic/blob/6112afa/src/components/sub-card.js) | Classe `md-3`, que não existe no Bootstrap | — | Provavelmente `mb-3` |
| 17 | [App.test.js:6](https://github.com/honorio-samuel/YOURclinic/blob/6112afa/src/App.test.js) | O teste procura o texto "learn react", que o app não tem | — | Reescrever; o teste não foi rodado, a falha é deduzida da leitura |
| 18 | [axios.js:5](https://github.com/honorio-samuel/YOURclinic/blob/6112afa/src/config/axios.js) | "Hoje" é a data fixa 28/09/2026 | — | Já está comentado no código; trocar quando houver backend real |
| 19 | `package.json` | `@mui/material` e Emotion instalados só para os ícones | — | Manter só `@mui/icons-material` se o empacotamento permitir |

## Contraste com o Yeti original

Calculado sobre o CSS compilado. Mínimo de 4,5:1 para texto e 3:1 para texto de 24 px ou mais, ícones e bordas de campo.

| Elemento | Onde | Cores | Razão | Com os tokens novos |
|---|---|---|---|---|
| Botão "+ Novo paciente" | `btn btn-primary` | branco sobre #008cba | 3,84 | 4,55 |
| Item ativo do menu | `nav-pills .active` | branco sobre #008cba | 3,84 | 4,55 |
| Ícone do item ativo | [custom.css:56](https://github.com/honorio-samuel/YOURclinic/blob/6112afa/src/custom.css) | branco sobre #40a9cb | 2,70 | 3,03 |
| Página atual | `page-item active` | branco sobre #008cba | 3,84 | 4,55 |
| Links da paginação | `--bs-pagination-color` | #888 sobre branco | 3,54 | 5,67 com #006f94 |
| Rodapé | [footer.js:7](https://github.com/honorio-samuel/YOURclinic/blob/6112afa/src/components/footer.js) | branco sobre #008cba, texto pequeno | 3,84 | 4,55 |
| "Clinic" na marca | [navbar.js:14](https://github.com/honorio-samuel/YOURclinic/blob/6112afa/src/components/navbar.js) | branco sobre #40a9cb, 24 px | 2,70 | 3,03 |
| Link "Abrir" | `btn-link` | #008cba sobre branco | 3,84 | 5,67 com #006f94 |
| Pílula Finalizado | `bg-success text-white` | branco sobre #43ac6a | 2,85 | 4,59 |
| Pílula Cancelado | `bg-danger text-white` | branco sobre #f04124 | 3,82 | 4,53 |
| Borda dos campos | `form-control` | #dee2e6 sobre branco | 1,30 | 4,54 com #767676 |
| Texto secundário | `text-body-secondary` | #222 a 75% sobre branco | 6,97 | já passa |
| Alertas | `alert-danger` | texto escuro sobre fundo claro | 9,69 | já passa |

Botões, títulos, paginação e badges do Yeti usam peso 300. O pedido mantém 300 só em títulos de 24 px ou mais.

## Como aplicar os tokens

Há dois caminhos, e só o primeiro é completo.

**1. Compilar por SCSS.** Exige acrescentar `sass` e `bootstrap` às dependências (hoje só o `bootswatch` está instalado) e trocar a importação do `App.js` por um arquivo próprio:

```scss
// src/tema.scss
$primary: #007fa9;
$success: #348452;
$danger: #da3b21;
$min-contrast-ratio: 4.5;
$link-color: #006f94;
$font-size-base: .875rem;
$btn-font-weight: 400;
$badge-font-weight: 400;
$input-border-color: #767676;
$pagination-color: #006f94;

@import "bootswatch/dist/yeti/variables";
@import "bootstrap/scss/bootstrap";
@import "bootswatch/dist/yeti/bootswatch";
```

Com `$min-contrast-ratio: 4.5`, o próprio Bootstrap passa a escolher texto escuro sobre `warning` e `info` e texto branco sobre `primary`, `success` e `danger`. Os valores acima seguem a seção 6 do pedido e a decisão D10.

Este trecho não foi compilado nem testado. Um ponto a conferir na primeira compilação: `primary`, `success` e `danger` passam de 4,5 por três a nove centésimos, e o Bootstrap calcula a luminância por uma tabela aproximada. Se ele escolher texto escuro para algum dos três, escurecer a cor um passo.

**2. Sobrescrever variáveis `--bs-*` no `custom.css`.** Funciona para o que lê a variável na hora, como `.bg-success` e `.text-bg-*`. Não alcança o que o Bootstrap 5.3 compila por componente: `--bs-btn-bg` em cada `.btn-*`, `--bs-nav-pills-link-active-bg` e `--bs-pagination-active-bg` continuam com #008cba, e cada um teria de ser sobrescrito à mão.

## Do Figma para as classes

| Figma | Bootstrap |
|---|---|
| Botao: Primario, Secundario, Perigo, Texto | `btn btn-primary`, `btn-outline-secondary`, `btn-danger`, `btn-link` |
| Campo | `form-control`, `form-select` |
| Tabela | `table table-hover align-middle` |
| PilulaStatus | `badge rounded-pill` |
| PilulaStatus/Interativa | `dropdown` com um `badge` como botão |
| Modal | `modal` |
| MenuLateral | `nav nav-pills flex-column`, com `collapse` |
| Head | `navbar bg-primary` |
| Avisos | `alert alert-*` |
| Ícones | `@mui/icons-material`, o pacote que já está no projeto |

## O que o código já acerta

- Os seis estados do RF22 e nenhum outro, com um estado desconhecido tratado como texto sem cor.
- A fila não mostra nem busca dado clínico.
- As mensagens de erro são genéricas e não revelam estrutura interna (RNF19).
- Tabelas com `scope='col'`, paginação com `aria-label` e `aria-current`, campo de busca com rótulo associado.
- As classes Bootstrap usadas são as mesmas previstas para o Figma, então a troca de tema não exige reescrever componentes.

## Situação em 20/10/2026

| Item | Situação | Onde |
|---|---|---|
| API aberta no Render | Resolvido em 21/10/2026: o serviço do Render passou a rodar a API com sessão, recusa por papel e campos filtrados; sem login, todas as coleções respondem 401, inclusive `/db` | `fake-api/` no Render |
| 1. Usuário e papel fixos | Resolvido: login, sessão com papel vindo do servidor e menu por papel | `feat/telas-listagem-redesenho` |
| 2. Rotas sem guarda | Resolvido no front: rota fora do papel mostra G-08a; registro fora do alcance, G-08b; sessão expirada volta ao login com aviso. A recusa de fato é da API | front e API |
| 3. GET sem filtro | Em parte: as telas pedem só o recorte que mostram (dia, médico, titular, ids citados). Busca e paginação ainda acontecem no navegador | front |
| 4. Contraste das pílulas | Resolvido com os tokens do tema | front |
| 5. Yeti pré-compilado | Resolvido: `src/tema.scss` compila Bootstrap e Yeti com os tokens AA | front |
| 6. `lang` e título | Resolvido: `pt-BR`, título "YOURClinic" e título por tela sem nome de paciente | front |
| 7. Fila do dia | Em parte: lista completa, filtro por médico e transições do papel. A coluna Espera e a atualização automática continuam pendentes | front |
| 8. Texto de regra na tela | Resolvido: as telas antigas foram substituídas | front |
| 9. Fila busca a pessoa inteira | Em parte: busca só as pessoas citadas; a API ainda devolve todos os campos se o front não pedir `_campos` | front |
| 10. `/listagem-usuarios` vazia | Resolvido: a rota antiga leva à tela nova correspondente | front |
| 11. Menu do avatar | Resolvido: Meu perfil (em construção) e Sair | front |
| 12. Menu lateral | Resolvido: árvore do `03-mapa-de-navegacao.md`, em acordeão | front |
| 13. Listagens sem ações | Resolvido: pílula com transições, ícones de ação e estado vazio | front |
| 14. Fonte do Google | Aberto | — |
| 15. `index.css` | Aberto | — |
| 16. Classe `md-3` | Resolvido: os componentes `card` e `sub-card` saíram | front |
| 17. Teste "learn react" | Resolvido: testes dos utilitários de formato e rótulo | front |
| 18. Data fixa | Mantida: os dados simulados representam 28/09/2026 | — |
| 19. `@mui/material` | Aberto | — |
