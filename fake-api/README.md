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

Estão em [usuarios-de-teste.json](usuarios-de-teste.json): um login por papel, mais um segundo médico e um segundo responsável (com duas crianças, para o seletor G-09). Todos os usuários ativos do banco usam a mesma senha de demonstração, que vale só para esta API local.

## Contrato

### Sessão

| Rota | Faz |
|---|---|
| `POST /login` `{login, senha}` | Aceita login ou e-mail. Devolve `{token, usuario: {id, idPessoa, nome, papel}, expiraEm, representado}`. Login inexistente, senha errada e conta bloqueada recebem a mesma resposta 401 |
| `GET /sessao` | Dados da sessão; renova o prazo |
| `POST /logout` | Encerra a sessão |
| `POST /sessao/senha` `{senhaAtual, novaSenha}` | G-10; encerra as outras sessões do usuário |
| `GET /sessao/representados` | Responsável Legal: representados em vigor (G-09) |
| `POST /sessao/representado` `{idPaciente}` | Responsável Legal: escolhe em nome de quem age |
| `GET /saude` | Única rota sem sessão além do login |

Todas as outras exigem `Authorization: Bearer <token>`. Papéis: `ADMINISTRADOR`, `MEDICO`, `SECRETARIA`, `PACIENTE`, `RESPONSAVEL_LEGAL`. O papel vem do servidor, nunca do cliente.

### Coleções

`GET /colecao`, `GET /colecao/:id`, `POST /colecao`, `PATCH /colecao/:id` e, onde a matriz permite, `DELETE /colecao/:id`. `PUT` não existe. `/db` é recusado para todos.

Consulta no estilo do json-server 0.17: `campo=valor` (repetível), `campo_gte`, `_lte`, `_gt`, `_lt`, `_ne`, `_like` (sem diferenciar acento nem caixa), `_sort` e `_order`, `_page` e `_limit`, com o total em `X-Total-Count`. `_campos=nome,cpf` devolve só essas colunas (o `id` sempre vem). Os filtros rodam sobre o que o papel já pode ver: filtrar por um campo oculto dá o mesmo resultado que filtrar por um campo que não existe.

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

Exemplos da matriz: Observações Gerais nunca vão ao Administrador (A3-R17); custo de aquisição só ao Administrador (RC06); fechamento de caixa cego para a Secretária, que informa o contado sem ver o esperado nem a divergência (D5); total do lote TISS oculto para a Secretária (D9); o Administrador vê só os orçamentos na etapa de aprovação (RC09); justificativa clínica da autorização só para o Médico (RC10); dos médicos, o portal vê só nome, CRM e especialidade; do estoque, o titular vê só nome e lote dos itens dispensados a ele.

## Regras de negócio aplicadas

| Onde | Regra |
|---|---|
| Status da consulta (RF22, D1, PR-01) | Secretária: Agendado → Na Recepção, Cancelado ou Não Compareceu; Na Recepção → Cancelado ou Não Compareceu. Médico: Na Recepção → Em Atendimento (chamar) → Finalizado. Titular: Agendado → Cancelado. Cancelar pela clínica exige `motivoCancelamento` |
| Volta de status | Só o Médico: Em Atendimento → Na Recepção e Finalizado → Em Atendimento, com `motivoTransicao` enviado na própria requisição. O log ganha um registro `TRANSICAO_RETROATIVA` só com a referência; o registro clínico continua selado |
| Agenda (RF18) | Consulta nova começa Agendada; um médico não tem duas consultas ativas no mesmo horário |
| Orçamento (RF31, D32) | Cada papel mexe só na sua etapa. Devolver (Secretária para o Médico, Administrador para a Secretária) exige `observacaoDevolucao`, que o titular não vê |
| Caixa (RF47, D5) | O servidor calcula o esperado e a divergência no fechamento; diferença sem `justificativa` é recusada |
| Prontuário (A5-R03) | Registro selado só muda por retificação |
| Pessoas (A-02b, S-01b) | Nome completo; CPF com 11 dígitos e sem repetição (só o formato é conferido, porque os CPFs sintéticos têm o dígito verificador errado); e-mail válido; nascimento que não seja futuro |
| Paciente, médico, secretária, administrador e responsável legal | Nascem com o `id` da pessoa, informado no corpo do POST. Sem a pessoa, 422; com o cadastro já existente, 409 |
| Paciente (RF07) | Convênio exige um convênio ativo e `numeroCarteirinha`; `pendenteDeCpf` exige `justificativaSemCpf` |
| Médico (A-03) | CRM sem repetição na mesma UF. Inativar passa a conta a Inativa e encerra os vínculos ativos; reativar devolve a conta |
| Contas (RF03, RF09) | Conta nova nasce `CONVITE_PENDENTE`, de uma pessoa já cadastrada no papel, uma por pessoa, com login e e-mail sem repetição. O papel e a pessoa não mudam depois. Só o aceite do convite ativa a conta. A clínica não fica sem Administrador ativo. A Secretária só convida Paciente e Responsável Legal e não lê as contas |
| Representação (RF08) | Paciente e responsável cadastrados, grau de parentesco e natureza (`PODER_FAMILIAR`, `TUTELA` ou `CURATELA`). A Secretária não encerra a representação |
| Convênio e procedimento (RF11, RF12) | Registro ANS com 6 dígitos e TUSS com 8, sem repetição; duração de 5 a 480 minutos; preço particular informado |
| Conta a pagar (RF50) | Nasce `ABERTO`, com fornecedor, categoria, vencimento e valor maior que zero. Paga, só o estorno a muda (`situacao` e `motivoEstorno`); estornada, não muda mais |
| Bloqueio de agenda (RF14) | Motivo da lista fechada (férias, feriado, congresso, capacitação, intervalo, outro), fim depois do início e médico ativo; sem médico, vale para a clínica inteira |
| Produto (RF36) | Descrição, tipo (`MEDICAMENTO`, `MATERIAL` ou `AMOSTRA`), unidade (`UN`, `CX`, `PCT`, `FR` ou `DOSE`) e estoque mínimo inteiro. Custo, se informado, não negativo; a Secretária não grava o custo |

