// Recorre todas las rutas en escritorio y celular con datos simulados de ESPN.
// Uso: node tests/smoke.js   → imprime el comienzo de cada vista y la lista de errores de JS.
const { chromium, testPage, mockNetwork } = require('./_helpers');

const ROUTES = ['#/hoy', '#/nfl/hoy', '#/nfl/partidos', '#/nfl/partidos/2025/3/1', '#/nfl/posiciones/2025', '#/nfl/stats/2026',
  '#/nfl/team/12', '#/nfl/team/12/fixture/2026', '#/nfl/team/12/stats/2024', '#/nfl/team/12/foro', '#/nfl/player/3139477',
  '#/nfl/game/401', '#/nfl/game/403', '#/fbs/partidos', '#/ufl/partidos', '#/foro', '#/foro/rankings', '#/zzz'];

(async () => {
  const url = testPage();
  const browser = await chromium.launch();
  const errors = [];
  for (const [label, viewport] of [['escritorio', { width: 1280, height: 900 }], ['celular', { width: 360, height: 740 }]]) {
    const page = await browser.newPage({ viewport });
    page.on('pageerror', e => errors.push(`[${label}] ${e.message}`));
    await mockNetwork(page);
    for (const h of ROUTES) {
      await page.goto(url + h); await page.waitForTimeout(900);
      const txt = await page.$eval('#view', e => e.innerText.slice(0, 110).replace(/\s+/g, ' '));
      const sw = await page.evaluate(() => document.documentElement.scrollWidth);
      console.log(`${label.padEnd(10)} ${h.padEnd(28)} ${sw > viewport.width ? '⚠ SCROLL HORIZONTAL ' : ''}${txt}`);
    }
    await page.close();
  }
  console.log('\nErrores de JS:', errors.length ? '\n' + errors.join('\n') : 'ninguno');
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
