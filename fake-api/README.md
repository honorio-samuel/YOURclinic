# API simulada local

Substitui, no desenvolvimento, a API aberta do Render (`yourclinic-api.onrender.com`) por uma que segue a RC03: sessão obrigatória, recusa por papel antes de qualquer busca, negação registrada no log, nenhuma senha nas respostas e nenhum campo enviado a um papel que não pode vê-lo. A matriz de quem vê o quê vem de [docs/redesenho/02-matriz-por-papel.md](../docs/redesenho/02-matriz-por-papel.md) e está em [permissoes.js](permissoes.js).

Não tem dependências: só Node 20 ou mais novo.

## Rodar

```bash
cd fake-api
npm start
```

A API sobe em `http://127.0.0.1:3001` e aceita conexões só da própria máquina. Na primeira vez, gera `db.json` com dados sintéticos; as escritas ficam nesse arquivo, que o git ignora. Para voltar ao banco inicial:

```bash
npm run seed
```

Testes:

```bash
npm test
```

| Variável | Padrão | Para quê |
|---|---|---|
| `PORTA` | `PORT`, se houver; senão `3001` | Porta HTTP |
| `HOST` | `0.0.0.0` no Render (variável `RENDER`); `127.0.0.1` fora dele | Interface de rede |
| `ORIGENS` | `http://localhost:3000,http://127.0.0.1:3000` | Origens liberadas no CORS |
| `SESSAO_MINUTOS` | parâmetro X15 (30) | Inatividade até a sessão expirar |
| `CAMINHO_DB` | `fake-api/db.json` | Arquivo do banco |
| `PIX_SEGUNDOS` | `8` | Segundos até o Pix simulado ser pago (ver "Checkout simulado") |
| `TEF_ESPERA_MS` | `1500` | Espera do terminal TEF simulado, em milissegundos |
| `EXPORTACAO_SEGUNDOS` | `3` | Segundos até a exportação pedida ficar pronta |

Os e-mails de convite e de redefinição de senha não são enviados: a API escreve no terminal o destinatário, o assunto e o link, que vale como se tivesse chegado por e-mail.
| `DATA_DE_HOJE` | `2026-09-28` | "Hoje" das regras de agenda (horário passado, antecedência do X08). É o mesmo dia de `DATA_DE_HOJE` do app, porque os dados simulados ficam nele; a hora vem do relógio. A sessão e o log usam o relógio de verdade |

No app, aponte `REACT_APP_API_URL` para `http://127.0.0.1:3001`.

## Publicar no Render

Web Service a partir deste repositório, sem variável obrigatória: o Render informa `PORT` e `RENDER`, e a API passa a aceitar conexões de fora.

| Campo | Valor |
|---|---|
| Root Directory | `fake-api` |
| Build Command | `npm install` (não há dependências; o passo só confere o `package.json`) |
| Start Command | `node servidor.js` |
| Health Check Path | `/saude` |

O banco sintético é gerado na primeira subida e some a cada novo deploy ou reinício, porque o disco do serviço gratuito não é permanente. As sessões ficam em memória e também caem no reinício. Se um app publicado for usar esta API, inclua o endereço dele em `ORIGENS`. As contas de demonstração e a senha delas estão neste repositório, que é público: qualquer pessoa entra com elas, e por isso o banco só pode ter dados sintéticos.

## Contas de demonstração

Estão em [usuarios-de-teste.json](usuarios-de-teste.json): um login por papel, mais uma segunda secretária (para conferir o lançamento da maquininha avulsa da colega), um segundo médico e um segundo responsável (com duas crianças, para o seletor G-09). Todos os usuários ativos do banco usam a mesma senha de demonstração, que vale só para esta API local.

## Contrato

### Sessão

