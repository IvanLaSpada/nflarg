// El foro embebido no blanquea la página al publicar ni al reaccionar, y en el Home carga en paralelo con ESPN.
// Uso: node tests/foro-rapido.js
const { chromium, testPage, mockNetwork } = require('./_helpers');
(async () => {
  const url = testPage(); const b = await chromium.launch(); const errs = []; let fails = 0;
  const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  p.on('pageerror', e => errs.push(e.message)); await mockNetwork(p);
  const ok = (c, m) => { console.log((c ? '✔ ' : '✘ ') + m); if (!c) fails++; };
  await p.goto(url + '#/foro/registro'); await p.waitForTimeout(1200);
  await p.fill('#foUser', 'rapido'); await p.fill('#foPass', 'secreto1'); await p.fill('#foPass2', 'secreto1');
  await p.click('form button[type=submit]'); await p.waitForTimeout(900);
  await p.evaluate(() => location.hash = '#/hoy'); await p.waitForSelector('#foroBox textarea', { timeout: 10000 });
  await p.evaluate(() => { window.__mark = document.querySelector('.blk'); window.__rid = 0; window.scrollTo(0, 2000); });
  const y0 = await p.evaluate(() => scrollY);
  await p.fill('#foText', 'mensaje sin recargar'); await p.click('#foroBox form button[type=submit]'); await p.waitForTimeout(700);
  ok(await p.evaluate(() => document.querySelector('.blk') === window.__mark && !!window.__mark), 'Publicar no vuelve a dibujar los partidos');
  ok((await p.$eval('#foroBox .fpost .tx', e => e.textContent)).includes('mensaje sin recargar'), 'El mensaje nuevo aparece arriba');
  ok(Math.abs((await p.evaluate(() => scrollY)) - y0) < 5, 'No salta al principio de la página');
  await p.click('#foroBox .fpost .rx.up'); await p.waitForTimeout(500);
  ok(await p.evaluate(() => document.querySelector('.blk') === window.__mark), 'Reaccionar no vuelve a dibujar los partidos');
  ok((await p.$eval('#foroBox .fpost .rx.up', e => e.className)).includes('on'), 'El like queda marcado');
  ok(!errs.length, 'Errores de JS: ' + (errs.join(' | ') || 'ninguno'));
  await b.close(); process.exit(fails ? 1 : 0);
})();
