# Sistema de E-mail Marketing + ChatGuru

Plataforma própria para gerenciamento de e-mail marketing e remarketing de leads, com integração ao ChatGuru. Next.js 14 (App Router) + PostgreSQL (Prisma) + NextAuth + Gmail API.

## Como rodar localmente

1. **Instalar dependências**
   ```
   npm install
   ```

2. **Configurar variáveis de ambiente**
   ```
   cp .env.example .env
   ```
   Preencha pelo menos `DATABASE_URL`, `NEXTAUTH_SECRET` (gere com `openssl rand -base64 32`) e `ENCRYPTION_KEY` (gere com `openssl rand -hex 32` — usada para cifrar os refresh_tokens das contas de e-mail conectadas). Gmail, Outlook e ChatGuru podem ficar vazios no início — as telas mostram "não configurado" até você preenchê-los.

3. **Criar as tabelas no banco e gerar o Prisma Client**
   ```
   npx prisma generate
   npx prisma migrate dev --name init
   ```

4. **Popular dados iniciais (usuário admin + modelos + campanha de exemplo)**
   ```
   npm run seed
   ```
   Login: `carlos` · senha: `senhac1234` — troque em **Meu Perfil** no primeiro acesso.

5. **Rodar em desenvolvimento**
   ```
   npm run dev
   ```

## ⚠️ Sobre este ambiente de desenvolvimento

Este projeto foi construído em um sandbox sem acesso à CDN de binários do Prisma (`binaries.prisma.sh`), então **não foi possível rodar `prisma generate` nem `next build` aqui** para uma verificação 100% ponta a ponta. Revisei manualmente todo o código; a checagem de tipos (`tsc --noEmit`) só aponta erros de "tipo implícito `any`" em componentes que consultam o banco — isso é esperado, pois sem `prisma generate` o Prisma Client fica com um cliente vazio (placeholder) e não conhece os modelos `Lead`, `Campanha` etc. Assim que você rodar `npx prisma generate` no seu ambiente (com acesso normal à internet), esses tipos são gerados corretamente e os erros desaparecem.

**Antes de considerar o sistema pronto, rode `npm run build` no seu ambiente e resolva qualquer erro remanescente.**

## O que já está implementado

- **Login e sessão** (NextAuth + credenciais, senha com bcrypt, nunca em texto puro).
- **Usuários** com perfis Administrador / Supervisor / Operador, tela de gestão restrita a administradores.
- **Importação de planilha** (XLSX/CSV): detecção automática de colunas, confirmação de mapeamento, pré-visualização com contagem de válidos/inválidos/duplicados/já existentes, checagem de duplicidade por e-mail e depois telefone antes de gravar.
- **Leads**: cadastro completo (status, responsável, campanha, etapa, próximo disparo, status ChatGuru), ficha do lead com histórico de mensagens, transferência entre responsáveis.
- **Modelos de e-mail** com variáveis `{{nome}}`, `{{empresa}}`, `{{telefone}}`, `{{responsavel}}`.
- **Campanhas** com sequência configurável de etapas, responsável, conta de envio, data/horário de início e intervalo de remarketing (padrão 3 dias, ajustável por etapa).
- **Conexão de contas Gmail e Outlook/Microsoft 365 via OAuth 2.0** ("Conectar conta" em Configurações — fluxo completo de autorização, troca de código por refresh_token, que fica cifrado no banco com AES-256-GCM). Suporta múltiplas contas, cada campanha escolhe qual conta usa para enviar ("Enviar como").
- **Sincronização de respostas do Gmail**: a cada execução da automação, `verificarRespostasGmail` busca não lidas nas contas conectadas, identifica o lead pelo remetente, grava a mensagem recebida e interrompe o remarketing — idempotente (não reprocessa a mesma mensagem).
- **Motor de automação em duas fases** (`src/lib/automacao.ts`): agenda os próximos envios numa fila (`FilaEnvio`) rodando o checklist completo do roteiro (respondeu / opt-out / bloqueado / campanha ativa / e-mail válido) e depois processa a fila respeitando os limites de disparo por hora/dia/horário/dias da semana de cada conta, com retentativa controlada (backoff exponencial, até 5 tentativas) para erros temporários — nunca duplica um envio (chave de idempotência única). Endpoint `POST /api/automacoes/run` para acionar via cron externo, e botão "Rodar agora" na tela Automações.
- **Regra fundamental**: resposta do lead (detectada via Gmail, webhook do ChatGuru ou marcada manualmente) interrompe a sequência automaticamente, muda o status para "Respondeu" e gera notificação para o responsável.
- **Caixa de Entrada** própria (pastas Entrada/Enviados/Rascunhos/Arquivados/Importantes/Lixeira/Spam), com responder, encaminhar, Cc/Cco, rascunho automático e **upload real de anexos** (PDF, DOCX, XLSX, JPG, PNG etc., armazenados em `uploads/` e servidos só para usuários autenticados) — tudo dentro do aplicativo, sem precisar abrir Gmail/Outlook.
- **Opt-out**: todo e-mail de remarketing inclui link de descadastro; ao clicar, o lead é marcado como `OPT_OUT`, entra na lista de supressão e nenhuma campanha volta a enviar para ele.
- **ChatGuru**: criação de contato evitando duplicidade (reaproveita `chatguruContatoId` se já existir), anotação automática após cada envio e após cada resposta, endpoint de webhook (`POST /api/webhooks/chatguru`) que grava o evento bruto antes de processar (idempotência).
- **Notificações in-app** (nova resposta, erro de envio, etc.), central em `/notificacoes`.
- **Dashboard, Relatórios e Auditoria**: métricas de e-mail/leads/campanhas/ChatGuru, agrupamentos por status/responsável, atividade por usuário, relatório de campanha individual (envio/entrega/falha/resposta/taxa de resposta/opt-outs) e **relatório de login/logout com duração de sessão** (`/relatorios/acessos`, com filtros hoje/ontem/semana/mês/período/usuário) — tudo **exportável em PDF, Excel e CSV**. Log de auditoria completo com usuário resolvido pela sessão autenticada (nunca informado pelo frontend).
- **Configurações**: mostra se cada integração está configurada e lista as contas de e-mail conectadas, sem nunca expor os valores das credenciais na tela.

