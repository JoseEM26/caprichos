/* Lógica del grafo sin DOM: se usa en la página y para precalcular el orden con menos cruces. */
function makeCore(M, dagre){
  const HU = Object.fromEntries(M.hus.map(h=>[h.id,h]));
  const KEY = {hu:h=>h.id, ft:h=>h.ft, ep:h=>h.ep};
  const SIZE = {hu:{width:92,height:42}, ft:{width:200,height:58}, ep:{width:210,height:58}};

  // Nivel: dependencias reales y versión sin ciclos (la que arranca primero va antes)
  function level(L){
    const key = KEY[L], items = [...new Set(M.hus.map(key))].sort(), hus = {}, deps = {}, rev = {};
    for(const i of items){ hus[i] = []; deps[i] = new Set(); rev[i] = new Set(); }
    for(const h of M.hus){ hus[key(h)].push(h); for(const d of h.deps){ const a = key(HU[d]), b = key(h); if(a!==b){ deps[b].add(a); rev[a].add(b); } } }
    let idx = 0; const I = {}, low = {}, st = [], on = new Set(), comp = {}, comps = [];
    const sc = v => { I[v] = low[v] = idx++; st.push(v); on.add(v);
      for(const w of deps[v]){ if(I[w]===undefined){ sc(w); low[v] = Math.min(low[v], low[w]); } else if(on.has(w)) low[v] = Math.min(low[v], I[w]); }
      if(low[v]===I[v]){ const c = []; let w; do { w = st.pop(); on.delete(w); c.push(w); } while(w!==v); comps.push(c); c.forEach(x=>comp[x]=comps.length-1); } };
    for(const v of items) if(I[v]===undefined) sc(v);
    const start = i => Math.min(...hus[i].map(h=>h.w));
    const rank = {};
    for(const c of comps){ c.sort((a,b)=>start(a)-start(b) || a.localeCompare(b)); c.forEach((x,i)=>rank[x]=i); }
    const dag = {}, back = {};   // back[b] = lo que b también espera, pero arranca después
    for(const b of items){ dag[b] = new Set(); back[b] = new Set();
      for(const a of deps[b]){ if(comp[a]===comp[b] && rank[a] > rank[b]) back[b].add(a); else dag[b].add(a); } }
    const anc = {};
    const A = v => { if(anc[v]) return anc[v]; const s = new Set(); for(const d of dag[v]){ s.add(d); for(const x of A(d)) s.add(x); } return anc[v] = s; };
    items.forEach(A);
    return {L, items, hus, deps, rev, dag, back, anc};
  }

  // Vista: nodos visibles, flechas directas (sin redundantes) y paso de cada uno
  function view(G, visible){
    const V = G.items.filter(visible), Vs = new Set(V), edges = [];
    for(const b of V){
      const an = [...G.anc[b]].filter(a=>Vs.has(a));
      for(const a of an) if(!an.some(c=>c!==a && G.anc[c].has(a))) edges.push([a,b]);
    }
    const preds = {}; V.forEach(v=>preds[v]=[]); edges.forEach(([a,b])=>preds[b].push(a));
    const step = {};
    [...V].sort((x,y)=>G.anc[x].size-G.anc[y].size).forEach(v=>step[v]=1+Math.max(0,...preds[v].map(p=>step[p])));
    return {V, edges, step, steps: Math.max(1, ...Object.values(step))};
  }

  function crossings(g){
    const segs = [];
    g.edges().forEach(e=>{ const p = g.edge(e).points; for(let i=0;i<p.length-1;i++) segs.push([p[i],p[i+1]]); });
    const X = (p,q,r,s) => { const d = (q.x-p.x)*(s.y-r.y)-(q.y-p.y)*(s.x-r.x); if(!d) return false;
      const t = ((r.x-p.x)*(s.y-r.y)-(r.y-p.y)*(s.x-r.x))/d, u = ((r.x-p.x)*(q.y-p.y)-(r.y-p.y)*(q.x-p.x))/d;
      return t>0.01 && t<0.99 && u>0.01 && u<0.99; };
    let n = 0; for(let i=0;i<segs.length;i++) for(let j=i+1;j<segs.length;j++) if(X(segs[i][0],segs[i][1],segs[j][0],segs[j][1])) n++;
    return n;
  }

  // Disposición con dagre. dir: "LR" (izquierda→derecha) o "TB" (arriba→abajo)
  function layout(L, vw, dir, order){
    const g = new dagre.graphlib.Graph();
    g.setGraph({rankdir: dir==="LR" ? "RL" : "BT", ranker:"longest-path",
      nodesep: L==="hu" ? (dir==="LR"?12:14) : 18, ranksep: L==="hu" ? (dir==="LR"?44:40) : (dir==="LR"?56:44), edgesep: 8, marginx: 16, marginy: 16});
    g.setDefaultEdgeLabel(()=>({}));
    (order || vw.V).forEach(v=>g.setNode(v, {...SIZE[L]}));
    vw.edges.forEach(([a,b])=>g.setEdge(b, a));   // invertido: los que no necesitan nada quedan al inicio
    dagre.layout(g);
    return g;
  }

  function bestOrder(L, vw, dir, tries, seed){
    let s = seed || 7; const rnd = () => (s = s*16807 % 2147483647) / 2147483647;
    let best = null;
    for(let k=0; k<tries; k++){
      const order = k===0 ? [...vw.V] : [...vw.V].sort(()=>rnd()-.5);
      const g = layout(L, vw, dir, order), c = crossings(g);
      if(!best || c < best.c) best = {c, order, g};
      if(c===0) break;
    }
    return best;
  }

  return {HU, KEY, SIZE, level, view, layout, crossings, bestOrder};
}
if(typeof module!=="undefined") module.exports = makeCore;
