# YOURClinic

App React de gestão de clínica médica, organizado por papel: Administrador, Médico, Secretária, Paciente e Responsável Legal. As telas seguem o redesenho em [docs/redesenho/](docs/redesenho/): menu próprio de cada papel, listagens e cadastros num padrão único e tema Bootswatch Yeti ajustado para contraste AA.

## Rodar

O app lê e grava os dados por axios numa API simulada local, com sessão obrigatória e acesso por papel. A API fica em [`fake-api/`](fake-api/), neste repositório, e não tem dependências além do Node 20.

```bash
npm install
npm run api
```

Em outro terminal:

```bash
npm start
```

O app abre em `http://localhost:3000` e usa a API em `http://127.0.0.1:3001` (`REACT_APP_API_URL` em `.env.development`). Para apontar para outra API sem mexer nesse arquivo, crie `.env.development.local`. Na primeira vez, a API gera `fake-api/db.json` com dados sintéticos; as gravações ficam nesse arquivo, que o git ignora, e `npm run seed` dentro de `fake-api/` volta ao banco inicial.

## Contas de demonstração

A tela de login tem um botão por papel que preenche login e senha. As contas e a senha estão em `fake-api/usuarios-de-teste.json` e só valem para a API local, com dados sintéticos.

| Papel | Login | Começa em |
|---|---|---|
| Administrador | `admin` | Painel do dia |
| Médico | `medico` | Atendimentos do dia |
| Secretária | `secretaria` | Fila do dia |
| Paciente | `paciente` | Início do portal |
| Responsável Legal | `responsavel` (uma representada) ou `responsavel2` (duas, passa pelo seletor) | Início do portal |

O dia de referência dos dados é 28/09/2026 (`DATA_DE_HOJE` em `src/config/axios.js`).

## Listagem e cadastro

Cada entidade tem uma tela de listagem e uma de cadastro, em arquivos e rotas próprios:

| | Arquivo | Rota |
|---|---|---|
| Listagem | `listagem-<entidade-plural>.js` | `/<papel>/listagem-<entidade>` |
| Cadastro | `cadastro-<entidade-singular>.js` | `/<papel>/cadastro-<entidade>/:idParam?` |

