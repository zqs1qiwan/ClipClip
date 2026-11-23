// Self-contained QR Code encoder (subset: byte mode, ECC level L, versions 1-10).
// Algorithm follows the public-domain/MIT reference structure used by Nayuki's
// QR Code generator. No external requests or dependencies.

const MAX_VERSION = 10;
const ECC_LEVELS = {
  L: {
    formatBits: 1,
    // Error-correction codewords per block, indexed by version (1-based).
    eccPerBlock: [0, 7, 10, 15, 20, 26, 36, 20, 24, 30, 18],
    numBlocks: [0, 1, 1, 1, 1, 1, 1, 2, 2, 2, 4]
  },
  M: {
    formatBits: 0,
    eccPerBlock: [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26],
    numBlocks: [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5]
  }
};

const ALIGNMENT_POSITIONS = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50]
};

function getNumRawDataModules(version) {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const numAlign = Math.floor(version / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (version >= 7) {
      result -= 36;
    }
  }
  return result;
}

function getTotalCodewords(version) {
  return Math.floor(getNumRawDataModules(version) / 8);
}

function getEccInfo(version, ecl) {
  const level = ECC_LEVELS[ecl];
  const numBlocks = level.numBlocks[version];
  const eccPerBlock = level.eccPerBlock[version];
  const totalCodewords = getTotalCodewords(version);
  const dataCodewords = totalCodewords - eccPerBlock * numBlocks;
  return { level, numBlocks, eccPerBlock, totalCodewords, dataCodewords };
}

function charCountBits(version) {
  return version <= 9 ? 8 : 16;
}

function utf8Bytes(text) {
  if (typeof TextEncoder === "function") {
    return Array.from(new TextEncoder().encode(text));
  }
  const out = [];
  for (const char of String(text)) {
    let code = char.codePointAt(0);
    if (code < 0x80) {
      out.push(code);
    } else if (code < 0x800) {
      out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      out.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    }
  }
  return out;
}

function appendBits(bits, value, length) {
  for (let i = length - 1; i >= 0; i -= 1) {
    bits.push((value >>> i) & 1);
  }
}

function chooseVersion(byteLength, ecl) {
  for (let version = 1; version <= MAX_VERSION; version += 1) {
    const { dataCodewords } = getEccInfo(version, ecl);
    const capacityBits = dataCodewords * 8;
    const neededBits = 4 + charCountBits(version) + byteLength * 8;
    if (neededBits <= capacityBits) {
      return version;
    }
  }
  throw new RangeError("QR content too long for supported versions");
}

function rsMultiply(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i -= 1) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function rsComputeDivisor(degree) {
  const result = new Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i += 1) {
    for (let j = 0; j < result.length; j += 1) {
      result[j] = rsMultiply(result[j], root);
      if (j + 1 < result.length) {
        result[j] ^= result[j + 1];
      }
    }
    root = rsMultiply(root, 0x02);
  }
  return result;
}

function rsComputeRemainder(data, divisor) {
  const result = new Array(divisor.length).fill(0);
  for (const b of data) {
    const factor = b ^ result.shift();
    result.push(0);
    divisor.forEach((coef, i) => {
      result[i] ^= rsMultiply(coef, factor);
    });
  }
  return result;
}

function buildCodewords(bytes, version, ecl) {
  const { dataCodewords, numBlocks, eccPerBlock, totalCodewords } = getEccInfo(version, ecl);
  const bits = [];
  appendBits(bits, 0x4, 4);
  appendBits(bits, bytes.length, charCountBits(version));
  for (const b of bytes) {
    appendBits(bits, b, 8);
  }

  const capacityBits = dataCodewords * 8;
  appendBits(bits, 0, Math.min(4, capacityBits - bits.length));
  appendBits(bits, 0, (8 - (bits.length % 8)) % 8);

  const padBytes = [];
  for (let pad = 0xec; bits.length < capacityBits; pad ^= 0xec ^ 0x11) {
    appendBits(bits, pad, 8);
  }
  for (let i = 0; i < bits.length; i += 8) {
    let value = 0;
    for (let j = 0; j < 8; j += 1) {
      value = (value << 1) | bits[i + j];
    }
    padBytes.push(value);
  }

  const divisor = rsComputeDivisor(eccPerBlock);
  const numShortBlocks = numBlocks - (totalCodewords % numBlocks);
  const shortBlockLen = Math.floor(totalCodewords / numBlocks);
  const blocks = [];
  let offset = 0;
  for (let i = 0; i < numBlocks; i += 1) {
    const dataLen = shortBlockLen - eccPerBlock + (i < numShortBlocks ? 0 : 1);
    const data = padBytes.slice(offset, offset + dataLen);
    offset += dataLen;
    blocks.push({ data, ecc: rsComputeRemainder(data, divisor) });
  }

  const interleaved = [];
  const maxDataLen = Math.max(...blocks.map((block) => block.data.length));
  for (let i = 0; i < maxDataLen; i += 1) {
    for (const block of blocks) {
      if (i < block.data.length) {
        interleaved.push(block.data[i]);
      }
    }
  }
  for (let i = 0; i < eccPerBlock; i += 1) {
    for (const block of blocks) {
      interleaved.push(block.ecc[i]);
    }
  }
  return interleaved;
}

