import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { calcularPrecioLinea } from '@caprichos/compartido';
import { GrupoOpcionesCarta, OpcionElegida, ProductoCarta } from './tipos';
import { useCarrito } from './CarritoContext';
import { useEsMovil } from './useEsMovil';
import { alternarEleccion } from './eleccionGrupo';
import { etiquetaQuedan, infoStockDe, mezclasDisponibles, saboresParaLinea, topeAgregable, unidadesEnCarrito } from './stock';
import { SelectorSaboresMezcla } from '../comun/SelectorSaboresMezcla';
import { Reparto, aArreglo, faltanUnidades, recortarAlTope, repartoValido } from '../comun/saboresMezcla';
import type { OfertaItem } from '../admin/ofertas/ofertasApi';
import {
  AvisoReemplazoCombo,
  eleccionesCombo,
  eleccionInicial,
  faltaElegirReemplazo,
  notaReemplazos,
  partesConReemplazo,
} from './ReemplazoCombo';

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

const titulo: CSSProperties = { fontFamily: 'var(--fuente-titulos)' };

/** Un grupo es "de combo" cuando su nombre es «Bebida 1 · Bebida» (paso · tipo). */
const claveSeccion = (g: GrupoOpcionesCarta): string => (g.nombre.includes(' · ') ? g.nombre.split(' · ')[0] : g.id);
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
  const gruposCarta = producto.saboresConStock === true ? producto.grupos.filter((g) => !(g.obligatorio || g.minimo >= 1)) : producto.grupos;

  const [tamanoId, setTamanoId] = useState<string | null>(producto.tamanos[0]?.id ?? null);
  const [sel, setSel] = useState<Record<string, string[]>>(() => {
    const inicial: Record<string, string[]> = {};
    for (const g of gruposCarta) {
      // elección única y obligatoria: parte con la primera opción marcada
      inicial[g.id] = g.maximo === 1 && g.minimo >= 1 && g.opciones[0] ? [g.opciones[0].id] : [];
    }
    return inicial;
  });
  const partesRe = useMemo(() => partesConReemplazo(oferta), [oferta]);
  const [reemplazos, setReemplazos] = useState<Record<string, string>>(() => eleccionInicial(partesRe));
  const comboAgotado = oferta?.disponible === false;
  const elecciones = eleccionesCombo(oferta, reemplazos);
  const [cantidad, setCantidad] = useState(1);
  const [nombres, setNombres] = useState<string[]>([]);
  const [avisoNombres, setAvisoNombres] = useState(false);
  const [nota, setNota] = useState('');
  const [busquedas, setBusquedas] = useState<Record<string, string>>({});
  const [zoom, setZoom] = useState(false);
  const [valorSabores, setValorSabores] = useState<Reparto>({});

  const esCombo = producto.grupos.some((g) => g.nombre.includes(' · '));
  // bebidas del combo (grupos «Bebida 1 · Bebida»): cada una lleva su nombre para el envase
  const gruposBebida = esCombo ? producto.grupos.filter((g) => g.nombre.includes(' · ') && /^bebida/i.test(nombreCorto(g))) : [];
  const nB = gruposBebida.length;
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

  const elegidas: OpcionElegida[] = gruposCarta.flatMap((g) =>
    (sel[g.id] ?? []).flatMap((oid) => {
      const o = g.opciones.find((x) => x.id === oid);
      return o ? [{ id: o.id, nombre: o.nombre, precioExtra: o.precioExtra, grupoId: g.id, grupoNombre: g.nombre }] : [];
    }),
  );
  const unitario = calcularPrecioLinea({ precioBase, opciones: elegidas, cantidad: 1 }).precioUnitario;
  const valido =
    !comboAgotado && !faltaElegirReemplazo(partesRe, reemplazos) && gruposCarta.every((g) => (sel[g.id] ?? []).length >= g.minimo);

  // Stock: el saldo lo comparten todas las líneas del mismo producto que ya están en el carrito
  const info = inventario[String(producto.id)] ?? infoStockDe(producto);
  const enCarrito = unidadesEnCarrito(lineas, producto.id);
  // Mezcla de sabores (donas y galletas): cada tamaño trae sus unidades y el saldo es por sabor
  const saborMode = producto.saboresConStock === true;
  const unidadesMezcla = tamano?.unidades ?? 1;
  const total = unidadesMezcla * cantidad;
  const saboresDisp = saborMode ? saboresParaLinea(info, lineas, String(producto.id)) : [];
  // al cambiar tamaño o cantidad el reparto se recorta al nuevo total y a lo que queda de cada sabor
  const valorSaboresOk = saborMode ? recortarAlTope(valorSabores, saboresDisp, total) : {};
  useEffect(() => {
    if (saborMode && JSON.stringify(valorSaboresOk) !== JSON.stringify(valorSabores)) setValorSabores(valorSaboresOk);
  });
  const saboresListos = !saborMode || repartoValido(valorSaboresOk, total, saboresDisp);
  const faltanSabores = faltanUnidades(valorSaboresOk, total);

  const tope = saborMode ? mezclasDisponibles(info, lineas, String(producto.id), unidadesMezcla) : topeAgregable(info, enCarrito);
  const sinStock = !info.disponible || (info.controlaStock && info.quedan === 0);
  const sinSaldo = tope !== null && tope <= 0;
  const puedeAgregar = valido && saboresListos && !sinStock && !sinSaldo;
  const enTope = tope !== null && cantidad >= tope;
  const etiquetaStock = etiquetaQuedan(info);
  const ayudaStock =
    sinStock || info.quedan === null
      ? null
      : enTope
        ? `Solo quedan ${info.quedan}${enCarrito > 0 ? ` · ya tienes ${enCarrito} en tu pedido` : ''}`
        : etiquetaStock;
  const ayudaSabores = valido && !saboresListos ? `Elige los sabores: faltan ${faltanSabores}` : null;
  const ayudaMezclas = saborMode && enTope ? 'Ya no quedan más unidades de estos sabores' : null;
  useEffect(() => {
    if (tope !== null && cantidad > Math.max(1, tope)) setCantidad(Math.max(1, tope));
  }, [tope, cantidad]);

  const alternar = (g: GrupoOpcionesCarta, oid: string) => {
    setSel((prev) => ({ ...prev, [g.id]: alternarEleccion(g, prev[g.id] ?? [], oid) }));
  };

  const consejoHielo = /poco hielo|menos hielo/i.test(nota)
    ? 'Con poco hielo el vaso queda con menos volumen de bebida.'
    : /no tan helado|menos helado|sin tanto hielo/i.test(nota)
      ? 'Si lo pides menos helado, la bebida quedará más aguada.'
      : '';

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
    agregarLinea({
      productoId: producto.id,
      nombre: producto.nombre,
      fotoUrl: producto.fotoUrl,
      tamanoId: tamano?.id,
      tamanoNombre: tamano?.nombre,
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

  const filtrar = (g: GrupoOpcionesCarta) => {
    const q = (busquedas[g.id] ?? '').trim().toLowerCase();
    const lista = g.opciones.filter((o) => !q || o.nombre.toLowerCase().includes(q) || (sel[g.id] ?? []).includes(o.id));
    return { grande: g.opciones.length > 8, q: busquedas[g.id] ?? '', lista };
  };

  const buscador = (g: GrupoOpcionesCarta, alto: number, etiqueta: string) => (
    <input
      type="search"
      value={busquedas[g.id] ?? ''}
      onChange={(e) => setBusquedas((p) => ({ ...p, [g.id]: e.target.value }))}
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

  const nombreSticker = (i: number): string => recortar((nombres[i] ?? '').trim() || 'TU NOMBRE', 14);

  return (
    <>
      <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, zIndex: 30, background: 'rgba(11,44,62,0.55)' }} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Detalles de ${producto.nombre}`}
        style={{
          position: 'fixed',
          zIndex: 40,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(620px, calc(100% - 24px))',
          maxHeight: 'calc(100% - 24px)',
          overflowY: 'auto',
          background: 'var(--cp-cream)',
          borderRadius: 20,
          boxShadow: '0 20px 50px rgba(11,44,62,0.4)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ position: 'relative', flex: 'none', background: 'var(--cp-white)' }}>
            <button
              onClick={onCerrar}
              aria-label="Cerrar ventana de producto"
              style={{ position: 'absolute', zIndex: 2, top: 12, right: 12, width: 44, height: 44, borderRadius: 22, border: '1.5px solid var(--cp-navy)', background: 'var(--cp-white)', color: 'var(--cp-navy)', fontSize: 20, fontWeight: 800 }}
            >
              ×
            </button>
            {producto.fotoUrl ? (
              <button
                type="button"
                onClick={() => setZoom(true)}
                aria-label={`Ampliar la foto de ${producto.nombre}`}
                style={{ position: 'relative', width: '100%', height: movil ? 210 : 280, border: 0, padding: 0, background: 'var(--cp-sand)', cursor: 'zoom-in', display: 'block', overflow: 'hidden' }}
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

          <div style={{ flex: 'none', minWidth: 0, padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ ...titulo, fontWeight: 800, fontSize: 24, lineHeight: '30px' }}>{producto.nombre}</div>
              {producto.descripcion && <div style={{ fontSize: 13, color: 'var(--cp-soft)', marginTop: 4 }}>{producto.descripcion}</div>}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ ...titulo, fontWeight: 800, fontSize: 26, color: 'var(--cp-rust)' }}>{fmt(unitario)}</span>
            </div>

            {producto.tamanos.length > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ ...titulo, fontWeight: 700, fontSize: 15 }}>Tamaño</span>
                  <span style={{ fontSize: 11, fontWeight: 700, background: 'var(--cp-navy)', color: 'var(--cp-cream)', borderRadius: 9999, padding: '2px 10px' }}>OBLIGATORIO</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: 8 }}>
                  {producto.tamanos.map((t) => {
                    const on = t.id === tamanoId;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setTamanoId(t.id)}
                        aria-pressed={on}
                        style={{ minHeight: 64, borderRadius: 14, border: `2px solid ${on ? 'var(--cp-orange)' : 'var(--cp-line)'}`, background: 'var(--cp-white)', color: 'var(--cp-navy)', padding: '8px 10px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 2, textAlign: 'left' }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                          <span style={{ width: 16, height: 16, borderRadius: 8, border: '2px solid var(--cp-navy)', background: on ? 'var(--cp-orange)' : 'transparent', flex: 'none' }} />
                          <span style={{ flex: 1, fontWeight: 700, fontSize: 13, lineHeight: '17px' }}>{t.nombre}</span>
                        </span>
                        <span style={{ ...titulo, fontWeight: 800, fontSize: 15, color: 'var(--cp-rust)', paddingLeft: 24 }}>{fmt(t.precio)}</span>
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
            <AvisoReemplazoCombo
              partes={comboAgotado ? [] : partesRe}
              elegidos={reemplazos}
              onElegir={(parteId, productoId) => setReemplazos((prev) => ({ ...prev, [parteId]: productoId }))}
            />

            {esCombo ? (
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
                              <div key={g.id}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                  <span style={{ fontWeight: 700, fontSize: 13 }}>{nombreCorto(g)}</span>
                                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--cp-soft)' }}>
                                    {g.minimo >= 1 ? 'Elige 1' : g.maximo > 1 ? `Opcional, hasta ${g.maximo}` : 'Opcional'}
                                  </span>
                                </div>
                                {f.grande && buscador(g, 40, `Buscar ${nombreCorto(g).toLowerCase()}`)}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, ...(f.grande ? { maxHeight: 236, overflowY: 'auto' } : {}) }}>
                                  {f.lista.map((o) => {
                                    const on = (sel[g.id] ?? []).includes(o.id);
                                    return (
                                      <button
                                        key={o.id}
                                        onClick={() => alternar(g, o.id)}
                                        aria-pressed={on}
                                        style={{ minHeight: 40, padding: '0 12px', borderRadius: 9999, border: `1.5px solid ${on ? 'var(--cp-orange)' : 'var(--cp-line)'}`, background: on ? 'rgba(230,121,41,0.16)' : 'var(--cp-white)', color: 'var(--cp-navy)', fontWeight: 600, fontSize: 13 }}
                                      >
                                        {on ? '✓ ' : ''}
                                        {o.nombre}
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
              gruposCarta.map((g) => {
                const f = filtrar(g);
                const obligatorio = g.minimo >= 1;
                return (
                  <div key={g.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ ...titulo, fontWeight: 800, fontSize: 14, letterSpacing: '0.01em' }}>{g.nombre}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, background: obligatorio ? 'var(--cp-navy)' : 'transparent', color: obligatorio ? 'var(--cp-cream)' : 'var(--cp-soft)', borderRadius: 9999, padding: '2px 10px', border: `1px solid ${obligatorio ? 'var(--cp-navy)' : 'var(--cp-soft)'}` }}>
                        {etiquetaGrupo(g)}
                      </span>
                    </div>
                    {f.grande && buscador(g, 44, `Buscar en ${g.nombre}`)}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, ...(f.grande ? { maxHeight: 300, overflowY: 'auto' } : {}) }}>
                      {f.lista.map((o) => {
                        const on = (sel[g.id] ?? []).includes(o.id);
                        return (
                          <button
                            key={o.id}
                            onClick={() => alternar(g, o.id)}
                            aria-pressed={on}
                            style={{ minHeight: 44, borderRadius: 9999, border: `2px solid ${on ? 'var(--cp-orange)' : 'var(--cp-line)'}`, background: 'var(--cp-white)', color: 'var(--cp-navy)', padding: '0 14px 0 10px', display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', fontSize: 13 }}
                          >
                            <span style={{ width: 16, height: 16, borderRadius: g.maximo === 1 ? 10 : 6, border: '2px solid var(--cp-navy)', background: on ? 'var(--cp-orange)' : 'transparent', flex: 'none' }} />
                            <span style={{ fontWeight: 600 }}>{o.nombre}</span>
                            {o.precioExtra > 0 && <span style={{ fontWeight: 700, color: 'var(--cp-rust)' }}>+{fmt(o.precioExtra)}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}

            {nB > 0 && (
              <div style={{ border: '1.5px solid var(--cp-line)', borderRadius: 14, padding: '10px 12px', background: 'var(--cp-white)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ ...titulo, fontWeight: 800, fontSize: 14 }}>Nombre para el envase</div>
                {Array.from({ length: cantidad * nB }, (_, i) => {
                  const g = gruposBebida[i % nB];
                  const bebida = g.opciones.find((o) => o.id === (sel[g.id] ?? [])[0])?.nombre ?? nombreCorto(g);
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

            <div style={{ position: 'sticky', bottom: 0, zIndex: 1, margin: '0 -24px -24px', padding: '12px 24px 16px', background: 'var(--cp-cream)', borderTop: '1px solid var(--cp-line)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
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
              <button
                onClick={soloLectura ? undefined : agregar}
                disabled={soloLectura ? true : !puedeAgregar}
                aria-label={soloLectura ? 'Vista previa deshabilitada' : undefined}
                style={{
                  flex: '1 1 200px',
                  minHeight: 52,
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
                      ? 'Agotado'
                      : sinSaldo && valido
                        ? 'Sin más unidades'
                        : valido && !saboresListos
                          ? 'Elige los sabores'
                          : valido
                            ? 'Agregar al pedido'
                            : 'Elige las opciones obligatorias'}
                </span>
                <span>{fmt(unitario * cantidad)}</span>
              </button>
            </div>
          </div>
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
