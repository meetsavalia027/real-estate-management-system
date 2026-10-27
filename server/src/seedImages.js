/**
 * Generates simple SVG illustrations for the demo listings, so the seed data
 * works offline. Real listings use photos uploaded by owners.
 */
const WALLS = ['#F1E6D6', '#E4ECF2', '#F4E3D3', '#E7E2EE', '#DCE8E0', '#EFE1D0'];
const ACCENTS = ['#B85C3C', '#2F5D8A', '#7A5A3A', '#3D7A69', '#86507A', '#A9772A'];
const SKIES = [
  ['#8EC3EA', '#E4F1FB', '#FFF4C9'], // day
  ['#F0A868', '#FBE2C8', '#FFE7A8'], // evening
  ['#5B7DB1', '#CFDAEC', '#F6F1DE'], // dusk
];

const W = 800;
const H = 560;
const GROUND = 440;

function rng(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function tree(x, y, scale, color = '#4F8A5B') {
  return `<g transform="translate(${x} ${y}) scale(${scale})">
    <rect x="-5" y="-10" width="10" height="50" fill="#7A5A3A"/>
    <circle cx="0" cy="-30" r="32" fill="${color}"/>
    <circle cx="-20" cy="-12" r="22" fill="${color}" opacity=".9"/>
    <circle cx="22" cy="-14" r="24" fill="${color}" opacity=".9"/>
  </g>`;
}

function windows(x, y, cols, rows, w, h, gapX, gapY, lit, rand) {
  let out = '';
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const on = lit && rand() > 0.55;
      out += `<rect x="${x + c * (w + gapX)}" y="${y + r * (h + gapY)}" width="${w}" height="${h}" rx="2" fill="${on ? '#FFD98A' : '#9FC1DA'}" stroke="#FFFFFF" stroke-width="2"/>`;
    }
  }
  return out;
}

function building(type, wall, accent, evening, rand, seed) {
  switch (type) {
    case 'apartment': {
      // Tower height and side-block position vary per listing so cards look different
      const floors = 6 + (seed % 5);
      const top = GROUND - 30 - floors * 30;
      const sideLeft = seed % 2 === 0;
      const sideX = sideLeft ? 150 : 520;
      const sideFloors = Math.max(3, floors - 3);
      const sideTop = GROUND - 20 - sideFloors * 30;
      return `
        <rect x="${sideX}" y="${sideTop}" width="130" height="${GROUND - sideTop}" fill="${wall}" opacity=".75"/>
        ${windows(sideX + 14, sideTop + 16, 3, sideFloors, 26, 18, 12, 12, evening, rand)}
        <rect x="290" y="${top}" width="230" height="${GROUND - top}" fill="${wall}" stroke="${accent}" stroke-width="3"/>
        <rect x="282" y="${top - 12}" width="246" height="14" fill="${accent}"/>
        ${windows(306, top + 16, 5, floors, 28, 18, 14, 12, evening, rand)}
        ${Array.from({ length: floors }, (_, i) => `<rect x="298" y="${top + 38 + i * 30}" width="214" height="3" fill="${accent}" opacity=".45"/>`).join('')}
        <rect x="380" y="${GROUND - 46}" width="50" height="46" fill="${accent}"/>`;
    }
    case 'house':
      return `
        <polygon points="230,270 400,150 570,270" fill="${accent}"/>
        <rect x="250" y="265" width="300" height="175" fill="${wall}" stroke="${accent}" stroke-width="3"/>
        <rect x="380" y="345" width="50" height="95" fill="${accent}"/>
        <circle cx="420" cy="395" r="4" fill="#F6E7B0"/>
        ${windows(280, 300, 2, 1, 60, 50, 140, 0, evening, rand)}
        <rect x="480" y="170" width="30" height="60" fill="${accent}"/>`;
    case 'villa':
      return `
        <rect x="170" y="230" width="260" height="210" fill="${wall}" stroke="${accent}" stroke-width="3"/>
        <rect x="160" y="222" width="280" height="14" fill="${accent}"/>
        <rect x="390" y="160" width="250" height="280" fill="${wall}" stroke="${accent}" stroke-width="3"/>
        <rect x="380" y="150" width="270" height="14" fill="${accent}"/>
        <rect x="420" y="190" width="190" height="90" fill="${evening ? '#FFD98A' : '#A9CBE3'}" stroke="#FFFFFF" stroke-width="4"/>
        <rect x="420" y="310" width="190" height="130" fill="${evening ? '#FFE3A3' : '#B8D5E8'}" stroke="#FFFFFF" stroke-width="4"/>
        ${windows(195, 265, 3, 1, 55, 60, 20, 0, evening, rand)}
        <rect x="250" y="360" width="60" height="80" fill="${accent}"/>
        <rect x="150" y="470" width="300" height="40" rx="6" fill="#6FB7D9" stroke="#FFFFFF" stroke-width="3"/>`;
    case 'office':
      return `
        <rect x="300" y="50" width="210" height="390" fill="#5F8DB5"/>
        ${[0, 1, 2, 3, 4, 5, 6].map((i) => `<rect x="${310 + i * 28}" y="60" width="20" height="370" fill="${evening && rand() > 0.5 ? '#FFD98A' : '#A8C8E2'}" opacity=".9"/>`).join('')}
        <rect x="300" y="40" width="210" height="14" fill="${accent}"/>
        <rect x="510" y="180" width="130" height="260" fill="${wall}" stroke="${accent}" stroke-width="3"/>
        ${windows(525, 200, 3, 6, 28, 22, 12, 14, evening, rand)}
        <rect x="380" y="390" width="50" height="50" fill="${accent}"/>`;
    case 'shop':
      return `
        <rect x="140" y="200" width="520" height="240" fill="${wall}" stroke="${accent}" stroke-width="3"/>
        <rect x="130" y="190" width="540" height="18" fill="${accent}"/>
        ${[0, 1, 2].map((i) => `
          <g transform="translate(${160 + i * 170} 250)">
            ${[0, 1, 2, 3, 4, 5].map((s) => `<rect x="${s * 25}" y="0" width="25" height="34" fill="${s % 2 ? '#FFFFFF' : accent}"/>`).join('')}
            <rect x="0" y="50" width="150" height="140" fill="${evening ? '#FFE3A3' : '#B8D5E8'}" stroke="#FFFFFF" stroke-width="4"/>
            <rect x="55" y="110" width="40" height="80" fill="${accent}" opacity=".8"/>
          </g>`).join('')}`;
    case 'plot':
    default:
      return `
        <polygon points="120,470 680,470 600,330 200,330" fill="#C9A978" stroke="#8C6D45" stroke-width="3" stroke-dasharray="10 8"/>
        ${[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => `<rect x="${200 + i * 50}" y="310" width="6" height="30" fill="#8C6D45"/>`).join('')}
        <rect x="200" y="318" width="406" height="4" fill="#8C6D45"/>
        <rect x="360" y="230" width="8" height="110" fill="#6B5233"/>
        <rect x="300" y="210" width="128" height="56" rx="4" fill="${accent}"/>
        <rect x="314" y="226" width="100" height="8" rx="4" fill="#FFFFFF" opacity=".85"/>
        <rect x="314" y="242" width="70" height="8" rx="4" fill="#FFFFFF" opacity=".6"/>`;
  }
}

