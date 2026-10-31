// Calendario controlado de 32 equipos y 272 partidos para probar el Draft sin red.
const names = [
  ['2','BUF','Buffalo Bills'],['17','NE','New England Patriots'],['20','NYJ','New York Jets'],['15','MIA','Miami Dolphins'],
  ['5','CLE','Cleveland Browns'],['23','PIT','Pittsburgh Steelers'],['4','CIN','Cincinnati Bengals'],['33','BAL','Baltimore Ravens'],
  ['30','JAX','Jacksonville Jaguars'],['11','IND','Indianapolis Colts'],['34','HOU','Houston Texans'],['10','TEN','Tennessee Titans'],
  ['12','KC','Kansas City Chiefs'],['7','DEN','Denver Broncos'],['13','LV','Las Vegas Raiders'],['24','LAC','Los Angeles Chargers'],
  ['19','NYG','New York Giants'],['6','DAL','Dallas Cowboys'],['21','PHI','Philadelphia Eagles'],['28','WSH','Washington Commanders'],
  ['16','MIN','Minnesota Vikings'],['3','CHI','Chicago Bears'],['8','DET','Detroit Lions'],['9','GB','Green Bay Packers'],
  ['29','CAR','Carolina Panthers'],['1','ATL','Atlanta Falcons'],['27','TB','Tampa Bay Buccaneers'],['18','NO','New Orleans Saints'],
  ['25','SF','San Francisco 49ers'],['26','SEA','Seattle Seahawks'],['14','LAR','Los Angeles Rams'],['22','ARI','Arizona Cardinals'],
];
const teams = names.map(([id,abbreviation,displayName])=>({id,abbreviation,displayName,color:'13306b',logo:`https://a.espncdn.com/i/teamlogos/nfl/500/${abbreviation.toLowerCase()}.png`}));
function event(id, home, away, hs=21, as=14, state='post', week=1, type=2, year=2026){
  const status = {type:{state,completed:state==='post',name:state==='post'?'STATUS_FINAL':'STATUS_SCHEDULED'}};
  const date = week===18 ? '2027-01-03T18:00:00Z' : new Date(Date.UTC(2026,8,10+(week-1)*7,18)).toISOString();
  return {id:String(id),season:{year,type},week:{number:week},date,status,competitions:[{date,status,competitors:[{homeAway:'home',team:home,score:String(hs)},{homeAway:'away',team:away,score:String(as)}]}]};
}
function entry(team,wins,losses,ties=0,seed=8){
  return {team,stats:Object.entries({wins,losses,ties,playoffSeed:seed}).map(([name,value])=>({name,value,displayValue:String(value)}))};
}
function fixture(){
  const events=[], slots=teams.slice(), records=Object.fromEntries(teams.map(t=>[t.id,{w:0,l:0}]));
  for(let round=0;round<17;round++){
    for(let i=0;i<16;i++){
      const home=slots[i],away=slots[31-i],hs=(round+i)%3?24:10,as=17;
      events.push(event(round*16+i+1,home,away,hs,as,round<7?'post':'pre',round===16?18:round+1));
      if(round<7){records[home.id][hs>as?'w':'l']++;records[away.id][hs>as?'l':'w']++;}
    }
    slots.splice(1,0,slots.pop());
  }
  const groups=[];
  for(let i=0;i<8;i++)groups.push({name:(i<4?'AFC':'NFC')+' '+['East','North','South','West'][i%4],parent:i<4?'AFC':'NFC',entries:teams.slice(i*4,i*4+4).map((t,j)=>entry(t,records[t.id].w,records[t.id].l,0,(i*4+j)%16+1))});
  const standings={season:{year:2026},children:['AFC','NFC'].map(parent=>({name:parent,abbreviation:parent,children:groups.filter(g=>g.parent===parent).map(g=>({name:g.name,abbreviation:g.name,standings:{entries:g.entries}}))}))};
  return {teams,events,groups,standings};
}
module.exports={teams,event,entry,fixture};
