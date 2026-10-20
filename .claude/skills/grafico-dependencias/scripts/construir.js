#!/usr/bin/env node
/*
 * Construye el gráfico de dependencias (HTML autocontenido) a partir de proyecto.json.
 *
 *   node construir.js <proyecto.json> <salida.html> [--rapido] [--acomodo <grafico-anterior.html>]
 *
 * --acomodo: reutiliza el orden de cajas de un gráfico ya publicado, para que no cambie el
 *            acomodo cuando solo cambian textos. Solo se reutiliza en las vistas cuyas cajas no cambiaron.
 *
 * - Calcula el paso de cada HU, los grupos que se necesitan mutuamente y las flechas directas.
 * - Busca el acomodo con menos cruces de flechas (con --rapido prueba menos combinaciones).
 * - Verifica que ninguna dependencia se pierda al simplificar las flechas.
 * El formato de proyecto.json está en references/formato-datos.md.
 */
const fs = require("fs"), path = require("path");
const [,, inPath, outPath, ...flags] = process.argv;
if(!inPath || !outPath){ console.error("Uso: node construir.js <proyecto.json> <salida.html> [--rapido]"); process.exit(1); }
const RAPIDO = flags.includes("--rapido");
const ACOMODO = flags.includes("--acomodo") ? flags[flags.indexOf("--acomodo") + 1] : null;
let PREVIO = {};
if(ACOMODO){
  const prev = fs.readFileSync(ACOMODO, "utf8"), m = prev.match(/const ORDERS = (\{.*?\});\n/s);
  if(m) PREVIO = JSON.parse(m[1]); else console.log("Aviso: no se encontró el acomodo en " + ACOMODO);
}
const DIR = __dirname;
const dagre = require(path.join(DIR, "dagre.min.js"));
const makeCore = require(path.join(DIR, "graphcore.js"));
const P = JSON.parse(fs.readFileSync(inPath, "utf8"));

const avisos = [];
const PRIOS = ["DEBE","DEBERIA","PODRIA","NO"];

/* ---------- Normalizar ---------- */
const eps = {}, fts = {};
for(const e of P.epicas || []) eps[e.id] = {id:e.id, t:e.titulo || e.id};
for(const f of P.features || []) fts[f.id] = {id:f.id, t:f.titulo || f.id, ep:f.epica};
const ids = new Set((P.hus || []).map(h => h.id));
const hus = [];
for(const h of P.hus || []){
  if(!eps[h.epica]){ avisos.push(`${h.id}: la épica ${h.epica} no está en "epicas"; se crea con su código como título.`); eps[h.epica] = {id:h.epica, t:h.epica}; }
  if(!fts[h.feature]){ avisos.push(`${h.id}: la feature ${h.feature} no está en "features"; se crea con su código como título.`); fts[h.feature] = {id:h.feature, t:h.feature, ep:h.epica}; }
  const p = PRIOS.includes(h.prioridad) ? h.prioridad : (avisos.push(`${h.id}: prioridad "${h.prioridad}" desconocida; se toma DEBE.`), "DEBE");
  const back = (h.dependeDe || []).filter(d => d !== h.id && (ids.has(d) || !avisos.push(`${h.id}: depende de ${d}, que no existe; se ignora.`)));
  const txt = (h.dependeDeTexto || []).filter(d => d !== h.id && ids.has(d) && !back.includes(d));
  hus.push({id:h.id, t:h.titulo || h.id, ep:h.epica, ft:h.feature, p, back, deps:[...back, ...txt], txt, ext:h.externos || [], n:h.tareas || 0, ...(h.historia ? {historia:h.historia} : {})});
}
if(!hus.length){ console.error("proyecto.json no tiene HU."); process.exit(1); }
for(const f of Object.values(fts)) if(!eps[f.ep]) avisos.push(`La feature ${f.id} apunta a la épica ${f.ep}, que no existe.`);

/* ---------- Paso de cada HU (solo con las dependencias del backlog, para un acomodo estable) ---------- */
const H = Object.fromEntries(hus.map(h => [h.id, h]));
{
  let idx = 0; const I = {}, low = {}, st = [], on = new Set(), comp = {}, comps = [];
  const sc = v => { I[v] = low[v] = idx++; st.push(v); on.add(v);
    for(const w of H[v].back){ if(I[w]===undefined){ sc(w); low[v] = Math.min(low[v], low[w]); } else if(on.has(w)) low[v] = Math.min(low[v], I[w]); }
    if(low[v]===I[v]){ const c = []; let w; do { w = st.pop(); on.delete(w); c.push(w); } while(w!==v); comps.push(c); c.forEach(x => comp[x] = comps.length-1); } };
  for(const h of hus) if(I[h.id]===undefined) sc(h.id);
  const memo = {};
  const wave = ci => { if(memo[ci]) return memo[ci]; memo[ci] = 1; let w = 1;
    for(const v of comps[ci]) for(const u of H[v].back) if(comp[u]!==ci) w = Math.max(w, wave(comp[u]) + 1);
    return memo[ci] = w; };
  for(const h of hus) h.w = wave(comp[h.id]);
}

const M = {hus: hus.map(({back, ...h}) => h), fts, eps};
const core = makeCore(M, dagre);