function createMatrix(size) {
  return Array.from({ length: size }, () => new Array(size).fill(false));
}

function drawFinderPattern(modules, isFunction, centerX, centerY) {
  const size = modules.length;
  for (let dy = -4; dy <= 4; dy += 1) {
    for (let dx = -4; dx <= 4; dx += 1) {
      const x = centerX + dx;
      const y = centerY + dy;
      if (x < 0 || x >= size || y < 0 || y >= size) {
        continue;
      }
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      modules[y][x] = dist !== 2 && dist !== 4;
      isFunction[y][x] = true;
    }
  }
}

function drawAlignmentPattern(modules, isFunction, centerX, centerY) {
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      modules[centerY + dy][centerX + dx] = Math.max(Math.abs(dx), Math.abs(dy)) !== 1;
      isFunction[centerY + dy][centerX + dx] = true;
    }
  }
}

function drawFunctionPatterns(modules, isFunction, version, ecl, mask) {
  const size = modules.length;

  for (let i = 0; i < size; i += 1) {
    modules[6][i] = i % 2 === 0;
    modules[i][6] = i % 2 === 0;
    isFunction[6][i] = true;
    isFunction[i][6] = true;
  }

  drawFinderPattern(modules, isFunction, 3, 3);
  drawFinderPattern(modules, isFunction, size - 4, 3);
  drawFinderPattern(modules, isFunction, 3, size - 4);

  const positions = ALIGNMENT_POSITIONS[version];
  const numAlign = positions.length;
  for (let i = 0; i < numAlign; i += 1) {
    for (let j = 0; j < numAlign; j += 1) {
      if (
        (i === 0 && j === 0) ||
        (i === 0 && j === numAlign - 1) ||
        (i === numAlign - 1 && j === 0)
      ) {
        continue;
      }
      drawAlignmentPattern(modules, isFunction, positions[i], positions[j]);
    }
  }

  drawFormatBits(modules, isFunction, ecl, mask);

  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i += 1) {
      rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    }
    const bits = (version << 12) | rem;
    for (let i = 0; i < 18; i += 1) {
      const bit = ((bits >>> i) & 1) !== 0;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      modules[b][a] = bit;
      isFunction[b][a] = true;
      modules[a][b] = bit;
      isFunction[a][b] = true;
    }
  }
}

function drawFormatBits(modules, isFunction, ecl, mask) {
  const size = modules.length;
  const data = (ECC_LEVELS[ecl].formatBits << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i += 1) {
    rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  }
  const bits = ((data << 10) | rem) ^ 0x5412;

  const setBit = (x, y, index) => {
    modules[y][x] = ((bits >>> index) & 1) !== 0;
    isFunction[y][x] = true;
  };

  for (let i = 0; i <= 5; i += 1) setBit(8, i, i);
  setBit(8, 7, 6);
  setBit(8, 8, 7);
  setBit(7, 8, 8);
  for (let i = 9; i <= 14; i += 1) setBit(14 - i, 8, i);

  for (let i = 0; i <= 7; i += 1) setBit(size - 1 - i, 8, i);
  for (let i = 8; i <= 14; i += 1) setBit(8, size - 15 + i, i);
  modules[size - 8][8] = true;
  isFunction[size - 8][8] = true;
}

function drawCodewords(modules, isFunction, codewords) {
  const size = modules.length;
  let bitIndex = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) {
      right = 5;
    }
    for (let vert = 0; vert < size; vert += 1) {
      for (let j = 0; j < 2; j += 1) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!isFunction[y][x] && bitIndex < codewords.length * 8) {
          modules[y][x] = ((codewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1) !== 0;
          bitIndex += 1;
        }
      }
    }
  }
}

function maskPredicate(mask, x, y) {
  switch (mask) {
    case 0:
      return (x + y) % 2 === 0;
    case 1:
      return y % 2 === 0;
    case 2:
      return x % 3 === 0;
    case 3:
      return (x + y) % 3 === 0;
    case 4:
      return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
}

function applyMask(modules, isFunction, mask) {
  const size = modules.length;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!isFunction[y][x] && maskPredicate(mask, x, y)) {
        modules[y][x] = !modules[y][x];
      }
    }
  }
}

