import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { calcularPrecioLinea } from '@caprichos/compartido';
import { GrupoOpcionesCarta, OpcionElegida, ProductoCarta } from './tipos';
import { useCarrito } from './CarritoContext';
import { useEsMovil } from './useEsMovil';
import { alternarEleccion } from './eleccionGrupo';
import { useUmbralesStock } from './umbralesStock';
import { etiquetaQuedan, etiquetaUltimos, infoStockDe, mezclasDisponibles, saboresParaLinea, topeAgregable, topeTamano, unidadesEnCarrito } from './stock';
import { maximoMezclas, totalElegido } from '../comun/saboresMezcla';
import { SelectorSaboresMezcla } from '../comun/SelectorSaboresMezcla';
import { Reparto, aArreglo, faltanUnidades, recortarAlTope, repartoValido } from '../comun/saboresMezcla';
import type { OfertaItem } from '../admin/ofertas/ofertasApi';
import {
  AvisoAlternativasCombo,
  bebidasElegidas,
  comboConBebidas,
  eleccionesCombo,
  esGrupoBebidaDuplicado,
  filtrarPaquetes,
  gruposPaquetes,
  SelectorPaqueteCombo,
  notaReemplazos,
  partesConAlternativas,
  partesEleccion,
  ResumenPartesFijas,
  repartoAlternativa,
  unirElecciones,
  usosDeSabor,
} from './ReemplazoCombo';
import { PasosBebidaCombo } from './PasosBebidaCombo';
import { SelectorEleccionCombo } from './SelectorEleccionCombo';
import { agruparUnidadesIguales } from './unidadesPorBebida';

interface Props {
  producto: ProductoCarta;
  /** Las bebidas piden el nombre de quien la toma, una por unidad (DT-57 f) */
  esBebida: boolean;
  onCerrar: () => void;
  soloLectura?: boolean;
  esMovilPreview?: boolean;
  /** Combo vinculado a este producto (para avisar si una parte fija se agotó y ofrecer reemplazos) */
  oferta?: OfertaItem | null;
}

const fmt = (n: number): string => `S/ ${n.toFixed(2)}`;
const recortar = (t: string, n: number): string => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

interface Faltante {
  texto: string;
  /** Dónde se elige (para llevar al cliente ahí) */
  selector: string;
  /** Paso del combo que hay que abrir para verlo */
  seccion?: string;
}

const titulo: CSSProperties = { fontFamily: 'var(--fuente-titulos)' };

/** Pasos (claves de sección) en orden de aparición. */
const secciones0 = (gs: GrupoOpcionesCarta[]): string[] => Array.from(new Set(gs.filter((g) => g.nombre.includes(' · ')).map((g) => g.nombre.split(' · ')[0])));

/** Un grupo es "de combo" cuando su nombre es «Bebida 1 · Bebida» (paso · tipo). */
// Un grupo suelto del anfitrión (sin « · ») se titula con su nombre; nunca con su id (salía un paso llamado «8»).
const tituloPaso = (nombre: string): string => (/^\s*\d*\s*$/.test(nombre) ? 'Complemento' : nombre.trim());
const claveSeccion = (g: GrupoOpcionesCarta): string => (g.nombre.includes(' · ') ? g.nombre.split(' · ')[0] : tituloPaso(g.nombre));
const nombreCorto = (g: GrupoOpcionesCarta): string => (g.nombre.includes(' · ') ? g.nombre.split(' · ')[1] : g.nombre);

/**
 * Ventana de producto de la carta pública, igual que el mockup (Main ▸ VENTANA DE PRODUCTO):
 * una sola elección de tamaño y opciones para todas las unidades, nombre por bebida con la vista
 * previa de la etiqueta del vaso, y los combos armados paso a paso. (La personalización unidad por
 * unidad, DT-62, es del pedido de caja y mozo: VentanaProducto.)
 */
