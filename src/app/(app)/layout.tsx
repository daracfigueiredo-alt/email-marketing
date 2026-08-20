import Sidebar from "@/components/Sidebar";
import { exigirUsuario } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const usuario = await exigirUsuario();

  return (
    <div className="flex min-h-screen">
      <Sidebar nomeUsuario={usuario.name} />
      <main className="flex-1 min-w-0 p-6 pt-16 md:pt-6 max-w-6xl">{children}</main>
    </div>
  );
}
