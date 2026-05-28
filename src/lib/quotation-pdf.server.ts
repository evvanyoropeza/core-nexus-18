/**
 * PDF builder using pdf-lib (Worker-compatible, pure JS).
 * Server-only — never import from client code.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export interface PdfHeader {
  folio: string;
  status: string;
  issue_date: string;
  valid_until: string | null;
  currency: string;
  payment_terms: string | null;
  delivery_terms: string | null;
  notes: string | null;
  subtotal: number;
  discount_pct: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
}

export interface PdfItem {
  position: number;
  name: string;
  sku: string | null;
  unit: string;
  quantity: number;
  unit_price: number;
  discount_pct: number;
  tax_rate: number;
  total: number;
}

export interface PdfTenant {
  name: string;
  fiscal_id: string | null;
  primary_color: string | null;
}

export interface PdfCustomerSnapshot {
  name?: string | null;
  legal_name?: string | null;
  tax_id?: string | null;
  email?: string | null;
  phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
}

export interface PdfBuildInput {
  tenant: PdfTenant;
  customer: PdfCustomerSnapshot;
  header: PdfHeader;
  items: PdfItem[];
  footer?: string | null;
}

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 40;

function hexToRgb(hex: string | null | undefined) {
  if (!hex) return rgb(0.39, 0.36, 1); // Stripe purple fallback
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return rgb(isFinite(r) ? r : 0, isFinite(g) ? g : 0, isFinite(b) ? b : 0);
}

const fmtMoney = (n: number, currency: string) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency, maximumFractionDigits: 2 }).format(
    Number(n || 0),
  );

const fmtDate = (s: string | null) => (s ? new Date(s + "T00:00:00").toLocaleDateString("es-MX") : "—");

// pdf-lib WinAnsi-safe text (replace unsupported chars).
function safe(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\u2022/g, "*")
    .replace(/\u00A0/g, " ");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = safe(text).split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const cand = cur ? cur + " " + w : w;
    if (font.widthOfTextAtSize(cand, size) <= maxWidth) cur = cand;
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

export async function buildQuotationPdf(input: PdfBuildInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Cotizacion ${input.header.folio}`);
  pdf.setCreator("ERP/CRM Industrial");

  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const brand = hexToRgb(input.tenant.primary_color);
  const muted = rgb(0.45, 0.47, 0.52);
  const border = rgb(0.88, 0.89, 0.92);
  const fg = rgb(0.1, 0.11, 0.14);

  let page: PDFPage = pdf.addPage([A4.w, A4.h]);
  let y = A4.h - MARGIN;

  const newPage = () => {
    page = pdf.addPage([A4.w, A4.h]);
    y = A4.h - MARGIN;
  };

  const ensure = (needed: number) => {
    if (y - needed < MARGIN + 30) newPage();
  };

  // Header band
  page.drawRectangle({ x: 0, y: A4.h - 110, width: A4.w, height: 110, color: brand });
  page.drawText(safe(input.tenant.name), {
    x: MARGIN,
    y: A4.h - 50,
    size: 18,
    font: bold,
    color: rgb(1, 1, 1),
  });
  if (input.tenant.fiscal_id) {
    page.drawText(safe(`RFC: ${input.tenant.fiscal_id}`), {
      x: MARGIN,
      y: A4.h - 70,
      size: 9,
      font: helv,
      color: rgb(1, 1, 1),
    });
  }
  page.drawText("COTIZACION", {
    x: A4.w - MARGIN - 110,
    y: A4.h - 50,
    size: 16,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText(safe(input.header.folio), {
    x: A4.w - MARGIN - 110,
    y: A4.h - 70,
    size: 11,
    font: helv,
    color: rgb(1, 1, 1),
  });
  page.drawText(safe(input.header.status.toUpperCase()), {
    x: A4.w - MARGIN - 110,
    y: A4.h - 86,
    size: 9,
    font: helv,
    color: rgb(1, 1, 1),
  });

  y = A4.h - 140;

  // Meta panels (Cliente / Datos)
  const colW = (A4.w - MARGIN * 2 - 16) / 2;
  const c1x = MARGIN;
  const c2x = MARGIN + colW + 16;
  const panelTop = y;
  const panelH = 110;

  // Customer box
  page.drawRectangle({ x: c1x, y: panelTop - panelH, width: colW, height: panelH, borderColor: border, borderWidth: 0.7, color: rgb(1, 1, 1) });
  page.drawText("CLIENTE", { x: c1x + 10, y: panelTop - 16, size: 8, font: bold, color: muted });

  const cust = input.customer;
  let cy = panelTop - 32;
  const drawSmall = (s: string, x: number, ySrc: number, opts: { b?: boolean } = {}) => {
    page.drawText(safe(s), { x, y: ySrc, size: 9, font: opts.b ? bold : helv, color: fg });
  };
  drawSmall(cust.name || "—", c1x + 10, cy, { b: true });
  cy -= 12;
  if (cust.legal_name && cust.legal_name !== cust.name) {
    drawSmall(cust.legal_name, c1x + 10, cy);
    cy -= 11;
  }
  if (cust.tax_id) { drawSmall(`RFC ${cust.tax_id}`, c1x + 10, cy); cy -= 11; }
  const addr = [cust.address_line1, cust.address_line2].filter(Boolean).join(", ");
  if (addr) { drawSmall(addr, c1x + 10, cy); cy -= 11; }
  const cityLine = [cust.city, cust.state, cust.postal_code].filter(Boolean).join(", ");
  if (cityLine) { drawSmall(cityLine, c1x + 10, cy); cy -= 11; }
  if (cust.email) { drawSmall(cust.email, c1x + 10, cy); cy -= 11; }
  if (cust.phone) { drawSmall(cust.phone, c1x + 10, cy); }

  // Header data
  page.drawRectangle({ x: c2x, y: panelTop - panelH, width: colW, height: panelH, borderColor: border, borderWidth: 0.7, color: rgb(1, 1, 1) });
  page.drawText("DATOS", { x: c2x + 10, y: panelTop - 16, size: 8, font: bold, color: muted });
  const rows: Array<[string, string]> = [
    ["Fecha emision", fmtDate(input.header.issue_date)],
    ["Valido hasta", fmtDate(input.header.valid_until)],
    ["Moneda", input.header.currency],
    ["Pago", input.header.payment_terms || "—"],
    ["Entrega", input.header.delivery_terms || "—"],
  ];
  let ry = panelTop - 32;
  for (const [k, v] of rows) {
    page.drawText(safe(k), { x: c2x + 10, y: ry, size: 8.5, font: helv, color: muted });
    page.drawText(safe(v), { x: c2x + 90, y: ry, size: 9, font: bold, color: fg });
    ry -= 13;
  }

  y = panelTop - panelH - 24;

  // Items table
  const tableX = MARGIN;
  const tableW = A4.w - MARGIN * 2;
  const cols = [
    { key: "name", title: "Concepto", w: 220, align: "l" as const },
    { key: "qty", title: "Cant.", w: 50, align: "r" as const },
    { key: "unit", title: "Unidad", w: 50, align: "l" as const },
    { key: "price", title: "P. unit.", w: 80, align: "r" as const },
    { key: "disc", title: "Desc%", w: 45, align: "r" as const },
    { key: "tax", title: "IVA%", w: 40, align: "r" as const },
    { key: "total", title: "Importe", w: 90, align: "r" as const },
  ];

  const drawHeaderRow = () => {
    page.drawRectangle({ x: tableX, y: y - 18, width: tableW, height: 18, color: rgb(0.96, 0.97, 0.99) });
    let cx = tableX + 6;
    for (const c of cols) {
      const w = bold.widthOfTextAtSize(c.title, 8);
      const tx = c.align === "r" ? cx + c.w - w - 6 : cx;
      page.drawText(c.title, { x: tx, y: y - 12, size: 8, font: bold, color: muted });
      cx += c.w;
    }
    y -= 18;
  };

  drawHeaderRow();

  for (const it of input.items) {
    const nameLines = wrap(it.name, helv, 9, cols[0].w - 12);
    const rowH = Math.max(20, nameLines.length * 11 + 8);
    ensure(rowH);
    if (y - rowH < MARGIN + 30) {
      newPage();
      drawHeaderRow();
    }

    let cx = tableX + 6;
    // Name
    nameLines.forEach((ln, i) => {
      page.drawText(ln, { x: cx, y: y - 12 - i * 11, size: 9, font: helv, color: fg });
    });
    if (it.sku) {
      page.drawText(safe(it.sku), {
        x: cx,
        y: y - 12 - nameLines.length * 11,
        size: 7.5,
        font: helv,
        color: muted,
      });
    }
    cx += cols[0].w;

    const rightCol = (text: string, w: number) => {
      const tw = helv.widthOfTextAtSize(text, 9);
      page.drawText(text, { x: cx + w - tw - 6, y: y - 12, size: 9, font: helv, color: fg });
      cx += w;
    };
    const leftCol = (text: string, w: number) => {
      page.drawText(text, { x: cx, y: y - 12, size: 9, font: helv, color: fg });
      cx += w;
    };

    rightCol(String(Number(it.quantity)), cols[1].w);
    leftCol(safe(it.unit), cols[2].w);
    rightCol(fmtMoney(it.unit_price, input.header.currency), cols[3].w);
    rightCol(Number(it.discount_pct) ? `${Number(it.discount_pct)}%` : "—", cols[4].w);
    rightCol(`${Number(it.tax_rate)}%`, cols[5].w);
    const totalText = fmtMoney(it.total, input.header.currency);
    const tw = bold.widthOfTextAtSize(totalText, 9);
    page.drawText(totalText, { x: cx + cols[6].w - tw - 6, y: y - 12, size: 9, font: bold, color: fg });

    y -= rowH;
    page.drawLine({
      start: { x: tableX, y },
      end: { x: tableX + tableW, y },
      thickness: 0.4,
      color: border,
    });
  }

  // Totals
  ensure(110);
  y -= 16;
  const tBoxW = 240;
  const tBoxX = tableX + tableW - tBoxW;
  const drawTotalRow = (label: string, value: string, strong = false) => {
    const f = strong ? bold : helv;
    const size = strong ? 11 : 9.5;
    const w = f.widthOfTextAtSize(value, size);
    page.drawText(label, { x: tBoxX + 12, y, size, font: f, color: strong ? fg : muted });
    page.drawText(value, { x: tBoxX + tBoxW - w - 12, y, size, font: f, color: fg });
    y -= size + 6;
  };

  drawTotalRow("Subtotal", fmtMoney(input.header.subtotal, input.header.currency));
  if (Number(input.header.discount_amount) > 0) {
    drawTotalRow(
      `Descuento (${Number(input.header.discount_pct)}%)`,
      `- ${fmtMoney(input.header.discount_amount, input.header.currency)}`,
    );
  }
  drawTotalRow("Impuestos", fmtMoney(input.header.tax_amount, input.header.currency));
  y -= 4;
  page.drawLine({
    start: { x: tBoxX + 12, y: y + 6 },
    end: { x: tBoxX + tBoxW - 12, y: y + 6 },
    thickness: 0.7,
    color: border,
  });
  drawTotalRow("TOTAL", fmtMoney(input.header.total, input.header.currency), true);

  // Notes
  if (input.header.notes) {
    ensure(60);
    y -= 6;
    page.drawText("NOTAS", { x: MARGIN, y, size: 8, font: bold, color: muted });
    y -= 14;
    const lines = wrap(input.header.notes, helv, 9.5, A4.w - MARGIN * 2);
    for (const ln of lines) {
      ensure(14);
      page.drawText(ln, { x: MARGIN, y, size: 9.5, font: helv, color: fg });
      y -= 12;
    }
  }

  // Footer
  if (input.footer) {
    const lines = wrap(input.footer, helv, 8, A4.w - MARGIN * 2);
    for (const p of pdf.getPages()) {
      let fy = MARGIN - 10;
      for (const ln of lines.slice(0, 2)) {
        p.drawText(ln, { x: MARGIN, y: fy, size: 8, font: helv, color: muted });
        fy -= 10;
      }
    }
  }

  return pdf.save();
}
