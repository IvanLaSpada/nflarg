// Uso: node tests/draft.js. Reglas del Draft y datos faltantes; sin navegador ni red.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {teams,event,entry,fixture}=require('./draft-fixture');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const source=html.match(/<script>([\s\S]*)<\/script>/)[1].replace(/\binit\(\);\s*$/,'');
const storage={getItem(){return null;},setItem(){}};
const ctx=vm.createContext({window:{},document:{title:'NFLARG'},localStorage:storage,sessionStorage:storage,console,URL,setTimeout,clearTimeout});
vm.runInContext(source,ctx);
assert.equal(vm.runInContext('typeof draftModel',ctx),'function','Falta el cálculo del Draft');
const {draftModel,draftCard}=vm.runInContext('({draftModel,draftCard})',ctx);
const team=id=>teams.find(t=>t.id===String(id));
const group=entries=>[{name:'AFC East',parent:'AFC',entries}];
const byId=(m,id)=>m.rows.find(r=>r.origin.id===String(id));
const toPlain=v=>JSON.parse(JSON.stringify(v));

// Una victoria y dos empates en seis juegos valen .333; no equivalen a una victoria sola.
let m=draftModel(group([entry(team(24),1,3,2,16),entry(team(10),1,4,0,15)]),[],2026);
assert.equal(m.rows[0].origin.id,'10');
assert.equal(byId(m,24).pct,1/3);

// SOS pondera todos los partidos de los rivales, incluidas las repeticiones divisionales.
const a=team(24),b=team(10),c=team(15),d=team(20);
const entries=[entry(a,1,2,0,16),entry(b,4,2,0,15),entry(c,0,1,0,14),entry(d,2,2,0,13)];
const games=[event('ab',a,b),event('ab2',a,b,10,20),event('ac',a,c),event('ad',a,d,0,0,'pre',10)];
m=draftModel(group(entries),games,2026);
assert.equal(byId(m,24).sos,8/13);
assert.equal(byId(m,24).remainingSos,.5);
assert.equal(byId(m,24).next.opponent.id,'20');

// Nunca contar pretemporada, otra temporada ni una versión vieja duplicada de un partido.
m=draftModel(group(entries),[...games,event('ab',a,b,0,0,'pre'),event('other',a,c,1,0,'post',1,1),event('year',a,c,1,0,'post',1,2,2025),null,{}],2026);
assert.equal(byId(m,24).sos,8/13);
assert.equal(m.regular.length,4);

// La situación en vivo no agrega una victoria y se mantiene como próximo partido.
m=draftModel(group(entries),[event('live',a,b,40,0,'in',8),event('future',a,c,0,0,'pre',9)],2026);
assert.equal(byId(m,24).wins,1);
assert.equal(byId(m,24).sos,null);
assert.equal(byId(m,24).next.state,'in');

// Mismo récord: el calendario más fácil elige antes, sin redondear .5004 a .500.
m=draftModel(group([entry(a,1,5,0,16),entry(b,1,5,0,15),entry(c,1,4,0,14),entry(d,4,1,0,13)]),[event('ac',a,c),event('bd',b,d)],2026);
assert.ok(byId(m,24).pickStart<byId(m,10).pickStart);

// Una igualdad que los datos no resuelven se muestra como rango; el ID no decide un pick.
const tied=[{name:'AFC East',parent:'AFC',entries:[entry(a,1,5,0,16)]},{name:'NFC East',parent:'NFC',entries:[entry(b,1,5,0,16)]}];
m=draftModel(tied,[],2026);
assert.deepEqual(toPlain(m.rows.map(r=>[r.pickStart,r.pickEnd])),[[1,2],[1,2]]);

// Registros ausentes no se inventan como 0-0.
m=draftModel(group([{team:a,stats:null},null,entry(b,1,5,0,15)]),[null],2026);
assert.equal(byId(m,24).pct,null);
assert.equal(byId(m,24).record,'Sin datos');
assert.equal(byId(m,24).pickStart,null);
assert.doesNotThrow(()=>draftModel(null,null,2026));

// Dallas entrega a Jets el mejor pick entre el propio y el que recibió de Green Bay.
const dal=team(6),gb=team(9),nyj=team(20),ind=team(11),lar=team(14),cle=team(5),chi=team(3),ten=team(10);
const transferEntries=[entry(dal,2,5,0,12),entry(gb,5,2,0,6),entry(nyj,2,5,0,11),entry(ind,3,4,0,10),entry(lar,3,4,0,9),entry(cle,5,2,0,3),entry(chi,5,2,0,5),entry(ten,1,6,0,15)];
m=draftModel(group(transferEntries),[],2026);
assert.equal(byId(m,6).owner.id,'20');
assert.equal(byId(m,9).owner.id,'6');
assert.equal(byId(m,11).owner.id,'20');
assert.equal(byId(m,14).owner.id,'5');
assert.equal(byId(m,3).owner.id,'10');
assert.equal(byId(m,6).record,'2–5');
transferEntries[0]=entry(dal,4,3,0,9);transferEntries[1]=entry(gb,1,6,0,16);
m=draftModel(group(transferEntries),[],2026);
assert.equal(byId(m,9).owner.id,'20');
assert.equal(byId(m,6).owner.id,'6');
transferEntries[0]=entry(dal,6,1,0,2);transferEntries[1]=entry(gb,5,2,0,6);
m=draftModel(group(transferEntries),[],2026);
assert.equal(byId(m,9).owner,null,'Dos equipos aún en playoffs no tienen orden final conocido');
assert.deepEqual(toPlain(byId(m,9).candidates.map(t=>t.id)).sort(),['20','6']);

