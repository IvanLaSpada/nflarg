// Navegación dentro del foro sin recargar la página (temas, solapas, volver, atrás/adelante), en el Home, en un partido y en el celular.
// Uso: node tests/foro-navegacion.js
const { chromium, testPage, mockNetwork } = require('./_helpers');

(async () => {
  const url = testPage(); const b = await chromium.launch(); const errs = []; let fails = 0;
  const ok = (c, m) => { console.log((c ? '✔ ' : '✘ ') + m); if (!c) fails++; };
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  p.on('pageerror', e => errs.push(e.message)); await mockNetwork(p);
  const nav = async h => { await p.evaluate(h => location.hash = h, h); await p.waitForTimeout(900); };
  // Marca en la página: si algo vuelve a dibujar toda la vista (route), la marca desaparece
  const mark = sel => p.evaluate(sel => { const e = document.querySelector(sel); if (e) e.dataset.marca = '1'; return !!e; }, sel);
  const marked = sel => p.evaluate(sel => document.querySelector(sel)?.dataset.marca === '1', sel);

  await p.goto(url + '#/foro/registro'); await p.waitForTimeout(1200);
  await p.fill('#foUser', 'navegante'); await p.fill('#foPass', 'secreto1'); await p.fill('#foPass2', 'secreto1'); await p.click('form button[type=submit]'); await p.waitForTimeout(900);
  for (let i = 1; i <= 3; i++) { await nav('#/foro/nuevo'); await p.fill('#foTitle', 'Tema ' + i); await p.fill('#foText', 'Primer mensaje del tema ' + i); await p.click('#foroBox form button[type=submit]'); await p.waitForTimeout(600); }
  ok(/^#\/foro\/t\/3$/.test(await p.evaluate(() => location.hash)) && !!(await p.$('.fmain .crumb')), 'Crear un tema lo abre en el lugar del muro');

  // ---- Home ----
  await nav('#/hoy'); await p.waitForSelector('#foroBox .fside .ftr', { timeout: 8000 });
  await mark('.blk'); await p.evaluate(() => window.scrollTo(0, document.querySelector('#foroSec').getBoundingClientRect().top + scrollY - 10));
  const y0 = await p.evaluate(() => scrollY);
  await p.click('#foroBox .fside .ftr:has-text("Tema 2")'); await p.waitForTimeout(700);
  const st1 = await p.evaluate(() => ({ h: location.hash, title: document.querySelector('.fmain .ph')?.textContent || '', on: document.querySelector('.fside .ftr.on b')?.textContent, y: scrollY }));
  ok(st1.h === '#/hoy/foro/t/2' && /Tema 2/.test(st1.title) && st1.on === 'Tema 2', 'Home: el tema se abre donde estaba el muro y queda marcado a la derecha');
  ok(await marked('.blk'), 'Home: abrir el tema no recarga la página (los partidos siguen iguales)');
  ok(Math.abs(st1.y - y0) < 40, 'Home: la página no salta arriba');
  await p.click('.fmain .crumb a'); await p.waitForTimeout(700);
  ok((await p.evaluate(() => location.hash)) === '#/hoy/foro/temas' && !!(await p.$('.fmain textarea#foText')) && await marked('.blk'), 'Home: "Temas" vuelve al muro sin recargar');
  await p.click('#foroBox .ftabs a:has-text("Rankings")'); await p.waitForTimeout(700);
  ok(!!(await p.$('#foroBox .tbl')) && await marked('.blk'), 'Home: la solapa Rankings tampoco recarga');
  await p.goBack(); await p.waitForTimeout(800);
  ok((await p.evaluate(() => location.hash)) === '#/hoy/foro/temas' && !!(await p.$('.fmain textarea#foText')) && await marked('.blk'), 'Home: "atrás" vuelve al foro sin recargar');
  await p.goBack(); await p.waitForTimeout(800);
  ok((await p.evaluate(() => location.hash)) === '#/hoy/foro/t/2' && /Tema 2/.test(await p.$eval('.fmain .ph', e => e.textContent)) && await marked('.blk'), 'Home: otra vez "atrás" reabre el tema sin recargar');
  await p.goForward(); await p.waitForTimeout(800);
  ok(!!(await p.$('.fmain textarea#foText')) && await marked('.blk'), 'Home: "adelante" también');
  // Responder en el tema sin recargar
  await p.click('#foroBox .fside .ftr:has-text("Tema 1")'); await p.waitForTimeout(700);
  await p.waitForTimeout(10500);   // antispam del foro
  await p.fill('.fmain #foText', 'Respuesta desde el Home'); await p.click('.fmain form button[type=submit]'); await p.waitForTimeout(900);
  ok((await p.$$eval('.fmain .fpost .tx', x => x.map(e => e.textContent))).includes('Respuesta desde el Home') && await marked('.blk'), 'Home: responder un tema no recarga la página');

  // ---- Partido: el tema abierto no pisa el partido ----
  await nav('#/hoy'); await p.waitForSelector('.g', { timeout: 8000 });
  const game = await p.$eval('.g', a => a.getAttribute('href'));
  await nav(game); await p.waitForSelector('#foroBox .fside .ftr', { timeout: 8000 });
  await mark('.gh'); const before = await p.$eval('.gh', e => e.innerText);
  await p.click('#foroBox .fside .ftr:has-text("Tema 3")'); await p.waitForTimeout(700);
  ok((await p.evaluate(() => location.hash)) === game + '/foro/t/3' && await marked('.gh'), 'Partido: el tema se abre abajo del partido sin recargar');
  // (el foro simulado se borra al recargar: acá se controla que el partido sea el mismo, no el tema)
  await p.reload(); await p.waitForSelector('#foroBox .fmain', { timeout: 10000 });
  const rr = await p.evaluate(() => ({ id: state.route.id, tid: state.route.tid }));
  ok((await p.$eval('.gh', e => e.innerText)) === before && game.endsWith('/' + rr.id) && rr.tid === '3', 'Partido: entrando directo al link del tema se ve el mismo partido (antes mostraba otro)');

  // ---- Celular: solapas Mensajes / Temas sin recargar ----
  const m = await b.newPage({ viewport: { width: 360, height: 800 } }); m.on('pageerror', e => errs.push(e.message)); await mockNetwork(m);
  await m.goto(url + '#/foro/registro'); await m.waitForTimeout(1200);
  await m.fill('#foUser', 'celunav'); await m.fill('#foPass', 'secreto1'); await m.fill('#foPass2', 'secreto1'); await m.click('form button[type=submit]'); await m.waitForTimeout(900);
  await m.evaluate(() => location.hash = '#/foro/nuevo'); await m.waitForTimeout(800);
  await m.fill('#foTitle', 'Tema celu'); await m.fill('#foText', 'Hola'); await m.click('#foroBox form button[type=submit]'); await m.waitForTimeout(800);
  await m.evaluate(() => location.hash = '#/foro'); await m.waitForTimeout(900);
  await m.evaluate(() => { document.querySelector('.hero').dataset.marca = '1'; });
  await m.click('#foroBox .ftabs a:has-text("Temas")'); await m.waitForTimeout(700);
  await m.click('.fside .ftr'); await m.waitForTimeout(700);
  const mm = await m.evaluate(() => ({ h: location.hash, mark: document.querySelector('.hero')?.dataset.marca === '1', crumb: !!document.querySelector('.fmain .crumb')?.offsetParent }));
  ok(/^#\/foro\/t\/\d+$/.test(mm.h) && mm.mark && mm.crumb, 'Celular: Temas → abrir un tema, sin recargar la página');

  await b.close();
  ok(!errs.length, 'Errores de JS: ' + (errs.join(' | ') || 'ninguno'));
  process.exit(fails ? 1 : 0);
})();
