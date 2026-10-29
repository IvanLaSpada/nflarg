// Respuestas simuladas de la API de ESPN (misma forma que la real) para probar sin red.
// respond(url) -> {status?, body}. Simula además: UFL caída (500) y CFL vacía, para verificar que se ocultan.

const now = Date.now();
const iso = ms => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
const team = (id, ab, name, color) => ({ id: String(id), abbreviation: ab, displayName: name, shortDisplayName: name.split(' ').pop(), name: name.split(' ').pop(), location: name.split(' ').slice(0, -1).join(' '), color, alternateColor: 'ffffff', logo: `https://a.espncdn.com/i/teamlogos/nfl/500/${ab.toLowerCase()}.png`, logos: [{ href: `https://a.espncdn.com/i/teamlogos/nfl/500/${ab.toLowerCase()}.png`, rel: ['full', 'default'] }] });
const KC = team(12, 'KC', 'Kansas City Chiefs', 'e31837'), BUF = team(2, 'BUF', 'Buffalo Bills', '00338d'), DAL = team(6, 'DAL', 'Dallas Cowboys', '002a5c'), PHI = team(21, 'PHI', 'Philadelphia Eagles', '06424d'), NYG = team(19, 'NYG', 'New York Giants', '0b2265'), SF = team(25, 'SF', 'San Francisco 49ers', 'aa0000');
const NOLOGO = { id: '999', abbreviation: 'TBD', displayName: 'Mystery Team' };
const comp = (h, a, state, extra = {}) => ({
  id: extra.id, date: extra.date || iso(now), timeValid: true,
  venue: { fullName: 'Arrowhead Stadium', address: { city: 'Kansas City', state: 'MO' } },
  competitors: [
    { id: h.id, homeAway: 'home', team: h, score: state === 'pre' ? '' : extra.hs ?? '24', winner: state === 'post' ? (extra.hw ?? true) : undefined, linescores: state === 'pre' ? [] : [{ value: 7 }, { value: 10 }, { value: 0 }, { value: 7 }], records: [{ name: 'overall', type: 'total', summary: '5-1' }] },
    { id: a.id, homeAway: 'away', team: a, score: state === 'pre' ? '' : extra.as ?? '20', winner: state === 'post' ? !(extra.hw ?? true) : undefined, linescores: state === 'pre' ? [] : [{ value: 3 }, { value: 7 }, { value: 7 }, { value: 3 }], records: [{ name: 'overall', type: 'total', summary: '3-3' }] },
  ],
  status: { clock: 754, displayClock: '12:34', period: state === 'pre' ? 0 : 3, type: { id: '2', name: state === 'in' ? 'STATUS_IN_PROGRESS' : state === 'post' ? 'STATUS_FINAL' : (extra.sname || 'STATUS_SCHEDULED'), state, completed: state === 'post', description: '', detail: '', shortDetail: '' } },
  broadcasts: [{ market: 'national', names: ['CBS'] }],
  situation: state === 'in' ? { down: 2, distance: 7, downDistanceText: '2nd & 7 at KC 35', shortDownDistanceText: '2nd & 7', possession: h.id, isRedZone: false, lastPlay: { text: 'P.Mahomes pass short right to T.Kelce for 8 yards' } } : undefined,
});
const ev = (id, h, a, state, extra = {}) => ({ id: String(id), date: extra.date || iso(now), name: `${a.displayName} at ${h.displayName}`, shortName: `${a.abbreviation} @ ${h.abbreviation}`, season: { year: 2026, type: 2 }, week: { number: 6 }, competitions: [comp(h, a, state, { ...extra, id: String(id) })], status: comp(h, a, state, extra).status });
const calendar = [
  { label: 'Preseason', value: '1', entries: [{ label: 'Hall of Fame Weekend', value: '1' }, { label: 'Preseason Week 1', value: '2' }] },
  { label: 'Regular Season', value: '2', entries: Array.from({ length: 18 }, (_, i) => ({ label: `Week ${i + 1}`, value: String(i + 1), detail: 'Oct 9-13' })) },
  { label: 'Postseason', value: '3', entries: [{ label: 'Wild Card', value: '1' }, { label: 'Divisional Round', value: '2' }, { label: 'Conference Championship', value: '3' }, { label: 'Super Bowl', value: '5' }] },
  { label: 'Off Season', value: '4', entries: [] },
];
const scoreboard = (lg) => ({
  leagues: [{ id: '28', name: lg.toUpperCase(), abbreviation: lg.toUpperCase(), logos: [{ href: `https://a.espncdn.com/i/teamlogos/leagues/500/${lg}.png` }], season: { year: 2026, type: { id: '2', type: 2, name: 'Regular Season' } }, calendar }],
  season: { type: 2, year: 2026 }, week: { number: 6 },
  events: [
    ev(401, KC, BUF, 'in'),
    ev(402, DAL, PHI, 'post', { date: iso(now - 3600e3) }),
    ev(403, NYG, SF, 'pre', { date: iso(now + 2 * 3600e3) }),
    ev(404, NOLOGO, NYG, 'pre', { date: iso(now + 3 * 3600e3), sname: 'STATUS_POSTPONED' }),
  ],
});
const standings = {
  name: 'National Football League', children: [
    { name: 'American Football Conference', abbreviation: 'AFC', children: [
      { name: 'AFC West', abbreviation: 'AFCW', standings: { entries: [
        { team: KC, stats: [{ name: 'wins', value: 5, displayValue: '5' }, { name: 'losses', value: 1, displayValue: '1' }, { name: 'ties', value: 0, displayValue: '0' }, { name: 'winPercent', value: .833, displayValue: '.833' }, { name: 'pointsFor', value: 150, displayValue: '150' }, { name: 'pointsAgainst', value: 100, displayValue: '100' }, { name: 'differential', value: 50, displayValue: '+50' }, { name: 'streak', value: 3, displayValue: 'W3' }, { name: 'playoffSeed', value: 1, displayValue: '1' }, { name: 'clincher', displayValue: 'z' }] },
        { team: BUF, stats: [{ name: 'wins', value: 3, displayValue: '3' }, { name: 'losses', value: 3, displayValue: '3' }, { name: 'winPercent', value: .5, displayValue: '.500' }, { name: 'pointsFor', value: 120 }, { name: 'pointsAgainst', value: 130 }, { name: 'streak', displayValue: 'L1' }, { name: 'playoffSeed', value: 7 }] },
      ] } },
    ] },
    { name: 'National Football Conference', abbreviation: 'NFC', children: [
      { name: 'NFC East', abbreviation: 'NFCE', standings: { entries: [{ team: DAL, stats: [{ name: 'wins', value: 4, displayValue: '4' }, { name: 'losses', value: 2, displayValue: '2' }] }, { team: PHI, stats: [] }, { team: NYG, stats: null }] } },
    ] },
  ],
};
const summary = (state) => ({
  header: { id: '401', season: { year: 2026, type: 2 }, week: 6, competitions: [{ date: iso(now), competitors: [
    { id: KC.id, homeAway: 'home', team: { ...KC, logo: undefined }, score: state === 'pre' ? undefined : '24', linescores: [{ displayValue: '7' }, { displayValue: '10' }], record: [{ type: 'total', summary: '5-1' }], possession: true },
    { id: BUF.id, homeAway: 'away', team: BUF, score: state === 'pre' ? undefined : '20', linescores: [{ displayValue: '3' }, { displayValue: '7' }], record: [{ type: 'total', summary: '3-3' }] },
  ], status: { displayClock: '12:34', period: 2, type: { name: state === 'in' ? 'STATUS_IN_PROGRESS' : 'STATUS_SCHEDULED', state } }, broadcasts: [{ media: { shortName: 'NBC' } }] }] },
  situation: state === 'in' ? { downDistanceText: '1st & 10 at BUF 20', possession: KC.id, isRedZone: true, lastPlay: { text: 'Pass complete' } } : undefined,
  boxscore: state === 'pre' ? {} : {
    teams: [{ team: BUF, statistics: [{ name: 'totalYards', label: 'Total Yards', displayValue: '300' }, { name: 'possessionTime', label: 'Possession', displayValue: '28:10' }, { name: 'turnovers', label: 'Turnovers', displayValue: '2' }] },
            { team: KC, statistics: [{ name: 'totalYards', label: 'Total Yards', displayValue: '350' }, { name: 'possessionTime', label: 'Possession', displayValue: '31:50' }, { name: 'turnovers', label: 'Turnovers', displayValue: '0' }] }],
    players: [{ team: KC, statistics: [{ name: 'passing', labels: ['C/ATT', 'YDS', 'TD'], athletes: [{ athlete: { id: '3139477', displayName: 'Patrick Mahomes' }, stats: ['20/30', '250', '2'] }], totals: ['20/30', '250', '2'] }] },
              { team: BUF, statistics: [{ name: 'passing', labels: ['C/ATT', 'YDS', 'TD'], athletes: [{ athlete: { id: '3918298', displayName: 'Josh Allen' }, stats: ['18/29', '210', '1'] }] }, { name: 'rushing', labels: ['CAR', 'YDS'], athletes: [{ athlete: { id: '1', displayName: 'James Cook' }, stats: ['15', '80'] }] }] }],
  },
  leaders: [{ team: KC, leaders: [{ name: 'passingYards', displayName: 'Passing Yards', leaders: [{ displayValue: '20/30, 250 YDS, 2 TD', athlete: { id: '3139477', displayName: 'Patrick Mahomes', position: { abbreviation: 'QB' }, headshot: { href: 'https://x/y.png' } } }] }] },
            { team: BUF, leaders: [{ name: 'passingYards', leaders: [{ displayValue: '18/29, 210 YDS', athlete: { id: '3918298', displayName: 'Josh Allen' } }] }, { name: 'rushingYards', leaders: [] }] }],
  scoringPlays: state === 'pre' ? [] : [{ type: { abbreviation: 'TD' }, scoringType: { abbreviation: 'TD' }, text: 'Kelce 10 yd pass', awayScore: 0, homeScore: 7, period: { number: 1 }, clock: { displayValue: '5:00' }, team: { id: KC.id } },
                 { type: { abbreviation: 'FG' }, text: 'Bass 40 yd FG', awayScore: 3, homeScore: 7, period: { number: 2 }, clock: { displayValue: '1:00' }, team: { id: BUF.id } }],
  gameInfo: { venue: { fullName: 'Arrowhead', address: { city: 'KC', state: 'MO' } }, attendance: 73000, weather: { temperature: 60, displayValue: 'Sunny' } },
  pickcenter: [{ details: 'KC -3.5', overUnder: 47.5 }],
});
const teamsList = { sports: [{ leagues: [{ teams: [KC, BUF, DAL, PHI, NYG, SF].map(t => ({ team: t })) }] }] };
const teamDetail = { team: { ...KC, record: { items: [{ type: 'total', summary: '5-1' }] }, standingSummary: '1st in AFC West' } };
const roster = { athletes: [
  { position: 'offense', items: [{ id: '3139477', displayName: 'Patrick Mahomes', jersey: '15', position: { abbreviation: 'QB' }, age: 31, displayHeight: "6' 2\"", height: 74, displayWeight: '225 lbs', weight: 225, experience: { years: 10 }, college: { name: 'Texas Tech' }, headshot: { href: 'https://x/y.png' } }, { id: '2', displayName: 'Travis Kelce', jersey: '87', position: { abbreviation: 'TE' } }] },
  { position: 'defense', items: [{ id: '3', displayName: 'Chris Jones', jersey: '95', position: { abbreviation: 'DT' } }] },
  { position: 'specialTeam', items: [{ id: '4', displayName: 'Harrison Butker', position: { abbreviation: 'K' } }] },
], coach: [{ firstName: 'Andy', lastName: 'Reid', experience: 28 }] };
const schedule = (t) => ({ byeWeek: t === 2 ? 3 : undefined, events: t === 2 ? [1, 2, 4, 5, 6].map(w => ({ id: '50' + w, date: iso(now - (7 - w) * 7 * 864e5), week: { number: w, text: `Week ${w}` }, seasonType: { type: 2 }, competitions: [{ competitors: [
  { id: KC.id, homeAway: w % 2 ? 'home' : 'away', team: KC, score: w === 6 ? undefined : { value: 27, displayValue: '27' }, winner: w !== 6 && w !== 4, record: [{ type: 'total', summary: `${w}-0` }] },
  { id: DAL.id, homeAway: w % 2 ? 'away' : 'home', team: DAL, score: w === 6 ? undefined : { value: 20, displayValue: '20' }, winner: w === 4 }], status: { type: { state: w === 6 ? 'pre' : 'post', completed: w !== 6, name: w === 6 ? 'STATUS_SCHEDULED' : 'STATUS_FINAL' } }, broadcasts: [{ media: { shortName: 'FOX' } }] }] })) : [] });
