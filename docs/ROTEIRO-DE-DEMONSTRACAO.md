# Roteiro de demonstração

Como subir o YOURClinic no próprio computador e uma ordem de cliques que mostra as funções principais, papel por papel. Leva de 15 a 20 minutos.

## Antes de apresentar

Precisa do Node 20 ou mais novo. Na pasta do projeto:

```bash
npm install
cd fake-api
npm run seed
cd ..
```

O `npm run seed` gera o banco de demonstração do zero. Rode-o também sempre que quiser voltar ao estado inicial, e apague a pasta `fake-api/anexos/` se tiver enviado arquivos no ensaio. Um banco gerado por uma versão antiga do projeto não tem os dados novos: gere de novo antes da apresentação.

Depois, em dois terminais:

```bash
npm run api
```

```bash
npm start
```

O app abre em `http://localhost:3000`. A tela de login tem um botão por papel que preenche login e senha.

O sistema trata 28/09/2026 como "hoje" e usa a hora do relógio. A sessão termina depois de 30 minutos sem uso; nesse caso, é só entrar de novo.

## Roteiro

### 1. Secretária (Gabriela Souza Vieira)

1. **Fila do dia**: os atendimentos de hoje, com a espera de quem já chegou. Em Bruno Pereira Teixeira (09h30, Dra. Sofia), escolha **Fazer check-in** na pílula de status.
2. **Novo agendamento** (menu Agenda): escolha um paciente, o médico e um horário livre; a tela só oferece horários de verdade livres.
3. **Fila do dia**, em Larissa Vieira Esteves (atendida às 08h00): **Cobrar** abre o checkout. Pague em dinheiro (o caixa dela já está aberto) ou por Pix, que o provedor simulado confirma em uns 8 segundos.
4. **Recibos** (menu Caixa e cobranças): **Emitir recibo** para o título que acabou de ser pago; o recibo abre pronto para imprimir ou salvar em PDF.
5. **Alertas** (menu Estoque): o lote de gaze venceu; **Descartar** registra o descarte com o motivo. Em **Movimentações**, **Registrar saída** sugere o lote que vence primeiro; o Midazolam pede a conferência manual.
6. Na **Fila do dia**, em "Notificações sem entrega", **Reenviar ou ligar**.
7. **Elegibilidade e autorização** (menu Faturamento TISS): em um atendimento "A verificar", **Verificar na operadora** na pílula de status; a resposta da operadora simulada fica registrada com o protocolo (carteirinha terminada em 9 volta inelegível).
8. **Guias TISS**: em G000000255 (rascunho de hoje), **Editar** abre a revisão; a crítica prévia mostra o bloqueio 7, valor fora da tabela, e como corrigir. **Atualizar dados** traz o valor da tabela e **Liberar guia** libera para o lote. Guia liberada não se edita: a correção é cancelar e gerar outra em **+ Nova guia**.
9. **Lotes e protocolos**: **+ Novo lote**, escolha a operadora, marque as guias liberadas e **Montar lote**; depois **Enviar lote** na pílula de status registra o protocolo. A Secretária vê o valor de cada guia, mas não o total do lote.
10. **Glosas e recursos**: **Importar demonstrativo** de um lote protocolado; as guias voltam pagas ou glosadas, com o motivo. Na glosa nova, **Abrir recurso** com a justificativa; o recurso pode pedir antes a fundamentação do médico.

### 2. Médico (Dra. Sofia Lima Teixeira)

