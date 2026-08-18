import 'server-only';

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

import type { BillDetail } from '@/services/billing-service';

/**
 * PDF generation for maintenance receipts and invoices (SRS §1.6, Residents #2).
 *
 * `pdf-lib` is pure JavaScript with no native dependencies or headless browser,
 * so a receipt renders in a few milliseconds inside the request.
 */

const INK = rgb(0.06, 0.13, 0.15);
const MUTED = rgb(0.42, 0.46, 0.49);
const LINE = rgb(0.85, 0.87, 0.88);
const BRAND = rgb(0.11, 0.45, 0.46);
const SUCCESS = rgb(0.13, 0.53, 0.35);
const WARN = rgb(0.72, 0.42, 0.06);

const PAGE_WIDTH = 595.28; // A4 portrait
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

/** WinAnsi (the standard-font encoding) has no rupee glyph — spell it out. */
const money = (value: number) =>
  `Rs. ${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;

const formatDate = (date: Date | null | undefined) =>
  date
    ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
    : '—';

const formatDateTime = (date: Date | null | undefined) =>
  date
    ? new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date)
    : '—';

/** Strips characters the standard PDF fonts cannot encode. */
const safe = (value: string) => value.replace(/[^\x20-\x7E]/g, '-');

interface Ctx {
  page: PDFPage;
  regular: PDFFont;
  bold: PDFFont;
  y: number;
}

function text(
  ctx: Ctx,
  value: string,
  options: { x?: number; size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; align?: 'left' | 'right' } = {},
) {
  const size = options.size ?? 10;
  const font = options.bold ? ctx.bold : ctx.regular;
  const content = safe(value);
  const width = font.widthOfTextAtSize(content, size);
  const x =
    options.align === 'right'
      ? PAGE_WIDTH - MARGIN - width
      : (options.x ?? MARGIN);

  ctx.page.drawText(content, { x, y: ctx.y, size, font, color: options.color ?? INK });
}

function hr(ctx: Ctx, offset = 0) {
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y + offset },
    end: { x: PAGE_WIDTH - MARGIN, y: ctx.y + offset },
    thickness: 0.7,
    color: LINE,
  });
}

export interface ReceiptData {
  societyName: string;
  societyAddress: string;
  societyContact: string;
  bill: BillDetail;
  /** Omitted for an unpaid-invoice download. */
  payment?: BillDetail['payments'][number] | null;
}

export async function buildReceiptPdf(data: ReceiptData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const { bill, payment } = data;
  const isReceipt = Boolean(payment);
  const totalAmount = Number(bill.totalAmount);
  const paidAmount = Number(bill.paidAmount);
  const outstanding = Number((totalAmount - paidAmount).toFixed(2));
  const primary = bill.flat.residents[0];
  const flatLabel = `${bill.flat.block.name}-${bill.flat.flatNumber}`;
  const period = new Date(bill.periodYear, bill.periodMonth - 1, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });

  const ctx: Ctx = { page, regular, bold, y: PAGE_HEIGHT - MARGIN };

  // ── Header band ──
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 108,
    width: PAGE_WIDTH,
    height: 108,
    color: rgb(0.965, 0.976, 0.976),
  });
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 108, width: 5, height: 108, color: BRAND });

  ctx.y = PAGE_HEIGHT - 44;
  text(ctx, data.societyName, { size: 17, bold: true, color: BRAND });
  text(ctx, isReceipt ? 'PAYMENT RECEIPT' : 'MAINTENANCE INVOICE', {
    size: 12,
    bold: true,
    align: 'right',
  });

  ctx.y -= 16;
  text(ctx, data.societyAddress, { size: 8.5, color: MUTED });
  text(ctx, `Generated ${formatDateTime(new Date())}`, { size: 8.5, color: MUTED, align: 'right' });

  ctx.y -= 12;
  text(ctx, data.societyContact, { size: 8.5, color: MUTED });
  text(ctx, 'Powered by SmartSociety', { size: 8.5, color: MUTED, align: 'right' });

  // ── Reference block ──
  ctx.y = PAGE_HEIGHT - 148;
  const leftCol = MARGIN;
  const rightCol = MARGIN + CONTENT_WIDTH / 2 + 10;

  const pairs: [string, string, string, string][] = [
    [
      isReceipt ? 'Receipt number' : 'Invoice number',
      isReceipt ? payment!.receiptNumber : bill.billNumber,
      'Billing period',
      period,
    ],
    [
      'Invoice number',
      bill.billNumber,
      'Issue date',
      formatDate(bill.issueDate),
    ],
    [
      'Flat / unit',
      `${flatLabel} (${bill.flat.block.label ?? `Block ${bill.flat.block.name}`})`,
      'Due date',
      formatDate(bill.dueDate),
    ],
    [
      'Resident',
      primary ? primary.user.fullName : 'Not assigned',
      'Payment status',
      isReceipt ? 'PAID' : bill.status,
    ],
  ];

  for (const [labelA, valueA, labelB, valueB] of pairs) {
    text(ctx, labelA.toUpperCase(), { x: leftCol, size: 7.5, color: MUTED, bold: true });
    text(ctx, labelB.toUpperCase(), { x: rightCol, size: 7.5, color: MUTED, bold: true });
    ctx.y -= 11;
    text(ctx, valueA, { x: leftCol, size: 10 });
    text(ctx, valueB, {
      x: rightCol,
      size: 10,
      bold: labelB === 'Payment status',
      color: labelB === 'Payment status' && (isReceipt || bill.status === 'PAID') ? SUCCESS : INK,
    });
    ctx.y -= 18;
  }

  if (primary) {
    text(ctx, 'CONTACT', { size: 7.5, color: MUTED, bold: true });
    ctx.y -= 11;
    text(ctx, `${primary.user.email}  ·  ${primary.user.phone}`, { size: 9.5, color: MUTED });
    ctx.y -= 20;
  }

  // ── Charge breakdown ──
  ctx.y -= 6;
  hr(ctx, 12);
  text(ctx, 'CHARGE BREAKDOWN', { size: 8, bold: true, color: MUTED });
  ctx.y -= 16;
  hr(ctx, 10);

  ctx.y -= 4;
  for (const charge of bill.charges) {
    text(ctx, charge.label, { size: 10 });
    text(ctx, charge.chargeType.replace(/_/g, ' ').toLowerCase(), {
      x: MARGIN + 250,
      size: 8.5,
      color: MUTED,
    });
    text(ctx, money(Number(charge.amount)), { size: 10, align: 'right' });
    ctx.y -= 17;
  }

  hr(ctx, 8);
  ctx.y -= 10;

  const totals: [string, string, boolean][] = [
    ['Sub-total', money(Number(bill.baseAmount)), false],
    ...(Number(bill.penaltyAmount) > 0
      ? ([['Late payment penalty', money(Number(bill.penaltyAmount)), false]] as [string, string, boolean][])
      : []),
    ['Total payable', money(totalAmount), true],
    ['Amount paid', money(paidAmount), false],
  ];

  for (const [label, value, emphasise] of totals) {
    text(ctx, label, { x: MARGIN + 250, size: emphasise ? 11 : 10, bold: emphasise });
    text(ctx, value, { size: emphasise ? 11 : 10, bold: emphasise, align: 'right' });
    ctx.y -= emphasise ? 19 : 16;
  }

  text(ctx, 'Balance due', { x: MARGIN + 250, size: 11, bold: true });
  text(ctx, money(outstanding), {
    size: 11,
    bold: true,
    align: 'right',
    color: outstanding > 0 ? WARN : SUCCESS,
  });
  ctx.y -= 26;

  // ── Payment details ──
  if (payment) {
    hr(ctx, 12);
    text(ctx, 'PAYMENT DETAILS', { size: 8, bold: true, color: MUTED });
    ctx.y -= 18;

    const details: [string, string][] = [
      ['Payment date', formatDateTime(payment.paidAt)],
      ['Payment method', payment.method.replace(/_/g, ' ')],
      ['Transaction reference', payment.transactionRef],
      ['Amount received', money(Number(payment.amount))],
      ['Status', payment.status],
    ];

    for (const [label, value] of details) {
      text(ctx, label, { size: 9.5, color: MUTED });
      text(ctx, value, { size: 9.5, bold: label === 'Amount received', align: 'right' });
      ctx.y -= 15;
    }
    ctx.y -= 8;
  }

  // ── Footer ──
  ctx.y = MARGIN + 46;
  hr(ctx, 14);
  text(ctx, 'This is a computer-generated document and does not require a signature.', {
    size: 8,
    color: MUTED,
  });
  ctx.y -= 11;
  text(
    ctx,
    payment?.simulated
      ? 'Payment gateway processing and bank reconciliation are simulated for this demonstration build.'
      : 'Please settle the balance before the due date to avoid a late-payment penalty.',
    { size: 8, color: MUTED },
  );
  ctx.y -= 11;
  text(ctx, `${data.societyName}  ·  ${data.societyContact}`, { size: 8, color: MUTED });

  return pdf.save();
}

/** Printable A5 gate pass a resident can hand to a visitor. */
export interface GatePassPdfData {
  societyName: string;
  passCode: string;
  gateCode: string;
  visitorName: string;
  visitorPhone: string;
  visitorType: string;
  vehicleNumber: string | null;
  flatLabel: string;
  hostName: string;
  purpose: string | null;
  validFrom: Date;
  validUntil: Date;
  /** PNG data URI produced by `renderQrDataUrl`. */
  qrDataUrl: string;
}

export async function buildGatePassPdf(data: GatePassPdfData): Promise<Uint8Array> {
  const width = 420;
  const height = 595;
  const margin = 32;

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([width, height]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  page.drawRectangle({ x: 0, y: height - 84, width, height: 84, color: BRAND });
  page.drawText(safe(data.societyName), {
    x: margin,
    y: height - 42,
    size: 14,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText('VISITOR GATE PASS', {
    x: margin,
    y: height - 62,
    size: 9,
    font: regular,
    color: rgb(0.85, 0.95, 0.95),
  });

  // QR
  const qrImage = await pdf.embedPng(data.qrDataUrl);
  const qrSize = 170;
  page.drawImage(qrImage, {
    x: (width - qrSize) / 2,
    y: height - 84 - qrSize - 24,
    width: qrSize,
    height: qrSize,
  });

  let y = height - 84 - qrSize - 52;

  const centred = (value: string, size: number, font: PDFFont, color = INK) => {
    const content = safe(value);
    page.drawText(content, {
      x: (width - font.widthOfTextAtSize(content, size)) / 2,
      y,
      size,
      font,
      color,
    });
  };

  centred(`Gate code  ${data.gateCode}`, 15, bold, BRAND);
  y -= 15;
  centred(`Pass reference ${data.passCode}`, 8.5, regular, MUTED);
  y -= 24;

  page.drawLine({
    start: { x: margin, y: y + 6 },
    end: { x: width - margin, y: y + 6 },
    thickness: 0.7,
    color: LINE,
  });
  y -= 8;

  const rows: [string, string][] = [
    ['Visitor', data.visitorName],
    ['Phone', data.visitorPhone],
    ['Visitor type', data.visitorType.replace(/_/g, ' ')],
    ['Vehicle', data.vehicleNumber ?? 'Not provided'],
    ['Visiting flat', data.flatLabel],
    ['Host', data.hostName],
    ['Purpose', data.purpose ?? 'Not specified'],
    ['Valid from', formatDateTime(data.validFrom)],
    ['Valid until', formatDateTime(data.validUntil)],
  ];

  for (const [label, value] of rows) {
    page.drawText(safe(label.toUpperCase()), { x: margin, y, size: 7, font: bold, color: MUTED });
    page.drawText(safe(value), { x: margin + 96, y, size: 9.5, font: regular, color: INK });
    y -= 20;
  }

  page.drawText('Show this pass at the gate. It is valid only within the window above.', {
    x: margin,
    y: margin + 14,
    size: 7.5,
    font: regular,
    color: MUTED,
  });
  page.drawText('Generated by SmartSociety', {
    x: margin,
    y: margin + 3,
    size: 7.5,
    font: regular,
    color: MUTED,
  });

  return pdf.save();
}
