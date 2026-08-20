/**
 * Geração de relatórios em CSV, Excel (XLSX) e PDF (seção 43/44).
 * Usado pelos endpoints /api/relatorios/exportar e /api/campanhas/[id]/exportar.
 */
import * as XLSX from "xlsx";
import PDFDocument from "pdfkit";

export function gerarCSV(colunas: string[], linhas: (string | number)[][]): string {
  const escapar = (v: string | number) => {
    const texto = String(v ?? "");
    return /[",\n;]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };
  const cabecalho = colunas.map(escapar).join(";");
  const corpo = linhas.map((linha) => linha.map(escapar).join(";")).join("\n");
  return "﻿" + cabecalho + "\n" + corpo; // BOM para acentuação abrir corretamente no Excel
}

export function gerarXLSX(colunas: string[], linhas: (string | number)[][], nomeAba = "Relatório"): Buffer {
  const planilha = XLSX.utils.aoa_to_sheet([colunas, ...linhas]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, planilha, nomeAba);
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

export function gerarPDF(titulo: string, colunas: string[], linhas: (string | number)[][]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4", layout: "landscape" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(16).text(titulo, { align: "left" });
    doc.fontSize(9).fillColor("#666").text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, { align: "left" });
    doc.moveDown();

    const larguraColuna = (doc.page.width - 80) / colunas.length;
    let y = doc.y;

    doc.fontSize(9).fillColor("#000");
    colunas.forEach((col, i) => doc.text(String(col), 40 + i * larguraColuna, y, { width: larguraColuna, ellipsis: true }));
    y += 16;
    doc.moveTo(40, y).lineTo(doc.page.width - 40, y).strokeColor("#ccc").stroke();
    y += 6;

    linhas.forEach((linha) => {
      if (y > doc.page.height - 60) {
        doc.addPage();
        y = 40;
      }
      linha.forEach((valor, i) => doc.text(String(valor ?? ""), 40 + i * larguraColuna, y, { width: larguraColuna, ellipsis: true }));
      y += 16;
    });

    doc.end();
  });
}