Na listagem, "+ Novo" abre o cadastro sem id; o ícone Editar abre o cadastro com o id; o ícone Ver abre o mesmo cadastro em consulta (`?consulta`). No cadastro, Salvar grava (POST sem id, PATCH com id, só os campos que mudaram), avisa e volta à listagem; Cancelar volta à listagem e pergunta antes, se algo foi alterado. Os caminhos saem de `src/navegacao/caminhos.js`. As rotas anteriores continuam valendo e redirecionam; a tabela completa está em [docs/redesenho/03-mapa-de-navegacao.md](docs/redesenho/03-mapa-de-navegacao.md#rotas-no-app).

Cadastros prontos:

| Cadastro | Papéis | Observação |
|---|---|---|
| Pacientes (A-02b, S-01b) | Administrador, Secretária | Responsável legal e representação; convite do portal; pedido do histórico. A Secretária tem também as abas Observações gerais (S-01c) e Anexos (S-01d) e registra pedidos do titular |
| Médicos (A-03) | Administrador | Pessoa, registro profissional e conta de acesso no mesmo fluxo; a conta nasce como convite |
| Equipe (A-04) | Administrador | Secretária ou Administrador, com convite |
| Convênios (A-05) e Procedimentos (A-06) | Administrador | |
| Produtos (A-26, S-17) | Administrador, Secretária | O custo de aquisição só aparece ao Administrador |
| Contas a pagar (A-14) | Administrador | Conta paga abre só em consulta |
| Bloqueios (A-11a, S-05b) | Administrador, Secretária | Mostra quantas consultas o bloqueio atinge |

Agenda e agendamento:

| Tela | Papéis | Observação |
|---|---|---|
| Agenda da clínica (A-07, A-07b, A-07c, A-07d, S-02) e Minha agenda (M-03) | Administrador, Secretária, Médico | Visões Dia (uma coluna por médico), Semana, Mês e, só para o Administrador, Ano. Mês e Ano mostram só contagens. A Secretária reagenda e cancela pela agenda; o Médico registra a própria indisponibilidade |
| Novo agendamento (A-08a, S-03a) | Administrador, Secretária | Busca por nome ou CPF, ou cadastro na hora; médico primeiro; só horários livres; particular ou convênio com carteirinha. Se o horário for ocupado antes de confirmar, avisa sem dizer por quem e relê a lista (A-08b, S-03b) |
| Agendar consulta (P-02, R-02) | Paciente, Responsável Legal | Especialidade, médico, dia e horário livres, tipo de atendimento que cabe no horário e convênio |
| Grade de horários (A-10, S-05a) | Administrador, Secretária | Até dois períodos por dia; janela padrão de segunda a sexta, 8h às 18h; reduzir a grade com consulta marcada é recusado |
| Reagendar ou cancelar (S-04) | Secretária | Mesmo médico ou outro da mesma especialidade; motivo de lista fechada |
| Consultas afetadas por bloqueio (A-11b) | Administrador, Secretária | Reagendar ou cancelar em lote, com um motivo; tudo ou nada |

Caixa e cobrança:

| Tela | Papéis | Observação |
|---|---|---|
| Checkout (S-07a a S-07d) | Secretária | Itens, total e o que falta; pagamento composto em dinheiro (com troco), Pix, maquininha integrada e maquininha avulsa. Nenhum campo de número de cartão. O lançamento da maquininha avulsa acima de R$ 500 (X52) espera outro usuário conferir. "Receber" nas cobranças do dia e "Cobrar" na fila abrem a cobrança |
| Meu caixa (S-09) | Secretária | Abrir o turno, sangria e reforço com motivo, fechamento cego e recontagem quando o Administrador devolve |
| Cobrança (A-13b) | Administrador | Cria a cobrança de uma consulta finalizada que ficou sem ela e edita valor e vencimento até o primeiro pagamento |
| Caixas · supervisão (A-16) | Administrador | Ganhou a lista de lançamentos da maquininha avulsa a conferir |
| Recibos (S-11) e Recibos e NFS-e (A-19) | Secretária, Administrador | Emissão só de título pago, com numeração própria e sem lacunas por tipo; o pagador pode ser o responsável legal. A NFS-e calcula IBS e CBS pela tabela de alíquotas e vai a um ambiente nacional simulado, que rejeita tomador sem CPF; a pendente é reenviada depois da correção. Ver e Baixar abrem o documento para imprimir ou salvar em PDF, também no portal |
| Estornos (S-12) e Cancelamentos e estornos (A-17) | Secretária, Administrador | A Secretária escolhe o pagamento e vê o que o meio permite hoje: dinheiro pelo caixa, Pix pelo PSP, débito só no mesmo dia, crédito até X34 dias; fora disso, devolução por Pix ou dinheiro. Parcial só no crédito e no Pix. O Administrador aprova ou recusa; aprovado, o título reabre e o recibo e a NFS-e são cancelados. Chargeback a Secretária só registra |

Prontuário (Médico):

| Tela | Observação |
|---|---|
| Anamnese (M-02b) | Registro da consulta em atendimento, com rascunho salvo sozinho enquanto o médico digita |
| Registro selado e retificação (M-02c) | Finalizar a consulta sela o registro; só o autor retifica, com motivo, e o texto anterior fica no histórico |
| Prescrição (M-02d) | Itens com classificação obrigatória e aviso de controle especial; via de impressão com médico, CRM, data e validade |
| Anotações privadas (M-02f) | Criar, editar e excluir, só o autor |
| Exportações (M-02g) | Histórico e prontuário completo, gerados em segundos; o documento abre numa página própria para imprimir ou salvar em PDF |
| Acesso de exceção (M-02h) | Em Meus pacientes ou no prontuário sem vínculo, com justificativa; o prontuário mostra até quando vale |
| Orçamentos · escopo clínico (M-04) | Novo orçamento para paciente com vínculo: procedimentos do catálogo, quantidade e justificativa clínica, sem nenhum preço. Rascunho editável até enviar para valores, e de novo se a Secretária devolver |

Acesso e conta:

| Tela | Observação |
|---|---|
| Primeiro acesso por convite (G-04a, G-04b) | Pelo link do convite, sem sessão. O Paciente confere o próprio CPF e nascimento; o Responsável, o próprio CPF e o nascimento de quem representa. Depois cria a senha |
| Recuperar senha e nova senha (G-05, G-06) | "Esqueci minha senha" no login. A resposta não diz se o e-mail existe; o link vale uma vez e encerra as sessões abertas |
| Meu perfil (G-10) | Dados da conta e troca de senha com a senha atual |
| Aviso de expiração (G-07b) | Dois minutos antes da sessão terminar por inatividade, com "Continuar conectado" ou "Sair agora" |
| Acesso encerrado por maioridade (R-07) | O Responsável sem representado em vigor vê o aviso, sem o nome de quem fez 18 anos |
| Reenviar convite | Na conta pendente do cadastro de médico e de equipe |

Estoque:

| Tela | Papéis | Observação |
|---|---|---|
| Movimentações (A-27, S-18) | Administrador, Secretária | Entrada por lote, com validade e origem; o Administrador liga a compra ao título a pagar. Ajuste pela contagem física: o do Administrador vale na hora; o da Secretária vai para ele aprovar ou recusar, na mesma tela |
| Saída por lote (S-18, M-05b) | Secretária, Médico | Para quem foi atendido hoje ou descarte com motivo. Sugere o lote que vence primeiro, e trocar pede justificativa. Lote vencido só sai por descarte. Item de controle especial pede a conferência manual. O nome do paciente aparece só na confirmação |
| Produtos e lotes (A-26, S-17) e Estoque (M-05a) | Administrador, Secretária, Médico | Saldo que pode sair, com o vencido à parte, e a situação de cada lote pelo X14. Medicamento e amostra sempre controlam lote |
| Alertas (A-28, S-19) | Administrador, Secretária | Estoque mínimo, lote a vencer e lote vencido; cada alerta leva à entrada ou ao descarte. O Médico vê os de validade em Atendimentos do dia |

Os e-mails de convite e de nova senha saem no terminal da API local, com o link (detalhes em [fake-api/README.md](fake-api/README.md)).

O Pix e a maquininha integrada são simulados pela API local: o Pix é pago sozinho uns segundos depois de gerado, e valores terminados em ,13 simulam cartão negado (detalhes em [fake-api/README.md](fake-api/README.md#checkout-simulado)). Finalizar uma consulta particular gera a cobrança na hora.

Campo obrigatório leva `*` no rótulo; o erro aparece em texto junto do campo, e o foco vai para o primeiro campo com problema. A API repete as validações e responde 409 ou 422 com a mensagem, que o app mostra.

## O que mais está implementado

Todas as listagens do redesenho, com filtros, pílulas de status com as transições permitidas a cada papel, ícones de ação e estados de carregando, vazio e erro: painel do dia, fila do dia, atendimentos, prontuário (prescrição, anexos, anotações privadas e exportações), financeiro, faturamento TISS, estoque, gestão e o portal do Paciente e do Responsável Legal.

Painéis (Administrador):

| Tela | Observação |
|---|---|
| Painel financeiro (A-12) | A receber de pacientes e de operadoras, cartão em trânsito com a data prevista, contas a pagar e o saldo realizado e projetado, com a data-base; cada bloco leva à tela de origem |
| Dashboard gerencial (A-29) | Desfecho das consultas, particular e convênio, tempo médio de espera, ociosidade da agenda, conversão de orçamento, divergência de caixa e índice de glosa, no período escolhido; atualiza a cada X28 segundos |

Os dois são calculados pela API, sem nenhum dado clínico. A Fila do dia ganhou a coluna Espera, pela hora em que o paciente chegou, e se atualiza sozinha a cada X28 segundos.

Todas as telas do menu existem; nenhuma aparece mais como "Em construção". Ações de fluxo como estornar, conciliar, ajustar estoque e check-in ficam nas listagens, como antes.

## Regras que o front respeita

O papel vem do servidor. O front só monta menus e rotas do papel da sessão; quem recusa de fato é a API, que responde 401 (sem sessão), 403 (papel sem acesso) e 404 (registro fora do alcance, igual a inexistente). Nenhuma tela mostra texto de regra (RF, RC) ao usuário, e o título da aba nunca leva nome de paciente.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `src/config/` | Cliente axios com o token da sessão |
| `src/sessao/` | Login, sessão e representado escolhido |
| `src/navegacao/` | Menus de cada papel e caminhos de listagem e cadastro |
| `src/components/` | Cabeçalho, menu em acordeão, listagem, pílula de status, ações da linha, confirmação, campos e seções de formulário |
| `src/servicos/` | Leitura e gravação na API; cadastro de pessoas, pacientes e profissionais |
| `src/views/` | Telas por domínio (cadastro, agenda, financeiro, TISS, estoque, gestão, clínico, portal), uma por arquivo; o que mais de uma tela da pasta usa fica em `comum.js` |
| `src/utils/` | Formatos de data e moeda, máscaras e validações, rótulos dos valores da API |
| `fake-api/` | API simulada com sessão, acesso por papel e regras de negócio |
| `docs/redesenho/` | Matriz por papel, mapa de navegação e rotas, decisões e verificação do redesenho |

## Testes

```bash
npm test
```

Testes da API:

```bash
npm --prefix fake-api test
```
