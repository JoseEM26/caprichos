import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { conPelo } from './config';
import type { Avatar3D, ConfigAvatar, PartesAvatar } from './tipos';

export type VistaAvatar = 'cuerpo' | 'cabeza' | 'pies' | 'mascota';
export type AccionAvatar = 'saludando' | 'baile' | 'celebrar' | 'giro' | 'posar' | 'esperando';

const azar = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const suave = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

export function liberar(obj: THREE.Object3D): void {
  obj.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose();
  });
}

/** Luces de la maqueta. Desde three r155 las luces son físicas: la intensidad antigua se multiplica por π para verse igual. */
export function luces(escena: THREE.Scene): void {
  escena.add(new THREE.HemisphereLight(0xffffff, 0xe8d5bc, 0.75 * Math.PI));
  const sol = new THREE.DirectionalLight(0xfff4e6, 1.05 * Math.PI);
  sol.position.set(2, 4, 3);
  sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  Object.assign(sol.shadow.camera, { left: -1.4, right: 1.4, top: 2.6, bottom: -0.4 });
  sol.shadow.bias = -0.0004;
  escena.add(sol);
  const borde = new THREE.DirectionalLight(0xffd2a6, 0.55 * Math.PI);
  borde.position.set(-2.5, 2.2, -2.5);
  escena.add(borde);
  const frente = new THREE.PointLight(0xffffff, 0.25 * Math.PI, 6, 0);
  frente.position.set(0, 1.5, 2.5);
  escena.add(frente);
}

const VISTAS: Record<VistaAvatar, [THREE.Vector3, THREE.Vector3]> = {
  cuerpo: [new THREE.Vector3(0, 1.1, 4.3), new THREE.Vector3(0, 0.88, 0)],
  cabeza: [new THREE.Vector3(0, 1.5, 1.75), new THREE.Vector3(0, 1.4, 0)],
  pies: [new THREE.Vector3(0.6, 0.55, 1.7), new THREE.Vector3(0, 0.2, 0)],
  mascota: [new THREE.Vector3(1.1, 0.75, 2.5), new THREE.Vector3(0.6, 0.45, 0)],
};

/** Escena 3D del editor: renderer, cámara con órbita, piso, destellos y animaciones del avatar. */
export class EscenaAvatar {
  private renderer: THREE.WebGLRenderer;
  private escena = new THREE.Scene();
  private camara = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
  private controles: OrbitControls;
  private aro: THREE.Mesh;
  private reloj = new THREE.Clock();
  private rayo = new THREE.Raycaster();
  private obs: ResizeObserver | null = null;
  private frame = 0;
  private av: PartesAvatar | null = null;
  private cfg: ConfigAvatar | null = null;
  private pop = 0;
  private vista: VistaAvatar = 'cuerpo';
  private volando = false;
  private tocando = false;
  private anim = { estado: 'reposo' as AccionAvatar | 'reposo', desde: 0, dur: 0, prox: 4 };
  private mouse = { x: 0, y: 0, dentro: false };
  private abajo: { x: number; y: number } | null = null;
  private destellos: { lanzar: (y?: number) => void; mover: (dt: number) => void };
  private quitar: (() => void)[] = [];

