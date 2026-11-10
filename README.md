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

Campo obrigatório leva `*` no rótulo; o erro aparece em texto junto do campo, e o foco vai para o primeiro campo com problema. A API repete as validações e responde 409 ou 422 com a mensagem, que o app mostra.

## O que mais está implementado

Todas as listagens do redesenho, com filtros, pílulas de status com as transições permitidas a cada papel, ícones de ação e estados de carregando, vazio e erro: painel do dia, fila do dia, atendimentos, prontuário (prescrição, anexos, anotações privadas e exportações), financeiro, faturamento TISS, estoque, gestão e o portal do Paciente e do Responsável Legal.

Telas que ainda não existem (agenda em grade, novo agendamento, grade de horários, checkout, meu caixa, painéis financeiro e gerencial, perfil) aparecem no menu como "Em construção", com o código da tela no protótipo. Ações de fluxo como reagendar, estornar, conciliar, ajustar estoque e check-in ficam nas listagens, como antes.

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
