// Prueba con ESPN REAL y TheSportsDB (CFL) (necesita internet y curl): Home de hoy, Gamecast de los partidos en vivo comparado con el
// marcador de ESPN (posesión, sentido y yarda) y links de finales del palmarés. Uso: node tests/espn-real.js
const { chromium, testPage } = require('./_helpers');
const realNetwork = require('./_red-real');
(async () => {
  const url = testPage(); const b = await chromium.launch(); const errs = []; let fails = 0;
  const ok = (c, m) => { console.log((c ? '✔ ' : '✘ ') + m); if (!c) fails++; };
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } }); p.on('pageerror', e => errs.push(e.message)); await realNetwork(p);
  await p.goto(url + '#/hoy'); await p.waitForTimeout(12000);
  const blocks = await p.$$eval('.blk .ph', xs => xs.map(x => x.innerText.replace(/\s+/g, ' ').trim()));
  ok(blocks.length > 0, 'Home de hoy: ' + blocks.join(' / '));
  // CFL desde TheSportsDB: que el bloque exista y muestre partidos o el próximo partido
  const cfl = await p.$eval('.blk[data-lg="cfl"]', e => e.innerText.replace(/\s+/g, ' ')).catch(() => 'SIN BLOQUE CFL');
  ok(/partido|Próximo/.test(cfl), 'CFL (TheSportsDB) en el Home: ' + cfl.slice(0, 120));
  const live = (await p.$$eval('a.g.st-in', xs => xs.map(a => a.getAttribute('href')))).filter(h => h.startsWith('#/nfl/')).slice(0, 6);
  if (!live.length) console.log('· No hay partidos NFL en vivo ahora: no se compara el Gamecast.');
  for (const h of live) {
    await p.goto(url + h); await p.waitForTimeout(3500);
    const i = await p.evaluate(async (h) => {
      const id = h.split('/').pop(); const sb = await API.get(sbUrl(LG.nfl)); const c = sb.events.find(e => e.id === id)?.competitions[0]; const si = c?.situation || {};
      const home = c.competitors.find(x => x.homeAway === 'home'), away = c.competitors.find(x => x.homeAway === 'away');
      const top = document.querySelector('#gamecastBox .gc-top')?.innerText.replace(/\s+/g, ' ') || 'SIN GAMECAST';
      return { top, spot: si.possessionText || '', poss: String(si.possession) === home.id ? 'home' : String(si.possession) === away.id ? 'away' : '', name: away.team.abbreviation + '@' + home.team.abbreviation };
    }, h);
    const dirOk = !i.poss || (i.poss === 'home' ? i.top.includes('◀') : i.top.includes('▶'));
    const spotOk = !i.spot || i.top.includes(i.spot) || (/\s0$/.test(i.spot) && i.top.includes('Zona'));
    ok(dirOk && spotOk && i.top !== 'SIN GAMECAST', `Gamecast ${i.name}: ESPN ${i.poss} ${i.spot} → ${i.top}`);
  }
  for (const [lg, y, exp] of [['nfl', 2025, 'SEA'], ['nfl', 1990, 'NYG'], ['nfl', 1966, 'GB'], ['fbs', 2025, 'IU'], ['fcs', 2024, 'NDSU'], ['ufl', 2025, 'DC'], ['ufl', 2026, 'LOU']]) {
    const r = await p.evaluate(async ([lg, y]) => { const f = await findFinalGame(lg, y); if (!f.id) return f.fallback; const d = await API.get(`${SITE}/${LG[lg].slug}/summary?event=${f.id}`); return d.header.competitions[0].competitors.map(c => c.team.abbreviation).join(' vs '); }, [lg, y]);
    ok(r.includes(exp), `Final ${lg} ${y} → ${r}`);
  }
  console.log('\nErrores de JS:', errs.length ? errs.join('\n') : 'ninguno');
  await b.close(); process.exit(fails || errs.length ? 1 : 0);
})();
