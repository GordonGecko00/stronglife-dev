// Generates PNG app icons (barbell mark on a solid background) with no external
// image assets, so the PWA has real icons without needing designer input.
import { PNG } from "pngjs";
import { writeFileSync, mkdirSync } from "fs";

const BG = [22, 24, 29]; // near-black
const FG = [255, 91, 4]; // brand orange

function drawIcon(size, { padding = 0 } = {}) {
  const png = new PNG({ width: size, height: size });
  const set = (x, y, [r, g, b], a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const idx = (size * y + x) << 2;
    png.data[idx] = r;
    png.data[idx + 1] = g;
    png.data[idx + 2] = b;
    png.data[idx + 3] = a;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) set(x, y, BG);
  }

  // Barbell drawn in a square viewbox, then scaled/padded into the icon.
  const inner = size - padding * 2;
  const s = (v) => Math.round(padding + (v / 100) * inner);

  const barTop = s(46);
  const barBottom = s(54);
  for (let y = barTop; y < barBottom; y++) {
    for (let x = s(18); x < s(82); x++) set(x, y, FG);
  }

  const plates = [
    { x0: 8, x1: 16, y0: 22, y1: 78 },
    { x0: 84, x1: 92, y0: 22, y1: 78 },
    { x0: 2, x1: 8, y0: 34, y1: 66 },
    { x0: 92, x1: 98, y0: 34, y1: 66 },
  ];
  for (const p of plates) {
    for (let y = s(p.y0); y < s(p.y1); y++) {
      for (let x = s(p.x0); x < s(p.x1); x++) set(x, y, FG);
    }
  }

  return png;
}

mkdirSync("public/icons", { recursive: true });

const targets = [
  { name: "public/icons/icon-192.png", size: 192, padding: 0 },
  { name: "public/icons/icon-512.png", size: 512, padding: 0 },
  { name: "public/icons/maskable-512.png", size: 512, padding: 90 },
  { name: "public/icons/apple-touch-icon.png", size: 180, padding: 12 },
  { name: "public/favicon.png", size: 64, padding: 0 },
];

for (const t of targets) {
  const png = drawIcon(t.size, { padding: t.padding });
  writeFileSync(t.name, PNG.sync.write(png));
  console.log("wrote", t.name);
}
