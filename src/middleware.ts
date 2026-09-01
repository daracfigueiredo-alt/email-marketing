export { default } from "next-auth/middleware";

// Protege todas as rotas do app, exceto login, api de auth, assets estáticos e os
// endpoints públicos que têm autenticação própria (segredo/webhook/opt-out do lead):
// automacoes/run (Bearer AUTOMACAO_SECRET), webhooks/chatguru, o link de opt-out, o
// pixel de rastreamento de abertura (carregado pelo cliente de e-mail do lead),
// dfline-sync/webhook e dfline-sync/migrar-unico (Bearer DFLINE_SYNC_WEBHOOK_SECRET, chamados pelo cenário Make) e
// leads/importar-dfline (Bearer DFLINE_LEAD_IMPORT_SECRET, chamado direto do navegador
// pelo botão "Enviar para E-mail Marketing" no card do DFLINE — precisa ficar público
// porque quem chama não tem sessão logada neste app).
export const config = {
  matcher: [
    "/((?!login|redefinir-senha|api/auth|api/automacoes/run|api/webhooks|api/optout|api/mensagens/.*/pixel|api/dfline-sync/webhook|api/dfline-sync/poll|api/dfline-sync/migrar-unico|api/dfline-sync/espelhar-unico|api/dfline-sync/corrigir-faixa-divida|api/dfline-sync/detectar-equipe-errada|api/leads/importar-dfline|_next/static|_next/image|favicon.ico).*)"
  ]
};
