import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credenciais",
      credentials: {
        login: { label: "E-mail ou usuário", type: "text" },
        senha: { label: "Senha", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.login || !credentials?.senha) return null;

        const usuario = await prisma.usuario.findFirst({
          where: {
            OR: [{ email: credentials.login }, { login: credentials.login }],
            status: "ATIVO"
          }
        });
        if (!usuario) return null;

        const senhaValida = await bcrypt.compare(credentials.senha, usuario.senhaHash);
        if (!senhaValida) return null;

        await prisma.usuario.update({
          where: { id: usuario.id },
          data: { ultimoAcesso: new Date() }
        });

        return {
          id: usuario.id,
          name: usuario.nome,
          email: usuario.email,
          perfil: usuario.perfil
        } as any;
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.perfil = (user as any).perfil;
        // Seção 41 — abre um registro de sessão para calcular a duração no relatório de acessos
        const sessao = await prisma.sessaoLogin.create({ data: { usuarioId: (user as any).id } });
        token.sessaoId = sessao.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).perfil = token.perfil;
      }
      return session;
    }
  },
  events: {
    // Fecha o registro de sessão aberto no login (funciona com a estratégia JWT:
    // o evento recebe o token decodificado, de onde lemos o sessaoId salvo acima).
    async signOut({ token }) {
      const sessaoId = (token as any)?.sessaoId;
      if (sessaoId) {
        await prisma.sessaoLogin.update({ where: { id: sessaoId }, data: { saida: new Date() } }).catch(() => null);
      }
    }
  },
  secret: process.env.NEXTAUTH_SECRET
};
