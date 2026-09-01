import PDFDocument from 'pdfkit';
import type { TripReportData } from './reports.service';
import { getTranslations } from './translations';

const COLORS = {
    primary: '#059669',
    text: '#171717',
    muted: '#737373',
    border: '#e5e5e5',
    background: '#f7f6f1',
    positive: '#059669',
    negative: '#dc2626',
    zero: '#737373',
};

const MARGINS = { top: 50, bottom: 60, left: 50, right: 50 };

export async function buildTripReportPdf(data: TripReportData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: 'A4',
            margins: MARGINS,
            bufferPages: true,
            info: {
                Title: `${data.trip.name} — TripControl`,
                Author: 'TripControl',
                Subject: 'Relatório de Viagem',
                CreationDate: new Date(),
            },
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        renderReport(doc, data);
        doc.end();
    });
}

function renderReport(doc: PDFKit.PDFDocument, data: TripReportData) {
    const t = getTranslations(data.userLanguage);

    const currency = new Intl.NumberFormat(data.userLanguage, {
        style: 'currency',
        currency: data.userCurrency,
    });

    const dateFmt = new Intl.DateTimeFormat(data.userLanguage, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });

    const dateTimeFmt = new Intl.DateTimeFormat(data.userLanguage, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

    renderHeader(doc, t, dateTimeFmt);
    renderCover(doc, data, t, dateFmt, currency);
    renderFinancialSummary(doc, data, t, currency);
    renderByCategory(doc, data, t, currency);
    renderExpenseList(doc, data, t, currency, dateFmt);
    renderBalances(doc, data, t, currency);
    renderSettlements(doc, data, t, currency);
    renderPaymentHistory(doc, data, t, currency, dateFmt);
    renderFooter(doc, t);
}

// ─── Header ──────────────────────────────────────────────────────────────────
function renderHeader(
    doc: PDFKit.PDFDocument,
    t: ReturnType<typeof getTranslations>,
    dateTimeFmt: Intl.DateTimeFormat,
) {
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.primary).text('TripControl', MARGINS.left, 25);
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted).text(
        `${t.generatedAt}: ${dateTimeFmt.format(new Date())}`,
        MARGINS.left,
        25,
        { align: 'right' },
    );
    doc.moveTo(MARGINS.left, 45).lineTo(doc.page.width - MARGINS.right, 45).strokeColor(COLORS.border).stroke();
}