/* ---------- Verificación: ninguna dependencia se pierde al simplificar ---------- */
let perdidas = 0;
for(const L of ["hu","ft","ep"]){
  const G = core.level(L), vw = core.view(G, () => true);
  const pre = {}; vw.V.forEach(v => pre[v] = []); vw.edges.forEach(([a,b]) => pre[b].push(a));
  const R = {}; const r = v => { if(R[v]) return R[v]; const s = new Set(); for(const p of pre[v]){ s.add(p); for(const x of r(p)) s.add(x); } return R[v] = s; };
  for(const v of vw.V) for(const d of G.deps[v]) if(!r(v).has(d) && !G.back[v].has(d)) perdidas++;
}
if(perdidas) avisos.push(`ATENCIÓN: ${perdidas} dependencias no quedaron representadas. Revisar antes de publicar.`);

/* ---------- Acomodo con menos cruces ---------- */
const largo = g => { let s = 0; g.edges().forEach(e => { const p = g.edge(e).points; for(let i=0;i<p.length-1;i++) s += Math.hypot(p[i+1].x-p[i].x, p[i+1].y-p[i].y); }); return s; };
const sets = [PRIOS];
if(hus.some(h => h.p==="NO") && hus.some(h => h.p!=="NO")) sets.unshift(["DEBE","DEBERIA","PODRIA"]);
const ORDERS = {}, resumen = [];
for(const L of ["ep","ft","hu"]){
  const G = core.level(L);
  for(const ps of sets){
    const key = [...ps].sort().join(",");
    const vw = core.view(G, i => G.hus[i].some(h => ps.includes(h.p)));
    if(!vw.V.length) continue;
    for(const dir of ["LR","TB"]){
      const prev = PREVIO[`${L}|${key}|${dir}`];
      if(prev && prev.length===vw.V.length && prev.every(v => vw.V.includes(v))){
        const g = core.layout(L, vw, dir, prev);
        ORDERS[`${L}|${key}|${dir}`] = prev;
        resumen.push(`${L.padEnd(2)} ${ps.length===4?"todo        ":"sin NO      "} ${dir}: ${String(vw.V.length).padStart(3)} cajas, ${String(vw.edges.length).padStart(3)} flechas, ${core.crossings(g)} cruces (acomodo anterior)`);
        continue;
      }
      const semillas = RAPIDO ? [11] : (L==="hu" ? [3,11,29] : [11]);
      const intentos = RAPIDO ? 40 : (L==="hu" ? 300 : 250);
      let best = null;
      for(const seed of semillas){
        let s = seed; const rnd = () => (s = s*16807 % 2147483647) / 2147483647;
        for(let t=0; t<intentos; t++){
          const order = t===0 ? [...vw.V] : [...vw.V].sort(() => rnd()-.5);
          const g = core.layout(L, vw, dir, order), c = core.crossings(g);
          const sc = c*2000 + largo(g)/10;   // primero menos cruces; a igualdad, flechas más cortas
          if(!best || sc < best.sc) best = {sc, c, order};
          if(c===0 && t>30) break;
        }
      }
      ORDERS[`${L}|${key}|${dir}`] = best.order;
      resumen.push(`${L.padEnd(2)} ${ps.length===4?"todo        ":"sin NO      "} ${dir}: ${String(vw.V.length).padStart(3)} cajas, ${String(vw.edges.length).padStart(3)} flechas, ${best.c} cruces`);
    }
  }
}

/* ---------- Armar la página ---------- */
const pr = P.proyecto || {};
const CFG = {
  eyebrow: [pr.nombre, pr.empresa || "AybarCorp"].filter(Boolean).join(" · "),
  idPrefix: pr.prefijoId || "",
  externals: P.externos || {},
  outOfScope: P.fueraDeAlcance || "fuera de alcance por ahora",
  notes: P.notas || {},
  docNotesHtml: P.notasDocumentacionHtml || "",
  readiness: P.preparacion || {},
  logros: P.logros || {},
  fuentes: P.fuentes || {},
  codigos: Object.fromEntries(Object.entries(P.codigos || {}).map(([k, c]) => [k, (({texto, ...r}) => ({...r, texto: (texto||"").slice(0, 300)}))(c)]))
};
const js = o => JSON.stringify(o).replace(/</g, "\\u003c");
let html = fs.readFileSync(path.join(DIR, "..", "assets", "template.html"), "utf8");
html = html.replace("/*CORE*/", fs.readFileSync(path.join(DIR, "graphcore.js"), "utf8"))
           .replace("/*CFG*/null", js(CFG)).replace("/*DATA*/null", js(M)).replace("/*ORDERS*/null", js(ORDERS));
fs.writeFileSync(outPath, html);

console.log(`Listo: ${outPath}`);
console.log(`${Object.keys(eps).length} épicas · ${Object.keys(fts).length} features · ${hus.length} HU · ${hus.reduce((s,h)=>s+h.deps.length,0)} dependencias (${hus.reduce((s,h)=>s+h.txt.length,0)} tomadas del texto)`);
console.log(resumen.join("\n"));
console.log(perdidas ? `Dependencias perdidas: ${perdidas}` : "Verificación: ninguna dependencia se pierde al simplificar las flechas.");
if(avisos.length) console.log("\nAvisos:\n- " + avisos.join("\n- "));
