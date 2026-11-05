// Imágenes en el foro y foro en dos columnas (muro a la izquierda, temas a la derecha), con el Supabase falso.
// Uso: node tests/foro-imagenes.js   ·   Capturas en tests/.capturas/
const fs = require('fs');
const path = require('path');
const { chromium, testPage, mockNetwork, ROOT } = require('./_helpers');
const CAP = path.join(ROOT, 'tests', '.capturas'); fs.mkdirSync(CAP, { recursive: true });

(async () => {
  const url = testPage(); const b = await chromium.launch(); const errs = []; let fails = 0;
  const ok = (c, m) => { console.log((c ? '✔ ' : '✘ ') + m); if (!c) fails++; };
  // Una imagen grande de prueba (1600×1200) generada con canvas
  const gen = await b.newPage();
  const big = Buffer.from(await gen.evaluate(() => { const c = document.createElement('canvas'); c.width = 1600; c.height = 1200; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 1600, 1200); g.addColorStop(0, '#0a1f44'); g.addColorStop(1, '#c8102e'); x.fillStyle = g; x.fillRect(0, 0, 1600, 1200);
    x.fillStyle = '#fff'; x.font = 'bold 200px Arial'; x.fillText('NFLARG', 380, 680); return c.toDataURL('image/png').split(',')[1]; }), 'base64');
  await gen.close();
  const IMG = path.join(CAP, 'prueba-1600.png'); fs.writeFileSync(IMG, big);
  const serveImgs = pg => pg.route(/demo\.supabase\.co\/storage\/v1\/object\/public\/foro-imagenes\//, r => r.fulfill({ status: 200, contentType: 'image/png', body: big }));

  const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  p.on('pageerror', e => errs.push(e.message)); await mockNetwork(p); await serveImgs(p);
  const nav = async h => { await p.evaluate(h => location.hash = h, h); await p.waitForTimeout(800); };

  await p.goto(url + '#/foro/registro'); await p.waitForTimeout(1200);
  await p.fill('#foUser', 'fotero'); await p.fill('#foPass', 'secreto1'); await p.fill('#foPass2', 'secreto1'); await p.selectOption('#foTeam', '12');
  await p.click('form button[type=submit]'); await p.waitForTimeout(900);

  // Temas para la columna derecha
  for (let i = 1; i <= 7; i++) { await nav('#/foro/nuevo'); await p.fill('#foTitle', 'Tema número ' + i); await p.fill('#foText', 'Mensaje ' + i); await p.click('#foroBox form button[type=submit]'); await p.waitForTimeout(500); }
  await nav('#/foro');
  const cols = await p.evaluate(() => { const m = document.querySelector('.fmain').getBoundingClientRect(), s = document.querySelector('.fside').getBoundingClientRect(); return { mx: m.left, sx: s.left, mw: m.width, sw: s.width, top: Math.abs(m.top - s.top) }; });
  ok(cols.sx > cols.mx + cols.mw - 2 && cols.top < 4, `Compu: muro a la izquierda (${Math.round(cols.mw)} px) y temas a la derecha (${Math.round(cols.sw)} px)`);
  const titles = await p.$$eval('.fside .ftr b', x => x.map(e => e.textContent));
  ok(titles.length === 7 && titles.includes('Tema número 7'), 'La columna de temas lista los 7 temas');

  // Subir una imagen con el botón
  await p.setInputFiles('#foImg', IMG);
  await p.waitForFunction(() => /\[img\]/.test(document.querySelector('#foText').value), null, { timeout: 5000 });
  const up = await p.evaluate(() => window.__lastUpload);
  ok(up && up.type === 'image/jpeg' && /^0{8}-0{4}-4000-8000-\d{12}\/[a-z0-9]+-[a-z0-9]+\.jpg$/.test(up.path) && up.size < 1048576, `Se achica a JPEG y se sube a la carpeta del usuario (${up && Math.round(up.size / 1024)} KB)`);
  const val = await p.$eval('#foText', e => e.value);
  ok(/^\[img\]https:\/\/demo\.supabase\.co\/storage\/v1\/object\/public\/foro-imagenes\/.+\[\/img\]\n$/.test(val), 'El cuadro de texto recibe la etiqueta [img]');
  await p.type('#foText', 'Miren esto'); await p.click('#foroBox form button[type=submit]'); await p.waitForTimeout(900);
  const img = await p.$('.fpost .tx img.fimg');
  ok(!!img, 'El mensaje muestra la imagen');
  await p.waitForFunction(() => { const i = document.querySelector('.fpost .tx img.fimg'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 5000 });
  const box = await img.boundingBox(); const txw = await p.$eval('.fpost .tx', e => e.clientWidth);
  ok(box.height <= 321 && box.width <= Math.min(420, txw) + 1, `La imagen queda chica: ${Math.round(box.width)}×${Math.round(box.height)} px (máx. 420×320 y el ancho del texto)`);
  await p.screenshot({ path: path.join(CAP, 'foro-2col-1280.png') });
  await img.click(); await p.waitForTimeout(300);
  ok(!!(await p.$('.flbx img')), 'Tocar la imagen la abre grande');
  await p.screenshot({ path: path.join(CAP, 'foro-imagen-grande.png') });
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  ok(!(await p.$('.flbx')), 'Esc la cierra');

  // Seguridad: no se muestran imágenes de otros sitios ni HTML (se espera el antispam de 10 s)
  await p.waitForTimeout(10500);
  await p.fill('#foText', '[img]https://malo.example.com/x.jpg[/img] [img]javascript:alert(1)[/img] <img src=x onerror=alert(1)>');
  await p.click('#foroBox form button[type=submit]'); await p.waitForTimeout(900);
  const last = await p.$eval('.fpost .tx', e => ({ imgs: e.querySelectorAll('img').length, html: e.innerHTML }));
  ok(last.imgs === 0 && /&lt;img/.test(last.html), 'Imágenes de otros sitios y HTML quedan como texto');

  // Citar un mensaje con imagen la reemplaza por "(imagen)"
  const posts = await p.$$('.fpost');
  await posts[1].$eval('.rx:nth-child(3)', e => e.click());
  ok(/\[quote=fotero\]\(imagen\)\s*Miren esto\[\/quote\]/.test(await p.$eval('#foText', e => e.value)), 'Citar reemplaza la imagen por "(imagen)"');
  await p.fill('#foText', '');

  // Tema abierto: el tema queda a la izquierda y el actual resaltado a la derecha
  await nav('#/foro/t/3');
  ok((await p.$eval('.fside .ftr.on b', e => e.textContent)) === 'Tema número 3' && !!(await p.$('.fmain .crumb')), 'Con un tema abierto, se resalta en la lista de la derecha');

  // Embebido en el Home
  await nav('#/hoy');
  await p.waitForSelector('#foroBox .fgrid', { timeout: 8000 });
  ok(!!(await p.$('#foroBox .fgrid .fside .ftr')), 'Home: el Foro General también va en dos columnas');
  await (await p.$('#foroSec')).scrollIntoViewIfNeeded(); await p.screenshot({ path: path.join(CAP, 'foro-home-1280.png') });

  // Celular: una columna, temas primero y solo 5 hasta tocar "Ver todos"
  const ctx2 = await b.newContext({ viewport: { width: 360, height: 800 } });
  const m = await ctx2.newPage(); m.on('pageerror', e => errs.push(e.message)); await mockNetwork(m); await serveImgs(m);
  await m.goto(url + '#/foro/registro'); await m.waitForTimeout(1200);
  await m.fill('#foUser', 'celu'); await m.fill('#foPass', 'secreto1'); await m.fill('#foPass2', 'secreto1'); await m.click('form button[type=submit]'); await m.waitForTimeout(900);
  for (let i = 1; i <= 7; i++) { await m.evaluate(() => location.hash = '#/foro/nuevo'); await m.waitForTimeout(600); await m.fill('#foTitle', 'Tema celu ' + i); await m.fill('#foText', 'Hola ' + i); await m.click('#foroBox form button[type=submit]'); await m.waitForTimeout(500); }
  await m.evaluate(() => location.hash = '#/foro'); await m.waitForTimeout(900);
  await m.setInputFiles('#foImg', IMG); await m.waitForFunction(() => /\[img\]/.test(document.querySelector('#foText').value), null, { timeout: 5000 });
  await m.type('#foText', 'Desde el celu'); await m.click('#foroBox form button[type=submit]'); await m.waitForTimeout(900);
  await m.waitForFunction(() => { const i = document.querySelector('.fpost .tx img.fimg'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 5000 });
  const lay = await m.evaluate(() => { const s = document.querySelector('.fside').getBoundingClientRect(), mm = document.querySelector('.fmain').getBoundingClientRect();
    return { sideFirst: s.top < mm.top, vis: [...document.querySelectorAll('.fside .ftr')].filter(e => e.offsetParent).length, more: !!document.querySelector('.ftmore').offsetParent, sw: document.documentElement.scrollWidth,
      img: document.querySelector('.fpost .tx img.fimg').getBoundingClientRect().width }; });
  ok(lay.sideFirst && lay.vis === 5 && lay.more, `Celular: los temas van primero, se ven 5 y está "Ver todos los temas"`);
  ok(lay.sw <= 360 && lay.img <= 330, `Celular: sin scroll horizontal y la imagen entra (${Math.round(lay.img)} px)`);
  await m.screenshot({ path: path.join(CAP, 'foro-360.png'), fullPage: true });
  await m.click('.ftmore'); await m.waitForTimeout(200);
  ok((await m.$$eval('.fside .ftr', x => x.filter(e => e.offsetParent).length)) === 7, 'Celular: "Ver todos los temas" muestra el resto');

  await b.close();
  fs.unlinkSync(IMG);
  ok(!errs.length, 'Errores de JS: ' + (errs.join(' | ') || 'ninguno'));
  process.exit(fails ? 1 : 0);
})();