export function VentanaProductoCarta({ producto, esBebida, onCerrar, soloLectura = false, esMovilPreview, oferta = null }: Props) {
  const { agregarLinea, inventario, lineas } = useCarrito();
  const esMovilDetectado = useEsMovil();
  const movil = esMovilPreview !== undefined ? esMovilPreview : esMovilDetectado;

  // Con stock por sabor (donas, galletas) los grupos obligatorios heredados («Sabor» de empanadas) no aplican:
  // no se muestran, no se exigen y sus opciones no viajan con la línea.
  // Un combo con bebidas por categoría las pide en pasos «Bebida 1..N»: los grupos del anfitrión que repiten ese rol se ocultan.
  const gruposProducto = comboConBebidas(oferta) ? producto.grupos.filter((g) => !esGrupoBebidaDuplicado(g.nombre)) : producto.grupos;
  const gruposCarta = producto.saboresConStock === true ? gruposProducto.filter((g) => !(g.obligatorio || g.minimo >= 1)) : gruposProducto;

  const [tamanoId, setTamanoId] = useState<string | null>(producto.tamanos[0]?.id ?? null);
  const [sel, setSel] = useState<Record<string, string[]>>(() => {
    const inicial: Record<string, string[]> = {};
    for (const g of gruposCarta) {
      // elección única y obligatoria: parte con la primera opción marcada
      const primera = g.opciones.find((o) => o.disponible !== false);
      inicial[g.id] = g.maximo === 1 && g.minimo >= 1 && primera ? [primera.id] : [];
    }
    return inicial;
  });
  // Complemento con paquetes: el cliente elige UNO y el resto del armado usa solo las piezas de ese paquete
  const [paquetes, setPaquetes] = useState<Record<string, string>>({});
  const ofertaCombo = useMemo(() => filtrarPaquetes(oferta, paquetes), [oferta, paquetes]);
  const partesRe = useMemo(() => partesConAlternativas(ofertaCombo), [ofertaCombo]);
  // Sin alternativa elegida al inicio: el cliente la escoge (no se asigna sola)
  const [reemplazos, setReemplazos] = useState<Record<string, string>>({});
  const comboAgotado = oferta?.disponible === false;
  // Partes A_ELECCION con lista (juguetes): cuántas de cada opción; el total depende de la cantidad del combo
  const partesJug = useMemo(() => partesEleccion(ofertaCombo, reemplazos), [ofertaCombo, reemplazos]);
  const [juguetes, setJuguetes] = useState<Record<string, Reparto>>({});
  // Partes de bebidas: la bebida elegida en cada paso «Bebida N» (clave del producto; '' = sin elegir)
  const [bebidas, setBebidas] = useState<Record<string, string[]>>({});
  const [cantidad, setCantidad] = useState(1);
  // Opciones distintas por bebida: con cantidad 2 o más cada vaso puede llevar su propia elección
  const [porBebida, setPorBebida] = useState(false);
  const [selUnidad, setSelUnidad] = useState<Record<number, Record<string, string[]>>>({});
  // Lo elegido en todas las partes (contadores y pasos de bebidas)
  const elegido = unirElecciones(partesJug, juguetes, bebidas, cantidad);
  const elecciones = eleccionesCombo(ofertaCombo, reemplazos, elegido);
  // Saldo por sabor ya comprometido (este combo y el carrito): el + de cada sabor no lo supera
  const usosSabor = usosDeSabor(lineas, elegido);
  const [nombres, setNombres] = useState<string[]>([]);
  const [avisoNombres, setAvisoNombres] = useState(false);
  const [nota, setNota] = useState('');
  const [busquedas, setBusquedas] = useState<Record<string, string>>({});
  const [zoom, setZoom] = useState(false);
  const [valorSabores, setValorSabores] = useState<Reparto>({});

  const esCombo = producto.grupos.some((g) => g.nombre.includes(' · '));
  // bebidas del combo (grupos «Bebida 1 · Bebida»): cada una lleva su nombre para el envase
  // (el paso se reconoce por «Bebida N · ...»; antes solo valía «Bebida 1 · Bebida» y con «Bebida 1 · Sabor» el campo de nombre desaparecía)
  const gruposBebida = esCombo
    ? secciones0(gruposCarta).flatMap((k) => {
        const gs = gruposCarta.filter((g) => g.nombre.includes(' · ') && claveSeccion(g) === k);
        return /^bebida/i.test(k) ? [gs.find((g) => esGrupoBebidaDuplicado(g.nombre)) ?? gs[0]] : [];
      })
    : [];
  // Sin esos grupos, cada paso de la parte de bebidas es una bebida con su envase
  const nB = gruposBebida.length || partesJug.filter((p) => p.bebidas).reduce((a, p) => a + p.cantidad, 0);
  const envases = bebidasElegidas(partesJug, elegido);
  const secciones = useMemo(() => {
    const claves: string[] = [];
    const mapa: Record<string, GrupoOpcionesCarta[]> = {};
    for (const g of gruposCarta) {
      const k = claveSeccion(g);
      if (!mapa[k]) {
        mapa[k] = [];
        claves.push(k);
      }
      mapa[k].push(g);
    }
    return { claves, mapa };
  }, [gruposCarta]);
  const [abierta, setAbierta] = useState<string>(secciones.claves[0] ?? '');

  const tamano = producto.tamanos.find((t) => t.id === tamanoId) ?? null;
  const precioBase = tamano ? tamano.precio : producto.precio;

  const elegidasDe = (selX: Record<string, string[]>): OpcionElegida[] =>
    gruposCarta.flatMap((g) =>
      (selX[g.id] ?? []).flatMap((oid) => {
        const o = g.opciones.find((x) => x.id === oid);
        return o ? [{ id: o.id, nombre: o.nombre, precioExtra: o.precioExtra, grupoId: g.id, grupoNombre: g.nombre }] : [];
      }),
    );
  const elegidas = elegidasDe(sel);
  const unitario = calcularPrecioLinea({ precioBase, opciones: elegidas, cantidad: 1 }).precioUnitario;
  const precioDe = (ops: OpcionElegida[]) => calcularPrecioLinea({ precioBase, opciones: ops, cantidad: 1 }).precioUnitario;
  const puedePorBebida = cantidad >= 2 && !esCombo && producto.saboresConStock !== true && gruposCarta.length > 0;
  const activoPorBebida = porBebida && puedePorBebida;
  // la elección de la bebida i es la suya; si aún no la tocó, la común
  const selDe = (i: number): Record<string, string[]> => selUnidad[i] ?? sel;
  const unidadesBebida = activoPorBebida ? Array.from({ length: cantidad }, (_, i) => elegidasDe(selDe(i))) : [];
  const totalPrecio = activoPorBebida ? Number(unidadesBebida.reduce((a, ops) => a + precioDe(ops), 0).toFixed(2)) : Number((unitario * cantidad).toFixed(2));
  const bebidaCompleta = (i: number) => gruposCarta.every((g) => (selDe(i)[g.id] ?? []).length >= g.minimo);
  // Todo lo que falta, con el lugar donde se elige: una sola lista alimenta el botón, «Ver qué falta» y la validación
  const faltantes: Faltante[] = [];
  for (const g of gruposPaquetes(oferta)) if (!paquetes[g.grupo]) faltantes.push({ texto: `Elige tu ${g.grupo.toLowerCase()}`, selector: '[data-testid="paquetes-combo"]' });
  for (const p of partesRe) if (!reemplazos[p.parteId]) faltantes.push({ texto: `Alternativa de ${p.faltanteNombre}`, selector: '[data-testid="aviso-reemplazo-combo"]' });
  for (const parte of partesJug) {
    const total = parte.cantidad * cantidad;
    if (parte.bebidas) {
      for (let i = 0; i < total; i++) if (!(bebidas[parte.parteId] ?? [])[i]) faltantes.push({ texto: `Bebida ${i + 1}`, selector: `[data-testid="bebidas-combo-${parte.parteId}"] [aria-label="Bebida ${i + 1}"]` });
    } else {
      const n = totalElegido(elegido[parte.parteId] ?? {});
      if (n !== total) faltantes.push({ texto: n > total ? `Quita ${n - total} opción(es)` : `Elige ${total - n} opción(es)`, selector: `[data-testid="eleccion-combo-${parte.parteId}"]` });
    }
  }
  const unidadesGrupos = activoPorBebida ? Array.from({ length: cantidad }, (_, i) => i) : [-1];
  for (const i of unidadesGrupos) {
    for (const g of gruposCarta) {
      if (((i < 0 ? sel : selDe(i))[g.id] ?? []).length >= g.minimo) continue;
      const nombreG = g.nombre.includes(' · ') ? `${claveSeccion(g)} · ${nombreCorto(g)}` : tituloPaso(g.nombre);
      faltantes.push({ texto: i < 0 ? nombreG : `Bebida ${i + 1} · ${nombreG}`, selector: i < 0 ? `[data-grupo="${g.id}"]` : `[aria-label="Bebida ${i + 1}"]`, seccion: esCombo ? claveSeccion(g) : undefined });
    }
  }
  const valido = !comboAgotado && faltantes.length === 0;

  // Stock: el saldo lo comparten todas las líneas del mismo producto que ya están en el carrito
  const info = inventario[String(producto.id)] ?? infoStockDe(producto);
  const umbrales = useUmbralesStock();
  const enCarrito = unidadesEnCarrito(lineas, producto.id);
  // Mezcla de sabores (donas y galletas): cada tamaño trae sus unidades y el saldo es por sabor
  const saborMode = producto.saboresConStock === true;
  const unidadesMezcla = tamano?.unidades ?? 1;
  // Unidades sueltas (sin tamano o tamano de 1): el cliente reparte lo que quiera entre los sabores y la cantidad es la suma
  const libre = saborMode && unidadesMezcla === 1;
  const total = libre ? Infinity : unidadesMezcla * cantidad;
  const saboresDisp = saborMode ? saboresParaLinea(info, lineas, String(producto.id)) : [];
  // al cambiar tamaño o cantidad el reparto se recorta al nuevo total y a lo que queda de cada sabor
  const valorSaboresOk = saborMode ? recortarAlTope(valorSabores, saboresDisp, total) : {};
  useEffect(() => {
    if (saborMode && JSON.stringify(valorSaboresOk) !== JSON.stringify(valorSabores)) setValorSabores(valorSaboresOk);
  });
  const llevas = totalElegido(valorSaboresOk);
  useEffect(() => {
    if (libre && cantidad !== Math.max(1, llevas)) setCantidad(Math.max(1, llevas));
  });
  const saboresListos = !saborMode || (libre ? llevas > 0 : repartoValido(valorSaboresOk, total, saboresDisp));
  const faltanSabores = libre ? 1 : faltanUnidades(valorSaboresOk, total);

  // Sin sabores: cada cantidad consume las unidades del tamaño (1/2 docena = 6); con sabores, el tope son las mezclas
  const libres = topeAgregable(info, enCarrito);
  const tope = saborMode ? mezclasDisponibles(info, lineas, String(producto.id), unidadesMezcla) : topeTamano(info, enCarrito, unidadesMezcla);
  // Sin sabores, un tamaño no cabe si pasa de lo libre; con sabores, si no cabe ni una mezcla de ese tamaño
  const tamanoSinStock = (unidades: number) =>
    saborMode ? maximoMezclas(saboresParaLinea(info, lineas, String(producto.id)), unidades) === 0 : libres !== null && unidades > libres;
  const sinStock = !info.disponible || (info.controlaStock && info.quedan === 0);
  const sinSaldo = tope !== null && tope <= 0;
  // tamaño que no cabe en lo que queda (tope 0, con o sin sabores): no se puede agregar
  const tamanoNoCabe = producto.tamanos.length > 0 && tope === 0;
  const puedeAgregar = valido && saboresListos && !sinStock && !sinSaldo;
  const enTope = tope !== null && cantidad >= tope;
  const etiquetaStock = etiquetaQuedan(info, producto.nombre, umbrales);
  const franjaUltimos = sinStock ? null : etiquetaUltimos(info, producto.nombre, umbrales);
  const ayudaStock =
    sinStock || info.quedan === null || tamanoNoCabe
      ? null
      : enTope
        ? `Solo quedan ${info.quedan}${enCarrito > 0 ? ` · ya tienes ${enCarrito} en tu pedido` : ''}`
        : etiquetaStock;
  const ayudaSabores = valido && !saboresListos ? (libre ? 'Elige al menos un sabor' : `Elige los sabores: faltan ${faltanSabores}`) : null;
  const ayudaMezclas = saborMode && enTope ? 'Ya no quedan más unidades de estos sabores' : null;
  useEffect(() => {
    if (tope !== null && cantidad > Math.max(1, tope)) setCantidad(Math.max(1, tope));
  }, [tope, cantidad]);

  const alternar = (g: GrupoOpcionesCarta, oid: string) => {
    // Una opción agotada por stock no se puede elegir (sí quitar si ya estaba marcada)
    const op = g.opciones.find((x) => x.id === oid);
    if (op && op.disponible === false && !(sel[g.id] ?? []).includes(oid)) return;
    setSel((prev) => ({ ...prev, [g.id]: alternarEleccion(g, prev[g.id] ?? [], oid) }));
  };

  const alternarDe = (i: number, g: GrupoOpcionesCarta, oid: string) => {
    const actual = selDe(i);
    const op = g.opciones.find((x) => x.id === oid);
    if (op && op.disponible === false && !(actual[g.id] ?? []).includes(oid)) return;
    setSelUnidad((prev) => ({ ...prev, [i]: { ...(prev[i] ?? sel), [g.id]: alternarEleccion(g, actual[g.id] ?? [], oid) } }));
  };

  // «Copiar a todas»: la elección de la Bebida 1 pasa a las demás (y queda como la común)
  const copiarATodas = () => {
    const base = selDe(0);
    setSel(base);
    setSelUnidad(Object.fromEntries(Array.from({ length: cantidad }, (_, i) => [i, base])));
  };

  const textoFalta = faltantes.length === 0 ? 'Elige las opciones obligatorias' : `Falta elegir: ${faltantes.slice(0, 2).map((f) => f.texto).join(' · ')}${faltantes.length > 2 ? ` +${faltantes.length - 2} más` : ''}`;

  const consejoHielo = /poco hielo|menos hielo/i.test(nota)
    ? 'Con poco hielo el vaso queda con menos volumen de bebida.'
    : /no tan helado|menos helado|sin tanto hielo/i.test(nota)
      ? 'Si lo pides menos helado, la bebida quedará más aguada.'
      : '';

  // Lleva al primer paso pendiente (abriéndolo si está plegado) y lo resalta un momento
  const verFalta = () => {
    const f = faltantes[0];
    if (!f) return;
    if (f.seccion) setAbierta(f.seccion);
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>(f.selector);
      if (!el) return;
      el.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
      const antes = el.style.boxShadow;
      el.style.boxShadow = '0 0 0 3px var(--cp-orange)';
      setTimeout(() => {
        el.style.boxShadow = antes;
      }, 1800);
    }, 0);
  };

  const agregar = () => {
    if (!puedeAgregar) return;
    // en las bebidas el nombre de quien la toma es obligatorio: va en la etiqueta del vaso
    if (esBebida && !esCombo) {
      const faltan = Array.from({ length: cantidad }, (_, i) => i).filter((i) => !(nombres[i] ?? '').trim());
      if (faltan.length > 0) {
        setAvisoNombres(true);
        const campo = document.getElementById(`nombre-bebida-${faltan[0]}`);
        campo?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
        campo?.focus();
        return;
      }
    }
    const personas =
      nB > 0
        ? Array.from({ length: cantidad * nB }, (_, i) => (nombres[i] ?? '').trim())
        : Array.from({ length: cantidad }, (_, i) => (esBebida ? (nombres[i] ?? '').trim() : ''));
    const notaFinal = [notaReemplazos(partesRe, reemplazos), nota.trim()].filter(Boolean).join(' · ') || undefined;
    if (activoPorBebida) {
      // las bebidas con la misma configuración van en una línea; las distintas, en líneas aparte
      const unidades = unidadesBebida.map((opciones, i) => ({ persona: personas[i], opciones }));
      for (const grupo of agruparUnidadesIguales(unidades)) {
        const unit = precioDe(grupo[0].opciones);
        agregarLinea({
          productoId: producto.id,
          nombre: producto.nombre,
          fotoUrl: producto.fotoUrl,
          tamanoId: tamano?.id,
          tamanoNombre: tamano?.nombre,
          unidadesTamano: unidadesMezcla,
          precioBase,
          cantidad: grupo.length,
          opciones: grupo[0].opciones,
          personas: grupo.map((u) => u.persona ?? ''),
          unidades: grupo,
          nota: notaFinal,
          precioUnitario: unit,
          subtotal: Number((unit * grupo.length).toFixed(2)),
        });
      }
      onCerrar();
      return;
    }
    agregarLinea({
      productoId: producto.id,
      nombre: producto.nombre,
      fotoUrl: producto.fotoUrl,
      tamanoId: tamano?.id,
      tamanoNombre: tamano?.nombre,
      unidadesTamano: unidadesMezcla,
      precioBase,
      cantidad,
      opciones: elegidas,
      personas,
      // mezcla de sabores: la línea viaja entera (sin «unidades») con el reparto por sabor
      ...(saborMode
        ? {
            unidadesPorMezcla: unidadesMezcla,
            sabores: aArreglo(valorSaboresOk).map((s) => ({ ...s, nombre: producto.sabores.find((x) => x.id === s.saborId)?.nombre })),
          }
        : {}),
      // combo con bebidas: sin «unidades», la línea viaja entera con los nombres en orden de bebida
      ...(nB > 0 || saborMode ? {} : { unidades: Array.from({ length: cantidad }, (_, i) => ({ persona: personas[i], opciones: elegidas })) }),
      // sin sabores: el tamaño dice cuántas unidades consume cada cantidad (para el stock del carrito)
      ...(saborMode ? {} : { unidadesTamano: unidadesMezcla }),
      nota: [notaReemplazos(partesRe, reemplazos), nota.trim()].filter(Boolean).join(' · ') || undefined,
      ...(oferta && elecciones.length > 0 ? { ofertaId: String(oferta.id), comboElecciones: elecciones } : {}),
      precioUnitario: unitario,
      subtotal: Number((unitario * cantidad).toFixed(2)),
    });
    onCerrar();
  };

  const iniciales = producto.nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  const filtrar = (g: GrupoOpcionesCarta, selX: Record<string, string[]> = sel, clave: string = g.id) => {
    const q = (busquedas[clave] ?? '').trim().toLowerCase();
    const lista = g.opciones.filter((o) => !q || o.nombre.toLowerCase().includes(q) || (selX[g.id] ?? []).includes(o.id));
    return { grande: g.opciones.length > 8, q: busquedas[clave] ?? '', lista };
  };

  const buscador = (g: GrupoOpcionesCarta, alto: number, etiqueta: string, clave: string = g.id) => (
    <input
      type="search"
      value={busquedas[clave] ?? ''}
      onChange={(e) => setBusquedas((p) => ({ ...p, [clave]: e.target.value }))}
      placeholder={etiqueta}
      aria-label={etiqueta}
      style={{ width: '100%', boxSizing: 'border-box', minHeight: alto, borderRadius: 9999, border: '1.5px solid var(--cp-line)', background: 'var(--cp-cream)', color: 'var(--cp-navy)', padding: '0 14px', fontSize: 13, marginBottom: 6 }}
    />
  );

  const etiquetaGrupo = (g: GrupoOpcionesCarta): string =>
    g.minimo >= 1
      ? g.maximo > 1
        ? `OBLIGATORIO · ELIGE ${g.minimo}`
        : 'OBLIGATORIO'
      : g.maximo > 1
        ? `OPCIONAL · HASTA ${g.maximo}`
        : 'OPCIONAL';

  // Un grupo de opciones (sin combo): la elección común, o la de la bebida `bebida` (0 en adelante)
  const bloqueGrupo = (g: GrupoOpcionesCarta, selX: Record<string, string[]>, onAlt: (oid: string) => void, clave: string, bebida?: number) => {
    const f = filtrar(g, selX, clave);
    const obligatorio = g.minimo >= 1;
    return (
      <div key={clave} data-grupo={g.id}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 }}>
          <span style={{ ...titulo, fontWeight: 800, fontSize: 14, letterSpacing: '0.01em' }}>{g.nombre}</span>
          <span style={{ fontSize: 11, fontWeight: 700, background: obligatorio ? 'var(--cp-navy)' : 'transparent', color: obligatorio ? 'var(--cp-cream)' : 'var(--cp-soft)', borderRadius: 9999, padding: '2px 10px', border: `1px solid ${obligatorio ? 'var(--cp-navy)' : 'var(--cp-soft)'}` }}>
            {etiquetaGrupo(g)}
          </span>
        </div>
        {g.aviso && <div role="status" style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-rust)', marginBottom: 8 }}>{g.aviso}</div>}
        {f.grande && buscador(g, 44, `Buscar en ${g.nombre}`, clave)}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, ...(f.grande ? { maxHeight: 300, overflowY: 'auto' } : {}) }}>
          {f.lista.map((o) => {
            const on = (selX[g.id] ?? []).includes(o.id);
            const agotada = o.disponible === false;
            return (
              <button
                key={o.id}
                onClick={() => onAlt(o.id)}
                aria-pressed={on}
                aria-label={bebida === undefined ? undefined : `Bebida ${bebida + 1}, ${g.nombre}: ${o.nombre}`}
                disabled={agotada && !on}
                style={{ minHeight: 44, maxWidth: '100%', borderRadius: 22, border: `2px solid ${on ? 'var(--cp-orange)' : 'var(--cp-line)'}`, background: 'var(--cp-white)', color: 'var(--cp-navy)', padding: '6px 14px 6px 10px', display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', fontSize: 13, lineHeight: '17px', opacity: agotada ? 0.5 : 1, cursor: agotada && !on ? 'not-allowed' : 'pointer' }}
              >
                <span style={{ width: 16, height: 16, borderRadius: g.maximo === 1 ? 10 : 6, border: '2px solid var(--cp-navy)', background: on ? 'var(--cp-orange)' : 'transparent', flex: 'none' }} />
                <span style={{ fontWeight: 600 }}>{o.nombre}</span>
                {agotada && <span style={{ fontWeight: 700, color: 'var(--cp-soft)' }}>Agotado</span>}
                {o.precioExtra > 0 && <span style={{ fontWeight: 700, color: 'var(--cp-rust)' }}>+{fmt(o.precioExtra)}</span>}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const nombreSticker =(i: number): string => recortar((nombres[i] ?? '').trim() || 'TU NOMBRE', 14);

  return (
    <>
      <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, zIndex: 30, background: 'rgba(11,44,62,0.55)' }} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Detalles de ${producto.nombre}`}
        data-movil={movil ? 'si' : 'no'}
        style={{
          position: 'fixed',
          zIndex: 40,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'var(--cp-cream)',
          boxShadow: '0 20px 50px rgba(11,44,62,0.4)',
          // celular: hoja que sube desde abajo (95 % de alto); PC: ventana centrada como siempre
          ...(movil
            ? { left: 0, right: 0, bottom: 0, height: '95%', borderRadius: '20px 20px 0 0' }
            : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 'min(620px, calc(100% - 24px))', maxHeight: 'calc(100% - 24px)', borderRadius: 20 }),
        }}
      >
        {movil && (
          <div data-testid="cabecera-ventana" style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px 8px 16px', background: 'var(--cp-white)', borderBottom: '1px solid var(--cp-line)' }}>
            <span style={{ ...titulo, flex: 1, minWidth: 0, fontWeight: 800, fontSize: 16, lineHeight: '20px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{producto.nombre}</span>
            <span style={{ ...titulo, flex: 'none', fontWeight: 800, fontSize: 16, color: 'var(--cp-rust)' }}>{fmt(unitario)}</span>
            <button onClick={onCerrar} aria-label="Cerrar ventana de producto" style={{ flex: 'none', width: 44, height: 44, borderRadius: 22, border: '1.5px solid var(--cp-navy)', background: 'var(--cp-white)', color: 'var(--cp-navy)', fontSize: 20, fontWeight: 800 }}>
              ×
            </button>
          </div>
        )}
        <div data-testid="cuerpo-ventana" style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ position: 'relative', flex: 'none', background: 'var(--cp-white)' }}>
            {!movil && (
            <button
              onClick={onCerrar}
              aria-label="Cerrar ventana de producto"
              style={{ position: 'absolute', zIndex: 2, top: 12, right: 12, width: 44, height: 44, borderRadius: 22, border: '1.5px solid var(--cp-navy)', background: 'var(--cp-white)', color: 'var(--cp-navy)', fontSize: 20, fontWeight: 800 }}
            >
              ×
            </button>
            )}
            {producto.fotoUrl ? (
              <button
                type="button"
                onClick={() => setZoom(true)}
                aria-label={`Ampliar la foto de ${producto.nombre}`}
                style={{ position: 'relative', width: '100%', height: movil ? 180 : 280, border: 0, padding: 0, background: 'var(--cp-sand)', cursor: 'zoom-in', display: 'block', overflow: 'hidden' }}
              >
                <img src={producto.fotoUrl} alt="" aria-hidden="true" style={{ position: 'absolute', left: '-10%', top: '-10%', width: '120%', height: '120%', objectFit: 'cover', filter: 'blur(22px)', opacity: 0.55 }} />
                <img src={producto.fotoUrl} alt={producto.nombre} style={{ position: 'relative', height: '100%', maxWidth: '100%', objectFit: 'contain', objectPosition: 'center', display: 'block', margin: '0 auto' }} />
                <span aria-hidden="true" style={{ position: 'absolute', right: 10, bottom: 10, width: 36, height: 36, borderRadius: 18, background: 'rgba(11,44,62,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M21 21l-4.3-4.3 M11 8v6 M8 11h6" />
                  </svg>
                </span>
              </button>
            ) : (
              <span style={{ ...titulo, width: '100%', aspectRatio: '16/10', background: 'var(--cp-sand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 72, color: 'var(--cp-navy)' }}>
                {iniciales}
              </span>
            )}
          </div>

          <div style={{ flex: 'none', minWidth: 0, padding: movil ? '14px 16px 20px' : '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ ...titulo, fontWeight: 800, fontSize: 24, lineHeight: '30px' }}>{producto.nombre}</div>
              {producto.descripcion && <div style={{ fontSize: 13, color: 'var(--cp-soft)', marginTop: 4 }}>{producto.descripcion}</div>}
            </div>
            {!movil && (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ ...titulo, fontWeight: 800, fontSize: 26, color: 'var(--cp-rust)' }}>{fmt(unitario)}</span>
              </div>
            )}

            {franjaUltimos && (
              <div data-testid="ultimos-ventana" style={{ ...titulo, alignSelf: 'flex-start', background: 'var(--cp-rust)', color: '#FFFFFF', fontWeight: 800, fontSize: 13, borderRadius: 9999, padding: '4px 14px' }}>
                {franjaUltimos}
              </div>
            )}

            {producto.tamanos.length > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ ...titulo, fontWeight: 700, fontSize: 15 }}>Tamaño</span>
                  <span style={{ fontSize: 11, fontWeight: 700, background: 'var(--cp-navy)', color: 'var(--cp-cream)', borderRadius: 9999, padding: '2px 10px' }}>OBLIGATORIO</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: 8 }}>
                  {producto.tamanos.map((t) => {
                    const on = t.id === tamanoId;
                    const noCabe = tamanoSinStock(t.unidades ?? 1);
                    return (
                      <button
                        key={t.id}
                        onClick={() => setTamanoId(t.id)}
                        aria-pressed={on}
                        disabled={noCabe}
                        style={{ minHeight: 64, borderRadius: 14, border: `2px solid ${on && !noCabe ? 'var(--cp-orange)' : 'var(--cp-line)'}`, background: 'var(--cp-white)', color: 'var(--cp-navy)', padding: '8px 10px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 2, textAlign: 'left', opacity: noCabe ? 0.5 : 1, cursor: noCabe ? 'not-allowed' : 'pointer' }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                          <span style={{ width: 16, height: 16, borderRadius: 8, border: '2px solid var(--cp-navy)', background: on && !noCabe ? 'var(--cp-orange)' : 'transparent', flex: 'none' }} />
                          <span style={{ flex: 1, fontWeight: 700, fontSize: 13, lineHeight: '17px' }}>{t.nombre}</span>
                        </span>
                        <span style={{ ...titulo, fontWeight: 800, fontSize: 15, color: 'var(--cp-rust)', paddingLeft: 24 }}>{fmt(t.precio)}</span>
                        {noCabe && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--cp-rust)', paddingLeft: 24 }}>
                            {libres && libres > 0 ? `Solo quedan ${libres}` : 'No hay stock suficiente'}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {saborMode && (
              <SelectorSaboresMezcla
                sabores={saboresDisp}
                total={total}
                libre={libre}
                valor={valorSaboresOk}
                onCambio={setValorSabores}
                deshabilitar={soloLectura}
              />
            )}

            {comboAgotado && (
              <div role="status" style={{ fontWeight: 800, color: 'var(--cp-rust)' }}>
                Agotado
              </div>
            )}
            {!comboAgotado && <ResumenPartesFijas oferta={ofertaCombo} />}
            {!comboAgotado && (
              <SelectorPaqueteCombo
                grupos={gruposPaquetes(oferta)}
                elegidos={paquetes}
                onElegir={(grupo, paquete) => {
                  setPaquetes((prev) => ({ ...prev, [grupo]: paquete }));
                  // Lo elegido en las piezas de otro paquete ya no vale
                  setJuguetes({});
                  setReemplazos({});
                }}
              />
            )}
            <AvisoAlternativasCombo
              partes={comboAgotado ? [] : partesRe}
              elegidos={reemplazos}
              onElegir={(parteId, alt) => {
                setReemplazos((prev) => ({ ...prev, [parteId]: alt.id }));
                setJuguetes((prev) => ({ ...prev, [parteId]: repartoAlternativa(alt) }));
              }}
            />

            {!comboAgotado &&
              partesJug.map((parte) =>
                parte.bebidas ? (
                  <PasosBebidaCombo
                    key={parte.parteId}
                    parte={parte}
                    unidades={cantidad}
                    valor={bebidas[parte.parteId] ?? []}
                    onCambio={(v) => setBebidas((prev) => ({ ...prev, [parte.parteId]: v }))}
                    deshabilitar={soloLectura}
                    usos={usosSabor}
                  />
                ) : (
                <SelectorEleccionCombo
                  key={parte.parteId}
                  parte={parte}
                  unidades={cantidad}
                  valor={juguetes[parte.parteId] ?? {}}
                  onCambio={(v) => setJuguetes((prev) => ({ ...prev, [parte.parteId]: v }))}
                  deshabilitar={soloLectura}
                  usos={usosSabor}
                />
                ),
              )}

            {esCombo && secciones.claves.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ ...titulo, fontWeight: 700, fontSize: 15 }}>
                  Arma tu combo{' '}
                  <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--cp-soft)' }}>
                    · {secciones.claves.filter((k) => secciones.mapa[k].every((g) => (sel[g.id] ?? []).length >= g.minimo)).length} de {secciones.claves.length} pasos listos
                  </span>
                </div>
                {secciones.claves.map((k, i) => {
                  const gs = secciones.mapa[k];
                  const hecha = gs.every((g) => (sel[g.id] ?? []).length >= g.minimo);
                  const abierto = abierta === k;
                  const siguiente = secciones.claves[i + 1];
                  const resumen = gs.flatMap((g) => (sel[g.id] ?? []).map((oid) => g.opciones.find((x) => x.id === oid)?.nombre ?? '')).filter(Boolean);
                  return (
                    <div key={k} style={{ border: `1.5px solid ${abierto ? 'var(--cp-orange)' : 'var(--cp-line)'}`, borderRadius: 14, background: 'var(--cp-white)', overflow: 'hidden' }}>
                      <button
                        onClick={() => setAbierta(abierto ? '__ninguna' : k)}
                        aria-expanded={abierto}
                        style={{ width: '100%', minHeight: 52, border: 0, background: 'transparent', color: 'var(--cp-navy)', padding: '0 12px', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}
                      >
                        <span style={{ flex: 'none', width: 26, height: 26, borderRadius: 13, background: hecha ? '#2F9E57' : 'var(--cp-line)', color: hecha ? '#FFFFFF' : 'var(--cp-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>
                          {hecha ? '✓' : i + 1}
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ ...titulo, display: 'block', fontWeight: 800, fontSize: 14 }}>{k}</span>
                          <span style={{ display: 'block', fontSize: 12, lineHeight: '16px', color: 'var(--cp-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {resumen.length ? resumen.join(' · ') : 'Elige una opción'}
                          </span>
                        </span>
                        <span style={{ flex: 'none', fontSize: 18, color: 'var(--cp-soft)' }}>{abierto ? '▴' : '▾'}</span>
                      </button>
                      {abierto && (
                        <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {gs.map((g) => {
                            const f = filtrar(g);
                            return (
                              <div key={g.id} data-grupo={g.id}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                  <span style={{ fontWeight: 700, fontSize: 13 }}>{nombreCorto(g)}</span>
                                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--cp-soft)' }}>
                                    {g.minimo >= 1 ? 'Elige 1' : g.maximo > 1 ? `Opcional, hasta ${g.maximo}` : 'Opcional'}
                                  </span>
                                </div>
                                {g.aviso && <div role="status" style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-rust)', marginBottom: 6 }}>{g.aviso}</div>}
                                {f.grande && buscador(g, 40, `Buscar ${nombreCorto(g).toLowerCase()}`)}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, ...(f.grande ? { maxHeight: 236, overflowY: 'auto' } : {}) }}>
                                  {f.lista.map((o) => {
                                    const on = (sel[g.id] ?? []).includes(o.id);
                                    const agotada = o.disponible === false;
                                    return (
                                      <button
                                        key={o.id}
                                        onClick={() => alternar(g, o.id)}
                                        aria-pressed={on}
                                        disabled={agotada && !on}
                                        style={{ minHeight: 44, maxWidth: '100%', padding: '6px 12px', borderRadius: 16, textAlign: 'left', lineHeight: '17px', border: `1.5px solid ${on ? 'var(--cp-orange)' : 'var(--cp-line)'}`, background: on ? 'rgba(230,121,41,0.16)' : 'var(--cp-white)', color: 'var(--cp-navy)', fontWeight: 600, fontSize: 13, opacity: agotada ? 0.5 : 1, cursor: agotada && !on ? 'not-allowed' : 'pointer' }}
                                      >
                                        {on ? '✓ ' : ''}
                                        {o.nombre}
                                        {agotada && <span style={{ fontWeight: 700, color: 'var(--cp-soft)' }}> · Agotado</span>}
                                        {o.precioExtra > 0 && <span style={{ fontWeight: 700, color: 'var(--cp-rust)' }}> +{fmt(o.precioExtra)}</span>}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                          <button
                            onClick={() => setAbierta(siguiente ?? '__ninguna')}
                            style={{ minHeight: 44, border: 0, borderRadius: 12, background: 'var(--cp-navy)', color: 'var(--cp-cream)', fontWeight: 800, fontSize: 13 }}
                          >
                            {siguiente ? `Listo, siguiente: ${siguiente}` : 'Listo'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <>
                {puedePorBebida && (
                  <div role="group" aria-label="¿Todas las bebidas iguales?" style={{ display: 'flex', gap: 6, background: 'var(--cp-white)', border: '1.5px solid var(--cp-line)', borderRadius: 14, padding: 4 }}>
                    {[
                      { valor: false, texto: 'Todas iguales' },
                      { valor: true, texto: 'Elegir por bebida' },
                    ].map((m) => (
                      <button
                        key={m.texto}
                        type="button"
                        onClick={() => setPorBebida(m.valor)}
                        aria-pressed={porBebida === m.valor}
                        style={{ flex: 1, minHeight: 44, border: 0, borderRadius: 10, fontWeight: 800, fontSize: 13, background: porBebida === m.valor ? 'var(--cp-navy)' : 'transparent', color: porBebida === m.valor ? 'var(--cp-cream)' : 'var(--cp-navy)', cursor: 'pointer' }}
                      >
                        {m.texto}
                      </button>
                    ))}
                  </div>
                )}
                {activoPorBebida
                  ? Array.from({ length: cantidad }, (_, i) => (
                      <div key={i} role="group" aria-label={`Bebida ${i + 1}`} style={{ border: `1.5px solid ${bebidaCompleta(i) ? 'var(--cp-line)' : 'var(--cp-orange)'}`, borderRadius: 14, padding: '10px 12px', background: 'var(--cp-white)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ ...titulo, fontWeight: 800, fontSize: 15 }}>
                            {`Bebida ${i + 1}`}
                            {(nombres[i] ?? '').trim() ? ` · ${(nombres[i] ?? '').trim()}` : ''}
                          </span>
                          <span style={{ ...titulo, fontWeight: 800, fontSize: 14, color: 'var(--cp-rust)' }}>{fmt(precioDe(unidadesBebida[i]))}</span>
                          {i === 0 && (
                            <button type="button" onClick={copiarATodas} style={{ minHeight: 44, padding: '0 14px', borderRadius: 9999, border: '1.5px solid var(--cp-navy)', background: 'var(--cp-white)', color: 'var(--cp-navy)', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                              Copiar a todas
                            </button>
                          )}
                        </div>
                        {gruposCarta.map((g) => bloqueGrupo(g, selDe(i), (oid) => alternarDe(i, g, oid), `${g.id}#${i}`, i))}
                      </div>
                    ))
                  : gruposCarta.map((g) => bloqueGrupo(g, sel, (oid) => alternar(g, oid), g.id))}
              </>
            )}

            {nB > 0 && (
              <div data-testid="nombre-envase" style={{ border: '1.5px solid var(--cp-line)', borderRadius: 14, padding: '10px 12px', background: 'var(--cp-white)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ ...titulo, fontWeight: 800, fontSize: 14 }}>Nombre para el envase</div>
                <div style={{ fontSize: 12, lineHeight: '16px', color: 'var(--cp-soft)' }}>Para escribir tu nombre en el vaso.</div>
                {Array.from({ length: cantidad * nB }, (_, i) => {
                  const g = gruposBebida[i % nB];
                  const bebida = g ? (g.opciones.find((o) => o.id === (sel[g.id] ?? [])[0])?.nombre ?? nombreCorto(g)) : (envases[i] ?? `Bebida ${i + 1}`);
                  return (
                    <label key={i} style={{ fontSize: 11, fontWeight: 700, display: 'block', color: 'var(--cp-soft)' }}>
                      {`${bebida} · Nombre para el envase (opcional, máx. 14 letras se ven completas)`}
                      <input
                        type="text"
                        value={nombres[i] ?? ''}
                        onChange={(e) =>
                          setNombres((prev) => {
                            const a = [...prev];
                            a[i] = e.target.value;
                            return a;
                          })
                        }
                        placeholder="Ej.: Lucía"
                        maxLength={30}
                        id={`nombre-bebida-${i}`}
                        style={{ display: 'block', width: '100%', boxSizing: 'border-box', minHeight: 40, marginTop: 2, borderRadius: 10, border: '1.5px solid var(--cp-line)', background: 'var(--cp-cream)', color: 'var(--cp-navy)', padding: '0 10px', fontSize: 14 }}
                      />
                    </label>
                  );
                })}
              </div>
            )}

            {esBebida && !esCombo && (
              <div style={{ border: '1.5px solid var(--cp-line)', borderRadius: 14, padding: '10px 12px', background: 'var(--cp-white)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ ...titulo, fontWeight: 800, fontSize: 14 }}>¿Para quién es?</div>
                {Array.from({ length: cantidad }, (_, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={{ flex: '1 1 150px', minWidth: 0, fontSize: 11, fontWeight: 700, display: 'block', color: 'var(--cp-soft)' }}>
                      {`Ingresa el nombre de la persona que tomará esta bebida${cantidad > 1 ? ` (${i + 1} de ${cantidad})` : ''} *`}
                      <input
                        type="text"
                        value={nombres[i] ?? ''}
                        onChange={(e) =>
                          setNombres((prev) => {
                            const a = [...prev];
                            a[i] = e.target.value;
                            return a;
                          })
                        }
                        placeholder="Ej.: Lucía"
                        maxLength={30}
                        id={`nombre-bebida-${i}`}
                        required
                        aria-invalid={avisoNombres && !(nombres[i] ?? '').trim()}
                        style={{ display: 'block', width: '100%', boxSizing: 'border-box', minHeight: 40, marginTop: 2, borderRadius: 10, border: `1.5px solid ${avisoNombres && !(nombres[i] ?? '').trim() ? 'var(--cp-rust)' : 'var(--cp-line)'}`, background: 'var(--cp-cream)', color: 'var(--cp-navy)', padding: '0 10px', fontSize: 14 }}
                      />
                    </label>
                    <div
                      aria-label={`Así se verá la etiqueta del vaso ${i + 1}`}
                      style={{ flex: 'none', width: 158, fontFamily: "'Courier New', monospace", fontSize: 10, lineHeight: '13px', color: '#111', background: '#fff', border: '1px solid var(--cp-line)', borderRadius: 8, boxShadow: '0 2px 8px rgba(11,44,62,0.14)', overflow: 'hidden' }}
                    >
                      <div style={{ background: 'var(--cp-navy)', color: 'var(--cp-cream)', padding: '2px 8px', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                        <span>{`BEBIDA ${i + 1}`}</span>
                        <span>ETIQUETA</span>
                      </div>
                      <div style={{ padding: '5px 8px' }}>
                        <div style={{ ...titulo, fontWeight: 800, fontSize: 17, lineHeight: '20px', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombreSticker(i)}</div>
                        <div style={{ ...titulo, fontWeight: 700, fontSize: 11, lineHeight: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{recortar(producto.nombre, 18)}</div>
                      </div>
                    </div>
                  </div>
                ))}
                {avisoNombres && Array.from({ length: cantidad }, (_, i) => i).some((i) => !(nombres[i] ?? '').trim()) ? (
                  <div role="alert" style={{ fontSize: 12, lineHeight: '16px', fontWeight: 700, color: 'var(--cp-rust)', background: 'var(--cp-sand)', borderRadius: 8, padding: '8px 10px' }}>
                    Escribe el nombre de quien tomará cada bebida. Va en la etiqueta del vaso.
                  </div>
                ) : (
                  <div style={{ fontSize: 11, lineHeight: '14px', color: 'var(--cp-soft)' }}>Obligatorio: el nombre va en la etiqueta del vaso.</div>
                )}
              </div>
            )}

            <div>
              <label htmlFor="nota-producto" style={{ ...titulo, fontWeight: 700, fontSize: 15, display: 'block', marginBottom: 8 }}>
                Nota para cocina (opcional)
              </label>
              <input
                id="nota-producto"
                type="text"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Ej.: sin hielo, bien caliente"
                style={{ width: '100%', boxSizing: 'border-box', minHeight: 48, borderRadius: 12, border: '1.5px solid var(--cp-line)', background: 'var(--cp-white)', color: 'var(--cp-navy)', padding: '0 12px', fontSize: 14 }}
              />
              {consejoHielo && (
                <div role="status" style={{ marginTop: 6, fontSize: 12, lineHeight: '17px', fontWeight: 600, color: 'var(--cp-rust)' }}>
                  {consejoHielo}
                </div>
              )}
            </div>
          </div>
        </div>
        <div data-testid="barra-agregar" style={{ flex: 'none', padding: movil ? '10px 16px calc(12px + env(safe-area-inset-bottom, 0px))' : '12px 24px 16px', background: 'var(--cp-cream)', borderTop: '1px solid var(--cp-line)', boxShadow: '0 -4px 12px rgba(11,44,62,0.08)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              {ayudaStock && (
                <div role="status" style={{ flexBasis: '100%', fontSize: 12, fontWeight: 700, lineHeight: '17px', color: enTope ? 'var(--cp-rust)' : 'var(--cp-navy)' }}>
                  {ayudaStock}
                </div>
              )}
              {ayudaSabores && (
                <div role="status" style={{ flexBasis: '100%', fontSize: 12, fontWeight: 700, lineHeight: '17px', color: 'var(--cp-rust)' }}>
                  {ayudaSabores}
                </div>
              )}
              {ayudaMezclas && (
                <div role="status" style={{ flexBasis: '100%', fontSize: 12, fontWeight: 700, lineHeight: '17px', color: 'var(--cp-rust)' }}>
                  {ayudaMezclas}
                </div>
              )}
              {!libre && (
              <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid var(--cp-navy)', borderRadius: 12 }}>
                <button onClick={() => setCantidad((c) => Math.max(1, c - 1))} aria-label="Menos" style={{ width: 44, height: 48, border: 0, background: 'transparent', color: 'var(--cp-navy)', fontSize: 22, fontWeight: 800 }}>
                  −
                </button>
                <span style={{ minWidth: 28, textAlign: 'center', fontWeight: 700 }}>{cantidad}</span>
                <button
                  onClick={() => setCantidad((c) => (tope !== null && c >= tope ? c : c + 1))}
                  disabled={enTope}
                  aria-label="Más"
                  style={{ width: 44, height: 48, border: 0, background: 'transparent', color: 'var(--cp-navy)', fontSize: 22, fontWeight: 800, opacity: enTope ? 0.35 : 1, cursor: enTope ? 'not-allowed' : 'pointer' }}
                >
                  +
                </button>
              </div>
              )}
              {!soloLectura && !valido && !comboAgotado && faltantes.length > 0 && (
                <button type="button" onClick={verFalta} style={{ flexBasis: '100%', minHeight: 44, border: '1.5px solid var(--cp-orange)', borderRadius: 12, background: 'var(--cp-white)', color: 'var(--cp-rust)', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                  Ver qué falta ({faltantes.length})
                </button>
              )}
              <button
                onClick={soloLectura ? undefined : agregar}
                disabled={soloLectura ? true : !puedeAgregar}
                aria-label={soloLectura ? 'Vista previa deshabilitada' : undefined}
                style={{
                  flex: '1 1 200px',
                  minHeight: 52,
                  minWidth: 0,
                  border: 0,
                  borderRadius: 12,
                  background: soloLectura ? 'var(--cp-sand)' : puedeAgregar ? 'var(--cp-orange)' : 'var(--cp-line)',
                  color: soloLectura ? 'var(--cp-navy)' : puedeAgregar ? '#fff' : 'var(--cp-soft)',
                  ...titulo,
                  fontWeight: 800,
                  fontSize: 14,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0 16px',
                  cursor: soloLectura ? 'not-allowed' : 'pointer',
                  opacity: soloLectura ? 0.9 : 1,
                }}
              >
                <span>
                  {soloLectura
                    ? 'Vista previa'
                    : comboAgotado || sinStock
                      ? producto.grupos.some((g) => g.sinStock) ? 'No disponible' : 'Agotado'
                      : sinSaldo && valido
                        ? tamanoNoCabe
                          ? 'No hay stock suficiente'
                          : 'Sin más unidades'
                        : valido && !saboresListos
                          ? 'Elige los sabores'
                          : valido
                            ? libre ? `Agregar ${llevas} al pedido` : 'Agregar al pedido'
                            : textoFalta}
                </span>
                <span>{fmt(totalPrecio)}</span>
              </button>
            </div>
      </div>

      {zoom && producto.fotoUrl && (
        <div onClick={() => setZoom(false)} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(11,44,62,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, boxSizing: 'border-box' }}>
          <img src={producto.fotoUrl} alt={producto.nombre} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 12 }} />
          <button onClick={() => setZoom(false)} aria-label="Cerrar vista ampliada" style={{ position: 'absolute', top: 12, right: 12, width: 48, height: 48, borderRadius: 24, border: '1.5px solid var(--cp-cream)', background: 'transparent', color: 'var(--cp-cream)', fontSize: 22, fontWeight: 800 }}>
            ×
          </button>
        </div>
      )}
    </>
  );
}
