'use strict';
// Server-side receipt PDF, written by hand (no dependency): plain uncompressed text with literal strings so
// every extractor, and a byte search, finds the order id and "PKR 4500.00" (AC-2.3-b). Standard Helvetica.
const { formatPkr } = require('../domain/store/pricing');

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[^\x20-\x7e]/g, '?');

function receiptLines(p) {
  const lines = ['Order Receipt', `Order: ${p.order_id}`, `Customer: ${p.customer_id}`, `Paid at: ${p.paid_at}`, ''];
  for (const i of p.items) lines.push(`${i.variant_id} x ${i.quantity} @ ${formatPkr(i.unit_price_minor)}`);
  lines.push('', `Subtotal: ${formatPkr(p.subtotal_minor)}`, `Discount: ${formatPkr(p.discount_minor)}`, `Total: ${formatPkr(p.total_minor)}`);
  return lines;
}

function renderReceipt(payload) {
  const lines = receiptLines(payload);
  const ops = ['BT', '/F1 12 Tf', '14 TL', '50 780 Td'];
  lines.forEach((l, idx) => {
    if (idx === 0) ops.push('/F1 18 Tf', `(${esc(l)}) Tj`, '/F1 12 Tf', '24 TL', 'T*');
    else { ops.push(`(${esc(l)}) Tj`, 'T*'); }
  });
  ops.push('ET');
  const stream = ops.join('\n');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((o, i) => { offsets.push(Buffer.byteLength(out, 'latin1')); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += `${String(off).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

module.exports = { renderReceipt };
