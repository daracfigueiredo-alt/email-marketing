-- CreateEnum
CREATE TYPE "Perfil" AS ENUM ('ADMINISTRADOR', 'SUPERVISOR', 'OPERADOR');

-- CreateEnum
CREATE TYPE "StatusUsuario" AS ENUM ('ATIVO', 'INATIVO');

-- CreateEnum
CREATE TYPE "StatusLead" AS ENUM ('NOVO', 'EM_REMARKETING', 'EMAIL_ENVIADO', 'RESPONDEU', 'EM_ATENDIMENTO', 'INTERESSADO', 'REUNIAO', 'CONVERTIDO', 'NAO_INTERESSADO', 'ENCERRADO', 'BLOQUEADO', 'OPT_OUT');

-- CreateEnum
CREATE TYPE "StatusCampanha" AS ENUM ('ATIVA', 'PAUSADA', 'CONCLUIDA');

-- CreateEnum
CREATE TYPE "StatusChatGuru" AS ENUM ('NAO_SINCRONIZADO', 'SINCRONIZADO', 'ERRO');

-- CreateEnum
CREATE TYPE "DirecaoMensagem" AS ENUM ('ENVIADA', 'RECEBIDA');

-- CreateEnum
CREATE TYPE "StatusEnvio" AS ENUM ('PENDENTE', 'ENVIADO', 'ENTREGUE', 'FALHOU');

-- CreateEnum
CREATE TYPE "StatusFila" AS ENUM ('PENDENTE', 'PROCESSANDO', 'ENVIADO', 'FALHOU', 'CANCELADO', 'BLOQUEADO');

-- CreateEnum
CREATE TYPE "ProvedorEmail" AS ENUM ('GMAIL', 'GOOGLE_WORKSPACE', 'OUTLOOK', 'MICROSOFT_365');

-- CreateEnum
CREATE TYPE "PastaMensagem" AS ENUM ('ENTRADA', 'ENVIADOS', 'RASCUNHOS', 'ARQUIVADOS', 'IMPORTANTES', 'LIXEIRA', 'SPAM');