| Rota | Faz |
|---|---|
| `POST /login` `{login, senha}` | Aceita login ou e-mail. Devolve `{token, usuario: {id, idPessoa, nome, papel}, expiraEm, representado}`. Login inexistente, senha errada e conta bloqueada recebem a mesma resposta 401 |
| `GET /sessao` | Dados da sessão; renova o prazo |
| `POST /logout` | Encerra a sessão |
| `POST /sessao/senha` `{senhaAtual, novaSenha}` | G-10; encerra as outras sessões do usuário |
| `GET /sessao/representados` | Responsável Legal: representados em vigor (G-09) |
| `GET /sessao/representacoes-encerradas` | Responsável Legal: quantas representações acabaram pela maioridade, sem nomes (R-07, D30) |
| `GET /convites/:token`, `POST /convites/:token` `{cpf, dataNascimento, senha}` | Sem sessão. Primeiro acesso por convite (G-04a, G-04b). O Paciente confere o próprio CPF e nascimento; o Responsável, o próprio CPF e o nascimento de um representado. Errar X01 vezes invalida o convite. Ativa a conta e apaga o token |
| `POST /senha/recuperar` `{email}` | Sem sessão (G-05). Responde sempre a mesma mensagem; se o e-mail for de conta ativa, manda o link, que vale X05 minutos |
| `GET /senha/redefinir/:token`, `POST /senha/redefinir/:token` `{senha}` | Sem sessão (G-06). Troca a senha, apaga o token e encerra todas as sessões do usuário |
| `POST /usuarios/:id/convite` | Administrador; a Secretária, só para Paciente e Responsável. Reenvia o convite de conta pendente, invalidando o anterior |
| `POST /sessao/representado` `{idPaciente}` | Responsável Legal: escolhe em nome de quem age |
| `GET /saude` | Única rota sem sessão além do login |

Todas as outras exigem `Authorization: Bearer <token>`. Papéis: `ADMINISTRADOR`, `MEDICO`, `SECRETARIA`, `PACIENTE`, `RESPONSAVEL_LEGAL`. O papel vem do servidor, nunca do cliente.

### Coleções

`GET /colecao`, `GET /colecao/:id`, `POST /colecao`, `PATCH /colecao/:id` e, onde a matriz permite, `DELETE /colecao/:id`, com a mesma trava de etapa da edição. `PUT` não existe nas coleções. `/db` é recusado para todos.

Consulta no estilo do json-server 0.17: `campo=valor` (repetível), `campo_gte`, `_lte`, `_gt`, `_lt`, `_ne`, `_like` (sem diferenciar acento nem caixa), `_sort` e `_order`, `_page` e `_limit`, com o total em `X-Total-Count`. `_campos=nome,cpf` devolve só essas colunas (o `id` sempre vem). Os filtros rodam sobre o que o papel já pode ver: filtrar por um campo oculto dá o mesmo resultado que filtrar por um campo que não existe.

### Agenda

| Rota | Quem | Faz |
|---|---|---|
| `GET /agenda/horarios?idMedico&idProcedimento&de&ate` | Administrador, Secretária, Paciente, Responsável | Horários de início livres, dia a dia (até 62 dias), para a duração do procedimento: dentro da grade, sem bloqueio, sem consulta ativa do médico e não antes de agora. Não diz por que um horário falta nem quem o ocupa. A recepção pode passar `idConsulta`, para remarcar sem que a consulta ocupe o próprio horário |
| `PUT /agenda/grade/:idMedico` `{granularidade, periodos: [{diaSemana, horaInicio, horaFim}]}` | Administrador, Secretária | Troca a grade inteira do médico (A-10, S-05a). `diaSemana` vai de 0 (domingo) a 6. Recusa períodos sobrepostos e, com 409, a grade que deixaria de fora consulta já agendada (RN-13.2) |
| `POST /agenda/lote` `{motivo, idBloqueio?, acoes: [{idConsulta, acao: "REAGENDAR" | "CANCELAR", dataHora?, idMedico?}]}` | Administrador, Secretária | Trata várias consultas de uma vez (A-11b). Tudo ou nada (A4-R09): se uma ação falha, nenhuma é gravada, e a mensagem diz de qual paciente. Cada consulta ganha o próprio registro no log e o próprio aviso. Com `idBloqueio`, recalcula as consultas atingidas pelo bloqueio |

### Checkout

Só a Secretária executa o checkout; o Administrador cria e edita a cobrança pela coleção `cobrancas` (A-13b). Pagamento nunca nasce pela coleção `pagamentos`. Toda resposta de pagamento traz a cobrança atualizada: itens, total, pago, saldo e pagamentos, sem taxa nem valor líquido.