const teamStats = { results: { stats: { categories: [{ name: 'passing', displayName: 'Passing', stats: [{ name: 'passingYards', displayName: 'Passing Yards', displayValue: '1,500', perGameDisplayValue: '250', rankDisplayValue: '5th' }] }] } } };
const leaders = { categories: [
  { name: 'passingYards', displayName: 'Passing Yards', abbreviation: 'YDS', leaders: [{ displayValue: '1,800', value: 1800, athlete: { $ref: 'http://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/athletes/3139477?lang=en' }, team: { $ref: 'http://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/teams/12?lang=en' } },
                                                                                    { displayValue: '1,700', athlete: { $ref: 'http://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/athletes/3918298' }, team: { $ref: 'http://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/teams/77' } }] },
  { name: 'sacks', displayName: 'Sacks', leaders: [{ displayValue: '8.5', athlete: { $ref: 'http://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/athletes/3' }, team: { $ref: '.../teams/12' } }] },
] };
const coreAthlete = id => ({ id, displayName: id === '3139477' ? 'Patrick Mahomes' : 'Athlete ' + id, position: { abbreviation: 'QB' }, headshot: { href: 'https://x/y.png' } });
const athlete = { athlete: { id: '3139477', displayName: 'Patrick Mahomes', jersey: '15', position: { displayName: 'Quarterback', abbreviation: 'QB' }, team: { id: '12', displayName: 'Kansas City Chiefs', abbreviation: 'KC', color: 'e31837', logos: [{ href: 'https://x/kc.png' }] }, age: 31, displayDOB: '17/9/1995', height: 74, displayHeight: "6' 2\"", weight: 225, displayWeight: '225 lbs', college: { name: 'Texas Tech' }, displayDraft: '2017: Rd 1, Pk 10 (KC)', statsSummary: { displayName: '2026 Regular Season', statistics: [{ displayName: 'Passing Yards', shortDisplayName: 'YDS', displayValue: '1,800', rankDisplayValue: '3rd' }] } } };
const athleteStats = { teams: { 12: { abbreviation: 'KC' } }, categories: [{ name: 'passing', displayName: 'Passing', labels: ['CMP', 'ATT', 'YDS'], displayNames: ['Completions', 'Attempts', 'Yards'], totals: ['3000', '4500', '35000'], statistics: [{ season: { year: 2024, displayName: '2024' }, teamId: '12', stats: ['380', '580', '3928'] }, { season: { year: 2025, displayName: '2025' }, teamId: '12', stats: ['390', '590', '4000'] }] }] };
const search = { results: [{ type: 'player', contents: [{ displayName: 'Patrick Mahomes', uid: 's:20~l:28~a:3139477', subtitle: 'Kansas City Chiefs', link: { web: 'https://www.espn.com/nfl/player/_/id/3139477/patrick-mahomes' }, image: { default: 'https://x/y.png' } }] }] };
const seasons = { items: Array.from({ length: 30 }, (_, i) => ({ $ref: `http://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/${2026 - i}?lang=en` })) };

