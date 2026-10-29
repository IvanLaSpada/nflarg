// Prueba del foro con el Supabase falso: registro, muro, emojis, likes, temas, citas, notificaciones,
// rankings, perfil, login con usuario/mail y duplicados. Uso: node tests/foro.js
const { chromium, testPage, mockNetwork } = require('./_helpers');

(async () => {
  const url = testPage();
  const b = await chromium.launch(); const errs = []; let fails = 0;
  const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  p.on('pageerror', e => errs.push(e.message)); await mockNetwork(p);
  const nav = async h => { await p.evaluate(h => location.hash = h, h); await p.waitForTimeout(800); };
  const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) fails++; };
  const reg = async (u, team, mail) => { await nav('#/foro/registro'); await p.fill('#foUser', u); if (mail) await p.fill('#foMail', mail); await p.fill('#foPass', 'secreto1'); await p.fill('#foPass2', 'secreto1'); if (team) await p.selectOption('#foTeam', team); await p.click('form button[type=submit]'); await p.waitForTimeout(900); };
  const out = async () => { await p.click('.fbar button:has-text("Salir")'); await p.waitForTimeout(500); };
  const msg = () => p.$eval('#foMsg', e => e.textContent);

  await p.goto(url + '#/foro'); await p.waitForTimeout(1200);
  ok((await p.$$eval('#foroBox .ftabs a', x => x.length)) === 3, 'Foro General con 3 solapas (Mensajes, Temas, Rankings)');
  await reg('ivan_ls', '12');
  ok((await p.$eval('.fbar', e => e.innerText)).includes('ivan_ls'), 'Registro sin mail y sesión iniciada');
  await nav('#/foro'); await p.click('button:has-text("Emojis")'); await p.click('.emo button:has-text("🏈")');
  await p.type('#foText', ' hola <b>x</b> https://nfl.com'); await p.click('#foroBox form button[type=submit]'); await p.waitForTimeout(800);
  const html = await p.$eval('.fpost .tx', e => e.innerHTML);
  ok(html.includes('🏈') && html.includes('&lt;b&gt;') && html.includes('href="https://nfl.com"'), 'Mensaje con emoji, HTML escapado y link');
  await p.click('.fpost .rx.up'); await p.waitForTimeout(500);
  ok((await p.$eval('.fpost .rx.up', e => e.className)).includes('on'), 'Like marcado');
  await nav('#/nfl/team/12/foro/nuevo'); await p.fill('#foTitle', 'Tema de prueba'); await p.fill('#foText', 'Primer mensaje'); await p.click('form button[type=submit]'); await p.waitForTimeout(900);
  ok(/#\/nfl\/team\/12\/foro\/t\/\d+/.test(await p.evaluate(() => location.hash)), 'Tema creado en el foro de la franquicia');
  await out();
  await reg('otro_user', '6', 'otro@test.com');
  await nav('#/nfl/team/12/foro/t/1'); await p.click('.rx:has-text("Citar")');
  ok((await p.$eval('#foText', e => e.value)).startsWith('[quote=ivan_ls]'), 'Citar inserta [quote=…]');
  await p.type('#foText', 'respuesta'); await p.click('form button[type=submit]'); await p.waitForTimeout(900);
  ok((await p.$$eval('.fq', x => x.length)) >= 1, 'La cita se ve como recuadro');
  await out();
  await nav('#/foro/entrar'); await p.fill('#foLogin', 'IVAN_LS'); await p.fill('#foPass', 'mala12'); await p.click('form button[type=submit]'); await p.waitForTimeout(400);
  ok((await msg()).includes('incorrectos'), 'Contraseña incorrecta rechazada');
  await p.fill('#foPass', 'secreto1'); await p.click('form button[type=submit]'); await p.waitForTimeout(1200);
  ok((await p.$eval('#nbadge', e => e.hidden ? '0' : e.textContent)) === '1', 'Login con usuario y 1 notificación (respuesta + cita = 1)');
  await out();
  await nav('#/foro/entrar'); await p.fill('#foLogin', 'otro@test.com'); await p.fill('#foPass', 'secreto1'); await p.click('form button[type=submit]'); await p.waitForTimeout(900);
  ok((await p.$eval('.fbar', e => e.innerText)).includes('otro_user'), 'Login con mail');
  await out();
  await nav('#/foro/registro'); await p.fill('#foUser', 'Ivan_LS'); await p.fill('#foPass', 'xxxxxx'); await p.fill('#foPass2', 'xxxxxx'); await p.click('form button[type=submit]'); await p.waitForTimeout(400);
  ok((await msg()).includes('en uso'), 'Usuario repetido rechazado');
  await nav('#/foro/rankings');
  ok((await p.$eval('.tbl.rk tbody tr', e => e.innerText)).includes('1'), 'Ranking por equipo');
  await nav('#/foro/rankings/actividad');
  ok((await p.$$eval('.tbl.rk', x => x.length)) === 2, 'Ranking por actividad (equipos y usuarios)');
  console.log('\nErrores de JS:', errs.length ? errs.join('\n') : 'ninguno');
  await b.close();
  process.exit(fails || errs.length ? 1 : 0);
})();