| Rota | Papéis | O que faz |
|---|---|---|
| `GET /checkout/:idCobranca` | Secretária | Itens sem conteúdo clínico, total, pago, saldo, `disponivel` (o saldo menos o que espera desfecho), pagamentos, limites de parcela (X32, X33), limite sem conferência (X52) e se o caixa dela está aberto |
| `POST /checkout/:idCobranca/dinheiro` `{valor, valorRecebido}` | Secretária | Exige o caixa aberto de quem recebe (RN-47.1) e calcula o troco |
| `POST /checkout/:idCobranca/pix` `{valor}` | Secretária | Cria o QR dinâmico: txid próprio, BR Code e expiração em X31 minutos. O pagamento fica `PENDENTE` |
| `POST /checkout/pix/:idPagamento/verificar` | Secretária | Consulta o PSP pelo txid: `CONFIRMADO`, `EXPIRADO` (E1, libera um QR novo) ou ainda `PENDENTE`. `/cancelar` desiste do QR que não foi pago |
| `POST /checkout/:idCobranca/tef` `{valor, modalidade, parcelas?, chave}` | Secretária | Envia ao terminal. A `chave` torna o pedido idempotente (RN-43.5): repetida, devolve a mesma transação. Resultado `CONFIRMADO`, `NEGADO` (sem o motivo do emissor) ou `INDEFINIDO` |
| `POST /checkout/tef/:idPagamento/confirmar` | Secretária | Consulta de confirmação da transação `INDEFINIDO`: aprovada depois do tempo (E3) ou não realizada (E4) |
| `POST /checkout/:idCobranca/pos` `{valor, modalidade, parcelas?, bandeira, ultimosDigitos, nsu, codigoAutorizacao, adquirente}` | Secretária | Lançamento do comprovante da maquininha avulsa, com conciliação pendente. NSU e autorização obrigatórios (RN-46.1); NSU repetido no dia e no adquirente é recusado (RN-46.2); acima do X52, fica `AGUARDANDO_CONFERENCIA` (RN-46.3) |
| `POST /checkout/:idCobranca/pix-portal` | Paciente, Responsável | O titular paga a própria cobrança aberta pelo valor que falta, com o mesmo Pix simulado. Pedir de novo devolve o QR que ainda espera. Responde só o pagamento e a situação da cobrança |
| `POST /checkout/pix/:idPagamento/verificar` | Secretária, Paciente e Responsável (o titular, só o próprio) | Consulta o PSP pelo txid, como acima |
| `GET /checkout/conferencias` | Administrador, Secretária | Lançamentos que esperam conferência, com o paciente e quem lançou |
| `POST /checkout/pagamentos/:idPagamento/conferir` `{aprovar, motivo?}` | Administrador, Secretária | Outro usuário confirma ou recusa (com motivo). Quem lançou não confere |

Modalidades: `DEBITO`, `CREDITO`, `CREDITO_PARCELADO_LOJISTA` e `CREDITO_PARCELADO_EMISSOR`. Parcelas, só no parcelado, de 2 até o menor entre X32, o limite do adquirente (12) e o valor dividido por X33 (RN-43.2). Ao atingir o total, a cobrança passa a `PAGA`, o título a `PAGO` e o titular recebe o aviso `PAGAMENTO_CONFIRMADO`.

#### Checkout simulado

Não há PSP nem gerenciador TEF de verdade. Para a demonstração:

- **Pix:** a primeira verificação feita `PIX_SEGUNDOS` depois de gerar o QR encontra o pagamento feito. Depois de X31 minutos sem pagamento, o QR expira. O BR Code imita o formato do Pix, mas nenhum banco o aceita.
- **TEF:** aprova, com bandeira, final, NSU e autorização gerados pelo "terminal". Valor com centavos ,13 é negado; com ,49, o terminal não responde e a confirmação diz que foi aprovada; com ,48, não responde e a confirmação diz que não houve transação.
- **Taxa:** o valor líquido usa taxas fictícias por modalidade, só para o Administrador.

### Indicadores

| Rota | Papéis | O que faz |
|---|---|---|
| `GET /indicadores/financeiro` | Administrador | Painel financeiro (RF35): a receber de pacientes (a vencer, vencido, pago), de operadoras pela situação da guia (a apresentar, apresentado, glosado, em recurso, pago), cartão em trânsito com bruto, taxa, líquido e data prevista por X35 e X36, contas a pagar e o saldo realizado e projetado, com a data-base |
| `GET /indicadores/gerencial?de&ate` | Administrador | Dashboard gerencial (RF41) no período, por padrão os últimos 30 dias: desfecho das consultas, particular e convênio por operadora, tempo médio de espera, ociosidade da agenda por blocos, conversão de orçamento, divergência de caixa por operador e índice de glosa por operadora e por motivo. Nada clínico entra no cálculo |

### Estorno

O pedido e a decisão passam por estas rotas; a coleção `estornos` é só de leitura. O pagamento original nunca muda (RN-48.1): o estorno aprovado é o lançamento de sinal oposto e sai do pago da cobrança e do recebido do painel financeiro.