-- CreateEnum
CREATE TYPE "TipoNotificacao" AS ENUM ('NOVA_RESPOSTA', 'ERRO_ENVIO', 'CAMPANHA_CONCLUIDA', 'ERRO_CHATGURU', 'CONTA_EMAIL_DESCONECTADA', 'LEAD_INTERESSADO', 'NOVO_ATENDIMENTO');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "perfil" "Perfil" NOT NULL DEFAULT 'OPERADOR',
    "status" "StatusUsuario" NOT NULL DEFAULT 'ATIVO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimoAcesso" TIMESTAMP(3),

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contas_email" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "provedor" "ProvedorEmail" NOT NULL,
    "emailConta" TEXT NOT NULL,
    "nomeRemetente" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "refreshTokenRef" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "limitePorHora" INTEGER NOT NULL DEFAULT 30,
    "limitePorDia" INTEGER NOT NULL DEFAULT 200,
    "intervaloSegundosEntreEnvios" INTEGER NOT NULL DEFAULT 20,
    "horarioInicioPermitido" TEXT NOT NULL DEFAULT '08:00',
    "horarioFimPermitido" TEXT NOT NULL DEFAULT '19:00',
    "diasSemanaPermitidos" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[],

    CONSTRAINT "contas_email_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT,
    "telefone" TEXT,
    "empresa" TEXT,
    "documento" TEXT,
    "observacao" TEXT,
    "status" "StatusLead" NOT NULL DEFAULT 'NOVO',
    "optOut" BOOLEAN NOT NULL DEFAULT false,
    "optOutEm" TIMESTAMP(3),
    "bloqueado" BOOLEAN NOT NULL DEFAULT false,
    "responsavelId" TEXT,
    "campanhaId" TEXT,
    "etapaAtual" INTEGER NOT NULL DEFAULT 0,
    "proximoDisparo" TIMESTAMP(3),
    "ultimoContato" TIMESTAMP(3),
    "ultimaResposta" TIMESTAMP(3),
    "chatguruStatus" "StatusChatGuru" NOT NULL DEFAULT 'NAO_SINCRONIZADO',
    "chatguruContatoId" TEXT,
    "chatguruErro" TEXT,
    "origemImportacaoId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lista_supressao" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "telefone" TEXT,
    "motivo" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lista_supressao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "importacoes" (
    "id" TEXT NOT NULL,
    "arquivoNome" TEXT NOT NULL,
    "totalLinhas" INTEGER NOT NULL,
    "leadsValidos" INTEGER NOT NULL,
    "leadsInvalidos" INTEGER NOT NULL,
    "duplicados" INTEGER NOT NULL,
    "jaExistentes" INTEGER NOT NULL,
    "mapeamento" JSONB NOT NULL,
    "importadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "importacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modelos_email" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "assunto" TEXT NOT NULL,
    "corpoHtml" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modelos_email_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campanhas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "status" "StatusCampanha" NOT NULL DEFAULT 'ATIVA',
    "intervaloDias" INTEGER NOT NULL DEFAULT 3,
    "criadorId" TEXT,
    "responsavelId" TEXT,
    "contaEmailId" TEXT,
    "dataInicio" TIMESTAMP(3),
    "horarioEnvio" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campanhas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campanha_etapas" (
    "id" TEXT NOT NULL,
    "campanhaId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "modeloId" TEXT NOT NULL,
    "diasAposAnterior" INTEGER NOT NULL DEFAULT 3,

    CONSTRAINT "campanha_etapas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_campanha_progresso" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "campanhaId" TEXT NOT NULL,
    "etapaAtual" INTEGER NOT NULL DEFAULT 0,
    "interrompida" BOOLEAN NOT NULL DEFAULT false,
    "motivoParada" TEXT,
    "iniciadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_campanha_progresso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fila_envio" (
    "id" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "campanhaId" TEXT NOT NULL,
    "etapaOrdem" INTEGER NOT NULL,
    "horarioProgramado" TIMESTAMP(3) NOT NULL,
    "status" "StatusFila" NOT NULL DEFAULT 'PENDENTE',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "ultimoErro" TEXT,
    "processadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fila_envio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensagens" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "direcao" "DirecaoMensagem" NOT NULL,
    "assunto" TEXT,
    "corpo" TEXT NOT NULL,
    "de" TEXT,
    "para" TEXT,
    "cc" TEXT,
    "cco" TEXT,
    "anexos" JSONB,
    "rascunho" BOOLEAN NOT NULL DEFAULT false,
    "pasta" "PastaMensagem" NOT NULL DEFAULT 'ENTRADA',
    "status" "StatusEnvio" NOT NULL DEFAULT 'PENDENTE',
    "usuarioId" TEXT,
    "campanhaEtapaOrdem" INTEGER,
    "contaEmailId" TEXT,
    "encaminhadaDeId" TEXT,
    "gmailMessageId" TEXT,
    "gmailThreadId" TEXT,
    "chaveIdempotencia" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensagens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chatguru_eventos" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "tipo" TEXT NOT NULL,
    "payload" JSONB,
    "sucesso" BOOLEAN NOT NULL DEFAULT true,
    "erro" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chatguru_eventos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "eventoExternoId" TEXT,
    "payload" JSONB NOT NULL,
    "processado" BOOLEAN NOT NULL DEFAULT false,
    "erro" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processadoEm" TIMESTAMP(3),

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacoes" (
    "id" TEXT NOT NULL,
    "destinatarioId" TEXT NOT NULL,
    "tipo" "TipoNotificacao" NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "leadId" TEXT,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessoes_login" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "entrada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "saida" TIMESTAMP(3),

    CONSTRAINT "sessoes_login_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log_auditoria" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "acao" TEXT NOT NULL,
    "entidade" TEXT,
    "entidadeId" TEXT,
    "detalhes" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "log_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracoes" (
    "chave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,

    CONSTRAINT "configuracoes_pkey" PRIMARY KEY ("chave")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_login_key" ON "usuarios"("login");

-- CreateIndex
CREATE UNIQUE INDEX "contas_email_emailConta_key" ON "contas_email"("emailConta");

-- CreateIndex
CREATE INDEX "leads_email_idx" ON "leads"("email");

-- CreateIndex
CREATE INDEX "leads_telefone_idx" ON "leads"("telefone");

-- CreateIndex
CREATE UNIQUE INDEX "lista_supressao_email_key" ON "lista_supressao"("email");

-- CreateIndex
CREATE UNIQUE INDEX "lista_supressao_telefone_key" ON "lista_supressao"("telefone");

-- CreateIndex
CREATE UNIQUE INDEX "campanha_etapas_campanhaId_ordem_key" ON "campanha_etapas"("campanhaId", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "lead_campanha_progresso_leadId_campanhaId_key" ON "lead_campanha_progresso"("leadId", "campanhaId");

-- CreateIndex
CREATE UNIQUE INDEX "fila_envio_chaveIdempotencia_key" ON "fila_envio"("chaveIdempotencia");

-- CreateIndex
CREATE UNIQUE INDEX "mensagens_gmailMessageId_key" ON "mensagens"("gmailMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "mensagens_chaveIdempotencia_key" ON "mensagens"("chaveIdempotencia");

-- CreateIndex
CREATE INDEX "mensagens_leadId_idx" ON "mensagens"("leadId");

-- CreateIndex
CREATE INDEX "mensagens_contaEmailId_criadoEm_idx" ON "mensagens"("contaEmailId", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_eventoExternoId_key" ON "webhook_events"("eventoExternoId");

-- CreateIndex
CREATE INDEX "notificacoes_destinatarioId_lida_idx" ON "notificacoes"("destinatarioId", "lida");

-- CreateIndex
CREATE INDEX "log_auditoria_entidade_entidadeId_idx" ON "log_auditoria"("entidade", "entidadeId");

-- AddForeignKey
ALTER TABLE "contas_email" ADD CONSTRAINT "contas_email_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_campanhaId_fkey" FOREIGN KEY ("campanhaId") REFERENCES "campanhas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_origemImportacaoId_fkey" FOREIGN KEY ("origemImportacaoId") REFERENCES "importacoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campanhas" ADD CONSTRAINT "campanhas_criadorId_fkey" FOREIGN KEY ("criadorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campanhas" ADD CONSTRAINT "campanhas_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campanhas" ADD CONSTRAINT "campanhas_contaEmailId_fkey" FOREIGN KEY ("contaEmailId") REFERENCES "contas_email"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campanha_etapas" ADD CONSTRAINT "campanha_etapas_campanhaId_fkey" FOREIGN KEY ("campanhaId") REFERENCES "campanhas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campanha_etapas" ADD CONSTRAINT "campanha_etapas_modeloId_fkey" FOREIGN KEY ("modeloId") REFERENCES "modelos_email"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_campanha_progresso" ADD CONSTRAINT "lead_campanha_progresso_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_campanha_progresso" ADD CONSTRAINT "lead_campanha_progresso_campanhaId_fkey" FOREIGN KEY ("campanhaId") REFERENCES "campanhas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fila_envio" ADD CONSTRAINT "fila_envio_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fila_envio" ADD CONSTRAINT "fila_envio_campanhaId_fkey" FOREIGN KEY ("campanhaId") REFERENCES "campanhas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens" ADD CONSTRAINT "mensagens_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens" ADD CONSTRAINT "mensagens_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens" ADD CONSTRAINT "mensagens_encaminhadaDeId_fkey" FOREIGN KEY ("encaminhadaDeId") REFERENCES "mensagens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_destinatarioId_fkey" FOREIGN KEY ("destinatarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessoes_login" ADD CONSTRAINT "sessoes_login_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_auditoria" ADD CONSTRAINT "log_auditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
