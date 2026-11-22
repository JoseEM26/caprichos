import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { crearCtx, liberar } from './base';
import { construirLocal } from './local';
import { crearDirector, type ResumenMesero } from './director';
import { crearDecoracion, crearParticulas, TEMAS } from './temas';
import { crearSonido } from './sonido';
import { planoAEscena, type PlanoEscena } from './planoAEscena';
import type { Persona } from './personas';
import type { PisoVivo, SalonVivo } from '../salonVivoApi';

/**
 * Motor 3D del salón en vivo: arma la escena desde el plano real y la anima con los datos reales.
 * Three a pelo (sin react-three-fiber), como la mascota; se carga solo cuando se abre el módulo.
 */
export type VistaCamara = 'general' | 'cocina' | 'salon' | 'capri';
export type ModoHora = 'auto' | 'dia' | 'tarde' | 'noche';

export interface OpcionesMotor {
  piso: PisoVivo;
  contenedor: HTMLElement;
  lienzo: HTMLCanvasElement;
  capa: HTMLElement;
  reducir: boolean;
  ligero: boolean;
  alMeseros?: (m: ResumenMesero[]) => void;
}

export interface Motor {
  actualizar: (d: SalonVivo) => void;
  camara: (v: VistaCamara) => void;
  /** Vuelve a la vista elegida (botón «Centrar»): deshace el zoom o el arrastre que dejó el local fuera de cuadro. */
  centrar: () => void;
  tema: (clave: string) => void;
  hora: (m: ModoHora) => string;
  sonido: (on: boolean) => boolean;
  voz: (on: boolean) => void;
  saludar: () => void;
  bailar: () => void;
  destruir: () => void;
}

const PI = Math.PI;
const FASES = {
  dia: { sol: [0xfff4e6, 0.95], pos: [6, 14, 8], hemi: 0.75, fondo: 0x12384D, vidrio: [0xBFE3F2, 0.25], luces: 0, letrero: 0.15 },
  tarde: { sol: [0xFFB070, 0.8], pos: [14, 6, 6], hemi: 0.55, fondo: 0x3A2A3E, vidrio: [0xFFC48A, 0.45], luces: 0.35, letrero: 0.6 },
  noche: { sol: [0x8FA8FF, 0.18], pos: [-6, 12, 6], hemi: 0.3, fondo: 0x050E15, vidrio: [0x16304A, 0.9], luces: 1.0, letrero: 1.4 },
} as const;

export const horaLimaNumero = () => Number(new Intl.DateTimeFormat('es-PE', { hour: 'numeric', hour12: false, timeZone: 'America/Lima' }).format(new Date())) % 24;
export const faseDeHora = (h: number): 'dia' | 'tarde' | 'noche' => (h >= 6 && h < 17 ? 'dia' : h >= 17 && h < 19 ? 'tarde' : 'noche');