1. **Atendimentos do dia**: o aviso do estoque mostra a vacina perto de vencer. Em Leonardo Esteves Queiroz (na recepção), **Chamar paciente** e depois **Abrir**, na coluna Prontuário.
2. **Prontuário · Anamnese**: o rascunho se salva sozinho enquanto você digita. Em **Prescrição**, inclua um medicamento; o controle especial mostra o aviso e a via de impressão.
3. Volte a **Atendimentos do dia** e use **Finalizar e selar**: o registro fica selado e só muda por retificação.
4. Em **Meus pacientes**, abra o prontuário de Carlos Barros Queiroz e vá à aba **Anexos**: abra o hemograma e aceite ou recuse o exame que o paciente enviou pelo portal (a recusa pede motivo).
5. **Orçamentos**: **+ Novo orçamento** com procedimentos do catálogo e a justificativa clínica, sem nenhum preço, e envie para valores.
6. **Pendências clínicas**: **Preencher** a justificativa de uma autorização (o pedido segue para a operadora) e **Fundamentar** o recurso de glosa que espera o médico. Recepção e administração não leem esses textos.

### 3. Paciente (Carlos Barros Queiroz)

1. **Início**: próximas consultas e pendências.
2. **Agendar consulta**: especialidade, médico, dia e horário livres.
3. **Meus documentos**: **Gerar PDF** do histórico (fica pronto em segundos, em "Documentos gerados"), e **Enviar exame** com um PDF ou uma imagem; o exame espera o médico.
4. **Orçamentos e cobranças**: **Pagar** a cobrança em aberto com o Pix simulado; a janela confirma sozinha. Recibo e NFS-e, quando houver, abrem na mesma lista.
5. **Meus dados e privacidade**: desligue os lembretes (fica salvo) e veja os pedidos feitos à clínica.

### 4. Administrador (Diego Pereira Gomes)

1. **Painel do dia** e **Dashboard gerencial**: indicadores calculados na API, sem dado clínico.
2. **Painel financeiro**: a receber, cartão em trânsito, contas a pagar e saldo realizado e projetado.
3. **Cancelamentos e estornos**: aprove o pedido da Secretária; o título reabre e o recibo é cancelado.
4. **Conciliação** (menu Financeiro): **Importar extrato** da adquirente simulada; as transações que não batem ficam divergentes e, na pílula de status, **Aceitar o extrato** ou **Contestar**, com observação.
5. **Contratos e tabelas** (menu Faturamento TISS): **+ Novo contrato** com operadora, vigência e prazos; em **Ver**, a tabela de preços negociada, ao lado do preço particular.
6. **Movimentações** (menu Estoque): aprove ou recuse o pedido de ajuste de inventário.
7. **Recibos e NFS-e**: **Emitir documento** como NFS-e para Nicolas Barros Dias, que não tem CPF: a nota fica pendente com o erro do ambiente nacional.
8. **Relatórios**: escolha a dimensão e o período e **Gerar relatório**; fica pronto em segundos, para ver na tela ou baixar em CSV. Recortes com menos de 5 registros ficam de fora.
9. **Notificações** → **Modelos e canais**: edite o texto ou o canal de um aviso; um campo como `{cid}` é recusado, porque o aviso não leva conteúdo clínico.
10. **Solicitações dos titulares (LGPD)**: abra um pedido e responda ou recuse com o motivo; o titular vê a resposta no portal.
11. **Log de auditoria**: as ações feitas na apresentação aparecem aqui, com o papel e o resultado.

### 5. Responsável Legal (Nicolas Gomes Esteves)

Entra no portal em nome da representada, Tatiana Barros Macedo; com `responsavel2`, o portal pede antes para escolher quem acompanhar.

## O que é simulado

- Pix, maquininha integrada (TEF) e ambiente nacional da NFS-e: respostas previsíveis, sem banco ou prefeitura de verdade.
- Operadora de saúde: elegibilidade (carteirinha terminada em 9 volta inelegível), protocolo do lote na hora e demonstrativo de retorno (guia de número múltiplo de 4 volta glosada).
- Adquirente do cartão: extrato em que a transação de NSU múltiplo de 3 vem com R$ 1,50 a menos.
- Varredura antivírus dos anexos: reprova o arquivo de teste EICAR.
- E-mails de convite e de nova senha: saem no terminal da API.
- Os dados são sintéticos; CPFs e telefones não pertencem a ninguém.

Todas as ações das telas têm função; nenhum botão leva mais a "Próxima etapa".
