import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { tratarRespostaDetectada } from "@/lib/automacao";

/**
 * Recebe eventos do ChatGuru (seção 38). Todo evento é gravado em EventoWebhook
 * ANTES de qualquer processamento (seção 53), e o eventoExternoId (quando enviado
 * pelo ChatGuru) garante idempotência — o mesmo evento nunca é processado 2x (seção 52).
 *
 * Payload esperado (ajustar conforme documentação oficial da conta ChatGuru):
 * { id, telefone, nome, email, chat_id, responsavel, mensagem, data, tipo }
 */
export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const eventoExternoId: string | undefined = payload.id ?? payload.event_id;

  if (eventoExternoId) {
    const existente = await prisma.eventoWebhook.findUnique({ where: { eventoExternoId } });
    if (existente?.processado) {
      return NextResponse.json({ ok: true, duplicado: true });
    }
  }

  const evento = await prisma.eventoWebhook.upsert({
    where: { eventoExternoId: eventoExternoId ?? "sem-id-" + randomUUID() },
    update: { payload },
    create: { origem: "chatguru", eventoExternoId, payload }
  });

  try {
    const telefone: string | undefined = payload.telefone ?? payload.celular ?? payload.chat_number;
    const tipoMensagem: string | undefined = payload.tipo ?? payload.type;

    if (telefone && (tipoMensagem === "mensagem_recebida" || tipoMensagem === "resposta")) {
      const digitos = telefone.replace(/\D/g, "");
      const lead = await prisma.lead.findFirst({ where: { telefone: digitos } });
      if (lead) {
        await tratarRespostaDetectada(lead.id);
      }
    }

    await prisma.eventoWebhook.update({ where: { id: evento.id }, data: { processado: true, processadoEm: new Date() } });
    return NextResponse.json({ ok: true });
  } catch (erro: any) {
    await prisma.eventoWebhook.update({ where: { id: evento.id }, data: { erro: erro.message } });
    return NextResponse.json({ ok: false, erro: erro.message }, { status: 500 });
  }
}