function penaltyScore(modules) {
  const size = modules.length;
  let score = 0;

  for (let y = 0; y < size; y += 1) {
    let run = 1;
    for (let x = 1; x < size; x += 1) {
      if (modules[y][x] === modules[y][x - 1]) {
        run += 1;
      } else {
        if (run >= 5) score += 3 + (run - 5);
        run = 1;
      }
    }
    if (run >= 5) score += 3 + (run - 5);
  }

  for (let x = 0; x < size; x += 1) {
    let run = 1;
    for (let y = 1; y < size; y += 1) {
      if (modules[y][x] === modules[y - 1][x]) {
        run += 1;
      } else {
        if (run >= 5) score += 3 + (run - 5);
        run = 1;
      }
    }
    if (run >= 5) score += 3 + (run - 5);
  }

  for (let y = 0; y < size - 1; y += 1) {
    for (let x = 0; x < size - 1; x += 1) {
      const color = modules[y][x];
      if (
        color === modules[y][x + 1] &&
        color === modules[y + 1][x] &&
        color === modules[y + 1][x + 1]
      ) {
        score += 3;
      }
    }
  }

  const patternA = [true, false, true, true, true, false, true, false, false, false, false];
  const patternB = [false, false, false, false, true, false, true, true, true, false, true];
  const matches = (get) => {
    for (let i = 0; i <= size - 11; i += 1) {
      let a = true;
      let b = true;
      for (let j = 0; j < 11; j += 1) {
        const value = get(i + j);
        if (value !== patternA[j]) a = false;
        if (value !== patternB[j]) b = false;
        if (!a && !b) break;
      }
      if (a || b) score += 40;
    }
  };
  for (let y = 0; y < size; y += 1) matches((index) => modules[y][index]);
  for (let x = 0; x < size; x += 1) matches((index) => modules[index][x]);

  let dark = 0;
  for (const row of modules) {
    for (const cell of row) {
      if (cell) dark += 1;
    }
  }
  const total = size * size;
  score += Math.floor(Math.abs(dark * 20 - total * 10) / total) * 10;
  return score;
}

/**
 * Encode text into a QR matrix.
 * @returns {{version:number,size:number,mask:number,ecc:string,modules:boolean[][]}}
 */
export function encodeQR(text, { ecc = "L" } = {}) {
  const level = ECC_LEVELS[ecc] ? ecc : "L";
  const bytes = utf8Bytes(text);
  const version = chooseVersion(bytes.length, level);
  const codewords = buildCodewords(bytes, version, level);
  const size = version * 4 + 17;

  const base = createMatrix(size);
  const baseFunction = createMatrix(size);
  drawFunctionPatterns(base, baseFunction, version, level, 0);
  drawCodewords(base, baseFunction, codewords);

  let bestMask = 0;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask += 1) {
    const trial = base.map((row) => row.slice());
    const trialFunction = baseFunction.map((row) => row.slice());
    applyMask(trial, trialFunction, mask);
    drawFormatBits(trial, trialFunction, level, mask);
    const score = penaltyScore(trial);
    if (score < bestScore) {
      bestScore = score;
      bestMask = mask;
    }
  }

  applyMask(base, baseFunction, bestMask);
  drawFormatBits(base, baseFunction, level, bestMask);

  return {
    version,
    size,
    mask: bestMask,
    ecc: level,
    modules: base,
    codewords,
    functionModules: baseFunction
  };
}

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Render a QR code as an SVG element (zero external requests).
 * @param {string} text
 * @param {{margin?:number,ecc?:string,dark?:string,light?:string,label?:string}} options
 * @returns {SVGElement}
 */
export function renderQRCode(text, options = {}) {
  const { margin = 4, ecc = "L", dark = "#111820", light = "transparent", label = "QR code" } = options;
  const qr = encodeQR(text, { ecc });
  const viewSize = qr.size + margin * 2;

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `${-margin} ${-margin} ${viewSize} ${viewSize}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", label);
  svg.setAttribute("shape-rendering", "crispEdges");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

  if (light !== "transparent") {
    const background = document.createElementNS(SVG_NS, "rect");
    background.setAttribute("x", String(-margin));
    background.setAttribute("y", String(-margin));
    background.setAttribute("width", String(viewSize));
    background.setAttribute("height", String(viewSize));
    background.setAttribute("fill", light);
    svg.append(background);
  }

  let pathData = "";
  for (let y = 0; y < qr.size; y += 1) {
    for (let x = 0; x < qr.size; x += 1) {
      if (qr.modules[y][x]) {
        pathData += `M${x} ${y}h1v1h-1z`;
      }
    }
  }

  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", pathData || "M0 0h1v1h-1z");
  path.setAttribute("fill", dark);
  svg.append(path);

  svg.style.width = "100%";
  svg.style.height = "auto";
  svg.style.display = "block";
  return svg;
}