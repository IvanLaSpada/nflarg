// Datos REALES de ESPN para el navegador de pruebas: cada pedido a ESPN se baja con curl (el CDN de ESPN rechaza
// al Chromium automático) y se le entrega a la página. El foro usa el Supabase falso: nunca toca el foro real.
const fs = require('fs'); const { execFileSync } = require('child_process');
const FAKE = fs.readFileSync(require('path').join(__dirname, 'fake-supabase.js'), 'utf8');
const cache = new Map();
module.exports = async function realNetwork(page){
  await page.route(/supabase-js|demo\.supabase|fonts\.g/, r => /supabase-js/.test(r.request().url()) ? r.fulfill({ status: 200, contentType: 'application/javascript', body: FAKE }) : r.abort());
  await page.route(/espn\.com|espncdn\.com|thesportsdb\.com/, r => {
    const url = r.request().url();
    if (/espncdn|r2\.thesportsdb/.test(url)) return r.abort();   // imágenes: no hacen falta para probar
    let out = cache.get(url);
    if (!out) {
      try { out = execFileSync('curl', ['-sS', '-m', '20', '-w', '\n%{http_code}', url], { maxBuffer: 64 << 20 }).toString(); }
      catch (e) { out = '\n000'; }
      cache.set(url, out);
    }
    const i = out.lastIndexOf('\n'); const status = +out.slice(i + 1) || 502;
    r.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: out.slice(0, i) });
  });
};