## O que ficou como próxima etapa (roadmap)

- **Storage de anexos em produção**: hoje os anexos ficam em disco local (`uploads/`), o que funciona bem para uma única instância. Com múltiplas instâncias/deploy serverless, troque por S3/Google Cloud Storage/Azure Blob (a interface de `POST /api/anexos` já devolve `{nome, url, tipo, tamanho}`, então é só trocar a implementação interna).
- **Sincronização de respostas do Outlook** (o Gmail já sincroniza; o Outlook hoje só envia — leitura da caixa de entrada via Microsoft Graph ainda não foi implementada).
- **Confirmação de webhook oficial do ChatGuru**: os endpoints usados em `src/lib/chatguru.ts` (`/chat_add`, `/note_add`) seguem o padrão comum da API, mas devem ser conferidos com a documentação da conta ChatGuru do cliente antes de produção — não invente endpoints, valide com a doc oficial.
- **Fuso horário dos limites de disparo**: a checagem de horário/dias permitidos por conta (`dentroDaJanelaPermitida` em `automacao.ts`) usa o horário do servidor. Configure a variável de ambiente `TZ` do processo Node para o fuso do negócio (ex: `TZ=America/Sao_Paulo`) em produção.
- **"Sessão expirada" como evento de auditoria**: hoje só login e logout geram `SessaoLogin`; expiração automática do token (sem logout explícito) não fecha o registro — a sessão aparece como "em aberto" no relatório até o próximo login do usuário.
- **LGPD**: os campos e o controle de acesso por perfil já existem; políticas de retenção/exclusão de dados e registro formal de base legal ainda precisam ser definidos com o time jurídico do cliente.
- **Fila de disparo em processo separado**: hoje `processarFilaEnvio` roda dentro da própria requisição HTTP de `/api/automacoes/run` (até 100 itens por execução). Para grandes volumes, mover para um worker dedicado (ex: BullMQ + Redis) evita depender do timeout da requisição HTTP.

## Segurança

- Nenhuma senha, API key, token ou credencial de Gmail/Outlook fica no frontend — tudo em variáveis de ambiente lidas apenas no servidor (`.env`, nunca commitado).
- Senhas de usuário sempre em hash bcrypt.
- Refresh tokens das contas de e-mail conectadas ficam cifrados no banco (AES-256-GCM, `src/lib/crypto.ts`), nunca em texto puro.
- Anexos só são servidos para usuários autenticados (`GET /api/anexos/[id]`), com proteção contra path traversal.
- Toda ação relevante é registrada em auditoria com o usuário resolvido pela sessão autenticada (nunca informado pelo cliente).

## Estrutura do projeto

```
src/
  app/            rotas (App Router) — páginas em (app)/ exigem login (ver middleware.ts)
  app/api/        endpoints (leads, campanhas, webhook ChatGuru, automação, OAuth Gmail/Outlook,
                  anexos, exportação de relatórios, opt-out, etc.)
  components/     Sidebar, Card, PageHeader
  lib/            regras de negócio: dedupe, importParser, automacao (fila + retentativa),
                  email (dispatcher Gmail/Outlook), gmail, outlook, chatguru, notificacoes,
                  personalizacao, exportacao (CSV/XLSX/PDF), crypto, audit, auth, prisma, session
prisma/
  schema.prisma   modelo de dados completo
  seed.ts         dados iniciais de exemplo
uploads/          anexos enviados pela Caixa de Entrada (local; trocar por storage em nuvem em produção)
```

## Checklist de teste antes de ir para produção

1. Criar usuário administrador (seed já cria um).
2. Login / logout e conferir o registro em Relatórios → Acessos.
3. Importar uma planilha de teste (XLSX e CSV).
4. Confirmar detecção de duplicados e leads já existentes.
5. Criar um modelo de e-mail e uma campanha com 2+ etapas.
6. Conectar uma conta Gmail e/ou Outlook em Configurações e selecioná-la como "Enviar como" na campanha.
7. Rodar a automação manualmente ("Rodar agora") e confirmar o envio.
8. Responder ao e-mail de teste (de fora) e confirmar que a sincronização detecta a resposta e interrompe a sequência.
9. Responder pelo aplicativo (Caixa de Entrada), testar Cc, encaminhar, rascunho e anexo real.
10. Confirmar anotação automática no ChatGuru (com credenciais reais).
11. Testar o link de opt-out de um e-mail enviado.
12. Testar o webhook do ChatGuru com um payload de exemplo.
13. Forçar uma falha de envio (ex: conta inválida) e confirmar a retentativa com backoff na fila (`FilaEnvio`).
14. Conferir os registros em Auditoria e Notificações.
15. Gerar os relatórios (dashboard, campanha, acessos) e testar as exportações PDF/Excel/CSV.