| Rota | Papéis | O que faz |
|---|---|---|
| `GET /financeiro/estornos/avaliar/:idPagamento` | Secretária, Administrador | O que o meio permite hoje (RF48): `tipo` (`CANCELAMENTO` no mesmo dia, `ESTORNO` depois), `forma`, se aceita parcial, se pede o meio da devolução, quanto ainda pode ser devolvido e a orientação para o operador |
| `POST /financeiro/estornos` `{idPagamento, valor, motivo, meioDevolucao?}` | Secretária | Pedido, que fica `A_APROVAR`. Dinheiro sai do caixa aberto; Pix volta pelo PSP até 90 dias (depois, transferência manual); débito só se cancela no dia e sempre pelo total; crédito se cancela no adquirente até X34 dias. Fora disso, `meioDevolucao` `PIX` ou `DINHEIRO`. Um pedido aberto por pagamento |
| `POST /financeiro/estornos` `{idPagamento, valor, motivo, chargeback: true}` | Secretária | Registro de chargeback (contestação do portador), só em cartão, sem aprovação e sem efeito no título |
| `POST /financeiro/estornos/:id/aprovar` e `/recusar` `{motivo}` | Administrador | Aprovar confere de novo o que o meio permite, grava o protocolo, reabre o título, cancela recibo e NFS-e e, em dinheiro, lança a devolução num caixa aberto (o do recebimento ou o de quem pediu). Recusar pede motivo |

### Notificações

| Rota | Papéis | O que faz |
|---|---|---|
| `POST /notificacoes/:id/reenviar` | Secretária, Administrador | Reenvia a notificação que falhou pelo provedor simulado, que entrega; registra quem e quando. Sem telefone nem e-mail, 409 |
| `POST /notificacoes/:id/aviso-por-telefone` | Secretária, Administrador | Registra que a recepção avisou por telefone |
| `GET` e `PUT /portal/preferencias` `{lembretes, cobrancas}` | Paciente, Responsável | Preferência de aviso do titular, guardada no cadastro do paciente (RF39, RN-59.2) |

A coleção `notificacoes` é só de leitura.

### Anexos

A coleção `anexos` traz só os metadados e não recebe arquivo; o envio e a leitura do conteúdo passam por estas rotas. O arquivo fica na pasta `anexos/`, ao lado do banco (o git a ignora), com nome aleatório; os exames do banco sintético não têm arquivo, e a API gera um PDF ou PNG de demonstração.

| Rota | Papéis | O que faz |
|---|---|---|
| `POST /anexos/envio` `{idPaciente, nomeArquivo, conteudo}` | Secretária, Médico (paciente no alcance), Paciente e Responsável (o titular, sempre) | `conteudo` em base64. Aceita PDF, JPG e PNG pelo conteúdo, não pela extensão (E1, a tentativa vai ao log); acima de X13 MB, 413 (E2); a varredura simulada reprova o arquivo de teste EICAR (E3). Do portal, o exame nasce `A_ACEITAR`. Responde só os metadados |
| `GET /anexos/:id/arquivo` `?baixar` | Médico com o paciente no alcance, Paciente e Responsável (o próprio) | O conteúdo, com a sessão de quem pede; nunca à Secretária (RN-26.1). Cada abertura vai ao log como `LER` e cada download como `BAIXAR` (RF27) |

### Documentos fiscais

A coleção `documentosFiscais` é só de leitura; a emissão passa por estas rotas.

| Rota | Papéis | O que faz |
|---|---|---|
| `GET /financeiro/documentos/:id` | Quem lê o documento pela coleção (o titular, só o próprio) | Recibo ou documento auxiliar da NFS-e montado no servidor: emitente, pagador e paciente com CPF, descrição do serviço sem CID, formas de pagamento, IBS, CBS e chave de acesso |
| `POST /financeiro/documentos/recibo` `{idTituloReceber, idPagador?}` | Secretária, Administrador | Recibo de título de paciente pago (RF33), um por título, com o número seguinte dos recibos. O pagador é o paciente ou um responsável legal dele (RN-33.2) |
| `POST /financeiro/documentos/nfse` `{idTituloReceber, idPagador?}` | Administrador | NFS-e de título pago (RF34), com IBS e CBS calculados pela tabela [aliquotas.json](aliquotas.json) (RN-34.2). O ambiente nacional simulado rejeita tomador sem CPF: a nota fica `PENDENTE`, com `erro.codigo` e `erro.descricao` |
| `POST /financeiro/documentos/:id/reenviar` | Administrador | Reenvia a NFS-e pendente; aceita, ela ganha número e chave de acesso |