  constructor(
    private lienzo: HTMLCanvasElement,
    private A: Avatar3D,
    private reducir = false,
    /** Avatar suelto (saludo, celebración, seguimiento): sin piso, sin aro y sin órbita con el dedo */
    compacto = false,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true });
    const r = this.renderer;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    luces(this.escena);
    const piso = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.96, 0.07, 64), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 }));
    piso.position.y = -0.035;
    piso.receiveShadow = true;
    this.escena.add(piso);
    this.aro = new THREE.Mesh(new THREE.TorusGeometry(0.93, 0.016, 10, 90), new THREE.MeshStandardMaterial({ color: 0xe67929, emissive: 0xe67929, emissiveIntensity: 0.15 }));
    this.aro.rotation.x = Math.PI / 2;
    this.aro.position.y = 0.004;
    this.escena.add(this.aro);
    if (compacto) { piso.visible = false; this.aro.visible = false; }
    this.destellos = this.crearDestellos();
    this.camara.position.copy(VISTAS.cuerpo[0]);
    const c = (this.controles = new OrbitControls(this.camara, lienzo));
    c.target.copy(VISTAS.cuerpo[1]);
    if (compacto) c.enabled = false;
    Object.assign(c, { enablePan: false, enableDamping: true, dampingFactor: 0.08, minDistance: 1.1, maxDistance: 6, minPolarAngle: 0.5, maxPolarAngle: 1.75 });
    c.addEventListener('start', () => { this.tocando = true; this.volando = false; });
    c.addEventListener('end', () => { this.tocando = false; });
    this.escuchar('pointermove', (e: PointerEvent) => {
      const b = lienzo.getBoundingClientRect();
      this.mouse = { x: ((e.clientX - b.left) / b.width) * 2 - 1, y: ((e.clientY - b.top) / b.height) * 2 - 1, dentro: true };
    });
    this.escuchar('pointerleave', () => { this.mouse.dentro = false; });
    this.escuchar('pointerdown', (e: PointerEvent) => { this.abajo = { x: e.clientX, y: e.clientY }; });
    this.escuchar('pointerup', (e: PointerEvent) => this.alSoltar(e));
    if (typeof ResizeObserver !== 'undefined') {
      this.obs = new ResizeObserver(() => this.ajustar());
      this.obs.observe(lienzo);
    }
    this.ajustar();
    this.bucle();
  }

  private escuchar<K extends keyof HTMLElementEventMap>(tipo: K, fn: (e: HTMLElementEventMap[K] & PointerEvent) => void) {
    this.lienzo.addEventListener(tipo, fn as EventListener);
    this.quitar.push(() => this.lienzo.removeEventListener(tipo, fn as EventListener));
  }

  private crearDestellos() {
    const n = 40;
    const pos = new Float32Array(n * 3);
    const vel: number[][] = [];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xf2c14e, size: 0.05, transparent: true, opacity: 0, depthWrite: false }));
    this.escena.add(pts);
    let vida = 0;
    return {
      lanzar(y = 1) {
        vida = 1;
        for (let i = 0; i < n; i++) {
          pos.set([(Math.random() - 0.5) * 0.3, y + (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3], i * 3);
          vel[i] = [(Math.random() - 0.5) * 1.4, Math.random() * 1.2, (Math.random() - 0.5) * 1.4];
        }
      },
      mover(dt: number) {
        const m = pts.material as THREE.PointsMaterial;
        if (vida <= 0) { m.opacity = 0; return; }
        vida -= dt * 1.4;
        m.opacity = Math.max(0, vida);
        for (let i = 0; i < n; i++) {
          pos[i * 3] += vel[i][0] * dt;
          pos[i * 3 + 1] += vel[i][1] * dt;
          pos[i * 3 + 2] += vel[i][2] * dt;
          vel[i][1] -= dt * 1.5;
        }
        geo.attributes.position.needsUpdate = true;
      },
    };
  }

  private alSoltar(e: PointerEvent) {
    const a = this.abajo;
    if (!a || Math.hypot(e.clientX - a.x, e.clientY - a.y) > 6 || !this.av) return;
    const b = this.lienzo.getBoundingClientRect();
    this.rayo.setFromCamera(new THREE.Vector2(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1), this.camara);
    if (this.rayo.intersectObject(this.av.raiz, true).length) this.accion(azar<AccionAvatar>(['saludando', 'giro', 'celebrar']), 2);
  }

  ajustar(): void {
    const r = this.lienzo.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.renderer.setSize(r.width, r.height, false);
    this.camara.aspect = r.width / r.height;
    this.camara.updateProjectionMatrix();
  }

  irA(v: VistaAvatar): void {
    if (this.vista === v) return;
    this.vista = v;
    this.volando = true;
  }

  /** Reconstruye el avatar con la configuración (con «pop» y destellos si cambió algo visible). */
  reconstruir(cfg: ConfigAvatar, conPop = true): void {
    this.cfg = cfg;
    if (this.av) { this.escena.remove(this.av.raiz); liberar(this.av.raiz); if (this.av.mascota) { this.escena.remove(this.av.mascota); liberar(this.av.mascota); } }
    this.av = this.A.construir(conPelo(cfg));
    this.av.raiz.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
    this.escena.add(this.av.raiz);
    // La mascota sale de la raíz del avatar: así no gira ni salta con él (giro, baile) y se queda en el piso al lado
    if (this.av.mascota) this.escena.add(this.av.mascota);
    if (conPop) {
      this.pop = 1;
      this.destellos.lanzar(this.vista === 'cabeza' ? 1.5 : this.vista === 'pies' ? 0.2 : 1);
    }
  }

  accion(e: AccionAvatar, dur: number): void {
    const t = this.reloj.elapsedTime;
    this.anim = { estado: e, desde: t, dur, prox: t + 10 + Math.random() * 6 };
    if (e === 'celebrar' || e === 'saludando' || e === 'baile' || e === 'giro') this.av?.mascotaAlegrar?.(dur);
  }

  private pose(i: number, x: number, codo: number, k: number, z?: number) {
    const av = this.av!;
    const b = av.brazos[i], c = av.codos[i], zb = z ?? (i ? 0.1 : -0.1);
    b.rotation.x += (x - b.rotation.x) * k;
    c.rotation.x += (codo - c.rotation.x) * k;
    b.rotation.z += (zb - b.rotation.z) * k;
  }

  private animar(t: number, dt: number) {
    const av = this.av;
    if (!av || !this.cfg) return;
    const anim = this.anim;
    const k = Math.min(1, dt * 9);
    let p = (t - anim.desde) / anim.dur;
    if (anim.estado !== 'reposo' && p >= 1) { anim.estado = 'reposo'; p = 0; }
    if (anim.estado === 'reposo' && !this.reducir && t > anim.prox) this.accion(azar<AccionAvatar>(['saludando', 'baile', 'posar']), 2.6);
    let salto = 0, giro = 0, torsion = 0, inclina = 0;
    av.piernas.forEach((pi) => { pi.rotation.x += (0 - pi.rotation.x) * k; pi.rotation.z += (0 - pi.rotation.z) * k; });
    av.rodillas.forEach((r) => { r.rotation.x += (0 - r.rotation.x) * k; });
    const pose = this.pose.bind(this);
    switch (anim.estado) {
      case 'saludando': pose(0, -0.2, -0.5 + Math.sin(t * 10) * 0.35, k, -2.55); pose(1, 0, -0.1, k); inclina = Math.sin(t * 5) * 0.04; break;
      case 'baile':
        torsion = Math.sin(t * 6) * 0.4; salto = Math.abs(Math.sin(t * 6)) * 0.07;
        pose(0, -0.4, -1.2 + Math.sin(t * 6) * 0.5, k, -1.1 + Math.sin(t * 6) * 0.4); pose(1, -0.4, -1.2 - Math.sin(t * 6) * 0.5, k, 1.1 + Math.sin(t * 6) * 0.4);
        av.piernas[0].rotation.x = Math.max(0, Math.sin(t * 6)) * -0.45; av.piernas[1].rotation.x = Math.max(0, -Math.sin(t * 6)) * -0.45;
        av.rodillas[0].rotation.x = Math.max(0, Math.sin(t * 6)) * 0.6; av.rodillas[1].rotation.x = Math.max(0, -Math.sin(t * 6)) * 0.6;
        break;
      case 'celebrar':
        salto = Math.abs(Math.sin(p * Math.PI * 3)) * 0.3;
        pose(0, 0, -0.2, k, -2.75 + Math.sin(t * 12) * 0.2); pose(1, 0, -0.2, k, 2.75 - Math.sin(t * 12) * 0.2);
        av.rodillas.forEach((r) => { r.rotation.x = salto > 0.05 ? 0.55 : 0; });
        av.piernas.forEach((pi) => { pi.rotation.x = salto > 0.05 ? -0.35 : 0; });
        break;
      case 'giro': giro = suave(p) * Math.PI * 2; salto = Math.sin(p * Math.PI) * 0.2; pose(0, 0, -0.3, k, -1.2); pose(1, 0, -0.3, k, 1.2); break;
      case 'posar': pose(0, -0.3, -1.9, k, -0.5); pose(1, 0, -0.1, k, 0.35); torsion = 0.25; inclina = 0.1; av.piernas[1].rotation.z = 0.15; break;
      case 'esperando': pose(0, -0.6, -1.4, k); pose(1, -0.3, -0.6, k); break;
      default: pose(0, 0, -0.12, k); pose(1, 0, -0.12, k);
    }
    av.raiz.position.y = salto;
    av.raiz.rotation.y = giro;
    av.cuerpo.rotation.y += (torsion - av.cuerpo.rotation.y) * k;
    av.cuerpo.rotation.z += (inclina - av.cuerpo.rotation.z) * k;
    av.cuerpo.position.y = Math.sin(t * 2.2) * 0.01;
    if (this.pop > 0) {
      this.pop = Math.max(0, this.pop - dt * 3);
      const s = 1 + Math.sin((1 - this.pop) * Math.PI) * 0.045 * this.pop * 2;
      av.raiz.scale.set(s, 2 - s, s);
    } else av.raiz.scale.set(1, 1, 1);
    const m = this.mouse;
    const mx = m.dentro ? m.x : Math.sin(t * 0.4) * 0.35, my = m.dentro ? m.y : Math.sin(t * 0.6) * 0.1;
    av.cabeza.rotation.y += (mx * 0.55 - av.cabeza.rotation.y) * k * 0.5;
    av.cabeza.rotation.x += ((anim.estado === 'esperando' ? 0.25 : my * 0.28) - av.cabeza.rotation.x) * k * 0.5;
    av.cabeza.rotation.z = Math.sin(t * 1.3) * 0.035;
    const parp = t % 3.9 < 0.12 ? 0.1 : 1;
    const guino = this.cfg.expresion === 'guino';
    av.ojos.forEach((o, i) => { o.scale.y = guino && i === 0 ? 0.1 : anim.estado === 'celebrar' ? 0.45 : parp; });
    av.animar(t, dt);
  }

  private bucle = () => {
    this.frame = requestAnimationFrame(this.bucle);
    const dt = Math.min(this.reloj.getDelta(), 0.05), t = this.reloj.elapsedTime;
    if (this.volando && !this.tocando) {
      const [pos, obj] = VISTAS[this.vista];
      this.camara.position.lerp(pos, 0.08);
      this.controles.target.lerp(obj, 0.08);
      if (this.camara.position.distanceTo(pos) < 0.01) this.volando = false;
    }
    this.controles.update();
    this.animar(t, dt);
    this.destellos.mover(dt);
    (this.aro.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.12 + Math.sin(t * 2) * 0.05;
    this.renderer.render(this.escena, this.camara);
  };

  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.quitar.forEach((f) => f());
    this.obs?.disconnect();
    this.controles.dispose();
    if (this.av) { liberar(this.av.raiz); if (this.av.mascota) liberar(this.av.mascota); }
    this.renderer.dispose();
  }
}