// ─── Capa ────────────────────────────────────────────────────────────────────
function renderCover(
    doc: PDFKit.PDFDocument,
    data: TripReportData,
    t: ReturnType<typeof getTranslations>,
    dateFmt: Intl.DateTimeFormat,
    currency: Intl.NumberFormat,
) {
    doc.y = 70;

    doc.font('Helvetica-Bold').fontSize(22).fillColor(COLORS.text).text(t.reportTitle);
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').fontSize(26).fillColor(COLORS.primary).text(data.trip.name);
    doc.moveDown(0.5);

    doc.font('Helvetica').fontSize(11).fillColor(COLORS.text);
    doc.text(data.trip.destination);
    doc.moveDown(0.3);

    const days = Math.ceil(
        (data.trip.endDate.getTime() - data.trip.startDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    doc.fillColor(COLORS.muted).fontSize(10).text(
        `${t.period}: ${dateFmt.format(data.trip.startDate)} — ${dateFmt.format(data.trip.endDate)} · ${days} ${t.days}`,
    );
    doc.text(`${t.participants}: ${data.participants.length}`);
    doc.text(`${t.budget}: ${data.trip.budget !== null ? currency.format(data.trip.budget) : t.noBudget}`);

    if (data.trip.description) {
        doc.moveDown(0.5);
        doc.fillColor(COLORS.text).fontSize(10).text(data.trip.description, { align: 'justify' });
    }

    doc.moveDown(1.5);
}

// ─── Resumo Financeiro ───────────────────────────────────────────────────────
function renderFinancialSummary(
    doc: PDFKit.PDFDocument,
    data: TripReportData,
    t: ReturnType<typeof getTranslations>,
    currency: Intl.NumberFormat,
) {
    sectionHeader(doc, t.sectionFinancialSummary);

    const boxWidth = (doc.page.width - MARGINS.left - MARGINS.right - 20) / 2;
    const rowY = doc.y;

    // Total gasto
    statBox(doc, MARGINS.left, rowY, boxWidth, t.totalSpent, currency.format(data.totalSpent));
    // Cota por pessoa
    statBox(doc, MARGINS.left + boxWidth + 20, rowY, boxWidth, t.perPersonAverage, currency.format(data.perPersonAverage));

    doc.y = rowY + 60;

    // Se tem budget, mostra restante
    if (data.trip.budget !== null) {
        const remaining = data.trip.budget - data.totalSpent;
        const isOver = remaining < 0;
        const rowY2 = doc.y;
        statBox(doc, MARGINS.left, rowY2, boxWidth, t.budget, currency.format(data.trip.budget));
        statBox(
            doc,
            MARGINS.left + boxWidth + 20,
            rowY2,
            boxWidth,
            isOver ? t.overBudget : t.remaining,
            currency.format(Math.abs(remaining)),
            isOver ? COLORS.negative : COLORS.positive,
        );
        doc.y = rowY2 + 60;
    }

    doc.moveDown(0.8);
}

function statBox(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    width: number,
    label: string,
    value: string,
    valueColor = COLORS.text,
) {
    doc.roundedRect(x, y, width, 50, 6).fillAndStroke(COLORS.background, COLORS.border);
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted).text(label, x + 12, y + 10);
    doc.font('Helvetica-Bold').fontSize(16).fillColor(valueColor).text(value, x + 12, y + 22);
}

// ─── Por Categoria ───────────────────────────────────────────────────────────
function renderByCategory(
    doc: PDFKit.PDFDocument,
    data: TripReportData,
    t: ReturnType<typeof getTranslations>,
    currency: Intl.NumberFormat,
) {
    if (data.categoryTotals.length === 0) return;
    sectionHeader(doc, t.sectionByCategory);

    const cols = [
        { label: t.category, x: MARGINS.left, width: 200 },
        { label: t.total, x: MARGINS.left + 210, width: 100, align: 'right' as const },
        { label: t.percentage, x: MARGINS.left + 320, width: 80, align: 'right' as const },
    ];
    tableHeader(doc, cols);

    for (const cat of data.categoryTotals) {
        ensureSpace(doc, 18);
        const y = doc.y;
        doc.font('Helvetica').fontSize(10).fillColor(COLORS.text);
        doc.text(cat.category, cols[0].x, y, { width: cols[0].width });
        doc.text(currency.format(cat.total), cols[1].x, y, { width: cols[1].width, align: 'right' });
        doc.text(`${cat.percentage.toFixed(1)}%`, cols[2].x, y, { width: cols[2].width, align: 'right' });
        doc.y = y + 16;
    }
    doc.moveDown(0.5);
}

// ─── Lista de Despesas ───────────────────────────────────────────────────────
function renderExpenseList(
    doc: PDFKit.PDFDocument,
    data: TripReportData,
    t: ReturnType<typeof getTranslations>,
    currency: Intl.NumberFormat,
    dateFmt: Intl.DateTimeFormat,
) {
    sectionHeader(doc, t.sectionExpenseList);

    if (data.expenses.length === 0) {
        doc.font('Helvetica-Oblique').fontSize(10).fillColor(COLORS.muted).text(t.noExpenses);
        doc.moveDown(0.8);
        return;
    }

    const cols = [
        { label: t.date, x: MARGINS.left, width: 90 },
        { label: t.expenseDescription, x: MARGINS.left + 100, width: 180 },
        { label: t.paidBy, x: MARGINS.left + 290, width: 100 },
        { label: t.amount, x: MARGINS.left + 400, width: 100, align: 'right' as const },
    ];
    tableHeader(doc, cols);

    for (const e of data.expenses) {
        ensureSpace(doc, 18);
        const y = doc.y;
        doc.font('Helvetica').fontSize(9).fillColor(COLORS.text);
        doc.text(dateFmt.format(new Date(e.date)), cols[0].x, y, { width: cols[0].width });
        doc.text(e.description, cols[1].x, y, { width: cols[1].width, ellipsis: true });
        const payerText = e.splitType === 'INDIVIDUAL' ? t.individualExpense : e.paidByName;
        doc.font(e.splitType === 'INDIVIDUAL' ? 'Helvetica-Oblique' : 'Helvetica');
        doc.text(payerText, cols[2].x, y, { width: cols[2].width, ellipsis: true });
        doc.font('Helvetica-Bold').fillColor(COLORS.text);
        doc.text(currency.format(e.amount), cols[3].x, y, { width: cols[3].width, align: 'right' });
        doc.y = y + 16;
    }
    doc.moveDown(0.5);
}

// ─── Saldos ──────────────────────────────────────────────────────────────────
function renderBalances(
    doc: PDFKit.PDFDocument,
    data: TripReportData,
    t: ReturnType<typeof getTranslations>,
    currency: Intl.NumberFormat,
) {
    sectionHeader(doc, t.sectionBalances);

    const cols = [
        { label: t.participant, x: MARGINS.left, width: 200 },
        { label: t.paid, x: MARGINS.left + 210, width: 90, align: 'right' as const },
        { label: t.quota, x: MARGINS.left + 310, width: 90, align: 'right' as const },
        { label: t.balance, x: MARGINS.left + 410, width: 100, align: 'right' as const },
    ];
    tableHeader(doc, cols);

    for (const p of data.participants) {
        ensureSpace(doc, 18);
        const y = doc.y;
        doc.font('Helvetica').fontSize(10).fillColor(COLORS.text);
        doc.text(p.name + (p.isOrganizer ? ' ★' : ''), cols[0].x, y, { width: cols[0].width });
        doc.text(currency.format(p.totalPaid), cols[1].x, y, { width: cols[1].width, align: 'right' });
        doc.text(currency.format(p.individualQuota), cols[2].x, y, { width: cols[2].width, align: 'right' });

        const balanceLabel =
            p.balance > 0.01 ? `+${currency.format(p.balance)} ${t.positive}` :
                p.balance < -0.01 ? `${currency.format(p.balance)} ${t.negative}` :
                    `${currency.format(0)} ${t.zeroBalance}`;
        const balanceColor =
            p.balance > 0.01 ? COLORS.positive :
                p.balance < -0.01 ? COLORS.negative :
                    COLORS.zero;

        doc.font('Helvetica-Bold').fillColor(balanceColor);
        doc.text(balanceLabel, cols[3].x, y, { width: cols[3].width, align: 'right' });
        doc.y = y + 16;
    }
    doc.moveDown(0.5);
}

// ─── Settlements ─────────────────────────────────────────────────────────────
function renderSettlements(
    doc: PDFKit.PDFDocument,
    data: TripReportData,
    t: ReturnType<typeof getTranslations>,
    currency: Intl.NumberFormat,
) {
    sectionHeader(doc, t.sectionSettlements);

    if (data.settlements.length === 0) {
        doc.font('Helvetica-Oblique').fontSize(10).fillColor(COLORS.muted).text(t.allSettled);
        doc.moveDown(0.8);
        return;
    }

    for (const s of data.settlements) {
        ensureSpace(doc, 18);
        const y = doc.y;
        doc.font('Helvetica').fontSize(10).fillColor(COLORS.text);
        doc.text(`${s.fromName}  →  ${s.toName}`, MARGINS.left, y);
        doc.font('Helvetica-Bold').fillColor(COLORS.primary);
        doc.text(currency.format(s.amount), MARGINS.left, y, {
            width: doc.page.width - MARGINS.left - MARGINS.right,
            align: 'right',
        });
        doc.y = y + 16;
    }
    doc.moveDown(0.5);
}

// ─── Histórico de Payments ───────────────────────────────────────────────────
function renderPaymentHistory(
    doc: PDFKit.PDFDocument,
    data: TripReportData,
    t: ReturnType<typeof getTranslations>,
    currency: Intl.NumberFormat,
    dateFmt: Intl.DateTimeFormat,
) {
    sectionHeader(doc, t.sectionPaymentHistory);

    if (data.payments.length === 0) {
        doc.font('Helvetica-Oblique').fontSize(10).fillColor(COLORS.muted).text(t.noPayments);
        return;
    }

    for (const p of data.payments) {
        ensureSpace(doc, 30);
        const y = doc.y;
        doc.font('Helvetica').fontSize(10).fillColor(COLORS.text);
        doc.text(`${p.fromName}  →  ${p.toName}`, MARGINS.left, y);
        doc.font('Helvetica-Bold').fillColor(COLORS.primary);
        doc.text(currency.format(p.amount), MARGINS.left, y, {
            width: doc.page.width - MARGINS.left - MARGINS.right,
            align: 'right',
        });
        doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted);
        doc.text(dateFmt.format(new Date(p.paidAt)), MARGINS.left, y + 12);
        doc.y = y + 26;
    }
}