### Estoque

O saldo do lote é a soma das movimentações (RN-36.2): nenhum papel grava em `movimentacoes` ou `lotes` pela coleção. Cada resposta traz a movimentação, do jeito que o papel a vê, e o lote com o saldo novo.

| Rota | Papéis | O que faz |
|---|---|---|
| `POST /estoque/entradas` `{idProduto, numeroLote, validade, quantidade, origem, idTituloPagar?}` | Administrador, Secretária | Entrada por lote (RF37). Medicamento, amostra e produto com controle de lote exigem lote e validade (RN-36.1); lote vencido não entra, e o mesmo número de lote não muda de validade. `origem`: `COMPRA`, `DOACAO` ou `AMOSTRA_FORNECEDOR`. Só o Administrador liga a compra a um título a pagar. Produto sem controle de lote usa um lote único, sem número nem validade |
| `POST /estoque/saidas` `{idLote, quantidade, destino, idConsulta?, motivoDescarte?, justificativa?, conferenciaManual?}` | Secretária, Médico | `DISPENSACAO` para uma consulta de hoje (a Secretária, de quem está ou esteve na clínica; o Médico, do próprio atendimento em curso ou finalizado) ou `DESCARTE` com motivo (`VENCIMENTO`, só para lote vencido; `AVARIA`; `RECOLHIMENTO`; `OUTRO`, com justificativa). Lote vencido não vai para paciente (RN-38.1). Fora do lote que vence primeiro, a justificativa é obrigatória. Item de controle especial exige `conferenciaManual: true` (RN-37.3) |
| `POST /estoque/ajustes` `{idLote, quantidadeContada, justificativa}` | Administrador, Secretária | Ajuste de inventário: a diferença entre a contagem e o saldo, com motivo. O do Administrador vale na hora (`APROVADO`); o da Secretária fica `A_APROVAR` e não mexe no saldo. Um pedido aberto por lote |
| `POST /estoque/ajustes/:id/aprovar` e `/recusar` `{motivo}` | Administrador | Decide o pedido da Secretária. Recusar pede motivo; a aprovação que deixaria o saldo negativo é recusada |

Os alertas (`MINIMO`, `VALIDADE` com a antecedência do X14 e `VENCIDO`) são refeitos a cada movimentação, a cada mudança de produto ou do X14 e no primeiro pedido de cada dia da clínica (RN-38.2). Produto inativo não gera alerta, e lote vencido não conta para o mínimo. O Médico lê só os alertas de validade.

### Documento exportado

| Rota | Papéis | O que faz |
|---|---|---|
| `GET /exportacoes/:id/documento` | Quem pediu a exportação | Conteúdo do documento, montado no servidor. Histórico (RF29): datas, tipo de atendimento, médico, especialidade e situação, sem conteúdo clínico nem motivo de cancelamento. Prontuário completo (RF30): registros selados na versão vigente, com as retificações sinalizadas e as prescrições, nunca as anotações privadas. Traz quem pediu, a emissão e um identificador de verificação. 409 enquanto gera, 410 depois de X42 horas, 403 para quem não pediu; cada leitura vai ao log como `BAIXAR` |

A exportação nasce `SOLICITADA` e fica `CONCLUIDA` `EXPORTACAO_SEGUNDOS` depois (RNF13). O app mostra o documento numa página própria, com o botão de imprimir ou salvar em PDF do navegador.

### Respostas de erro

| Código | Quando | Tela |
|---|---|---|
| 401 | Sem sessão ou sessão expirada | G-07 ou G-01 |
| 403 | O papel não tem acesso à coleção ou à ação; também `/db` | G-08a |
| 404 | Registro inexistente ou fora do alcance; as duas respostas são iguais | G-08b |
| 409 | Registro que não pode mais mudar (selado, caixa fechado, etapa de outro papel) | — |
| 422 | Regra de negócio: transição de status, horário ocupado, justificativa ausente | — |

Toda recusa vai para `logsAuditoria` com `resultado: "NEGADO"` e `motivo` (`SEM_SESSAO`, `PAPEL`, `FORA_DO_ALCANCE`, `ROTA_BLOQUEADA`, `CREDENCIAL`, `BLOQUEADO`). Também são registrados login, logout, toda escrita e toda leitura de conteúdo clínico.

## Como a proteção funciona

