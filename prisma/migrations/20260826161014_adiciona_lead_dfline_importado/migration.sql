-- CreateEnum
CREATE TYPE "OrigemLeadDfline" AS ENUM ('CONSOLIDADO_2_1_5', 'PRODUTOR_RURAL');

-- CreateTable
CREATE TABLE "leads_dfline_importados" (
    "id" TEXT NOT NULL,
    "origemAba" "OrigemLeadDfline" NOT NULL,
    "telefoneNormalizado" TEXT NOT NULL,
    "dflineDealId" TEXT NOT NULL,
    "nome" TEXT,
    "empresa" TEXT,
    "equipe" TEXT,
    "responsavelTexto" TEXT,
    "sdrIdDfline" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leads_dfline_importados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leads_dfline_importados_telefoneNormalizado_key" ON "leads_dfline_importados"("telefoneNormalizado");

