export { default } from "next-auth/middleware";

// Protege todas as rotas do app, exceto login, api de auth, assets estáticos e os
// endpoints públicos que têm autenticação própria (segredo/webhook/opt-out do lead):
// automacoes/run (Bearer AUTOMACAO_SECRET), webhooks/chatguru, o link de opt-out e o
// pixel de rastreamento de abertura (carregado pelo cliente de e-mail do lead).
export const config = {
  matcher: [
    "/((?!login|api/auth|api/automacoes/run|api/webhooks|api/optout|api/mensagens/.*/pixel|_next/static|_next/image|favicon.ico).*)"
  ]
};
