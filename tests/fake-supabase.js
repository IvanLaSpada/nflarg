// Supabase falso en memoria (auth, tablas, triggers emulados, RPCs, storage) para probar el foro sin red.
// Se inyecta en lugar de la librería real interceptando la URL de supabase-js. window.__RATE activa el antispam.
window.__RATE = 0;
window.supabase = { createClient(){
  const db = {profiles: [], threads: [], posts: [], reactions: [], notifications: []}, ids = {threads: 0, posts: 0, notifications: 0}, users = {};
  let session = null;
  const now = () => new Date().toISOString();
  const err = m => ({data: null, error: {message: m}});
  function addPost(row){
    const last = db.posts.filter(p => p.author === row.author).pop();
    if(window.__RATE && last && Date.now() - Date.parse(last.created_at) < window.__RATE) return err('too_fast');
    const p = {id: ++ids.posts, likes: 0, dislikes: 0, created_at: now(), ...row};
    if(p.thread_id){ const t = db.threads.find(t => t.id === p.thread_id); p.forum = t.forum; t.post_count++; t.last_post_at = p.created_at; }
    db.posts.push(p);
    const notify = (uid, kind) => { if(!uid || uid === p.author) return; const ex = db.notifications.find(n => n.user_id === uid && n.post_id === p.id); if(ex){ if(kind === 'quote') ex.kind = 'quote'; return; } db.notifications.push({id: ++ids.notifications, user_id: uid, actor: p.author, post_id: p.id, thread_id: p.thread_id || null, forum: p.forum, kind, read: false, created_at: now()}); };
    if(p.thread_id) notify(db.threads.find(t => t.id === p.thread_id).author, 'reply');
    for(const m of String(p.body).matchAll(/\[quote=([A-Za-z0-9_]{1,20})\]/g)){ const pr = db.profiles.find(x => x.username.toLowerCase() === m[1].toLowerCase()); if(pr) notify(pr.id, 'quote'); }
    return {data: null, error: null};
  }
  const recount = pid => { const p = db.posts.find(x => x.id === pid); if(!p) return; p.likes = db.reactions.filter(r => r.post_id === pid && r.value === 1).length; p.dislikes = db.reactions.filter(r => r.post_id === pid && r.value === -1).length; };
  function q(table){
    let filters = [], orderBy = null, rng = null, opts = {}, sel = '*', single = false, lim = null, op = null, payload = null;
    const api = {
      select(s, o){ sel = s; opts = o || {}; return api; },
      eq(k, v){ filters.push(x => String(x[k]) === String(v)); return api; },
      is(k, v){ filters.push(x => (x[k] ?? null) === v); return api; },
      in(k, vs){ filters.push(x => vs.map(String).includes(String(x[k]))); return api; },
      ilike(k, pat){ const re = new RegExp('^' + pat.replace(/\\_/g, '\u0001').replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/_/g, '.').replace(/%/g, '.*').replace(/\u0001/g, '_') + '$', 'i'); filters.push(x => re.test(x[k])); return api; },
      order(k, o){ orderBy = [k, o?.ascending !== false]; return api; }, range(a, b){ rng = [a, b]; return api; },
      limit(n){ lim = n; return api; }, maybeSingle(){ single = true; return api; },
      insert(r){ op = 'insert'; payload = r; return api; }, update(r){ op = 'update'; payload = r; return api; },
      delete(){ op = 'delete'; return api; }, upsert(r){ op = 'upsert'; payload = r; return api; },
      then(res, rej){ return Promise.resolve().then(exec).then(res, rej); },
    };
    const embed = r => { const o = {...r};
      if(/actor:profiles/.test(sel)){ const p = db.profiles.find(p => p.id === r.actor); o.actor = p ? {username: p.username} : null; }
      if(/threads!/.test(sel)){ const t = db.threads.find(t => t.id === r.thread_id); o.threads = t ? {title: t.title} : null; } const m = sel.match(/profiles(?:![a-z_]+)?\(([^)]*)\)/); if(m){ const p = db.profiles.find(p => p.id === r.author); o.profiles = p ? Object.fromEntries(m[1].split(',').map(k => [k, p[k] ?? null])) : null; } return o; };
    const match = () => db[table].filter(x => filters.every(f => f(x)));
    function exec(){
      if(op && !session) return err('new row violates row-level security policy');
      if(op === 'insert'){ if(payload.author !== session.user.id) return err('row-level security'); return addPost(payload); }
      if(op === 'update'){ if(table === 'notifications'){ match().filter(x => x.user_id === session.user.id).forEach(x => Object.assign(x, {read: payload.read})); return {data: null, error: null}; } if(table !== 'profiles') return err('permission denied'); match().filter(x => x.id === session.user.id).forEach(x => Object.assign(x, payload)); return {data: null, error: null}; }
      if(op === 'delete'){ const rm = match().filter(x => x.user_id === session.user.id); db[table] = db[table].filter(x => !rm.includes(x)); rm.forEach(x => recount(x.post_id)); return {data: null, error: null}; }
      if(op === 'upsert'){ if(payload.user_id !== session.user.id) return err('row-level security'); const ex = db.reactions.find(r => r.post_id === payload.post_id && r.user_id === payload.user_id); if(ex) ex.value = payload.value; else db.reactions.push({...payload}); recount(payload.post_id); return {data: null, error: null}; }
      let r = match(); if(table === 'notifications') r = session ? r.filter(x => x.user_id === session.user.id) : []; const count = r.length;
      if(orderBy) r.sort((a, b) => (a[orderBy[0]] > b[orderBy[0]] ? 1 : -1) * (orderBy[1] ? 1 : -1));
      if(rng) r = r.slice(rng[0], rng[1] + 1); if(lim) r = r.slice(0, lim);
      if(opts.head) return {data: null, count, error: null};
      r = r.map(embed);
      if(single) return {data: r[0] || null, error: null};
      return {data: r, count: opts.count ? count : null, error: null};
    }
    return api;
  }
  const files = {};
  return {
    storage: { from(bucket){ return {
      async upload(path, blob, o){ if(!session || !path.startsWith(session.user.id + '/')) return err('row-level security'); files[path] = blob.size; window.__lastUpload = {path, size: blob.size, type: blob.type}; return {data: {path}, error: null}; },
      getPublicUrl(path){ return {data: {publicUrl: 'https://demo.supabase.co/storage/v1/object/public/' + bucket + '/' + path}}; },
      async remove(paths){ paths.forEach(x => delete files[x]); return {data: null, error: null}; },
    }; } },
    from: q,
    async rpc(name, a){
      if(name === 'login_email'){
        const k = String(a.p_login).trim().toLowerCase();
        const pr = db.profiles.find(p => p.username.toLowerCase() === k);
        const byMail = Object.entries(users).find(([e, u]) => (u.meta.contact_email || '').toLowerCase() === k);
        const id = pr ? pr.id : byMail ? byMail[1].id : null;
        const e = Object.entries(users).find(([e, u]) => u.id === id);
        return {data: e ? e[0] : null, error: null};
      }
      if(name === 'ranking_hinchas'){ const c = {}; db.profiles.forEach(p => { if(p.team_id) c[p.team_id] = (c[p.team_id] || 0) + 1; }); return {data: Object.entries(c).map(([team_id, fans]) => ({team_id, fans})).sort((a, b) => b.fans - a.fans), error: null}; }
      if(name === 'ranking_actividad'){ const c = {}; db.posts.forEach(po => { const p = db.profiles.find(x => x.id === po.author); if(!p || !p.team_id) return; const e = c[p.team_id] = c[p.team_id] || {team_id: p.team_id, posts: 0, autores: new Set(), likes: 0}; e.posts++; e.autores.add(p.id); e.likes += po.likes; }); return {data: Object.values(c).map(e => ({...e, autores: e.autores.size})).sort((a, b) => b.posts - a.posts), error: null}; }
      if(name === 'ranking_usuarios'){ const c = {}; db.posts.forEach(po => { const p = db.profiles.find(x => x.id === po.author); const e = c[p.id] = c[p.id] || {username: p.username, team_id: p.team_id, avatar_url: p.avatar_url || null, posts: 0, likes: 0}; e.posts++; e.likes += po.likes; }); return {data: Object.values(c).sort((a, b) => b.posts - a.posts).slice(0, a.p_limit || 10), error: null}; }
      if(!session) return err('not_authenticated');
      const t = {id: ++ids.threads, forum: a.p_forum, title: a.p_title, author: session.user.id, created_at: now(), last_post_at: now(), post_count: 0};
      db.threads.push(t); const r = addPost({thread_id: t.id, forum: a.p_forum, body: a.p_body, author: session.user.id});
      if(r.error){ db.threads.pop(); ids.threads--; return r; }
      return {data: t.id, error: null};
    },
    auth: {
      async getSession(){ return {data: {session}}; },
      onAuthStateChange(fn){ return {data: {subscription: {unsubscribe(){}}}}; },
      async signUp({email, password, options}){
        if(users[email]) return {data: {}, error: {message: 'User already registered'}};
        const id = 'u' + Object.keys(users).length; users[email] = {id, password, meta: options.data};
        db.profiles.push({id, username: options.data.username, team_id: options.data.team_id || null});
        session = {user: {id, email, user_metadata: options.data}}; return {data: {session, user: session.user}, error: null};
      },
      async signInWithPassword({email, password}){
        const u = users[email]; if(!u || u.password !== password) return {data: {}, error: {message: 'Invalid login credentials'}};
        session = {user: {id: u.id, email, user_metadata: u.meta}}; return {data: {session}, error: null};
      },
      async signOut(){ session = null; return {error: null}; },
    },
  };
}};
