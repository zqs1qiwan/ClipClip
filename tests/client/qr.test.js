import test from "node:test";
import assert from "node:assert/strict";
import { encodeQR, renderQRCode } from "../../public/js/qr.js";

// QR structural smoke tests. The encoder is a zero-dependency inline implementation;
// these tests verify its observable contract (matrix geometry, finder patterns,
// deterministic output, ECC/version selection and SVG rendering) without pulling in
// a QR decoder dependency.

test("encodeQR returns the documented structure", () => {
  const qr = encodeQR("http://clip.clip:5678/");
  assert.equal(typeof qr.version, "number");
  assert.equal(typeof qr.size, "number");
  assert.ok(qr.version >= 1 && qr.version <= 10);
  assert.equal(qr.size, qr.version * 4 + 17);
  assert.equal(qr.ecc, "L");
  assert.equal(qr.mask >= 0 && qr.mask <= 7, true);
  assert.ok(Array.isArray(qr.codewords) && qr.codewords.length > 0);
  assert.ok(qr.codewords.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255));

  assert.equal(qr.modules.length, qr.size);
  for (const row of qr.modules) {
    assert.equal(row.length, qr.size);
    assert.ok(row.every((cell) => typeof cell === "boolean"));
  }
  assert.equal(qr.functionModules.length, qr.size);
});

test("encodeQR is deterministic for identical input", () => {
  const a = encodeQR("https://example.com/app", { ecc: "M" });
  const b = encodeQR("https://example.com/app", { ecc: "M" });
  assert.equal(a.version, b.version);
  assert.equal(a.mask, b.mask);
  assert.deepEqual(a.modules, b.modules);
  assert.deepEqual(a.codewords, b.codewords);
});

test("encodeQR honors ECC level M and falls back to L on unknown levels", () => {
  assert.equal(encodeQR("hello", { ecc: "M" }).ecc, "M");
  assert.equal(encodeQR("hello", { ecc: "Z" }).ecc, "L");
  assert.equal(encodeQR("hello").ecc, "L");
});

test("encodeQR encodes UTF-8 (Chinese) content without throwing", () => {
  const qr = encodeQR("http://192.168.2.1:5678/分享");
  assert.ok(qr.size >= 21);
  assert.ok(qr.modules.some((row) => row.some(Boolean)));
});

test("larger payloads select a larger version", () => {
  const small = encodeQR("a");
  const large = encodeQR("x".repeat(120));
  assert.ok(large.version > small.version, `${large.version} should exceed ${small.version}`);
});

test("over-capacity payload throws a RangeError", () => {
  assert.throws(() => encodeQR("x".repeat(4000)), RangeError);
});

test("finder patterns occupy the three corners (7x7 with dark border and center)", () => {
  const qr = encodeQR("http://clip.clip:5678/");
  const size = qr.size;
  const checkFinder = (cx, cy) => {
    // center 3x3 of the 7x7 finder must be dark
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        assert.equal(qr.modules[cy + dy][cx + dx], true, `finder center ${cx},${cy}`);
      }
    }
    // ring at distance 3 must be dark; the separating ring at distance 4 light
    assert.equal(qr.modules[cy - 3][cx], true);
    assert.equal(qr.modules[cy][cx + 3], true);
    if (cy + 4 < size && cx + 4 < size) {
      assert.equal(qr.modules[cy + 4][cx + 4], false);
    }
  };
  checkFinder(3, 3);
  checkFinder(size - 4, 3);
  checkFinder(3, size - 4);
});

test("timing pattern alternates on row 6 and column 6", () => {
  const qr = encodeQR("http://clip.clip:5678/");
  for (let i = 8; i < qr.size - 8; i += 1) {
    assert.equal(qr.modules[6][i], i % 2 === 0, `row6@${i}`);
    assert.equal(qr.modules[i][6], i % 2 === 0, `col6@${i}`);
  }
});

test("renderQRCode produces a zero-request inline SVG", () => {
  const created = [];
  const elementStub = () => ({
    attributes: {},
    style: {},
    children: [],
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
    append(child) {
      this.children.push(child);
    },
    get textContent() {
      return this._text || "";
    },
    set textContent(value) {
      this._text = value;
    }
  });

  globalThis.document = {
    createElementNS(namespace, tag) {
      const element = elementStub();
      element.namespace = namespace;
      element.tag = tag;
      created.push(element);
      return element;
    }
  };

  try {
    const svg = renderQRCode("http://clip.clip:5678/", { margin: 4, ecc: "M", light: "#fff" });
    assert.equal(svg.tag, "svg");
    assert.equal(svg.namespace, "http://www.w3.org/2000/svg");
    assert.match(svg.attributes.viewBox, /^-4 -4 \d+ \d+$/);
    assert.equal(svg.attributes.role, "img");
    assert.equal(svg.attributes["shape-rendering"], "crispEdges");
    assert.equal(svg.style.width, "100%");
    // background rect + single dark path
    assert.equal(svg.children.length, 2);
    assert.equal(svg.children[0].tag, "rect");
    assert.equal(svg.children[0].attributes.fill, "#fff");
    assert.equal(svg.children[1].tag, "path");
    assert.match(svg.children[1].attributes.d, /^M\d+ \d+h1v1h-1z/);
    // createElementNS is called for the svg itself + background rect + dark path.
    assert.equal(created.length, 3, "must create only svg + rect + path");
  } finally {
    delete globalThis.document;
  }
});
