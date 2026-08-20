import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { redirect } from "next/navigation";

/** Usa em Server Components/route handlers para exigir usuário logado. */
export async function usuarioAtual() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return session.user as { id: string; name?: string | null; email?: string | null; perfil: "ADMINISTRADOR" | "SUPERVISOR" | "OPERADOR" };
}

export async function exigirUsuario() {
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/login");
  return usuario;
}

export async function exigirAdmin() {
  const usuario = await exigirUsuario();
  if (usuario.perfil !== "ADMINISTRADOR") redirect("/dashboard");
  return usuario;
}
