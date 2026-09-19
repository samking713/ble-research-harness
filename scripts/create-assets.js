/**
 * Creates minimal valid placeholder PNG assets for the Expo build.
 * Uses only Node.js built-ins (zlib, fs, path) — no npm deps required.
 * Run once before the first build: node scripts/create-assets.js
 */
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function makeCRCTable() {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
}
const CRC_TABLE = makeCRCTable();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeB = Buffer.from(type, 'ascii');
  const combined = Buffer.concat([typeB, data]);
  const crcVal = crc32(combined);
  const out = Buffer.alloc(4 + 4 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  typeB.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crcVal, 8 + data.length);
  return out;
}

function solidPNG(w, h, r, g, b) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB (no alpha)

  const rowLen = 1 + w * 3;
  const raw = Buffer.alloc(h * rowLen);
  for (let y = 0; y < h; y++) {
    const base = y * rowLen;
    raw[base] = 0; // filter: None
    for (let x = 0; x < w; x++) {
      raw[base + 1 + x * 3]     = r;
      raw[base + 1 + x * 3 + 1] = g;
      raw[base + 1 + x * 3 + 2] = b;
    }
  }
  const idat = zlib.deflateSync(raw);

  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idat),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

const dir = path.join(__dirname, '..', 'assets');
fs.mkdirSync(dir, { recursive: true });

// 1024x1024 near-black background icon
fs.writeFileSync(path.join(dir, 'icon.png'),          solidPNG(1024, 1024, 10, 10, 10));
// 1284x2778 splash (iPhone 14 Pro Max size — works for Android too)
fs.writeFileSync(path.join(dir, 'splash.png'),        solidPNG(1284, 2778, 10, 10, 10));
// 1024x1024 adaptive icon with green tint for identification
fs.writeFileSync(path.join(dir, 'adaptive-icon.png'), solidPNG(1024, 1024,  0, 40, 20));

console.log('Assets created in', dir);