1. **Sessão.** Token aleatório de 256 bits, guardado em memória, com prazo de inatividade. Senhas guardadas só como hash scrypt (`senhaHash`). Depois de X01 falhas seguidas, a conta fica bloqueada por X03 minutos.
2. **Papel antes da busca.** A rota confere papel, coleção e verbo antes de tocar no banco. Por isso um id inexistente numa coleção proibida recebe 403, e não 404.
3. **Alcance.** O Médico lê conteúdo clínico só de paciente com vínculo Ativo ou Histórico, ou com acesso de exceção vigente (RC05). Chamar o paciente (Na Recepção → Em Atendimento) cria o vínculo e o prontuário (RF05). Anotação privada, só o autor (D2). O Paciente vê só o próprio registro; o Responsável Legal, só o representado escolhido, e a representação acaba aos 18 anos. Ao criar, o servidor impõe o titular, o autor e o estado inicial.
4. **Campos.** Cada papel tem a sua lista de campos ocultos, que não saem na resposta e não podem ser gravados. Qualquer campo cujo nome comece por `senha` é retirado de toda resposta, em qualquer nível.

Exemplos da matriz: Observações Gerais nunca vão ao Administrador (A3-R17); custo de aquisição só ao Administrador (RC06); fechamento de caixa cego para a Secretária, que informa o contado sem ver o esperado nem a divergência (D5); total do lote TISS oculto para a Secretária (D9); o Administrador vê só os orçamentos na etapa de aprovação (RC09); justificativa clínica da autorização só para o Médico (RC10); dos médicos, o portal vê só nome, CRM, especialidade e situação (para agendar só com médico ativo); do estoque, o titular vê só nome e lote dos itens dispensados a ele.

## Regras de negócio aplicadas

