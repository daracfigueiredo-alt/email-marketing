-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN "resetSenhaToken" TEXT,
ADD COLUMN "resetSenhaExpira" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_resetSenhaToken_key" ON "usuarios"("resetSenhaToken");
