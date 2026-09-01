/**
 * Cliente para o Firestore do DFLINE (CRM externo, app estático em
 * github.com/daracfigueiredo-alt/dfline-crm — NUNCA modificado por este projeto).
 *
 * Usa o Firebase Admin SDK com uma Service Account própria (FIREBASE_ADMIN_*),
 * gerada no Console do Firebase do projeto df-crm-14fac — não a chave pública de
 * cliente que o DFLINE embute no navegador. Isso dá acesso de leitura/escrita
 * garantido, independente das regras do Firestore.
 *
 * Escreve sempre em escritorios/{DFLINE_OFFICE_ID}/deals — a mesma coleção que o
 * DFLINE observa em tempo real, então um card criado aqui aparece no Kanban dele
 * imediatamente.
 */
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let app: App | undefined;
let db: Firestore | undefined;

function firestoreAdmin(): Firestore {
  if (db) return db;

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("FIREBASE_ADMIN_PROJECT_ID / FIREBASE_ADMIN_CLIENT_EMAIL / FIREBASE_ADMIN_PRIVATE_KEY não configurados.");
  }

  app = getApps()[0] ?? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  db = getFirestore(app);
  return db;
}

function officeId() {
  const id = process.env.DFLINE_OFFICE_ID;
  if (!id) throw new Error("DFLINE_OFFICE_ID não configurado no ambiente.");
  return id;
}

function normalizarTelefone(telefone: string) {
  return (telefone || "").replace(/\D/g, "");
}

/**
 * Forma canônica de um telefone BR para COMPARAÇÃO de duplicidade: DDD + 9 dígitos
 * do celular, sem o "55". Cards antigos do DFLINE foram digitados à mão em formatos
 * variados — com/sem "55", com/sem o "9" extra do celular (ex: "(32) 99194535" vs
 * "5532999194535" são o mesmo número). Comparar os dígitos crus faz a checagem de
 * duplicidade não bater nesses casos e recriar um card pra um lead que já existe
 * (achado investigando o card duplicado "Julian & Jaider", telefone 5532999194535,
 * em 2026-08-31). Esta função só serve pra COMPARAR — o telefone gravado no deal ou
 * em LeadDflineImportado continua sendo o valor original, sem essa normalização.
 */
function numeroComparavelBR(telefone: string): string {
  let digitos = normalizarTelefone(telefone);
  if (digitos.length === 13 && digitos.startsWith("55")) digitos = digitos.slice(2);
  else if (digitos.length === 12 && digitos.startsWith("55")) digitos = digitos.slice(2);
  if (digitos.length === 10) digitos = digitos.slice(0, 2) + "9" + digitos.slice(2);
  return digitos;
}

/** Lê os campos crm_teams e crm_users do escritório (para casar equipe/responsável por nome). */
export async function buscarEquipesEUsuarios() {
  const doc = await firestoreAdmin().collection("escritorios").doc(officeId()).get();
  const dados = doc.data() || {};
  const equipes: string[] = dados.crm_teams || [];
  const usuarios: Array<{ id: number; name: string; role: string; team?: string }> = dados.crm_users || [];
  return { equipes, usuarios };
}

/**
 * Busca (best-effort) um deal existente com o mesmo telefone, para evitar duplicar
 * card no Kanban do DFLINE. Compara pelos dígitos do telefone armazenado — como o
 * DFLINE guarda o telefone como o usuário digitou (sem normalizar), isso não pega
 * 100% dos casos de formatação diferente; a garantia forte de não-duplicidade desta
 * sincronização é o índice único em LeadDflineImportado.telefoneNormalizado.
 */
export async function buscarDealPorTelefone(telefoneNormalizado: string) {
  const alvo = numeroComparavelBR(telefoneNormalizado);
  const snapshot = await firestoreAdmin()
    .collection("escritorios")
    .doc(officeId())
    .collection("deals")
    .get();

  for (const doc of snapshot.docs) {
    const campos = doc.data();
    const telefoneDoc = campos.phone ? numeroComparavelBR(String(campos.phone)) : "";
    if (telefoneDoc && telefoneDoc === alvo) {
      return { id: doc.id, campos };
    }
  }
  return null;
}

export type NovoDealDfline = {
  contato: string; // "Nome do Contato" — campo obrigatório no DFLINE
  empresa?: string; // vai para o campo "name" (nome de exibição/empresa)
  telefone: string;
  email?: string; // sem isso o botão "Enviar para E-mail Marketing" do card não consegue disparar remarketing
  equipe?: string;
  sdrId?: number;
  campanha?: string;
  observacaoInicial?: string; // vira uma anotação (notes[]) no card, com o restante dos dados da planilha
};

/** Cria um novo card em escritorios/{OFFICE_ID}/deals, no funil/coluna de destino configurados. */
export async function criarDealNoDfline(dados: NovoDealDfline) {
  const funilId = process.env.DFLINE_FUNIL_NOVO_LEAD_ID;
  const colunaId = process.env.DFLINE_COLUNA_NOVO_LEAD_ID;
  if (!funilId || !colunaId) throw new Error("DFLINE_FUNIL_NOVO_LEAD_ID / DFLINE_COLUNA_NOVO_LEAD_ID não configurados.");

  const agora = new Date().toISOString();
  const doc = {
    name: dados.empresa || dados.contato,
    contact: dados.contato,
    phone: dados.telefone,
    email: dados.email || "",
    column: colunaId,
    funnelId: funilId,
    campaign: dados.campanha || "",
    team: dados.equipe || "",
    sdrId: dados.sdrId ?? "",
    closerId: "",
    chatguru: "",
    tags: [] as string[],
    state: "",
    createdAt: agora,
    tasks: [] as unknown[],
    notes: dados.observacaoInicial
      ? [{ id: Date.now(), text: dados.observacaoInicial, author: "Sincronização Funil 2.1", ts: agora }]
      : ([] as unknown[]),
    files: [] as unknown[],
    won: false,
    lost: false,
    lostReason: ""
  };

  const ref = await firestoreAdmin().collection("escritorios").doc(officeId()).collection("deals").add(doc);
  return { dealId: ref.id };
}