export function crearMotor(op: OpcionesMotor): Motor {
  const { contenedor, lienzo, capa, reducir, ligero } = op;
  const plano: PlanoEscena = planoAEscena(op.piso);
  const { ancho, alto } = plano;
  const k = Math.max(ancho / 20, alto / 12, 0.5);

  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: !ligero });
  renderer.setPixelRatio(ligero ? 1 : Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = !ligero;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x082231);

  const escena = new THREE.Scene();
  escena.fog = new THREE.Fog(0x082231, 30 * k, 60 * k);
  const camara = new THREE.PerspectiveCamera(40, 1, 0.1, 200 * k);
  const vistas: Record<string, { pos: THREE.Vector3; obj: THREE.Vector3 }> = {};
  const centroZ = alto * 0.117;
  vistas.general = { pos: new THREE.Vector3(0, 17.5 * k, 16.5 * k), obj: new THREE.Vector3(0, 0, centroZ) };
  camara.position.copy(vistas.general.pos);
  const controles = new OrbitControls(camara, lienzo);
  controles.target.copy(vistas.general.obj);
  controles.enableDamping = true; controles.dampingFactor = 0.08;
  controles.minDistance = 5; controles.zoomSpeed = 0.7; controles.maxDistance = 30 * k; controles.maxPolarAngle = 1.35; controles.screenSpacePanning = false;

  // Las luces de three moderno son físicas: se escalan para igualar la maqueta
  const hemi = new THREE.HemisphereLight(0xffffff, 0x3a4c5a, 0.75 * PI);
  const sol = new THREE.DirectionalLight(0xfff4e6, 0.9 * PI);
  sol.position.set(6, 14, 8); sol.castShadow = !ligero; sol.shadow.mapSize.set(2048, 2048);
  Object.assign(sol.shadow.camera, { left: -ancho * 0.6, right: ancho * 0.6, top: alto * 0.75, bottom: -alto * 0.75 });
  sol.shadow.bias = -0.0005;
  const calida = new THREE.PointLight(0xFFD9A8, 0.6 * 11, 18 * k, 1); calida.position.set(0, 4, 2);
  escena.add(hemi, sol, calida);

  const ctx = crearCtx(escena, capa, ancho, alto, reducir, ligero);
  const gente = new Set<Persona>();
  const local = construirLocal(ctx, plano, gente);
  const sonido = crearSonido();

  // Vistas que dependen del plano
  const cocinas = plano.items.filter((i) => i.clase === 'cocina');
  const cc = cocinas.length ? new THREE.Vector3(cocinas.reduce((s, c) => s + c.cx, 0) / cocinas.length, 0.6, cocinas.reduce((s, c) => s + c.cz, 0) / cocinas.length) : new THREE.Vector3(0, 0.6, -alto * 0.35);
  vistas.cocina = { pos: new THREE.Vector3(cc.x - 1, 6.5 * k, cc.z + 7.7), obj: cc };
  vistas.salon = { pos: new THREE.Vector3(3 * k, 7.5 * k, 11 * k), obj: new THREE.Vector3(2 * k, 0, alto * 0.2) };

  // Partículas, humo y vapor
  const particulas = crearParticulas(ctx, ligero ? 0 : 700);
  escena.add(particulas.puntos);
  const textura = (particulas.puntos.material as THREE.PointsMaterial).map;
  const humo = (() => {
    const n = 60, pos = new Float32Array(n * 3), vida = new Float32Array(n);
    for (let i = 0; i < n; i++) vida[i] = Math.random();
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const p = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.22, color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false, map: textura }));
    p.visible = !ligero && !reducir && local.humos.length > 0; escena.add(p);
    return (dt: number) => {
      if (!p.visible) return;
      for (let i = 0; i < n; i++) {
        vida[i] += dt * 0.5; if (vida[i] > 1) vida[i] = 0;
        const o = local.humos[i % local.humos.length];
        pos[i * 3] = o.x + Math.sin(vida[i] * 6 + i) * 0.08; pos[i * 3 + 1] = o.y + vida[i] * 1.2; pos[i * 3 + 2] = o.z;
      }
      geo.attributes.position.needsUpdate = true;
    };
  })();
  const vapor = (() => {
    const n = 90, pos = new Float32Array(n * 3), vida = new Float32Array(n);
    for (let i = 0; i < n; i++) vida[i] = Math.random();
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.1, color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false, map: textura }));
    escena.add(pts);
    return (dt: number, fuentes: THREE.Vector3[]) => {
      pts.visible = fuentes.length > 0 && !reducir && !ligero;
      if (!pts.visible) return;
      for (let i = 0; i < n; i++) {
        vida[i] += dt * 0.55; if (vida[i] > 1) vida[i] = 0;
        const o = fuentes[i % fuentes.length];
        pos[i * 3] = o.x + Math.sin(vida[i] * 7 + i) * 0.03; pos[i * 3 + 1] = o.y + vida[i] * 0.4; pos[i * 3 + 2] = o.z + Math.cos(vida[i] * 5 + i) * 0.02;
      }
      geo.attributes.position.needsUpdate = true;
    };
  })();

  const decoracion = crearDecoracion(ctx, { hemi, calida }, local.mesas.map((m) => m.centro), local.spots, particulas);
  let claveTema = 'normal';
  const director = crearDirector(ctx, plano, local, gente, sonido, () => op.alMeseros?.(director.resumenMeseros()));

  /* ---------- Hora del día ---------- */
  let modoHora: ModoHora = 'auto';
  function aplicarHora(): string {
    const fase = modoHora === 'auto' ? faseDeHora(horaLimaNumero()) : modoHora;
    const P = FASES[fase];
    sol.color.setHex(P.sol[0]); sol.intensity = P.sol[1] * PI; sol.position.set(P.pos[0], P.pos[1], P.pos[2]);
    hemi.intensity = P.hemi * PI;
    renderer.setClearColor(P.fondo); (escena.fog as THREE.Fog).color.setHex(P.fondo);
    local.ventanas.forEach((v) => { v.color.setHex(P.vidrio[0]); v.emissive.setHex(P.vidrio[0]); v.emissiveIntensity = P.vidrio[1]; });
    local.lucesNoche.forEach((l) => { l.intensity = P.luces * 9; });
    if (local.letrero) local.letrero.emissiveIntensity = P.letrero;
    return modoHora === 'auto' ? `Automática · ${{ dia: 'día', tarde: 'atardecer', noche: 'noche' }[fase]}` : { dia: 'Día', tarde: 'Atardecer', noche: 'Noche' }[fase];
  }
  const relojHora = setInterval(() => { if (modoHora === 'auto') aplicarHora(); }, 60000);

  /* ---------- Cámara ---------- */
  let vista: VistaCamara = 'general', volando = true, tocando = false;
  controles.addEventListener('start', () => { tocando = true; volando = false; });
  controles.addEventListener('end', () => { tocando = false; });
  const vSeguir = new THREE.Vector3();
  // En pantallas angostas (celular de pie) la vista se aleja para que el local entre completo
  let alejar = 1;
  const posDe = (v: { pos: THREE.Vector3; obj: THREE.Vector3 }) => (alejar === 1 ? v.pos : v.obj.clone().add(v.pos.clone().sub(v.obj).multiplyScalar(alejar)));
  // El punto al que mira la cámara no sale del local: arrastrar con dos dedos ya no lo pierde
  const limitarObjetivo = () => {
    const t = controles.target;
    t.x = THREE.MathUtils.clamp(t.x, -ancho * 0.6, ancho * 0.6);
    t.z = THREE.MathUtils.clamp(t.z, -alto * 0.6, alto * 0.6);
    t.y = THREE.MathUtils.clamp(t.y, 0, 3);
  };
  function moverCamara() {
    if (vista === 'capri') {
      vSeguir.copy(director.capriObj.position); vSeguir.y = 0.8;
      controles.target.lerp(vSeguir, 0.08);
      if (volando) camara.position.lerp(vSeguir.clone().add(new THREE.Vector3(0, 4.5, 6)), 0.05);
      return;
    }
    if (!volando || tocando) return;
    const v = vistas[vista];
    const destino = posDe(v);
    if (reducir) { camara.position.copy(destino); controles.target.copy(v.obj); volando = false; return; }
    camara.position.lerp(destino, 0.06); controles.target.lerp(v.obj, 0.06);
    if (camara.position.distanceTo(destino) < 0.05) volando = false;
  }

  // Tocar a Capri
  const rayo = new THREE.Raycaster();
  let abajo: { x: number; y: number } | null = null;
  const alBajar = (e: PointerEvent) => { abajo = { x: e.clientX, y: e.clientY }; };
  const alSubir = (e: PointerEvent) => {
    if (!abajo || Math.hypot(e.clientX - abajo.x, e.clientY - abajo.y) > 6) return;
    const r = lienzo.getBoundingClientRect();
    rayo.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camara);
    if (rayo.intersectObject(director.capriObj, true).length && !director.estaCaminando(director.capriObj)) {
      director.accion(Math.random() < 0.5 ? 'giro' : 'saludando', 1.6);
      director.decir(['¡Hola! 😊', '¡Jiji, cosquillas!', 'Estoy atenta a los pedidos 👀', '¡Hoy hay donas recién hechas! 🍩'][Math.floor(Math.random() * 4)], 2.4);
    }
  };
  lienzo.addEventListener('pointerdown', alBajar);
  lienzo.addEventListener('pointerup', alSubir);

  function ajustar() {
    const w = contenedor.clientWidth, h = contenedor.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camara.aspect = w / h; camara.updateProjectionMatrix();
    // Solo si cambió de verdad (girar el celular), no por la barra del navegador que aparece y se esconde
    // Angosta (celular de pie): se aleja; muy ancha (TV con la franja de pedidos abajo): se acerca para llenar el alto
    const nuevo = THREE.MathUtils.clamp(1.5 / (w / h || 1), 0.72, 2.2);
    if (Math.abs(nuevo - alejar) > 0.05) { alejar = nuevo; controles.maxDistance = 30 * k * alejar; volando = true; }
  }
  const observador = new ResizeObserver(ajustar); observador.observe(contenedor);
  ajustar();

  /* ---------- Etiquetas HTML sobre el 3D ---------- */
  const vTmp = new THREE.Vector3();
  function moverEtiquetas() {
    const w = contenedor.clientWidth, h = contenedor.clientHeight;
    for (const e of ctx.etiquetas) {
      if (!e.visible) { e.el.style.display = 'none'; continue; }
      if ((e.pos as THREE.Object3D).isObject3D) (e.pos as THREE.Object3D).getWorldPosition(vTmp); else vTmp.copy(e.pos as THREE.Vector3);
      vTmp.y += e.alto;
      vTmp.project(camara);
      const fuera = vTmp.z > 1 || Math.abs(vTmp.x) > 1.1 || Math.abs(vTmp.y) > 1.1;
      e.el.style.display = fuera ? 'none' : '';
      e.el.style.transform = `translate(${(vTmp.x * 0.5 + 0.5) * w}px, ${(-vTmp.y * 0.5 + 0.5) * h}px) translate(-50%, -100%)`;
    }
  }

  /* ---------- Bucle ---------- */
  const reloj = new THREE.Clock();
  let raf = 0, ultimo = 0, vivo = true;
  const intervalo = reducir ? 120 : ligero ? 33 : 0;
  function bucle(ms: number) {
    if (!vivo) return;
    raf = requestAnimationFrame(bucle);
    if (intervalo && ms - ultimo < intervalo) return;
    ultimo = ms;
    const dt = Math.min(reloj.getDelta(), 0.1), t = reloj.elapsedTime;
    director.paso(t, dt);
    decoracion.animar(t);
    particulas.mover(t, dt);
    humo(dt);
    vapor(dt, local.mesas.flatMap((m) => (m.comida.children.length ? m.vapor : [])));
    moverCamara();
    limitarObjetivo();
    controles.update();
    moverEtiquetas();
    renderer.render(escena, camara);
  }

  /* ---------- Inicio ---------- */
  decoracion.decorar(TEMAS.normal, 'normal');
  aplicarHora();
  let primera = true;
  let vozOn = false;
  let despachoPrevio = new Set<string>();
  raf = requestAnimationFrame(bucle);

  return {
    actualizar(d) {
      if (vozOn && !primera && typeof speechSynthesis !== 'undefined') {
        for (const p of d.despacho.filter((x) => !despachoPrevio.has(x.codigo))) {
          const num = p.codigo.replace(/\D/g, '').split('').join(' ');
          const dest = p.modalidad === 'MESA' ? p.mesas[0] ?? 'mesa' : p.modalidad === 'DELIVERY' ? 'delivery' : 'para llevar';
          const u = new SpeechSynthesisUtterance(`¡Pedido ${num}! ${dest}, su pedido está listo.`);
          u.lang = 'es-PE'; u.pitch = 1.35;
          speechSynthesis.speak(u);
        }
      }
      despachoPrevio = new Set(d.despacho.map((x) => x.codigo));
      director.aplicar(d, primera);
      primera = false;
    },
    camara(v) { vista = v; volando = true; },
    centrar() { volando = true; },
    tema(clave) {
      const t = TEMAS[clave] ?? TEMAS.normal;
      claveTema = clave in TEMAS ? clave : 'normal';
      director.ponerCapri(t);
      decoracion.decorar(t, claveTema);
      director.accion('giro', 1.4); director.decir(t.saludo, 3);
    },
    hora(m) { modoHora = m; return aplicarHora(); },
    sonido(on) { return sonido.activar(on); },
    voz(on) {
      vozOn = on;
      if (typeof speechSynthesis === 'undefined') return;
      if (on) { const u = new SpeechSynthesisUtterance('¡Hola! Soy Capri. Te aviso cuando un pedido esté listo.'); u.lang = 'es-PE'; u.pitch = 1.35; speechSynthesis.speak(u); } else speechSynthesis.cancel();
    },
    saludar() { director.accion('saludando', 2.6); director.decir(TEMAS[claveTema].saludo); },
    bailar() { director.accion('baile', 3.2); director.decir('¡A bailar! 💃', 2.4); },
    destruir() {
      vivo = false; cancelAnimationFrame(raf); clearInterval(relojHora);
      director.destruir(); sonido.cerrar();
      observador.disconnect();
      lienzo.removeEventListener('pointerdown', alBajar); lienzo.removeEventListener('pointerup', alSubir);
      controles.dispose();
      for (const e of [...ctx.etiquetas]) ctx.quitarEtiqueta(e);
      liberar(escena);
      renderer.dispose();
    },
  };
}
