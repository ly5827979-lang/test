function createQrSvg(text) {
  const version = 6;
  const size = version * 4 + 17;
  const ecCodewordsPerBlock = 18;
  const numBlocks = 2;
  const totalCodewords = 172;
  const dataCodewords = totalCodewords - ecCodewordsPerBlock * numBlocks;
  const bytes = Array.from(new TextEncoder().encode(text));

  if (bytes.length > 120) {
    return "<p>地址过长，无法生成二维码。</p>";
  }

  const bits = [];
  const appendBits = (value, length) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };

  appendBits(0b0100, 4);
  appendBits(bytes.length, 8);
  bytes.forEach((byte) => appendBits(byte, 8));
  appendBits(0, Math.min(4, dataCodewords * 8 - bits.length));
  while (bits.length % 8) bits.push(0);

  const data = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    data.push(byte);
  }
  for (let pad = 0xec; data.length < dataCodewords; pad ^= 0xfd) data.push(pad);

  const gfMul = (x, y) => {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11d);
      z ^= ((y >>> i) & 1) * x;
    }
    return z & 255;
  };

  const rsGenerator = (degree) => {
    let result = [1];
    let root = 1;
    for (let i = 0; i < degree; i++) {
      const next = Array(result.length + 1).fill(0);
      for (let j = 0; j < result.length; j++) {
        next[j] ^= gfMul(result[j], root);
        next[j + 1] ^= result[j];
      }
      result = next;
      root = gfMul(root, 2);
    }
    return result;
  };

  const divisor = rsGenerator(ecCodewordsPerBlock);
  const rsRemainder = (block) => {
    const result = Array(ecCodewordsPerBlock).fill(0);
    for (const byte of block) {
      const factor = byte ^ result.shift();
      result.push(0);
      for (let i = 0; i < divisor.length; i++) result[i] ^= gfMul(divisor[i], factor);
    }
    return result;
  };

  const blocks = [];
  for (let i = 0; i < numBlocks; i++) {
    const block = data.slice(i * 68, (i + 1) * 68);
    blocks.push({ data: block, ecc: rsRemainder(block) });
  }

  const codewords = [];
  for (let i = 0; i < 68; i++) blocks.forEach((block) => codewords.push(block.data[i]));
  for (let i = 0; i < ecCodewordsPerBlock; i++) blocks.forEach((block) => codewords.push(block.ecc[i]));

  const dataBits = [];
  codewords.forEach((byte) => {
    for (let i = 7; i >= 0; i--) dataBits.push((byte >>> i) & 1);
  });

  const modules = Array.from({ length: size }, () => Array(size).fill(false));
  const isFunction = Array.from({ length: size }, () => Array(size).fill(false));
  const setFunction = (x, y, dark) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    modules[y][x] = Boolean(dark);
    isFunction[y][x] = true;
  };

  const drawFinder = (x, y) => {
    for (let dy = -1; dy <= 7; dy++) {
      for (let dx = -1; dx <= 7; dx++) {
        const isCore = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
        const dark = isCore && (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
        setFunction(x + dx, y + dy, dark);
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(size - 7, 0);
  drawFinder(0, size - 7);

  for (let i = 8; i < size - 8; i++) {
    setFunction(i, 6, i % 2 === 0);
    setFunction(6, i, i % 2 === 0);
  }

  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      setFunction(34 + dx, 34 + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }

  for (let i = 0; i < 9; i++) {
    if (i !== 6) {
      setFunction(8, i, false);
      setFunction(i, 8, false);
    }
  }
  for (let i = 0; i < 8; i++) {
    setFunction(size - 1 - i, 8, false);
    setFunction(8, size - 1 - i, false);
  }
  setFunction(8, size - 8, true);

  let bitIndex = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right--;
    for (let vertical = 0; vertical < size; vertical++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vertical : vertical;
        if (!isFunction[y][x]) modules[y][x] = bitIndex < dataBits.length ? Boolean(dataBits[bitIndex++]) : false;
      }
    }
  }

  const masks = [
    (x, y) => (x + y) % 2 === 0,
    (_x, y) => y % 2 === 0,
    (x) => x % 3 === 0,
    (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
    (x, y) => ((x * y) % 2 + (x * y) % 3) === 0,
    (x, y) => (((x * y) % 2 + (x * y) % 3) % 2) === 0,
    (x, y) => (((x + y) % 2 + (x * y) % 3) % 2) === 0,
  ];

  const formatBits = (mask) => {
    let dataValue = (1 << 3) | mask;
    let remainder = dataValue;
    for (let i = 0; i < 10; i++) remainder = (remainder << 1) ^ (((remainder >>> 9) & 1) * 0x537);
    return ((dataValue << 10) | remainder) ^ 0x5412;
  };

  const drawFormat = (matrix, mask) => {
    const bitsValue = formatBits(mask);
    const getBit = (i) => ((bitsValue >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i++) matrix[i][8] = getBit(i);
    matrix[7][8] = getBit(6);
    matrix[8][8] = getBit(7);
    matrix[8][7] = getBit(8);
    for (let i = 9; i < 15; i++) matrix[8][14 - i] = getBit(i);
    for (let i = 0; i < 8; i++) matrix[8][size - 1 - i] = getBit(i);
    for (let i = 8; i < 15; i++) matrix[size - 15 + i][8] = getBit(i);
    matrix[size - 8][8] = true;
  };

  const getPenalty = (matrix) => {
    let penalty = 0;
    for (let y = 0; y < size; y++) {
      let runColor = matrix[y][0];
      let runLength = 1;
      for (let x = 1; x < size; x++) {
        if (matrix[y][x] === runColor) runLength++;
        else {
          if (runLength >= 5) penalty += runLength - 2;
          runColor = matrix[y][x];
          runLength = 1;
        }
      }
      if (runLength >= 5) penalty += runLength - 2;
    }
    for (let x = 0; x < size; x++) {
      let runColor = matrix[0][x];
      let runLength = 1;
      for (let y = 1; y < size; y++) {
        if (matrix[y][x] === runColor) runLength++;
        else {
          if (runLength >= 5) penalty += runLength - 2;
          runColor = matrix[y][x];
          runLength = 1;
        }
      }
      if (runLength >= 5) penalty += runLength - 2;
    }
    return penalty;
  };

  let best = modules;
  let bestPenalty = Infinity;
  for (let mask = 0; mask < masks.length; mask++) {
    const matrix = modules.map((row) => row.slice());
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!isFunction[y][x] && masks[mask](x, y)) matrix[y][x] = !matrix[y][x];
      }
    }
    drawFormat(matrix, mask);
    const penalty = getPenalty(matrix);
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      best = matrix;
    }
  }

  const border = 4;
  const scale = 10;
  const dimension = (size + border * 2) * scale;
  let rects = "";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (best[y][x]) {
        rects += `<rect x="${(x + border) * scale}" y="${(y + border) * scale}" width="${scale}" height="${scale}"/>`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${dimension}" height="${dimension}" viewBox="0 0 ${dimension} ${dimension}" role="img" aria-label="扫码打开网页"><rect width="100%" height="100%" fill="#fff"/><g fill="#111827">${rects}</g></svg>`;
}
