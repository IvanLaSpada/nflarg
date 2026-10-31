// Integración del Draft: navegación, vista completa, celular, errores y respuestas atrasadas.
// Uso: node tests/draft-ui.js (mismas dependencias que smoke.js).
const assert=require('node:assert/strict');
const {chromium,testPage,mockNetwork}=require('./_helpers');
const {fixture}=require('./draft-fixture');
const data=fixture();
(async()=>{
  const browser=await chromium.launch();
  const url=testPage(), errors=[];
  for(const width of [1280,360]){
    const page=await browser.newPage({viewport:{width,height:900}});
    page.on('pageerror',e=>errors.push(e.message));
    await mockNetwork(page);
    let slow=false,fail=false;
    await page.route(/apis\/(site\/)?v2\/sports\/football\/nfl\/(scoreboard|standings)/,async route=>{
      const u=new URL(route.request().url());
      if(slow && u.searchParams.get('limit')==='500')await new Promise(r=>setTimeout(r,500));
      if(fail)return route.fulfill({status:503,body:'Error de prueba'});
      const body=u.pathname.endsWith('/standings')?data.standings:{season:{year:2026,type:2},week:{number:8},leagues:[{season:{year:2026},logos:[],calendar:[]}],events:u.searchParams.get('dates')==='2027'?data.events.filter(e=>e.date.startsWith('2027')):data.events.filter(e=>!e.date.startsWith('2027'))};
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
    });
    await page.goto(url+'#/nfl/draft');
    await page.locator('.draft-card').first().waitFor({timeout:5000});
    assert.equal(await page.locator('.draft-card').count(),32);
    assert.equal(await page.locator('#seasonSel').isDisabled(),true);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
    assert.equal(await page.locator('.draft-card .dc-streak:visible').count(),32,'La racha no se esconde en celular');
    assert.ok((await page.locator('.draft-card[data-origin="11"]').innerText()).includes('New York Jets'));
    assert.ok((await page.locator('.draft-card[data-origin="11"]').innerText()).includes('Indianapolis Colts'));
    assert.ok(!(await page.locator('#view').innerText()).includes('ilustrativos'));
    assert.equal(await page.locator('#foroBox').count(),0);
    // El año que muestra el Draft también debe ser el que heredan sus enlaces a equipos.
    await page.goto(url+'#/nfl/partidos/2014');
    await page.locator('.tabs').waitFor();
    if(width===360)await page.locator('#burger').click();
    await page.locator('#side').getByRole('link',{name:/Draft NFL 2027/}).click();
    await page.locator('.draft-card').first().waitFor();
    await page.locator('.draft-card h2 a').first().click();
    await page.locator('.hero .chip.gold').waitFor();
    assert.ok((await page.locator('.hero .chip.gold').innerText()).includes('2026'),'Los equipos abiertos desde el Draft no heredan 2014');
    await page.goto(url+'#/nfl/draft');
    await page.locator('.draft-card').first().waitFor();
    await page.getByRole('button',{name:'Actualizar',exact:true}).click();
    await page.locator('#draftNotice').filter({hasText:'Consulta'}).waitFor();
    // Una respuesta lenta de ESPN no puede reemplazar la vista a la que navegó el usuario.
    slow=true;
    await page.getByRole('button',{name:'Actualizar',exact:true}).click();
    await page.evaluate(()=>{location.hash='#/foro';});
    await page.locator('#foroBox').waitFor();
    await page.waitForTimeout(700);
    assert.equal(await page.locator('.draft-card').count(),0);
    assert.equal(await page.locator('#seasonSel').isDisabled(),false);
    // La caché anterior no debe disfrazar una falla al solicitar una actualización explícita.
    slow=false;
    await page.goto(url+'#/nfl/draft');
    await page.locator('.draft-card').first().waitFor();
    fail=true;
    await page.getByRole('button',{name:'Actualizar',exact:true}).click();
    await page.locator('#draftNotice').filter({hasText:'No se pudo actualizar'}).waitFor();
    assert.equal(await page.locator('.draft-card').count(),32,'Una falla conserva la última consulta');
    console.log(`Draft ${width}px: 32 tarjetas, datos visibles, navegación y fallas OK`);
    fail=false;
    await page.goto(url+'#/nfl/team/12/palmares/2026');
    await page.locator('.palmares').waitFor();
    assert.equal(await page.locator('.pal-summary .pal-total b').innerText(),'6');
    assert.ok((await page.locator('.palmares').innerText()).includes('1962'));
    assert.ok((await page.locator('.palmares').innerText()).includes('2023'));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
    await page.getByRole('link',{name:'Palmarés',exact:true}).click();
    await page.locator('.palmares').waitFor();
    await page.goto(url+'#/fbs/team/12');
    await page.locator('.tabs').waitFor();
    assert.equal(await page.locator('.tabs').getByRole('link',{name:'Palmarés',exact:true}).count(),0);
    console.log(`Palmarés ${width}px: solapa NFL, temporadas y ancho OK`);
    await page.close();
  }
  assert.deepEqual(errors,[]);
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
