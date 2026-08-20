/**
 * Popula o banco com dados iniciais: um usuário administrador, um supervisor,
 * um operador, dois modelos de e-mail de exemplo e uma campanha de exemplo.
 *
 * Rodar com: npm run seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const senhaHashAdmin = await bcrypt.hash("senhac1234", 12);
  const senhaHash = await bcrypt.hash("Trocar@123", 12);

  const admin = await prisma.usuario.upsert({
    where: { email: "carlos@empresa.com" },
    update: {},
    create: {
      nome: "Carlos",
      email: "carlos@empresa.com",
      login: "carlos",
      senhaHash: senhaHashAdmin,
      perfil: "ADMINISTRADOR"
    }
  });

  await prisma.usuario.upsert({
    where: { email: "supervisor@empresa.com" },
    update: {},
    create: {
      nome: "Supervisor Exemplo",
      email: "supervisor@empresa.com",
      login: "supervisor",
      senhaHash,
      perfil: "SUPERVISOR"
    }
  });

  await prisma.usuario.upsert({
    where: { email: "operador@empresa.com" },
    update: {},
    create: {
      nome: "Operador Exemplo",
      email: "operador@empresa.com",
      login: "operador",
      senhaHash,
      perfil: "OPERADOR"
    }
  });

  const modelo1 = await prisma.modeloEmail.create({
    data: {
      nome: "E-mail 1 — Primeiro contato",
      assunto: "Podemos conversar, {{nome}}?",
      corpoHtml: "Olá {{nome}},<br><br>Tudo bem? Meu nome é {{responsavel}} e gostaria de conversar sobre uma oportunidade para {{empresa}}.<br><br>Podemos marcar um horário?"
    }
  });

  const modelo2 = await prisma.modeloEmail.create({
    data: {
      nome: "E-mail 2 — Remarketing",
      assunto: "{{nome}}, ainda podemos conversar?",
      corpoHtml: "Olá {{nome}},<br><br>Passando novamente para saber se faz sentido conversarmos. Fico à disposição!"
    }
  });

  await prisma.campanha.create({
    data: {
      nome: "Remarketing Bancário — Agosto",
      descricao: "Sequência de exemplo com 2 etapas, a cada 3 dias",
      intervaloDias: 3,
      criadorId: admin.id,
      responsavelId: admin.id,
      etapas: {
        create: [
          { ordem: 0, modeloId: modelo1.id, diasAposAnterior: 3 },
          { ordem: 1, modeloId: modelo2.id, diasAposAnterior: 3 }
        ]
      }
    }
  });

  console.log("Seed concluído. Login: carlos / senha: senhac1234 (altere após o primeiro acesso).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
