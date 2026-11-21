import * as THREE from 'three';
import { azar, formaCorazon, liberar, type Ctx, type Etq } from './base';
import { construirCapriMesera, crearBandeja, crearBolsa, crearLibreta, crearMoto, persona, animarGente, type CapriPiezas, type Persona } from './personas';
import { COLOR_ESTADO, type Local, type MesaEsc } from './local';
import { buscarRuta, claveArea, type PlanoEscena } from './planoAEscena';
import { TEMAS, type Tema } from './temas';
import type { Sonido } from './sonido';
import type { PedidoVivo, SalonVivo } from '../salonVivoApi';

/**
 * Director: anima la escena SOLO con lo que cambia en los datos reales.
 * Un cliente llega cuando una mesa se ocupa y se va cuando se libera; Capri lleva al salón lo que aparece en despacho;
 * los cocineros trabajan más rápido en el área con más carga. Nada se inventa: sin cambios, solo hay vida de fondo.
 */
type Punto = [number, number] | THREE.Vector3;

interface Agente { obj: any; ruta: THREE.Vector3[]; vel: number; alLlegar?: () => void; v?: number }

type Tarea =
  | { tipo: 'pedido'; codigo: string; mesaId: string }
  | { tipo: 'llevar'; codigo: string }
  | { tipo: 'cuenta'; mesaId: string }
  | { tipo: 'tomar'; mesaId: string }
  | { tipo: 'limpiar'; mesaId: string };

interface Mesero {
  nombre: string; esCapri: boolean; obj: any; per?: Persona; bandeja: THREE.Group; bolsa: THREE.Group; libreta: THREE.Group;
  base: THREE.Vector3; vel: number; tarea: Tarea | 'paseo' | null; globo: Etq; globoHasta: number;
}

interface Grupo { personas: Persona[]; fase: 'llegando' | 'sentado' | 'saliendo' }

export interface ResumenMesero { nombre: string; esCapri: boolean; ocupado: boolean; texto: string }

const UMBRAL_DEMORA = 15;