function exterior(type, seed, variant) {
  const rand = rng(seed * 97 + variant * 13 + 7);
  const wall = WALLS[seed % WALLS.length];
  const accent = ACCENTS[(seed * 3 + variant) % ACCENTS.length];
  const sky = SKIES[variant % SKIES.length];
  const evening = variant === 1;
  const sunX = 120 + Math.floor(rand() * 560);
  return `
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#sky)"/>
    <circle cx="${sunX}" cy="${evening ? 300 : 90}" r="${evening ? 60 : 40}" fill="${sky[2]}" opacity=".9"/>
    <ellipse cx="${(sunX + 300) % W}" cy="120" rx="80" ry="18" fill="#FFFFFF" opacity=".6"/>
    <rect y="${GROUND}" width="${W}" height="${H - GROUND}" fill="${type === 'office' || type === 'shop' ? '#B9B4AA' : '#86B47A'}"/>
    <rect y="${GROUND + 70}" width="${W}" height="50" fill="#9A9488"/>
    ${building(type, wall, accent, evening, rand, seed)}
    ${tree(80, GROUND, 1.1)}
    ${tree(720, GROUND, 0.9, '#5E9A62')}
  `;
}

function interior(type, seed) {
  const accent = ACCENTS[(seed * 5) % ACCENTS.length];
  const wall = WALLS[(seed + 2) % WALLS.length];
  if (type === 'office' || type === 'shop') {
    return `
      <rect width="${W}" height="${H}" fill="${wall}"/>
      <rect y="400" width="${W}" height="160" fill="#C8B79E"/>
      <rect x="60" y="60" width="680" height="220" fill="#A9CBE3" stroke="#FFFFFF" stroke-width="10"/>
      ${[1, 2, 3].map((i) => `<rect x="${60 + i * 170}" y="60" width="8" height="220" fill="#FFFFFF"/>`).join('')}
      ${[0, 1, 2].map((i) => `
        <g transform="translate(${110 + i * 220} 360)">
          <rect x="0" y="0" width="160" height="14" fill="${accent}"/>
          <rect x="10" y="14" width="8" height="60" fill="#555"/><rect x="142" y="14" width="8" height="60" fill="#555"/>
          <rect x="50" y="-46" width="60" height="40" rx="3" fill="#2B2F36"/>
        </g>`).join('')}`;
  }
  return `
    <rect width="${W}" height="${H}" fill="${wall}"/>
    <rect y="410" width="${W}" height="150" fill="#C9A77E"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<rect x="${i * 100}" y="410" width="2" height="150" fill="#B08F66"/>`).join('')}
    <rect x="470" y="70" width="250" height="220" fill="#A9CBE3" stroke="#FFFFFF" stroke-width="10"/>
    <rect x="590" y="70" width="8" height="220" fill="#FFFFFF"/>
    <rect x="80" y="300" width="330" height="90" rx="18" fill="${accent}"/>
    <rect x="70" y="270" width="40" height="120" rx="14" fill="${accent}"/>
    <rect x="380" y="270" width="40" height="120" rx="14" fill="${accent}"/>
    <rect x="110" y="250" width="260" height="70" rx="16" fill="${accent}" opacity=".85"/>
    <rect x="160" y="420" width="200" height="16" rx="4" fill="#6B4E31"/>
    <rect x="600" y="300" width="6" height="110" fill="#444"/>
    <polygon points="575,300 631,300 615,260 591,260" fill="#F2D27A"/>
    <rect x="130" y="110" width="160" height="100" fill="#FFFFFF" stroke="#6B4E31" stroke-width="6"/>
    <circle cx="210" cy="160" r="30" fill="${ACCENTS[(seed + 1) % ACCENTS.length]}" opacity=".6"/>`;
}

/** Return an SVG string for listing `seed`, image number `variant` (0, 1, 2). */
function propertySvg(type, seed, variant) {
  const body = variant === 2 && type !== 'plot' ? interior(type, seed) : exterior(type, seed, variant);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${body}</svg>`;
}

module.exports = { propertySvg };
