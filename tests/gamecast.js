// Comprueba la orientación de la cancha y los cambios de posesión con jugadas reales simplificadas.
// Uso: node tests/gamecast.js (no necesita navegador ni red).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const source = html.match(/<script>([\s\S]*)<\/script>/)[1].replace(/\binit\(\);\s*$/, '');
const storage = {getItem(){ return null; }, setItem(){}};
const ctx = vm.createContext({window: {}, document: {title: 'NFLARG'}, localStorage: storage, sessionStorage: storage, console, URL, setTimeout, clearTimeout});
vm.runInContext(source, ctx);
assert.equal(vm.runInContext('typeof gamecastModel', ctx), 'function', 'Falta el modelo de la cancha');
const {gamecastYard, gamecastModel, gamecastHTML} = vm.runInContext('({gamecastYard, gamecastModel, gamecastHTML})', ctx);
const g = {id: '401873023', lg: 'nfl', state: 'in', period: 2, clock: '9:19', away: {id: '29', team: {id: '29', abbreviation: 'CAR', displayName: 'Carolina Panthers', color: '0085ca'}}, home: {id: '9', team: {id: '9', abbreviation: 'GB', displayName: 'Green Bay Packers', color: '204e32'}}};
for(const [pos, want] of [
  [{possessionText: 'CAR 20', team: {id: '29'}, yardsToEndzone: 80}, 20],
  [{possessionText: 'GB 20', team: {id: '9'}, yardsToEndzone: 80}, 80],
  [{possessionText: 'GB 10', team: {id: '9'}, yardsToEndzone: 0}, 90],
  [{team: {id: '29'}, yardsToEndzone: 15}, 85],
  [{team: {id: '9'}, yardsToEndzone: 15}, 15],
  [{yardLine: 74}, 26],
  [{}, null],
  [{yardLine: null, yardsToEndzone: null}, null],
]) assert.equal(gamecastYard(pos, g), want, JSON.stringify(pos));
const pass = {id: 'p1', sequenceNumber: '100', type: {text: 'Pass Reception'}, statYardage: 53, start: {possessionText: 'GB 21', team: {id: '9'}, down: 1, distance: 10}, end: {possessionText: 'CAR 26', team: {id: '9'}, down: 1, distance: 10}, participants: [{type: 'passer', athlete: {shortName: 'J. Love'}}, {type: 'receiver', athlete: {shortName: 'C. Watson'}}]};
const timeout = {id: 'p2', sequenceNumber: '200', type: {text: 'Official Timeout'}, start: {yardLine: 74}, end: {yardLine: 74}};
let m = gamecastModel({drives: {previous: [{team: {id: '9'}, plays: [pass]}], current: {team: {id: '9'}, plays: [pass, timeout]}}}, g);
assert.equal(m.play.id, 'p1', 'Un tiempo muerto no reemplaza la última jugada');
assert.equal(m.from, 79);
assert.equal(m.to, 26);
assert.equal(m.firstDown, 16, 'Packers avanza hacia el extremo izquierdo');
assert.match(m.summary, /Love.*Watson.*53/);
const earlier = {...pass, id: '4018730231411', statYardage: 3, start: {possessionText: 'GB 18', team: {id: '9'}}, end: {possessionText: 'GB 21', team: {id: '9'}, down: 1, distance: 10}};
const latest = {...pass, id: '4018730231436'};
const newest = gamecastModel({situation: {lastPlay: latest}, drives: {previous: [{plays: [earlier]}]}}, g);
assert.equal(newest.play.id, latest.id, 'La última jugada más nueva tiene prioridad aunque el historial siga atrasado');
assert.equal(newest.to, 26);
const withNames = gamecastModel({drives: {current: {plays: [pass]}}}, g);
const withoutNames = gamecastModel({drives: {current: {plays: [{...pass, participants: []}]}}}, g);
assert.notEqual(withNames.signature, withoutNames.signature, 'La descripción y el retrato se actualizan si ESPN completa los participantes');
assert.equal(withNames.key, withoutNames.key, 'Completar los datos de la misma jugada no vuelve a disparar la animación');
const punt = {id: 'punt', type: {text: 'Punt'}, text: 'S.Martin punts 52 yards to GB 10, fair catch by C.Owen.', start: {possessionText: 'CAR 38', team: {id: '29'}, down: 4, distance: 9}, end: {possessionText: 'GB 10', team: {id: '9'}, down: 1, distance: 10}};
m = gamecastModel({drives: {current: {team: {id: '29'}, plays: [punt]}}}, g);
assert.equal(m.from, 38);
assert.equal(m.to, 90);
assert.equal(m.possession, '9');
assert.equal(m.firstDown, 80, 'Tras el punt, el primer down corresponde al equipo receptor');
assert.equal(m.pathKind, 'arc');
assert.match(m.summary, /52.*recepción libre/i);
const injured = {...pass, participants: [{type: 'receiver', athlete: {shortName: '<img src=x onerror=alert(1)>'}}]};
const markup = gamecastHTML({drives: {current: {team: {id: '9'}, plays: [injured]}}}, g, false);
assert.ok(markup.includes('&lt;img'), 'Se escapan los nombres externos');
assert.ok(!markup.includes('<img src=x'), 'Un nombre nunca se interpreta como HTML');
assert.doesNotThrow(() => gamecastHTML({drives: null}, g, false));
assert.doesNotThrow(() => gamecastHTML({drives: {previous: [null, {}], current: {plays: [null, {}]}}}, g, false));
console.log('Gamecast: orientación, punt con cambio de posesión, tiempos muertos, datos faltantes y HTML externo: OK');
