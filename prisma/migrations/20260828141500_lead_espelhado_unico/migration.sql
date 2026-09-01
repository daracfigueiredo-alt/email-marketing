-- CreateTable
CREATE TABLE "leads_espelhados_unico" (
    "id" TEXT NOT NULL,
    "telefoneNormalizado" TEXT NOT NULL,
    "origemAba" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leads_espelhados_unico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leads_espelhados_unico_telefoneNormalizado_key" ON "leads_espelhados_unico"("telefoneNormalizado");
