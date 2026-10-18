const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 table for PNG chunk checksums
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const typeAndData = chunk.subarray(4, 8 + len);
  const crc = crc32(typeAndData);
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

function makePng(width, height, drawFn) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth: 8
  ihdrData[9] = 6; // color type: RGBA (6)
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // Scanlines with filter byte 0 at start of each line
  const rawData = Buffer.alloc((1 + width * 4) * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + width * 4);
    rawData[rowOffset] = 0; // filter 0: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawFn(x, y, width, height);
      const pixelOffset = rowOffset + 1 + x * 4;
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData, { level: 9 });
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Drawing logic
function drawAppIcon(isMaskable) {
  return function (x, y, w, h) {
    // Normalized coordinates (-1 to +1)
    const scale = isMaskable ? 0.72 : 0.88; // safe zone padding for maskable
    const nx = ((x / (w - 1)) * 2 - 1) / scale;
    const ny = ((y / (h - 1)) * 2 - 1) / scale;
    const dist = Math.sqrt(nx * nx + ny * ny);

    // Background color: dark charcoal gradient #1c1917 -> #0e0e0d
    const t = (y / h);
    let bgR = Math.round(28 - t * 14);
    let bgG = Math.round(25 - t * 13);
    let bgB = Math.round(23 - t * 12);
    let bgA = 255;

    // Outer subtle gold accent ring
    if (dist >= 0.88 && dist <= 0.93 && !isMaskable) {
      const ringAlpha = (1 - Math.abs(dist - 0.905) / 0.025) * 0.4;
      bgR = Math.round(bgR * (1 - ringAlpha) + 245 * ringAlpha);
      bgG = Math.round(bgG * (1 - ringAlpha) + 158 * ringAlpha);
      bgB = Math.round(bgB * (1 - ringAlpha) + 11 * ringAlpha);
    }

    // Headphones headband arc (semicircle nx^2 + ny^2 ~ 0.5^2 for ny <= 0.1)
    const arcDist = Math.sqrt(nx * nx + (ny + 0.05) * (ny + 0.05));
    if (arcDist >= 0.44 && arcDist <= 0.56 && ny <= 0.05) {
      // Golden headphone band
      return [245, 158, 11, 255];
    }
    if (arcDist >= 0.47 && arcDist <= 0.53 && ny <= -0.05) {
      // Highlight on headband
      return [254, 240, 138, 255];
    }

    // Ear cups: Left cup (nx ~ -0.52, ny between -0.05 and 0.32)
    if (nx >= -0.62 && nx <= -0.42 && ny >= -0.05 && ny <= 0.35) {
      if (nx >= -0.58 && nx <= -0.46 && ny >= 0.02 && ny <= 0.28) {
        return [28, 25, 23, 255]; // ear cushion center
      }
      return [245, 158, 11, 255]; // gold outer cup
    }

    // Ear cups: Right cup (nx ~ +0.52, ny between -0.05 and 0.32)
    if (nx >= 0.42 && nx <= 0.62 && ny >= -0.05 && ny <= 0.35) {
      if (nx >= 0.46 && nx <= 0.58 && ny >= 0.02 && ny <= 0.28) {
        return [28, 25, 23, 255]; // ear cushion center
      }
      return [245, 158, 11, 255]; // gold outer cup
    }

    // Visualizer equalizer bars in center (-0.28 to +0.28)
    const barWidth = 0.04;
    const barSpacing = 0.07;
    const bars = [
      { cx: -0.21, h: 0.14 },
      { cx: -0.14, h: 0.24 },
      { cx: -0.07, h: 0.35 },
      { cx: 0.00, h: 0.45 },
      { cx: 0.07, h: 0.32 },
      { cx: 0.14, h: 0.22 },
      { cx: 0.21, h: 0.12 },
    ];

    for (const bar of bars) {
      if (Math.abs(nx - bar.cx) <= barWidth / 2 && Math.abs(ny - 0.08) <= bar.h / 2) {
        // Gradient along height of the bar
        const barNorm = (ny - (0.08 - bar.h / 2)) / bar.h;
        if (barNorm < 0.2) return [254, 240, 138, 255];
        return [245, 158, 11, 255];
      }
    }

    // Microphone arm from left earcup curving down towards center
    // Arc from (-0.5, 0.3) to (-0.08, 0.45)
    const micX = nx - (-0.1);
    const micY = ny - 0.44;
    if (Math.sqrt(micX * micX + micY * micY) <= 0.055) {
      // Mic capsule
      if (Math.sqrt(micX * micX + micY * micY) <= 0.025) {
        return [217, 119, 6, 255];
      }
      return [254, 240, 138, 255];
    }

    // Arm curve
    const armT = (nx + 0.5) / 0.4;
    if (armT >= 0 && armT <= 1) {
      const targetY = 0.3 + 0.14 * Math.sin(armT * (Math.PI / 2));
      if (Math.abs(ny - targetY) <= 0.02) {
        return [245, 158, 11, 255];
      }
    }

    return [bgR, bgG, bgB, bgA];
  };
}

const outDir = path.resolve(__dirname, '../public');

// 1. pwa-192x192.png
console.log('Generating pwa-192x192.png...');
fs.writeFileSync(path.join(outDir, 'pwa-192x192.png'), makePng(192, 192, drawAppIcon(false)));

// 2. pwa-512x512.png
console.log('Generating pwa-512x512.png...');
fs.writeFileSync(path.join(outDir, 'pwa-512x512.png'), makePng(512, 512, drawAppIcon(false)));

// 3. pwa-maskable-512x512.png
console.log('Generating pwa-maskable-512x512.png...');
fs.writeFileSync(path.join(outDir, 'pwa-maskable-512x512.png'), makePng(512, 512, drawAppIcon(true)));

// 4. apple-touch-icon.png (180x180)
console.log('Generating apple-touch-icon.png...');
fs.writeFileSync(path.join(outDir, 'apple-touch-icon.png'), makePng(180, 180, drawAppIcon(false)));

// 5. favicon.ico (can be a 48x48 PNG or ICO format; modern browsers support PNG-in-ICO or we create a standard 48x48 PNG and standard ICO header)
console.log('Generating favicon.ico...');
const favPng = makePng(48, 48, drawAppIcon(false));
// Simple 1-image ICO header + directory + PNG payload
const icoHeader = Buffer.alloc(6);
icoHeader.writeUInt16LE(0, 0); // reserved
icoHeader.writeUInt16LE(1, 2); // type 1 = icon
icoHeader.writeUInt16LE(1, 4); // count 1

const icoDir = Buffer.alloc(16);
icoDir[0] = 48; // width
icoDir[1] = 48; // height
icoDir[2] = 0;  // palette
icoDir[3] = 0;  // reserved
icoDir.writeUInt16LE(1, 4); // color planes
icoDir.writeUInt16LE(32, 6); // bits per pixel
icoDir.writeUInt32LE(favPng.length, 8); // image size
icoDir.writeUInt32LE(6 + 16, 12); // image offset

fs.writeFileSync(path.join(outDir, 'favicon.ico'), Buffer.concat([icoHeader, icoDir, favPng]));

console.log('All PWA icons generated successfully!');