// Calendario completo incluye enero y separa 18 elecciones de 14 puestos de playoffs.
const full=fixture();m=draftModel(full.groups,full.events,2026);
assert.equal(m.regular.length,272);
assert.equal(m.calendarComplete,true);
assert.equal(m.rows.filter(r=>r.playoff).length,14);
assert.equal(m.rows.filter(r=>!r.playoff).length,18);
assert.ok(m.rows.filter(r=>r.playoff).every(r=>r.pickStart===null));
assert.equal(m.rows.filter(r=>r.origin.id==='24').length,1);
const badSeed=JSON.parse(JSON.stringify(full.groups));
badSeed[0].entries[0].stats.find(s=>s.name==='playoffSeed').value=99;
assert.equal(draftModel(badSeed,full.events,2026).seedsComplete,false,'Un seed fuera de 1–16 no valida la clasificación');

// Escape de todo nombre externo y separación del origen/propietario.
const transferred=byId(m,11);
const remainingTie=draftCard({...transferred,remainingSos:.5},{remainingRanks:[{origin:{id:'2'},remainingSos:.5},{origin:transferred.origin,remainingSos:.5}]});
assert.match(remainingTie,/<em>1\.º<\/em>/,'Dos calendarios restantes iguales comparten el mismo ranking');
const card=draftCard(transferred,{season:2026,year:2027,baseline:null});
assert.match(card,/New York Jets/);
assert.match(card,/Indianapolis Colts/);
const attack={...transferred,owner:{...transferred.owner,displayName:'<img src=x onerror=alert(1)>'}};
assert.ok(draftCard(attack,{season:2026,year:2027}).includes('&lt;img'));
assert.ok(!draftCard(attack,{season:2026,year:2027}).includes('<img src=x'));
assert.doesNotThrow(()=>draftCard({...transferred,next:null,sos:null,remainingSos:null,streak:null},{season:2026,year:2027}));

// La postemporada terminada sí permite asignar 31 al subcampeón y 32 al campeón.
const post=(id,w,l,week)=>event(id,team(w),team(l),24,10,'post',week,3);
const playoffs=[post('p1',17,4,1),post('p2',20,23,1),post('p3',15,5,1),post('p4',6,8,1),post('p5',21,3,1),post('p6',28,16,1),post('p7',2,15,2),post('p8',17,20,2),post('p9',19,28,2),post('p10',6,21,2),post('p11',2,17,3),post('p12',19,6,3),post('p13',2,19,5)];
m=draftModel(full.groups,[...full.events,...playoffs],2026);
assert.equal(byId(m,2).pickStart,32);
assert.equal(byId(m,19).pickStart,31);
assert.ok(m.rows.filter(r=>r.playoff).every(r=>r.pickStart>=19&&r.pickEnd<=32));

// Regresiones detectadas por la revisión independiente: cada caso comprueba el resultado visible.
const reviewCases=[
  ['El seed protegido de un campeón divisional no decide el desempate del Draft',()=>{
    const buf=team(2),kc=team(12),bal=team(33);
    const afc=[entry(buf,3,3,0,3),entry(kc,3,3,0,5),entry(team(10),1,5,0,7),entry(bal,5,5,0,16),entry(team(20),4,2,0,1),entry(team(30),4,2,0,2),entry(team(15),4,2,0,4)];
    const nfc=[entry(team(6),1,5,0,3),entry(team(9),5,1,0,5),entry(team(3),5,1,0,7),entry(team(19),4,2,0,1),entry(team(21),4,2,0,2),entry(team(8),4,2,0,4)];
    const regular=[event('head',kc,buf,21,10)];
    for(let i=0;i<5;i++){regular.push(event('buf'+i,buf,bal,i<3?21:10,17));regular.push(event('kc'+i,kc,bal,i<2?21:10,17));}
    const postGames=[post('r1',20,2,1),post('r2',30,12,1),post('r3',15,10,1),post('r4',19,6,1),post('r5',21,9,1),post('r6',8,3,1)];
    const x=draftModel([{name:'AFC',parent:'AFC',entries:afc},{name:'NFC',parent:'NFC',entries:nfc}],[...regular,...postGames],2026);
    assert.equal(byId(x,2).pickStart,21);
    assert.equal(byId(x,12).pickStart,22);
  }],
  ['Un avance de ronda ya resuelve el mejor pick condicional DAL/GB',()=>{
    const f=fixture();
    f.groups.flatMap(g=>g.entries).find(e=>e.team.id==='9').stats.find(s=>s.name==='playoffSeed').value=7;
    f.groups.flatMap(g=>g.entries).find(e=>e.team.id==='8').stats.find(s=>s.name==='playoffSeed').value=8;
    const x=draftModel(f.groups,[...f.events,post('wc-gb',9,6,1)],2026);
    assert.equal(x.calendarComplete,true);assert.equal(x.playedComplete,true);assert.equal(x.seedsComplete,true);
    assert.equal(byId(x,6).owner?.id,'20');
    assert.equal(byId(x,9).owner?.id,'6');
  }],
  ['El Draft fija su temporada al salir de una vista histórica',()=>{
    ctx.location={hash:'#/nfl/draft'};
    assert.equal(vm.runInContext('parseHash().season',ctx),2026);
  }],
];
const failures=[];
for(const [name,run] of reviewCases){try{run();}catch(e){failures.push(name+': '+e.message);}}
assert.deepEqual(failures,[],'Regresiones de la revisión: '+failures.join('\n'));

console.log('Draft: récords, empates, SOS, calendario, playoffs, transferencias y escape OK');
