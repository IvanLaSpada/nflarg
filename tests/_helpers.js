// Utilidades comunes de las pruebas. Requiere: npm i -D playwright (o un Chromium de Playwright instalado).
const fs = require('fs');
const path = require('path');
const { respond } = require('./mock-espn');

let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

const ROOT = path.resolve(__dirname, '..');
const FAKE_SB = fs.readFileSync(path.join(__dirname, 'fake-supabase.js'), 'utf8');

// Copia temporal de index.html apuntando el foro a un Supabase falso (para no tocar el real)
function testPage(){
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
    .replace(/const FORO_CFG = \{url: '[^']*', key: '[^']*'\};/, "const FORO_CFG = {url: 'https://demo.supabase.co', key: 'sb_publishable_demo_key_1234567890'};");
  const out = path.join(ROOT, 'tests', '.page.html');
  fs.writeFileSync(out, html);
  return 'file://' + out;
}

// Intercepta ESPN (datos simulados), Supabase (falso) y bloquea imágenes/fuentes externas
async function mockNetwork(page){
  await page.route(/espn|espncdn|googleapis|gstatic|jsdelivr|demo\.supabase/, r => {
    const url = r.request().url();
    if (/supabase-js/.test(url)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: FAKE_SB });
    if (/espncdn|googleapis|gstatic|demo\.supabase/.test(url)) return r.abort();
    const { status = 200, body } = respond(url);
    r.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
  });
}

module.exports = { chromium, testPage, mockNetwork, ROOT };