function respond(url) {
  const u = new URL(url);
  const p = u.pathname, q = u.searchParams;
  if (/\/ufl\//.test(p) && /scoreboard/.test(p)) return { status: 500, body: {} };   // liga caída -> debe ocultarse
  if (/\/cfl\//.test(p) && /scoreboard/.test(p)) return { body: { events: [] } };       // liga vacía -> oculta
  if (/scoreboard$/.test(p)) return { body: scoreboard(p.includes('college') ? 'ncaa' : 'nfl') };
  if (/summary$/.test(p)) return { body: summary(q.get('event') === '403' ? 'pre' : 'in') };
  if (/\/standings$/.test(p)) return { body: standings };
  if (/\/teams\/\d+\/roster$/.test(p)) return { body: roster };
  if (/\/teams\/\d+\/schedule$/.test(p)) return { body: schedule(+q.get('seasontype')) };
  if (/\/teams\/\d+\/statistics$/.test(p)) return { body: teamStats };
  if (/site\/v2.*\/teams\/\d+$/.test(p)) return { body: teamDetail };
  if (/site\/v2.*\/teams$/.test(p)) return { body: teamsList };
  if (/\/leaders$/.test(p)) return p.includes('groups') ? { status: 404, body: {} } : { body: leaders };
  if (/\/seasons$/.test(p)) return { body: seasons };
  if (u.host.startsWith("sports.core") && /\/athletes\/(\d+)$/.test(p)) return { body: coreAthlete(p.match(/athletes\/(\d+)/)[1]) };
  if (u.host.startsWith("sports.core") && /\/teams\/(\d+)$/.test(p)) return { body: { id: p.match(/teams\/(\d+)/)[1], abbreviation: 'OTH', displayName: 'Other Team' } };
  if (/common\/v3.*\/athletes\/\d+\/stats$/.test(p)) return { body: athleteStats };
  if (/common\/v3.*\/athletes\/\d+$/.test(p)) return { body: athlete };
  if (/search\/v2/.test(p)) return { body: search };
  return { status: 404, body: {} };
}


module.exports = { respond };
