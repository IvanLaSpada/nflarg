// Solapa Palmarés de cada liga: resumen, ranking, campeones por temporada, corte por temporada y celular.
// Uso: node tests/ligas-palmares.js   (capturas en tests/.capturas/, que no se suben)
const fs = require('fs'); const path = require('path');
const { chromium, testPage, mockNetwork } = require('./_helpers');
const { respond } = require('./mock-espn');
// En los datos simulados la CFL viene vacía a propósito; para esta prueba se la simula activa.
const cflOn = page => page.route(/\/cfl\/scoreboard/, r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(respond(r.request().url().replace('/cfl/', '/nfl/')).body) }));
(async () => {
  const url = testPage(); const out = path.join(__dirname, '.capturas'); fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const errs = []; let fails = 0;
  const ok = (c, m) => { console.log((c ? '✔ ' : '✘ ') + m); if (!c) fails++; };
  for (const [label, vp] of [['desk', { width: 1280, height: 1000 }], ['mob', { width: 360, height: 740 }]]) {
    const p = await b.newPage({ viewport: vp }); p.on('pageerror', e => errs.push(e.message)); await mockNetwork(p); await cflOn(p);
    for (const lg of ['nfl', 'fbs', 'fcs', 'cfl']) {
      await p.goto(url + `#/${lg}/palmares/2025`); await p.waitForTimeout(1200);
      const tabs = await p.$$eval('.tabs .tab.on', x => x.map(e => e.innerText.trim()));
      const sum = (await p.$eval('.pal-summary', e => e.innerText)).replace(/\s+/g, ' ');
      const nRank = await p.$$eval('.tbl.rk tbody tr', x => x.length);
      const first = await p.$eval('.tbl.lpal:not(.rk) tbody tr', e => e.innerText.replace(/\s+/g, ' ').trim());
      const sw = await p.evaluate(() => document.documentElement.scrollWidth);
      ok(tabs[0] === 'PALMARÉS' && nRank > 0 && sw <= vp.width, `${label} ${lg}: ${sum} | 1ª fila: ${first}${sw > vp.width ? ' | SCROLL HORIZONTAL' : ''}`);
      await p.screenshot({ path: path.join(out, `liga-palmares-${lg}-${label}.png`), fullPage: label === 'desk' && lg === 'nfl' });
    }
    await p.close();
  }
  const p = await b.newPage(); await mockNetwork(p);
  await p.goto(url + '#/nfl/palmares/1990'); await p.waitForTimeout(1000);
  ok((await p.$eval('.pal-summary', e => e.innerText)).includes('1990'), 'Corte por temporada: NFL 1990 muestra el campeón de 1990');
  await p.goto(url + '#/ufl/palmares/2025'); await p.waitForTimeout(800);
  ok((await p.$eval('#view', e => e.innerText)).length > 0, 'UFL no rompe aunque la liga no esté disponible');
  // Clicks: año → temporada; instancia → partido de la final (buscado en los playoffs de ESPN)
  const q = await b.newPage({ viewport: { width: 1280, height: 900 } }); q.on('pageerror', e => errs.push(e.message)); await mockNetwork(q);
  const ev = (id, a, h) => ({ id, competitions: [{ competitors: [a, h].map(([tid, name, loc]) => ({ id: tid, team: { id: tid, displayName: name, location: loc } })) }], status: { type: { completed: true } } });
  await q.route(/scoreboard\?.*seasontype=3/, r => {
    const u = r.request().url(); const base = respond(u.replace(/\?.*/, '')).body;
    let events = [];
    if (/\/nfl\//.test(u) && /dates=2019/.test(u) && /week=5/.test(u)) events = [ev('sb54', ['12', 'Kansas City Chiefs', 'Kansas City'], ['25', 'San Francisco 49ers', 'San Francisco'])];
    if (/college-football/.test(u) && /dates=2025/.test(u)) events = [ev('cfp25', ['84', 'Indiana Hoosiers', 'Indiana'], ['2390', 'Miami Hurricanes', 'Miami'])];
    r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ...base, events }) });
  });
  const hashAfter = async (sel, wait = 1500) => { await q.click(sel); await q.waitForTimeout(wait); return q.evaluate(() => location.hash); };
  await q.goto(url + '#/nfl/palmares/2025'); await q.waitForTimeout(1200);
  ok((await hashAfter('.tbl.lpal:not(.rk) a.pal-year:has-text("2025")', 600)) === '#/nfl/partidos/2025', 'Año 2025 → temporada 2025');
  await q.goto(url + '#/nfl/palmares/2025'); await q.waitForTimeout(1200);
  ok((await hashAfter('a.pal-final:has-text("Super Bowl LIV ")')) === '#/nfl/game/sb54', 'Super Bowl LIV → partido de ESPN');
  await q.goto(url + '#/nfl/palmares/2025'); await q.waitForTimeout(1200);
  ok((await hashAfter('a.pal-final:has-text("Super Bowl LIX")')) === '#/nfl/partidos/2024/3/5', 'Super Bowl sin datos en ESPN → playoffs de ese año');
  await q.goto(url + '#/fbs/palmares/2025'); await q.waitForTimeout(1200);
  ok((await hashAfter('a.pal-final:has-text("Final CFP")')) === '#/fbs/game/cfp25', 'Final CFP 2025 (por nombre) → partido');
  await q.goto(url + '#/nfl/team/12/palmares'); await q.waitForTimeout(1500);
  ok((await hashAfter('.pal-row a.pal-year:has-text("2019")')) === '#/nfl/game/sb54', 'Palmarés del equipo: Super Bowl 2019 → partido');
  await q.goto(url + '#/nfl/palmares/2025'); await q.waitForTimeout(800); await q.setViewportSize({ width: 360, height: 740 }); await q.waitForTimeout(400);
  ok(await q.$eval('a.pal-final', e => e.getBoundingClientRect().width > 0), 'En celular se ve el link a la final');
  ok((await q.evaluate(() => document.documentElement.scrollWidth)) <= 360, 'Sin scroll horizontal de página en celular');
  console.log('\nErrores de JS:', errs.length ? errs.join('\n') : 'ninguno');
  await b.close(); process.exit(fails || errs.length ? 1 : 0);
})();
