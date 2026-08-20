import { NextRequest, NextResponse } from "next/server";
import { concluirConexaoOutlook } from "@/lib/outlook";
import { registrarAuditoria } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const usuarioId = req.nextUrl.searchParams.get("state");
  const erroMs = req.nextUrl.searchParams.get("error_description") || req.nextUrl.searchParams.get("error");
  const baseUrl = process.env.NEXTAUTH_URL || req.nextUrl.origin;

  if (erroMs || !code || !usuarioId) {
    return NextResponse.redirect(`${baseUrl}/configuracoes?outlook_erro=${encodeURIComponent(erroMs || "código ausente")}`);
  }

  try {
    const conta = await concluirConexaoOutlook(code, usuarioId);
    await registrarAuditoria({ usuarioId, acao: "CONECTOU_CONTA_EMAIL", entidade: "ContaEmail", entidadeId: conta.id, detalhes: { emailConta: conta.emailConta } });
    return NextResponse.redirect(`${baseUrl}/configuracoes?outlook_ok=1`);
  } catch (erro: any) {
    return NextResponse.redirect(`${baseUrl}/configuracoes?outlook_erro=${encodeURIComponent(erro.message)}`);
  }
}
