// MilkyWay QR codes: a small self-contained QR encoder (byte mode, error correction level M, versions 1–40)
// that draws a scannable SVG, used for the Lipa Namba payment code on the buy-coins screen. No network needed.
(() => {
  // Error correction codewords per block and number of blocks for level M, indexed by version.
  const ECC_PER_BLOCK = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28];
  const BLOCKS = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49];
  const FORMAT_M = 0;
  const bit = (value, index) => ((value >>> index) & 1) !== 0;

  const rawModules = version => {
    let result = (16 * version + 128) * version + 64;
    if (version >= 2) { const count = Math.floor(version / 7) + 2;result -= (25 * count - 10) * count - 55;if (version >= 7) result -= 36; }
    return result;
  };
  const dataCodewords = version => Math.floor(rawModules(version) / 8) - ECC_PER_BLOCK[version] * BLOCKS[version];

  // Reed–Solomon over GF(2^8) with the QR polynomial 0x11D.
  const multiply = (x, y) => { let z = 0;for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d);z ^= ((y >>> i) & 1) * x; }return z; };
  function divisor(degree) {
    const result = new Array(degree).fill(0);result[degree - 1] = 1;
    let root = 1;
    for (let i = 0; i < degree; i++) {
      for (let j = 0; j < result.length; j++) { result[j] = multiply(result[j], root);if (j + 1 < result.length) result[j] ^= result[j + 1]; }
      root = multiply(root, 0x02);
    }
    return result;
  }
  function remainder(data, poly) {
    const result = poly.map(() => 0);
    for (const value of data) { const factor = value ^ result.shift();result.push(0);poly.forEach((coef, i) => { result[i] ^= multiply(coef, factor); }); }
    return result;
  }

  // `forcedMask` (0–7) skips mask scoring; only used to compare output against reference encoders.
  function encode(text, forcedMask = -1) {
    const bytes = Array.from(new TextEncoder().encode(String(text)));
    let version = 1;
    for (; version <= 40; version++) if (4 + (version < 10 ? 8 : 16) + bytes.length * 8 <= dataCodewords(version) * 8) break;
    if (version > 40) throw new Error('Text too long for a QR code.');
    const capacity = dataCodewords(version) * 8;
    const bits = [];
    const append = (value, length) => { for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1); };
    append(0b0100, 4);append(bytes.length, version < 10 ? 8 : 16);bytes.forEach(value => append(value, 8));
    append(0, Math.min(4, capacity - bits.length));append(0, (8 - bits.length % 8) % 8);
    for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) append(pad, 8);
    const data = [];for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((byte, value) => (byte << 1) | value, 0));

    // Split into blocks, add error correction and interleave.
    const blockCount = BLOCKS[version], eccLength = ECC_PER_BLOCK[version], raw = Math.floor(rawModules(version) / 8);
    const shortBlocks = blockCount - raw % blockCount, shortLength = Math.floor(raw / blockCount), poly = divisor(eccLength);
    const blocks = [];
    for (let i = 0, k = 0; i < blockCount; i++) {
      const chunk = data.slice(k, k + shortLength - eccLength + (i < shortBlocks ? 0 : 1));k += chunk.length;
      const ecc = remainder(chunk, poly);if (i < shortBlocks) chunk.push(0);blocks.push(chunk.concat(ecc));
    }
    const codewords = [];
    for (let i = 0; i < blocks[0].length; i++) blocks.forEach((block, j) => { if (i !== shortLength - eccLength || j >= shortBlocks) codewords.push(block[i]); });

    const size = version * 4 + 17;
    const modules = Array.from({ length: size }, () => new Array(size).fill(false));
    const fixed = Array.from({ length: size }, () => new Array(size).fill(false));
    const set = (x, y, dark) => { modules[y][x] = dark;fixed[y][x] = true; };
    for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0);set(i, 6, i % 2 === 0); }
    const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy));if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4); } };
    finder(3, 3);finder(size - 4, 3);finder(3, size - 4);
    if (version > 1) {
      const count = Math.floor(version / 7) + 2, step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
      const positions = [6];for (let pos = size - 7; positions.length < count; pos -= step) positions.splice(1, 0, pos);
      positions.forEach((x, i) => positions.forEach((y, j) => {
        if ((i === 0 && j === 0) || (i === 0 && j === count - 1) || (i === count - 1 && j === 0)) return;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }));
    }
    const drawFormat = mask => {
      const value = FORMAT_M << 3 | mask;let rem = value;for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      const format = (value << 10 | rem) ^ 0x5412;
      for (let i = 0; i <= 5; i++) set(8, i, bit(format, i));
      set(8, 7, bit(format, 6));set(8, 8, bit(format, 7));set(7, 8, bit(format, 8));
      for (let i = 9; i < 15; i++) set(14 - i, 8, bit(format, i));
      for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(format, i));
      for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(format, i));
      set(8, size - 8, true);
    };
    drawFormat(0);
    if (version >= 7) {
      let rem = version;for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
      const value = version << 12 | rem;
      for (let i = 0; i < 18; i++) { const a = size - 11 + i % 3, b = Math.floor(i / 3);set(a, b, bit(value, i));set(b, a, bit(value, i)); }
    }

    // Place the codewords in the zigzag pattern.
    let index = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
        const x = right - j, y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
        if (!fixed[y][x] && index < codewords.length * 8) { modules[y][x] = bit(codewords[index >>> 3], 7 - (index & 7));index++; }
      }
    }

    // Try all eight masks and keep the one with the lowest penalty.
    const rules = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, x => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => x * y % 2 + x * y % 3 === 0,
      (x, y) => (x * y % 2 + x * y % 3) % 2 === 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0];
    const applyMask = mask => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fixed[y][x] && rules[mask](x, y)) modules[y][x] = !modules[y][x]; };
    const penalty = () => {
      let score = 0, dark = 0;
      const line = get => { let run = 1;for (let i = 1; i < size; i++) { if (get(i) === get(i - 1)) { run++;if (run === 5) score += 3;else if (run > 5) score++; } else run = 1; } };
      for (let i = 0; i < size; i++) { line(j => modules[i][j]);line(j => modules[j][i]); }
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        if (modules[y][x]) dark++;
        if (x < size - 1 && y < size - 1 && modules[y][x] === modules[y][x + 1] && modules[y][x] === modules[y + 1][x] && modules[y][x] === modules[y + 1][x + 1]) score += 3;
      }
      return score + Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
    };
    let best = 0, lowest = Infinity;
    for (let mask = 0; mask < 8; mask++) { if (forcedMask >= 0) { best = forcedMask;break; }applyMask(mask);drawFormat(mask);const score = penalty();if (score < lowest) { lowest = score;best = mask; }applyMask(mask); }
    applyMask(best);drawFormat(best);
    return modules;
  }

  // SVG with the standard four-module quiet zone, sized by CSS.
  function svg(text, { label = '', dark = '#0b0b14', light = '#ffffff' } = {}) {
    const modules = encode(text), size = modules.length + 8;
    let path = '';
    modules.forEach((row, y) => row.forEach((on, x) => { if (on) path += `M${x + 4} ${y + 4}h1v1h-1z`; }));
    const title = String(label).replace(/[&<>"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character]);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img"${title ? ` aria-label="${title}"` : ''}><rect width="${size}" height="${size}" fill="${light}"/><path d="${path}" fill="${dark}"/></svg>`;
  }

  window.MilkyWayQR = { encode, svg };
})();
