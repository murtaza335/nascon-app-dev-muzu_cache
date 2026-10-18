'use strict';
// QR matrix → SVG / PNG / PDF (D2-ADR-04). Pure apart from node:zlib. 4-module quiet zone everywhere.
const zlib = require('node:zlib');

const QUIET = 4;
const PX = 8; // PNG pixels per module (spec: ≥ 4)

const escXml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function svg(qr, title) {
  const n = qr.size + QUIET * 2;
  let path = '';
  qr.modules.forEach((row, y) => row.forEach((d, x) => { if (d) path += `M${x + QUIET},${y + QUIET}h1v1h-1z`; }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${n * 10}" height="${n * 10}" shape-rendering="crispEdges" role="img">`
    + `<title>${escXml(title)}</title><rect width="100%" height="100%" fill="#ffffff"/><path d="${path}" fill="#000000"/></svg>\n`;
}

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (const b of buf) c = CRC[(c ^ b) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(qr) {
  const n = (qr.size + QUIET * 2) * PX;
  const rows = [];
  for (let py = 0; py < n; py++) {
    const row = Buffer.alloc(n + 1, 0xFF); // filter byte 0, white
    row[0] = 0;
    const my = Math.floor(py / PX) - QUIET;
    if (my >= 0 && my < qr.size) {
      for (let px = 0; px < n; px++) {
        const mx = Math.floor(px / PX) - QUIET;
        if (mx >= 0 && mx < qr.size && qr.modules[my][mx]) row[px + 1] = 0;
      }
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(n, 0); ihdr.writeUInt32BE(n, 4); ihdr[8] = 8; ihdr[9] = 0; // 8-bit grayscale
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const pdfEsc = (s) => String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[^\x20-\x7e]/g, '?');

// A4 poster: vector modules (row runs merged into rectangles) plus literal entity id and short URL text.
function pdf(qr, { entityId, shortUrl }) {
  const total = qr.size + QUIET * 2;
  const scale = Math.floor(420 / total);
  const side = total * scale;
  const ox = (595 - side) / 2 + QUIET * scale;
  const oy = 330 + QUIET * scale; // PDF origin is bottom-left; QR top edge sits at oy + qr.size * scale
  const ops = ['0 g'];
  qr.modules.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      if (!row[x]) { x++; continue; }
      let e = x;
      while (e < row.length && row[e]) e++;
      ops.push(`${ox + x * scale} ${oy + (qr.size - 1 - y) * scale} ${(e - x) * scale} ${scale} re f`);
      x = e;
    }
  });
  ops.push('BT /F1 28 Tf 60 760 Td (NaSCon 26 - Scan to open) Tj ET',
    `BT /F1 20 Tf 60 250 Td (${pdfEsc(entityId)}) Tj ET`, `BT /F1 14 Tf 60 220 Td (${pdfEsc(shortUrl)}) Tj ET`);
  const stream = ops.join('\n');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((o, i) => { offsets.push(Buffer.byteLength(out, 'latin1')); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

module.exports = { svg, png, pdf, crc32 };