| Onde | Regra |
|---|---|
| Status da consulta (RF22, D1, PR-01) | Secretária: Agendado → Na Recepção, Cancelado ou Não Compareceu; Na Recepção → Cancelado ou Não Compareceu. Médico: Na Recepção → Em Atendimento (chamar) → Finalizado. Titular: Agendado → Cancelado. Cancelar pela clínica exige `motivoCancelamento` |
| Carimbos da fila (RF22) | Cada mudança de status grava a hora em `carimbos` (`NA_RECEPCAO`, `EM_ATENDIMENTO`, …), que dá a espera na fila e o tempo médio do dashboard |
| Volta de status | Só o Médico: Em Atendimento → Na Recepção e Finalizado → Em Atendimento, com `motivoTransicao` enviado na própria requisição. O log ganha um registro `TRANSICAO_RETROATIVA` só com a referência; o registro clínico continua selado |
| Agendamento (RF16 a RF18) | Consulta nova começa Agendada, com paciente, médico e procedimento ativos. O servidor grava a duração do procedimento, o preço vigente como referência (`valorReferencia`, que não vai ao Médico nem ao titular) e, com convênio, `convenioConferido: false`. O horário precisa caber na grade, fora de bloqueio e a partir de agora; o médico não tem duas consultas ativas que se sobreponham, e o paciente também não (Cancelado e Não Compareceu não ocupam horário). Convênio exige convênio ativo e `numeroCarteirinha`. Agendar cria o vínculo pendente com o médico e o aviso de confirmação |
| Cancelamento e remarcação (RF19, RF20) | Pelo portal, só até X08 horas antes. Remarcar (`dataHora` ou `idMedico`) só consulta Agendada, com `motivoRemarcacao`, e só com médico da mesma especialidade. Cancelar e remarcar geram aviso ao paciente; sem outra consulta agendada com o médico, o vínculo pendente acaba |
| Orçamento, escopo (RF31) | O Médico cria o orçamento de paciente no alcance dele; o servidor grava a data, o médico e a etapa `ESCOPO`. Itens só de procedimento ativo, com quantidade de 1 a 99 e a descrição do catálogo. Enviar para valores pede ao menos um item e `justificativaClinica`, que só o médico lê. No escopo, o médico muda a quantidade e tira o item; fora dele, nada muda |
| Orçamento (RF31, D32) | Cada papel mexe só na sua etapa. Devolver (Secretária para o Médico, Administrador para a Secretária) exige `observacaoDevolucao`, que o titular não vê |
| Caixa (RF47, D5) | Um turno aberto por vez (RN-47.2). Sangria e reforço (`movimentosCaixa`) pedem motivo e só entram no próprio caixa aberto (RN-47.1). O servidor calcula o esperado (fundo + dinheiro − troco + reforço − sangria) e a divergência no fechamento; diferença sem `justificativa` é recusada |
| Cobrança (RF32, RF43, A-13b) | Finalizar consulta particular gera a cobrança e o título pelo preço gravado no agendamento; a de convênio, só se a coparticipação já foi apurada; uma consulta não gera duas cobranças. O Administrador cria cobrança de consulta finalizada ou de orçamento aceito sem cobrança, com valor e vencimento, e edita valor e vencimento só antes de qualquer pagamento (RN-32.1) |
| Prontuário (RF23, A5-R03) | O registro clínico só nasce de consulta em atendimento do próprio médico, um por consulta, ligado ao prontuário e marcado `sobExcecao` quando feito sem vínculo Ativo (RN-06.2). Em edição, só o autor altera queixas, exame físico, diagnóstico, CID e conduta. Finalizar a consulta sela o registro (`selado`, `dataSelagem`); voltar de Finalizado não dessela. Selado ou fora de atendimento, só muda por retificação |
| Retificação (RF24) | Só o autor, em registro selado, com motivo diferente dos anteriores do mesmo registro. O servidor guarda o texto vigente antes (`textoAnterior`); o registro original nunca muda |
| Prescrição (RF25) | Nasce do registro em edição do próprio médico, com emissão, validade de 30 dias e o paciente do registro. Cada item exige medicamento, concentração, posologia, quantidade, duração e classificação (`COMUM`, `ANTIMICROBIANO` ou `CONTROLE_ESPECIAL`, sem padrão); item de controle especial faz a receita ser de controle especial. Selada a consulta, nada muda |
| Anotação privada (RF28, D2) | Só o autor cria, lê, edita e exclui; o texto não pode ficar vazio. A exclusão vai ao log sem o conteúdo |
| Acesso de exceção (RF06) | Justificativa com ao menos 20 caracteres e quatro palavras, legível e diferente da do acesso anterior do médico. O acesso vale X07 minutos, vai ao log como `ACESSO_EXCECAO` e avisa cada Administrador no ato; o segundo pedido do mesmo médico sobre o mesmo paciente em 30 dias ganha `padraoAtipico` |
| Pessoas (A-02b, S-01b) | Nome completo; CPF com 11 dígitos e sem repetição (só o formato é conferido, porque os CPFs sintéticos têm o dígito verificador errado); e-mail válido; nascimento que não seja futuro |
| Paciente, médico, secretária, administrador e responsável legal | Nascem com o `id` da pessoa, informado no corpo do POST. Sem a pessoa, 422; com o cadastro já existente, 409 |
| Paciente (RF07) | Convênio exige um convênio ativo e `numeroCarteirinha`; `pendenteDeCpf` exige `justificativaSemCpf` |
| Médico (A-03) | CRM sem repetição na mesma UF. Inativar passa a conta a Inativa e encerra os vínculos ativos; reativar devolve a conta |
| Contas (RF03, RF09) | Conta nova nasce `CONVITE_PENDENTE`, de uma pessoa já cadastrada no papel, uma por pessoa, com login e e-mail sem repetição. O papel e a pessoa não mudam depois. Só o aceite do convite ativa a conta. A clínica não fica sem Administrador ativo. A Secretária só convida Paciente e Responsável Legal e não lê as contas |
| Credencial (RF02) | Token de convite e de redefinição de uso único, guardado só como hash, em campos que começam com `senha` e por isso nunca saem da API. Pedir de novo invalida o anterior. Senha com ao menos 8 caracteres, letras e números |
| Representação (RF08) | Paciente e responsável cadastrados, grau de parentesco e natureza (`PODER_FAMILIAR`, `TUTELA` ou `CURATELA`). A Secretária não encerra a representação |
| Convênio e procedimento (RF11, RF12) | Registro ANS com 6 dígitos e TUSS com 8, sem repetição; duração de 5 a 480 minutos; preço particular informado |
| Conta a pagar (RF50) | Nasce `ABERTO`, com fornecedor, categoria, vencimento e valor maior que zero. Paga, só o estorno a muda (`situacao` e `motivoEstorno`); estornada, não muda mais |
| Bloqueio de agenda (RF14) | Motivo da lista fechada (férias, feriado, congresso, capacitação, intervalo, outro), fim depois do início e médico ativo; sem médico, vale para a clínica inteira. O servidor conta as consultas atingidas (`consultasAfetadas`). O Médico registra só a própria indisponibilidade (M-03); quem trata as consultas atingidas é a recepção |
| Produto (RF36) | Descrição, tipo (`MEDICAMENTO`, `MATERIAL` ou `AMOSTRA`), unidade (`UN`, `CX`, `PCT`, `FR` ou `DOSE`) e estoque mínimo inteiro. Custo, se informado, não negativo; a Secretária não grava o custo. Medicamento e amostra controlam lote, e o controle de lote não muda depois da primeira entrada. `controleEspecial` marca o item que pede conferência manual na saída |
| Exame do titular (RN-26.6) | O Médico só muda a situação do exame que espera o aceite, para `ACEITO` ou `RECUSADO`; a recusa exige `motivoRecusa`, que o titular lê e a Secretária não |
| Estorno (RF48) | Só pelas rotas de [Estorno](#estorno). A Secretária pede, o Administrador decide; quem pede não aprova. O pagamento original não muda |
| Movimentação de estoque (RF37, RC08) | Só pelas rotas de [Estoque](#estoque). Da dispensação, Administrador e Secretária não leem `idConsulta` nem `justificativa`; o titular não lê quem registrou nem a justificativa |

## Dados sintéticos

[seed.js](seed.js) gera tudo a partir de listas de nomes genéricos, com semente fixa: o mesmo comando gera sempre os mesmos dados. Nenhum valor vem da API do Render nem dos repositórios `fakeJson*`. Os CPFs têm o dígito verificador errado de propósito, os telefones são `(11) 90000-NNNN` e os e-mails usam o domínio reservado `.test`.

O dia de referência é 28/09/2026, o mesmo de `DATA_DE_HOJE` no app (`npm run seed -- --data AAAA-MM-DD` muda). As consultas vão de 40 dias antes a 3 semanas depois, e o dia de referência tem os seis status da fila. São 30 pacientes (quatro crianças e uma paciente que fez 18 anos), 5 médicos em atividade e um com convite pendente. No estoque há um lote vencido com saldo, um lote a vencer, um produto abaixo do mínimo, um item de controle especial e um pedido de ajuste esperando o Administrador.

O banco tem as 52 coleções da API do Render, com os mesmos nomes de campos, mais as coleções `relatorios` e `movimentosCaixa` e campos que as telas do redesenho usam. Entre eles: `usuarios.email`; `procedimentos.codigoInterno`, `tipo` e `situacao`; `convenios.nome`; `bloqueiosAgenda.situacao` e `consultasAfetadas`; `caixas.idSecretaria`, `turno`, `saldoContado`, `situacao` e `justificativa`; `estornos.tipo`, `situacao`, `idSolicitante` e `dataPedido`; `pagamentos.meio`; `orcamentos.idMedico`, `etapa` e `observacaoDevolucao`; `itensOrcamento.idProcedimento`; `consultas.motivoTransicao`; `exportacoes.idPaciente`; `guiasTiss.valor` e `cid`; `autorizacoes.cid` e `justificativa`; `glosas.situacao`; `recursosGlosa.rodada`, `prazo`, `aguardaFundamentacao` e `idMedico`; `anexos.enviadoPor`, `situacao` e `idPaciente`; `prescricoes.idPaciente`; `acessosExcecao.expiraEm`; `parametros.grupo`, `valorSugerido` e `editavel`; `produtos.controleEspecial`; `movimentacoes.motivoDescarte`, `conferenciaManual`, `idUsuario` e, no ajuste, `saldoNaContagem`, `quantidadeContada`, `idAprovador`, `dataDecisao` e `motivoRecusa`; `alertasEstoque.dataResolucao`. A senha do usuário virou `senhaHash`.

## O que esta API não resolve

- **Publicação manual no Render.** Desde 21/10/2026, `yourclinic-api.onrender.com` roda esta API, a partir do branch `feat/telas-listagem-redesenho` deste repositório, no lugar do json-server aberto. Como o repositório entra no Render como público, um push não publica sozinho: cada versão nova precisa de "Manual Deploy" no painel.
- As sessões ficam em memória: reiniciar o servidor encerra todas.
- `autorizacoes.senha` (a senha da operadora TISS) nunca é devolvida, porque nenhuma resposta leva campo `senha*`. As telas de TISS vão precisar de um campo com outro nome.
- Regras ainda não aplicadas: atraso X10 antes de Não Compareceu, janela X02 na contagem de tentativas de login, sigilo do adolescente (D3, o banco não tem campo que marque o registro), envelope clínico do recurso de glosa e conteúdo real de anexos e exportações.
- O bloqueio por tentativas vale por conta, não por endereço de origem: quem souber um login pode bloqueá-lo por X03 minutos. No simulado local isso foi aceito.