## Dados sintéticos

[seed.js](seed.js) gera tudo a partir de listas de nomes genéricos, com semente fixa: o mesmo comando gera sempre os mesmos dados. Nenhum valor vem da API do Render nem dos repositórios `fakeJson*`. Os CPFs têm o dígito verificador errado de propósito, os telefones são `(11) 90000-NNNN` e os e-mails usam o domínio reservado `.test`.

O dia de referência é 28/09/2026, o mesmo de `DATA_DE_HOJE` no app (`npm run seed -- --data AAAA-MM-DD` muda). As consultas vão de 40 dias antes a 3 semanas depois, e o dia de referência tem os seis status da fila. São 30 pacientes (quatro crianças e uma paciente que fez 18 anos), 5 médicos em atividade e um com convite pendente.

O banco tem as 52 coleções da API do Render, com os mesmos nomes de campos, mais a coleção `relatorios` e campos que as telas do redesenho usam. Entre eles: `usuarios.email`; `procedimentos.codigoInterno`, `tipo` e `situacao`; `convenios.nome`; `bloqueiosAgenda.situacao` e `consultasAfetadas`; `caixas.idSecretaria`, `turno`, `saldoContado`, `situacao` e `justificativa`; `estornos.tipo`, `situacao`, `idSolicitante` e `dataPedido`; `pagamentos.meio`; `orcamentos.idMedico`, `etapa` e `observacaoDevolucao`; `itensOrcamento.idProcedimento`; `consultas.motivoTransicao`; `exportacoes.idPaciente`; `guiasTiss.valor` e `cid`; `autorizacoes.cid` e `justificativa`; `glosas.situacao`; `recursosGlosa.rodada`, `prazo`, `aguardaFundamentacao` e `idMedico`; `anexos.enviadoPor`, `situacao` e `idPaciente`; `prescricoes.idPaciente`; `acessosExcecao.expiraEm`; `parametros.grupo`, `valorSugerido` e `editavel`. A senha do usuário virou `senhaHash`.

## O que esta API não resolve

- **A API do Render continua aberta.** Esta pasta não muda nada lá, e o código do serviço publicado não está em nenhum repositório público. Até alguém com acesso ao Render protegê-la ou desligá-la, os dados de lá continuam expostos.
- As sessões ficam em memória: reiniciar o servidor encerra todas.
- `autorizacoes.senha` (a senha da operadora TISS) nunca é devolvida, porque nenhuma resposta leva campo `senha*`. As telas de TISS vão precisar de um campo com outro nome.
- Regras ainda não aplicadas: antecedência X08 para o titular cancelar, atraso X10 antes de Não Compareceu, janela X02 na contagem de tentativas de login, sigilo do adolescente (D3, o banco não tem campo que marque o registro), envelope clínico do recurso de glosa e conteúdo real de anexos e exportações.
- O bloqueio por tentativas vale por conta, não por endereço de origem: quem souber um login pode bloqueá-lo por X03 minutos. No simulado local isso foi aceito.
