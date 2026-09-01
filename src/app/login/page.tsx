"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [modoEsqueci, setModoEsqueci] = useState(false);
  const [enviandoReset, setEnviandoReset] = useState(false);
  const [resetEnviado, setResetEnviado] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    const resultado = await signIn("credentials", { login, senha, redirect: false });
    setCarregando(false);
    if (resultado?.error) {
      setErro("E-mail/usuário ou senha inválidos.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function handleEsqueciSenha(e: React.FormEvent) {
    e.preventDefault();
    setEnviandoReset(true);
    await fetch("/api/auth/esqueci-senha", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login })
    }).catch(() => null);
    setEnviandoReset(false);
    setResetEnviado(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        <h1 className="text-xl font-semibold text-center mb-1">E-mail Marketing + ChatGuru</h1>
        <p className="text-sm text-slate-500 text-center mb-6">Faça login para continuar</p>

        {!modoEsqueci ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">E-mail ou usuário</label>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
              <input
                type="password"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
              />
            </div>

            {erro && <p className="text-sm text-red-600">{erro}</p>}

            <button
              type="submit"
              disabled={carregando}
              className="w-full bg-brand-500 hover:bg-brand-600 text-white rounded-md py-2 text-sm font-medium disabled:opacity-60"
            >
              {carregando ? "Entrando..." : "ENTRAR"}
            </button>
            <button
              type="button"
              onClick={() => { setModoEsqueci(true); setResetEnviado(false); }}
              className="w-full text-xs text-slate-500 hover:text-brand-600"
            >
              Esqueci minha senha
            </button>
          </form>
        ) : resetEnviado ? (
          <div className="space-y-4">
            <p className="text-sm text-green-600 text-center">
              Se esse e-mail/usuário existir, enviamos um link de redefinição para o e-mail cadastrado.
            </p>
            <button
              type="button"
              onClick={() => setModoEsqueci(false)}
              className="w-full text-xs text-slate-500 hover:text-brand-600"
            >
              Voltar para o login
            </button>
          </div>
        ) : (
          <form onSubmit={handleEsqueciSenha} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">E-mail ou usuário</label>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              disabled={enviandoReset}
              className="w-full bg-brand-500 hover:bg-brand-600 text-white rounded-md py-2 text-sm font-medium disabled:opacity-60"
            >
              {enviandoReset ? "Enviando..." : "ENVIAR LINK DE REDEFINIÇÃO"}
            </button>
            <button
              type="button"
              onClick={() => setModoEsqueci(false)}
              className="w-full text-xs text-slate-500 hover:text-brand-600"
            >
              Voltar para o login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
