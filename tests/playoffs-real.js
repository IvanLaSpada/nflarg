// Cuadros de playoffs con datos REALES de ESPN (internet + curl): NFL, FBS y UFL de varias épocas y la proyección actual.
// Uso: node tests/playoffs-real.js   ·   Capturas en tests/.capturas/
const fs = require('fs');
const path = require('path');
const { chromium, testPage, ROOT } = require('./_helpers');
const realNetwork = require('./_red-real');
const CAP = path.join(ROOT, 'tests', '.capturas'); fs.mkdirSync(CAP, { recursive: true });

const CASOS = [
  // [hash, cantidad de partidos esperada (null = no se controla), campeón esperado (abreviatura) o null, texto que tiene que aparecer]
  ['#/nfl/playoffs/2025', 13, 'SEA', 'cuadro final'],
  ['#/nfl/playoffs/2019', 11, 'KC', 'cuadro final'],
  ['#/nfl/playoffs/1995', 11, 'DAL', 'cuadro final'],
  ['#/nfl/playoffs/1985', 9, 'CHI', 'cuadro final'],   // 10 equipos: 2 comodines, 4 divisionales, 2 finales y el Super Bowl
  ['#/fbs/playoffs/2025', 11, 'IU', 'cuadro final'],
  ['#/fbs/playoffs/2024', 11, 'OSU', 'cuadro final'],
  ['#/fbs/playoffs/2018', 3, 'CLEM', 'cuadro final'],
  ['#/fbs/playoffs/2010', null, null, 'antes de 2014'],
  ['#/fbs/playoffs/2014', 3, 'OSU', 'cuadro final'],
  ['#/ufl/playoffs/2026', 3, 'LOU', 'cuadro final'],
  ['#/nfl/playoffs/2026', 13, null, 'proyección'],
  ['#/fbs/playoffs/2026', 11, null, 'proyección'],
];

(async () => {
  const url = testPage(); const b = await chromium.launch(); let fails = 0;
  const ok = (c, m) => { console.log((c ? '✔ ' : '✘ ') + m); if (!c) fails++; };
  for (const w of [1280, 360]) {
    const p = await b.newPage({ viewport: { width: w, height: 900 } }); const errs = [];
    p.on('pageerror', e => errs.push(e.message)); await realNetwork(p);
    await p.goto(url + '#/hoy'); await p.waitForTimeout(2500);
    for (const [h, n, champ, txt] of CASOS) {
      await p.evaluate(h => location.hash = h, h);
      await p.waitForFunction(() => document.querySelector('#tabc') && !document.querySelector('#tabc .spin'), null, { timeout: 60000 }).catch(() => {});
      await p.waitForTimeout(400);
      const info = await p.evaluate(() => ({
        cards: document.querySelectorAll('#tabc .bk-m:not(.bye)').length,
        byes: document.querySelectorAll('#tabc .bk-m.bye').length,
        champ: document.querySelector('#tabc .bk-champ .logo')?.getAttribute('alt') || document.querySelector('#tabc .bk-champ .logo-fb')?.textContent || '',
        text: document.querySelector('#tabc')?.innerText || '',
        sw: document.documentElement.scrollWidth,
        err: !!document.querySelector('#tabc .err'),
      }));
      const good = !info.err && (n == null || info.cards === n) && (!champ || info.champ === champ) && info.text.toLowerCase().includes(txt.toLowerCase()) && info.sw <= w;
      ok(good, `${w}px ${h}: ${info.cards} partidos, ${info.byes} descansos${info.champ ? ', campeón ' + info.champ : ''}${info.err ? ' · ERROR: ' + info.text.slice(0, 120) : ''}${info.sw > w ? ' · scroll horizontal ' + info.sw : ''}`);
      await p.screenshot({ path: path.join(CAP, `bk${w}-${h.replace(/[#/]+/g, '_')}.png`), fullPage: true });
    }
    ok(!errs.length, `${w}px errores de JS: ` + (errs.join(' | ') || 'ninguno'));
    await p.close();
  }
  await b.close();
  process.exit(fails ? 1 : 0);
})();
