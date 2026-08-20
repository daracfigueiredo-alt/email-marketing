/**
 * Criptografia simétrica (AES-256-GCM) para segredos que precisam ser
 * armazenados no banco (ex: refresh_token de contas de e-mail conectadas).
 *
 * A chave nunca fica no código nem no frontend — vem de ENCRYPTION_KEY (.env),
 * uma string de 32 bytes. Gere uma com: `openssl rand -hex 32`.
 *
 * Isso NÃO substitui um cofre de segredos (KMS/Vault) de verdade em produção,
 * mas evita guardar tokens em texto puro no banco.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

function chave() {
  const segredo = process.env.ENCRYPTION_KEY;
  if (!segredo) throw new Error("ENCRYPTION_KEY não configurada no ambiente.");
  return scryptSync(segredo, "email-marketing-chatguru", 32);
}

export function criptografar(texto: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", chave(), iv);
  const encrypted = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

export function descriptografar(valor: string): string {
  const [ivHex, authTagHex, dadosHex] = valor.split(":");
  const decipher = createDecipheriv("aes-256-gcm", chave(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dadosHex, "hex")), decipher.final()]);
  return decrypted.toString("utf8");
}
