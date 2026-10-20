# YOURClinic

App React de gestão de clínica médica, organizado por papel: Administrador, Médico, Secretária, Paciente e Responsável Legal. As telas seguem o redesenho em [docs/redesenho/](docs/redesenho/): menu próprio de cada papel, listagens num padrão único e tema Bootswatch Yeti ajustado para contraste AA.

## Rodar

O app lê os dados por axios de uma API simulada local, com sessão obrigatória e acesso por papel. A API fica em `fake-api/`, no branch `feat/api-protegida`.

```bash
npm install
npm run api
```

Em outro terminal:

```bash
npm start
```

O app abre em `http://localhost:3000` e usa a API em `http://127.0.0.1:3001` (`REACT_APP_API_URL` em `.env.development`). Para apontar para outra API sem mexer nesse arquivo, crie `.env.development.local`.

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

## O que está implementado

Todas as telas de listagem do redesenho, com filtros, pílulas de status com as transições permitidas a cada papel, ícones de ação e estados de carregando, vazio e erro:

- **Administrador:** painel do dia; pacientes, médicos, equipe, convênios e procedimentos; fila do dia (leitura) e bloqueios; contas a receber e a pagar, conciliação, caixas, cancelamentos e estornos, aprovação de orçamentos, recibos e NFS-e; contratos, elegibilidade, guias, lotes, glosas e recursos; produtos, movimentações e alertas; relatórios, log de auditoria, notificações, solicitações dos titulares e parâmetros.
- **Médico:** atendimentos do dia, meus pacientes, prontuário (prescrição, anexos, anotações privadas e exportações), orçamentos sem valores, estoque e pendências clínicas.
- **Secretária:** pacientes e anexos (só metadados), reagendar ou cancelar, bloqueios, fila do dia com check-in, cobranças do dia, orçamentos na etapa de valores, recibos, estornos, faturamento TISS e estoque.
- **Paciente e Responsável Legal:** início, agendamentos com cancelamento, documentos, cobranças e orçamentos com aceite, dados e direitos do titular; o Responsável escolhe o representado e vê a faixa "Representando".

Telas que não são listagem (formulários de cadastro, novo agendamento, checkout, agenda em grade, anamnese) aparecem no menu como "Em construção", com o código da tela no protótipo.

## Regras que o front respeita

O papel vem do servidor. O front só monta menus e rotas do papel da sessão; quem recusa de fato é a API, que responde 401 (sem sessão), 403 (papel sem acesso) e 404 (registro fora do alcance, igual a inexistente). Nenhuma tela mostra texto de regra (RF, RC) ao usuário, e o título da aba nunca leva nome de paciente.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `src/config/` | Cliente axios com o token da sessão |
| `src/sessao/` | Login, sessão e representado escolhido |
| `src/navegacao/` | Menus de cada papel |
| `src/components/` | Cabeçalho, menu em acordeão, listagem, pílula de status, ações da linha, confirmação |
| `src/views/` | Telas, por domínio: cadastro, agenda, financeiro, TISS, estoque, gestão, clínico e portal |
| `src/utils/` | Formatos de data e moeda, rótulos dos valores da API |
| `docs/redesenho/` | Matriz por papel, mapa de navegação, decisões e verificação do redesenho |

## Testes

```bash
npm test
```