export function crearDirector(ctx: Ctx, plano: PlanoEscena, local: Local, gente: Set<Persona>, sonido: Sonido, alCambiar: () => void) {
  const { escena, M, malla, G, etiqueta } = ctx;
  const { ancho, alto } = plano;
  let t = 0, vivo = true;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const espera = (ms: number, fn: () => void) => {
    const id = setTimeout(() => { timers.delete(id); if (vivo) fn(); }, ctx.reducir ? Math.min(ms, 50) : ms);
    timers.add(id);
  };

  /* ---------- Puntos clave ---------- */
  const ent = plano.entrada;
  const entradaG: [number, number] = ent ? [ent.cx + ancho / 2, ent.cz + alto / 2] : [ancho - 0.5, plano.pasilloY];
  const dirG: [number, number] = ent ? [ent.dirX, ent.dirZ] : [1, 0];
  const afueraG: [number, number] = [entradaG[0] + dirG[0] * 2.2, entradaG[1] + dirG[1] * 2.2];
  const aGrid = (v: THREE.Vector3): [number, number] => [v.x + ancho / 2, v.z + alto / 2];
  const enGrid = (p: Punto): THREE.Vector3 => (Array.isArray(p) ? G(p[0], p[1]) : p.clone());
  const libreEn = (x: number, y: number): [number, number] => {
    const i = Math.floor(x), j = Math.floor(y);
    return plano.bloqueo[j]?.[i] === false ? [x, y] : [x, plano.pasilloY];
  };

  /* ---------- Agentes que caminan ---------- */
  const agentes = new Set<Agente>();
  function caminar(obj: any, puntos: Punto[], vel: number, alLlegar?: () => void) {
    const ruta = puntos.map(enGrid);
    const o = obj.raiz || obj;
    if (ctx.reducir) { // sin movimiento: llega de una vez
      const f = ruta[ruta.length - 1];
      if (f) { o.position.x = f.x; o.position.z = f.z; }
      alLlegar?.();
      return null;
    }
    const ag: Agente = { obj, ruta, vel, alLlegar };
    agentes.add(ag);
    return ag;
  }
  const caminando = (o: any) => { for (const a of agentes) if ((a.obj.raiz || a.obj) === o) return true; return false; };
  /** Camino real por celdas libres desde donde está el objeto hasta una celda del plano. */
  const rutaA = (obj: any, destino: [number, number], extra: Punto[] = []): Punto[] => {
    const o = obj.raiz || obj;
    return [...buscarRuta(plano, aGrid(o.position), destino), ...extra];
  };
  function moverAgentes(dt: number) {
    const lista = [...agentes];
    for (const ag of lista) {
      const o = ag.obj.raiz || ag.obj;
      const est = ag.obj.raiz ? ag.obj : ag.obj.userData;
      const destino = ag.ruta[0];
      if (!destino) { agentes.delete(ag); est.ritmo = 0; ag.alLlegar?.(); continue; }
      const dx = destino.x - o.position.x, dz = destino.z - o.position.z;
      const dist = Math.hypot(dx, dz);
      ag.v = Math.min(ag.vel, (ag.v || 0) + ag.vel * 2.4 * dt);
      let v = ag.v;
      if (ag.ruta.length === 1 && dist < 0.7) v *= Math.max(0.3, dist / 0.7);
      const paso = v * dt;
      if (dist <= paso) { o.position.x = destino.x; o.position.z = destino.z; ag.ruta.shift(); }
      else {
        let mx = dx / dist, mz = dz / dist;
        for (const ot of lista) {
          if (ot === ag) continue;
          const q = (ot.obj.raiz || ot.obj).position;
          const ex = o.position.x - q.x, ez = o.position.z - q.z, d = Math.hypot(ex, ez);
          if (d > 0.01 && d < 0.55) { const f = (0.55 - d) / 0.55, px = -mz, pz = mx; mx += (ex / d) * f * 0.6 + px * f * 0.4; mz += (ez / d) * f * 0.6 + pz * f * 0.4; }
        }
        const n = Math.hypot(mx, mz) || 1;
        o.position.x += (mx / n) * paso; o.position.z += (mz / n) * paso;
      }
      est.paso = (est.paso || 0) + dt * v * 5.4;
      est.ritmo = v / ag.vel;
      if (dist > 0.02) {
        let d = Math.atan2(dx, dz) - o.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
        o.rotation.y += d * Math.min(1, dt * 8);
      }
    }
  }

  /* ---------- Capri y los mozos de apoyo ---------- */
  const capriObj = new THREE.Group(); escena.add(capriObj);
  let capri: CapriPiezas | null = null;
  const capriEstado = { anim: 'reposo', animDesde: 0, animDur: 0, proxAccion: 4, felizHasta: 0 };
  const bandejaC = crearBandeja(ctx, capriObj, 0.66, 0.32);
  const bolsaC = crearBolsa(ctx, capriObj, 0.32, 0.38, 0.15);
  const globoC = etiqueta('sv-globo', capriObj, 1.75); globoC.visible = false;
  let globoCHasta = 0;
  const globoCaja = etiqueta('sv-globo caja', new THREE.Vector3(), 0); globoCaja.visible = false;
  let globoCajaHasta = 0;
  const base = (fx: number, dy: number) => { const [x, y] = libreEn(ancho * fx, plano.pasilloY - dy); return G(x, y); };
  const meseros: Mesero[] = [{
    nombre: 'Capri', esCapri: true, obj: capriObj, bandeja: bandejaC, bolsa: bolsaC, libreta: crearLibreta(ctx, capriObj, -0.1, 0.66, 0.34),
    base: base(0.375, 1.2), vel: 2.3, tarea: null, globo: globoC, globoHasta: 0,
  }];
  capriObj.position.copy(meseros[0].base);
  for (const [nombre, fx, dy, estilo] of [['Mozo Luis', 0.485, 0.6, 'corto'], ['Moza Ana', 0.73, 0.5, 'cola']] as const) {
    const per = persona(ctx, gente, { ropa: '#0B2C3E', mandil: '#E67929', gorro: 'gorra', pantalon: '#1C1C22', estilo, rol: 'mozo', lentes: false });
    const b = base(fx, dy);
    per.raiz.position.copy(b);
    escena.add(per.raiz);
    const g = etiqueta('sv-globo', per.raiz, 1.75); g.visible = false;
    meseros.push({ nombre, esCapri: false, obj: per, per, libreta: crearLibreta(ctx, per.raiz, 0, 0.9, 0.3), bandeja: crearBandeja(ctx, per.raiz, 0.84, 0.3), bolsa: crearBolsa(ctx, per.raiz, 0.3, 0.42, 0.12), base: b, vel: 2.1, tarea: null, globo: g, globoHasta: 0 });
  }
  const raizDe = (ms: Mesero) => ms.obj.raiz || ms.obj;
  function ponerCapri(nuevo: Tema) {
    if (capri) { capriObj.remove(capri.raiz); liberar(capri.raiz); }
    capri = construirCapriMesera(ctx, nuevo, formaCorazon);
    capri.raiz.scale.setScalar(0.44);
    capriObj.add(capri.raiz);
  }
  function decir(txt: string, s = 3.5) { globoC.el.textContent = txt; globoC.visible = true; globoCHasta = t + s; }
  function hablar(ms: Mesero, txt: string, s = 3) {
    if (ms.esCapri) return decir(txt, s);
    ms.globo.el.textContent = txt; ms.globo.visible = true; ms.globoHasta = t + s;
  }
  function accion(nombre: string, dur: number) { capriEstado.anim = nombre; capriEstado.animDesde = t; capriEstado.animDur = dur; }
  function saludar(ms: Mesero) { if (ms.esCapri) accion('saludando', 2); else ms.per!.saludaHasta = t + 1.8; }
  function avisoCaja(txt: string) {
    if (!local.cajero) return;
    local.cajero.raiz.getWorldPosition(globoCaja.pos as THREE.Vector3); (globoCaja.pos as THREE.Vector3).y = 1.85;
    globoCaja.el.textContent = txt; globoCaja.visible = true; globoCajaHasta = t + 2.6;
  }
  function cargar(ms: Mesero, que: 'bandeja' | 'bolsa' | null) {
    ms.bandeja.visible = que === 'bandeja'; ms.bolsa.visible = que === 'bolsa';
    if (ms.per) ms.per.carga = !!que;
  }

  /* ---------- Estado vivo de la escena ---------- */
  const grupos = new Map<string, Grupo>();
  const meseDe = new Map(local.mesas.map((m) => [m.id, m]));
  const tareas: Tarea[] = [];
  let datos: SalonVivo | null = null;
  let despachoOcupado = false;
  const clientesLlevar = new Map<string, { per: Persona; spot: number }>();
  let codigosDespacho = new Set<string>();
  let firmaCaja = '';
  let motoEstado: 'parqueada' | 'ruta' = 'parqueada';

  const mesaPorId = (id: string) => meseDe.get(id);
  const estadoDe = (m: MesaEsc) => (datos?.mesas.find((x) => x.id === m.id)?.estado ?? 'LIBRE');

  function sentar(per: Persona, silla: MesaEsc['sillas'][number], m: MesaEsc) {
    per.sentado = true; per.mesaId = m.id; per.ritmo = 0; per.cuerpo.position.y = -0.05;
    per.piernas.forEach((pi) => { pi.rotation.x = -1.5; }); per.rodillas.forEach((r) => { r.rotation.x = 1.5; });
    per.raiz.position.set(silla.mundo.x, 0, silla.mundo.z);
    per.raiz.rotation.y = Math.atan2(m.cx - silla.mundo.x, m.cz - silla.mundo.z);
  }
  function pararse(per: Persona) {
    per.sentado = false; per.mesaId = undefined; per.manoArriba = false; per.tel.visible = false; per.cuerpo.position.y = 0;
    per.piernas.forEach((pi) => { pi.rotation.x = 0; }); per.rodillas.forEach((r) => { r.rotation.x = 0; });
  }
  const retirar = (per: Persona) => { escena.remove(per.raiz); liberar(per.raiz); gente.delete(per); };

  function personasDeMesa(m: MesaEsc) {
    const d = datos?.mesas.find((x) => x.id === m.id);
    const n = d?.pedido?.personas ?? Math.min(2, m.seats);
    return Math.max(1, Math.min(m.sillas.length, n));
  }

  function llegarMesa(m: MesaEsc, inmediato: boolean) {
    const n = personasDeMesa(m);
    const grupo: Grupo = { personas: [], fase: 'llegando' };
    grupos.set(m.id, grupo);
    let llegaron = 0;
    for (let i = 0; i < n; i++) {
      const per = persona(ctx, gente);
      grupo.personas.push(per);
      escena.add(per.raiz);
      const silla = m.sillas[i];
      const listo = () => {
        sentar(per, silla, m);
        if (++llegaron === n) { grupo.fase = 'sentado'; sincronizarMesa(m); }
      };
      if (inmediato) { listo(); continue; }
      per.raiz.position.copy(G(afueraG[0] + i * 0.5 * dirG[1], afueraG[1] + i * 0.5 * dirG[0]));
      espera(i * 450, () => caminar(per, [entradaG, ...rutaDesdeEntrada(silla.grilla)], 1.6, listo));
    }
    if (!inmediato) {
      const libre = meseros.find((ms) => !ms.tarea && !caminando(raizDe(ms)));
      if (libre) { hablar(libre, `¡Bienvenidos! Pasen a la ${m.nombre} 😊`, 2.6); saludar(libre); }
      tareas.push({ tipo: 'tomar', mesaId: m.id });
    }
  }
  const rutaDesdeEntrada = (dest: [number, number]): Punto[] => buscarRuta(plano, entradaG, dest);

  function irseMesa(m: MesaEsc, pasaPorCaja: boolean) {
    const g = grupos.get(m.id);
    if (!g) return;
    g.fase = 'saliendo';
    grupos.delete(m.id);
    m.comida.clear(); m.vapor = [];
    let fueron = 0;
    const salio = () => { if (++fueron === g.personas.length) { sincronizarMesa(m); tareas.push({ tipo: 'limpiar', mesaId: m.id }); alCambiar(); } };
    g.personas.forEach((per, i) => {
      pararse(per);
      const silla = m.sillas[i] ?? m.sillas[0];
      const salida = (desde: [number, number]): Punto[] => [...buscarRuta(plano, desde, entradaG), afueraG];
      const fin = () => { retirar(per); salio(); };
      if (i === 0 && pasaPorCaja) {
        espera(200, () => caminar(per, [...buscarRuta(plano, silla.grilla, local.pagoPunto)], 1.5, () => {
          per.raiz.rotation.y = Math.PI;
          avisoCaja(`${m.nombre} pagó ✓`); if (local.cajero) local.cajero.trabajando = t + 1.6; sonido.caja();
          espera(1500, () => caminar(per, salida(local.pagoPunto), 1.6, fin));
        }));
      } else {
        espera(600 + i * 350, () => caminar(per, salida(silla.grilla), 1.6, fin));
      }
    });
  }

  function servirMesa(m: MesaEsc) {
    m.comida.clear(); m.vapor = [];
    const g = grupos.get(m.id);
    const n = g ? g.personas.length : personasDeMesa(m);
    m.sillas.slice(0, n).forEach((s, i) => {
      const pos = s.local.clone().multiplyScalar(0.45);
      malla(new THREE.CylinderGeometry(0.13, 0.13, 0.02, 16), M('#FFFFFF'), pos.x, 0.76, pos.z, m.comida);
      const tipo = (i + Number(m.id)) % 3;
      if (tipo === 0) { malla(new THREE.CylinderGeometry(0.06, 0.05, 0.17, 12), M('#E67929'), pos.x, 0.86, pos.z, m.comida); m.vapor.push(new THREE.Vector3(m.cx + pos.x, 0.96, m.cz + pos.z)); }
      else if (tipo === 1) malla(new THREE.CylinderGeometry(0.08, 0.08, 0.08, 14), M('#5B3A29'), pos.x, 0.81, pos.z, m.comida);
      else malla(new THREE.BoxGeometry(0.16, 0.06, 0.1), M('#C9874A'), pos.x, 0.8, pos.z, m.comida);
    });
  }

  /** Pone la mesa como dicen los datos (anillo, etiqueta, platos, mano arriba). */
  function sincronizarMesa(m: MesaEsc) {
    const d = datos?.mesas.find((x) => x.id === m.id);
    const est = d?.estado ?? 'LIBRE';
    (m.anillo.material as THREE.MeshBasicMaterial).color.setHex(COLOR_ESTADO[est]);
    m.cartel.visible = est === 'RESERVADA';
    const g = grupos.get(m.id);
    if (g) g.personas.forEach((p, i) => { p.manoArriba = est === 'POR_COBRAR' && i === 0; });
    if (est === 'COMIENDO' || est === 'POR_COBRAR') { if (!m.comida.children.length && g) servirMesa(m); }
    else if (est === 'LIBRE' || est === 'RESERVADA') { m.comida.clear(); m.vapor = []; }
    const pers = g ? g.personas.length : 0;
    m.etq.el.className = `sv-etq sv-etq-mesa ${est.toLowerCase()}`;
    m.etq.el.innerHTML = `<b>${m.item.numero ?? m.nombre}</b>${g ? `${pers}/${m.seats} pers.${d?.pedido ? ' · ' + d.pedido.codigo : ''}` : `${m.seats} pers.`}<br><span class="ch">${textoMesa(est, d)}</span>`;
  }
  const textoMesa = (est: string, d?: SalonVivo['mesas'][number]) =>
    est === 'RESERVADA' ? `Reservada ${d?.reserva?.hora ?? ''}` : est === 'LIBRE' ? 'Libre' : est === 'POR_COBRAR' ? 'Pide la cuenta' : est === 'COMIENDO' ? 'Comiendo' : 'Esperando pedido';

  /* ---------- Tareas de los meseros ---------- */
  const puntoMesa = (m: MesaEsc): [number, number] => libreEn(m.servicio[0], m.servicio[1]);
  function irAMesa(ms: Mesero, m: MesaEsc, alLlegar: () => void) {
    caminar(ms.obj, rutaA(ms.obj, puntoMesa(m)), ms.vel, () => { raizDe(ms).rotation.y = m.mira; alLlegar(); });
  }
  function volverBase(ms: Mesero) {
    caminar(ms.obj, rutaA(ms.obj, aGrid(ms.base)), ms.vel * 0.9, () => { ms.tarea = null; raizDe(ms).rotation.y = 0; alCambiar(); });
  }
  function procesarMeseros() {
    for (const ms of meseros) {
      if (ms.tarea || caminando(raizDe(ms))) continue;
      const mozosLibres = meseros.some((o) => !o.esCapri && !o.tarea);
      const i = tareas.findIndex((tk) => (tk.tipo === 'pedido' || tk.tipo === 'llevar') ? !despachoOcupado : tk.tipo === 'limpiar' ? !ms.esCapri || !mozosLibres : true);
      if (i >= 0) {
        const tk = tareas.splice(i, 1)[0];
        ms.tarea = tk; alCambiar();
        if (tk.tipo === 'pedido') atender(ms, tk);
        else if (tk.tipo === 'llevar') atenderLlevar(ms, tk);
        else if (tk.tipo === 'cuenta') llevarCuenta(ms, tk.mesaId);
        else if (tk.tipo === 'tomar') tomarPedido(ms, tk.mesaId);
        else limpiarMesa(ms, tk.mesaId);
        continue;
      }
      if (ms.esCapri) paseoCapri();
    }
  }
  function tomarPedido(ms: Mesero, mesaId: string) {
    const m = mesaPorId(mesaId);
    if (!m || !grupos.has(mesaId) || estadoDe(m) !== 'ESPERANDO') { ms.tarea = null; return; }
    irAMesa(ms, m, () => {
      ms.libreta.visible = true;
      if (ms.esCapri) accion('anotando', 2.9); else ms.per!.anotaHasta = t + 2.9;
      hablar(ms, azar(['¿Qué les sirvo hoy? 📝', '¡Hola! ¿Ya saben qué van a pedir?', 'Les recomiendo el frappé de caramelo 😉']), 2.4);
      espera(2900, () => { ms.libreta.visible = false; volverBase(ms); });
    });
  }
  function llevarCuenta(ms: Mesero, mesaId: string) {
    const m = mesaPorId(mesaId);
    if (!m || !grupos.has(mesaId)) { ms.tarea = null; return; }
    irAMesa(ms, m, () => {
      hablar(ms, 'Aquí tiene su cuenta 🧾', 2.4);
      espera(1800, () => volverBase(ms));
    });
  }
  function limpiarMesa(ms: Mesero, mesaId: string) {
    const m = mesaPorId(mesaId);
    if (!m || grupos.has(mesaId)) { ms.tarea = null; return; }
    irAMesa(ms, m, () => {
      if (ms.per) ms.per.limpiaHasta = t + 2.6; else accion('baile', 2.4);
      hablar(ms, '¡Mesa lista! ✨', 2.2);
      espera(2600, () => { m.comida.clear(); m.vapor = []; volverBase(ms); });
    });
  }
  const pedidoListo = (codigo: string): PedidoVivo | undefined => datos?.despacho.find((p) => p.codigo === codigo);
  function atender(ms: Mesero, tk: Extract<Tarea, { tipo: 'pedido' }>) {
    const m = mesaPorId(tk.mesaId);
    if (!m || !pedidoListo(tk.codigo) || !local.despachoPunto) { ms.tarea = null; return; }
    despachoOcupado = true;
    const o = raizDe(ms);
    caminar(ms.obj, rutaA(ms.obj, local.despachoPunto), ms.vel, () => {
      o.rotation.y = Math.PI;
      espera(650, () => {
        despachoOcupado = false;
        cargar(ms, 'bandeja'); ocultarBandeja(true);
        caminar(ms.obj, rutaA(ms.obj, puntoMesa(m)), ms.vel, () => {
          o.rotation.y = m.mira;
          cargar(ms, null);
          if (grupos.has(m.id)) servirMesa(m);
          if (ms.esCapri) capriEstado.felizHasta = t + 3.5;
          saludar(ms); hablar(ms, azar([`¡Buen provecho${pedidoListo(tk.codigo)?.cliente ? ', ' + pedidoListo(tk.codigo)!.cliente : ''}! 😋`, '¡Aquí está su pedido!', '¡Que lo disfruten! 😊']));
          espera(1500, () => volverBase(ms));
        });
      });
    });
  }
  function atenderLlevar(ms: Mesero, tk: Extract<Tarea, { tipo: 'llevar' }>) {
    const c = clientesLlevar.get(tk.codigo);
    if (!c || !local.despachoPunto) { ms.tarea = null; return; }
    despachoOcupado = true;
    const o = raizDe(ms);
    caminar(ms.obj, rutaA(ms.obj, local.despachoPunto), ms.vel, () => {
      o.rotation.y = Math.PI;
      espera(650, () => {
        despachoOcupado = false;
        cargar(ms, 'bolsa'); ocultarBandeja(true);
        const spot = local.esperaLlevar[c.spot];
        caminar(ms.obj, rutaA(ms.obj, [spot[0], spot[1] - 0.8]), ms.vel, () => {
          o.rotation.y = 0;
          cargar(ms, null);
          if (ms.esCapri) capriEstado.felizHasta = t + 3.5;
          saludar(ms); hablar(ms, `¡Aquí tienes${pedidoListo(tk.codigo)?.cliente ? ', ' + pedidoListo(tk.codigo)!.cliente : ''}! 🛍️`);
          c.per.saludaHasta = t + 1.5; c.per.usaCel = false;
          espera(1200, () => volverBase(ms));
        });
      });
    });
  }
  function paseoCapri() {
    const ms = meseros[0];
    if (t <= capriEstado.proxAccion) return;
    capriEstado.proxAccion = t + 7 + Math.random() * 5;
    const r = Math.random();
    if (demorado() && r < 0.5) { decir(azar(['¡Ya casi sale, gracias por esperar! 🙏', 'Voy a apurar a cocina 😅'])); return; }
    if (r < 0.3) { accion('saludando', 2.6); decir(azar(['¡Bienvenidos a Caprichos! 😊', '¿Ya probaron el frappé de caramelo?', 'Busca tu código en la pantalla 👀'])); return; }
    if (r < 0.45) { accion('baile', 3); return; }
    const ocupadas = local.mesas.filter((x) => grupos.has(x.id) && grupos.get(x.id)!.fase === 'sentado');
    const m = ocupadas.length ? azar(ocupadas) : null;
    if (!m) return;
    ms.tarea = 'paseo'; alCambiar();
    irAMesa(ms, m, () => {
      accion('saludando', 2);
      decir(estadoDe(m) === 'COMIENDO' ? azar(['¿Todo bien por aquí? 😊', '¡Que lo disfruten!', '¿Algo más para la mesa?']) : azar(['Su pedido ya está en cocina 👩‍🍳', '¡Ya casi sale su pedido!', 'Gracias por esperar 💛']));
      espera(2200, () => volverBase(ms));
    });
  }
  const demorado = () => !!datos && [...datos.cocina, ...datos.despacho].some((p) => p.minutos >= UMBRAL_DEMORA);

  function ocultarBandeja(tomando = false) {
    const listos = (datos?.despacho ?? []);
    const nMesa = Math.max(0, listos.filter((p) => p.modalidad === 'MESA').length - (tomando ? 1 : 0));
    const nOtros = listos.filter((p) => p.modalidad !== 'MESA').length;
    local.bandejas.forEach((b, i) => { b.visible = i < nMesa; });
    local.bolsas.forEach((b, i) => { b.visible = i < nOtros; });
  }

  /* ---------- Para llevar y delivery ---------- */
  const repartidor = persona(ctx, gente, { ropa: '#E67929', pantalon: '#1C1C22', gorro: 'casco', rol: 'repartidor', lentes: false, estilo: 'corto' });
  const moto = crearMoto(ctx);
  const parqueo = G(entradaG[0] + dirG[0] * 1.9 + dirG[1] * 3.2, entradaG[1] + dirG[1] * 1.9 + dirG[0] * 3.2);
  const alLado = G(entradaG[0] + dirG[0] * 1.4 + dirG[1] * 2.8, entradaG[1] + dirG[1] * 1.4 + dirG[0] * 2.8);
  moto.position.copy(parqueo); moto.rotation.y = dirG[0] ? 0 : Math.PI / 2; escena.add(moto);
  repartidor.raiz.position.copy(alLado); repartidor.raiz.rotation.y = Math.atan2(-dirG[0], -dirG[1]) || 0; repartidor.usaCel = true;
  escena.add(repartidor.raiz);
  const bolsaRep = crearBolsa(ctx, repartidor.raiz, 0.3, 0.42, 0.12);
  void bolsaRep;
  const lejos = G(parqueo.x + ancho / 2 + dirG[0] * 14, parqueo.z + alto / 2 + dirG[1] * 14);

  function salirEnMoto(inmediato: boolean) {
    motoEstado = 'ruta';
    repartidor.usaCel = false;
    moto.add(repartidor.raiz); repartidor.raiz.position.set(0, 0.16, -0.1); repartidor.raiz.rotation.set(0, 0, 0); repartidor.enMoto = true;
    if (inmediato || ctx.reducir) { moto.visible = false; return; }
    sonido.moto();
    caminar(moto, [lejos], 4.5, () => { moto.visible = false; });
  }
  function volverMoto() {
    motoEstado = 'parqueada';
    moto.visible = true;
    const fin = () => {
      moto.remove(repartidor.raiz); escena.add(repartidor.raiz);
      repartidor.enMoto = false; repartidor.cuerpo.rotation.x = 0;
      repartidor.raiz.position.copy(alLado); repartidor.usaCel = true;
      alCambiar();
    };
    if (ctx.reducir) { moto.position.copy(parqueo); fin(); return; }
    moto.position.copy(lejos); sonido.moto();
    caminar(moto, [parqueo], 4.5, fin);
  }

  function aplicarLlevar(d: SalonVivo, primera: boolean) {
    const vivosLlevar = [...d.caja, ...d.cocina, ...d.despacho].filter((p) => p.modalidad === 'LLEVAR');
    const codigos: string[] = [];
    for (const p of vivosLlevar) if (!codigos.includes(p.codigo)) codigos.push(p.codigo);
    for (const [cod, c] of [...clientesLlevar]) {
      if (codigos.includes(cod)) continue;
      clientesLlevar.delete(cod);
      caminar(c.per, [...buscarRuta(plano, aGrid(c.per.raiz.position), entradaG), afueraG], 1.6, () => retirar(c.per));
    }
    for (const cod of codigos.slice(0, 3)) {
      if (clientesLlevar.has(cod)) continue;
      const usados = new Set([...clientesLlevar.values()].map((c) => c.spot));
      const spot = [0, 1, 2].find((i) => !usados.has(i));
      if (spot === undefined) break;
      const per = persona(ctx, gente);
      escena.add(per.raiz);
      clientesLlevar.set(cod, { per, spot });
      const sp = local.esperaLlevar[spot];
      if (primera) { per.raiz.position.copy(G(sp[0], sp[1])); per.raiz.rotation.y = Math.PI; }
      else {
        per.raiz.position.copy(G(afueraG[0], afueraG[1]));
        caminar(per, [entradaG, ...rutaDesdeEntrada(sp)], 1.6, () => { per.raiz.rotation.y = Math.PI; });
      }
    }
  }

  /* ---------- Aplicar datos reales ---------- */
  function aplicar(nuevo: SalonVivo, primera: boolean) {
    const previo = datos;
    datos = nuevo;
    const previoMesa = new Map((previo?.mesas ?? []).map((m) => [m.id, m.estado]));
    for (const dm of nuevo.mesas) {
      const m = mesaPorId(dm.id);
      if (!m) continue;
      const ocupada = dm.estado === 'ESPERANDO' || dm.estado === 'COMIENDO' || dm.estado === 'POR_COBRAR';
      const g = grupos.get(m.id);
      if (ocupada && !g) llegarMesa(m, primera);
      else if (!ocupada && g) irseMesa(m, previoMesa.get(m.id) === 'POR_COBRAR');
      if (dm.estado === 'POR_COBRAR' && previoMesa.get(m.id) && previoMesa.get(m.id) !== 'POR_COBRAR' && !primera) tareas.push({ tipo: 'cuenta', mesaId: m.id });
      sincronizarMesa(m);
    }
    // Pedidos que aparecen listos en despacho: campana y a llevarlos
    const nuevosListos = nuevo.despacho.filter((p) => !codigosDespacho.has(p.codigo));
    codigosDespacho = new Set(nuevo.despacho.map((p) => p.codigo));
    for (let i = tareas.length - 1; i >= 0; i--) { const tk = tareas[i]; if ((tk.tipo === 'pedido' || tk.tipo === 'llevar') && !codigosDespacho.has(tk.codigo)) tareas.splice(i, 1); }
    aplicarLlevar(nuevo, primera);
    for (const p of nuevosListos) {
      if (p.modalidad === 'MESA' && p.mesaIds[0] && mesaPorId(p.mesaIds[0])) tareas.push({ tipo: 'pedido', codigo: p.codigo, mesaId: p.mesaIds[0] });
      else if (p.modalidad === 'LLEVAR') tareas.push({ tipo: 'llevar', codigo: p.codigo });
      if (!primera) {
        sonido.campana();
        const dest = p.modalidad === 'MESA' ? p.mesas[0] ?? 'mesa' : p.modalidad === 'DELIVERY' ? 'delivery' : 'para llevar';
        decir(`¡${p.codigo}, ${dest}, su pedido está listo! 🔔`, 3.5);
      }
    }
    ocultarBandeja();
    // Cocina por área
    const cargaPor = new Map(nuevo.cargaCocina.map((c) => [claveArea(c.area), c.pendientes]));
    for (const z of local.zonas.values()) {
      const n = cargaPor.get(z.clave) ?? 0;
      z.carga = n;
      z.etq.el.className = 'sv-etq sv-etq-area' + (n ? ' activa' : '');
      z.etq.el.innerHTML = `${z.area === 'GENERAL' ? 'COCINA' : z.area}<em>${n ? n + ' en preparación' : 'libre'}</em>`;
    }
    if (!primera && (cargaPor.get('BEBID') ?? 0) > 0) sonido.cafetera();
    if (local.despachoEtq) local.despachoEtq.el.innerHTML = `DESPACHO<em>${nuevo.despacho.length} listos</em>`;
    if (local.cajaEtq) local.cajaEtq.el.innerHTML = `CAJA<em>${nuevo.caja.length} por cobrar</em>`;
    const firma = nuevo.caja.map((p) => p.codigo).join(',');
    if (!primera && firma !== firmaCaja && local.cajero) { local.cajero.trabajando = t + 1.4; sonido.caja(); }
    firmaCaja = firma;
    // Delivery: la moto sale cuando hay pedidos en reparto y vuelve cuando ya no hay
    if (nuevo.enReparto.length > 0 && motoEstado === 'parqueada') salirEnMoto(primera);
    else if (nuevo.enReparto.length === 0 && motoEstado === 'ruta') volverMoto();
    sonido.murmullo(nuevo.conteos.personas);
    alCambiar();
  }

  /* ---------- Animación de Capri ---------- */
  const suave = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
  function animarCapri(dt: number) {
    if (!capri) return;
    const e = capriEstado, c = capri;
    let p = (t - e.animDesde) / e.animDur;
    if (e.anim !== 'reposo' && p >= 1) { e.anim = 'reposo'; p = 0; }
    const anda = caminando(capriObj), lleva = bandejaC.visible;
    let dZ = -0.18, iZ = 0.18, dX = 0, iX = 0, salto = 0, giro = 0, torsion = 0, habla = 0, feliz = false;
    const ud = capriObj.userData, rr = ud.ritmo || 0, fp = ud.paso || 0;
    if (anda) { dX = Math.sin(fp) * 0.55 * rr; iX = -Math.sin(fp) * 0.55 * rr; salto = Math.abs(Math.cos(fp)) * 0.07 * rr; }
    c.piernas[0].rotation.x = -Math.sin(fp) * 0.6 * rr; c.piernas[1].rotation.x = Math.sin(fp) * 0.6 * rr;
    if (lleva) { dX = -1.35; iX = -1.35; dZ = -0.05; iZ = 0.05; }
    if (!anda && !lleva) switch (e.anim) {
      case 'saludando': dZ = -2.55 + Math.sin(t * 10) * 0.35; habla = 1; break;
      case 'giro': giro = suave(p) * Math.PI * 2; salto = Math.sin(p * Math.PI) * 0.25; dZ = -1.3; iZ = 1.3; feliz = true; break;
      case 'anotando': dX = -1.0 + Math.sin(t * 14) * 0.08; iX = -1.25; dZ = -0.15; iZ = 0.2; habla = 1; break;
      case 'baile': torsion = Math.sin(t * 6) * 0.35; dZ = -1.4 + Math.sin(t * 6) * 0.6; iZ = 1.4 + Math.sin(t * 6) * 0.6; salto = Math.abs(Math.sin(t * 6)) * 0.1; feliz = true; break;
    }
    const k = Math.min(1, dt * 10);
    c.brazoD.rotation.z += (dZ - c.brazoD.rotation.z) * k; c.brazoI.rotation.z += (iZ - c.brazoI.rotation.z) * k;
    c.brazoD.rotation.x += (dX - c.brazoD.rotation.x) * k; c.brazoI.rotation.x += (iX - c.brazoI.rotation.x) * k;
    c.raiz.position.y = salto / 0.44; c.raiz.rotation.y = giro;
    c.cuerpo.rotation.y += (torsion - c.cuerpo.rotation.y) * k;
    c.cuerpo.position.y = Math.sin(t * 2.2) * 0.025;
    c.cabeza.rotation.y = anda ? Math.sin(fp * 0.5) * 0.08 : Math.sin(t * 0.5) * 0.3;
    c.cabeza.rotation.z = Math.sin(t * 1.3) * 0.05;
    const parp = t % 3.7 < 0.12 ? 0.12 : 1;
    const cara = t < e.felizHasta || feliz ? 'feliz' : demorado() ? 'preocupada' : 'normal';
    if (cara === 'feliz') feliz = true;
    c.cejas.forEach((ce, i) => {
      const s = i ? 1 : -1;
      const rz = cara === 'preocupada' ? -s * 0.4 : cara === 'feliz' ? s * 0.12 : 0;
      ce.rotation.z += (rz - ce.rotation.z) * k; ce.position.y += ((cara === 'feliz' ? 0.2 : 0.16) - ce.position.y) * k;
    });
    c.boca.rotation.z = cara === 'preocupada' ? 0 : Math.PI;
    c.boca.position.y = cara === 'preocupada' ? -0.21 : -0.16;
    c.gota.visible = cara === 'preocupada';
    if (c.gota.visible) c.gota.position.y = 0.28 - ((t * 0.5) % 1) * 0.25;
    c.ojos.forEach((o) => { o.scale.y = feliz ? 0.45 : parp; });
    c.boca.scale.y = 1 + (habla || globoC.visible ? (Math.sin(t * 18) * 0.5 + 0.5) * 1.2 : 0) + (cara === 'feliz' ? 0.5 : cara === 'preocupada' ? -0.3 : 0);
    c.boca.scale.x = cara === 'feliz' ? 1.35 : 1;
    bandejaC.position.y = 0.66 + salto;
    c.orbitan.forEach((s) => { const a = t * 1.2 + s.userData.fase; s.position.set(Math.cos(a) * 1.1, 2.3 + Math.sin(a * 2) * 0.2, Math.sin(a) * 1.1); s.rotation.y = t * 3; });
  }

  ponerCapri(TEMAS.normal);

  return {
    aplicar,
    ponerCapri,
    decir,
    accion,
    capriObj,
    moto,
    caminandoMoto: () => caminando(moto),
    estaCaminando: caminando,
    comiendo: (p: Persona) => !!p.mesaId && estadoDe(mesaPorId(p.mesaId)!) === 'COMIENDO',
    paso(tt: number, dt: number) {
      t = tt;
      moverAgentes(dt);
      procesarMeseros();
      animarCapri(dt);
      animarGente(gente, t, dt, (p) => !!p.mesaId && !!mesaPorId(p.mesaId) && estadoDe(mesaPorId(p.mesaId)!) === 'COMIENDO');
      if (globoC.visible && t > globoCHasta) globoC.visible = false;
      if (globoCaja.visible && t > globoCajaHasta) globoCaja.visible = false;
      for (const ms of meseros) if (!ms.esCapri && ms.globo.visible && t > ms.globoHasta) ms.globo.visible = false;
      if (moto.visible && agentes.size && [...agentes].some((a) => a.obj === moto)) moto.userData.ruedas.forEach((r: THREE.Mesh) => { r.rotation.z -= dt * 14; });
      for (const z of local.zonas.values()) z.tortas?.forEach((g, i) => { g.rotation.y = t * (z.carga ? 1.5 : 0.4) + i; });
    },
    resumenMeseros(): ResumenMesero[] {
      return meseros.map((ms) => {
        const tk = ms.tarea;
        const txt = !tk ? 'Libre' : tk === 'paseo' ? 'Visitando mesas' : tk.tipo === 'tomar' ? `Toma el pedido · ${mesaPorId(tk.mesaId)?.nombre ?? ''}` : tk.tipo === 'cuenta' ? `Lleva la cuenta · ${mesaPorId(tk.mesaId)?.nombre ?? ''}` : tk.tipo === 'limpiar' ? `Limpiando ${mesaPorId(tk.mesaId)?.nombre ?? ''}` : tk.tipo === 'llevar' ? `Lleva ${tk.codigo} · para llevar` : `Lleva ${tk.codigo} · ${mesaPorId(tk.mesaId)?.nombre ?? ''}`;
        return { nombre: ms.nombre, esCapri: ms.esCapri, ocupado: !!tk && tk !== 'paseo', texto: txt };
      });
    },
    destruir() { vivo = false; for (const id of timers) clearTimeout(id); timers.clear(); agentes.clear(); },
  };
}

export type Director = ReturnType<typeof crearDirector>;