// ─── Footer + paginação ──────────────────────────────────────────────────────
function renderFooter(
    doc: PDFKit.PDFDocument,
    t: ReturnType<typeof getTranslations>,
) {
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        const bottomY = doc.page.height - 30;
        doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted);
        doc.text(t.reportFooter, MARGINS.left, bottomY, {
            width: doc.page.width - MARGINS.left - MARGINS.right,
            align: 'left',
            lineBreak: false,
        });
        doc.text(`${t.page} ${i + 1} ${t.of} ${range.count}`, MARGINS.left, bottomY, {
            width: doc.page.width - MARGINS.left - MARGINS.right,
            align: 'right',
            lineBreak: false,
        });
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function sectionHeader(doc: PDFKit.PDFDocument, title: string) {
    ensureSpace(doc, 40);
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').fontSize(13).fillColor(COLORS.primary).text(title);
    doc.moveTo(MARGINS.left, doc.y).lineTo(doc.page.width - MARGINS.right, doc.y).strokeColor(COLORS.border).stroke();
    doc.moveDown(0.5);
}

function tableHeader(
    doc: PDFKit.PDFDocument,
    cols: { label: string; x: number; width: number; align?: 'left' | 'right' }[],
) {
    const y = doc.y;
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.muted);
    for (const c of cols) {
        doc.text(c.label.toUpperCase(), c.x, y, { width: c.width, align: c.align ?? 'left' });
    }
    doc.y = y + 14;
    doc.moveTo(MARGINS.left, doc.y).lineTo(doc.page.width - MARGINS.right, doc.y).strokeColor(COLORS.border).stroke();
    doc.moveDown(0.3);
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
    if (doc.y + needed > doc.page.height - 60) {
        doc.addPage();
    }
}