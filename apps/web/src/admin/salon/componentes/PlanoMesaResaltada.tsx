import { useEffect, useMemo, useState } from 'react';
import { useSesion } from '../../../comun/sesion';
import { salonApi } from '../api';
import type { ElementoPlano, MesaSalon, PisoPlano, PisoSalon } from '../tipos';
import { CuadriculaPlano } from './CuadriculaPlano';

export interface PlanoMesaResaltadaProps {
  /** Pedido de la mesa: las mesas ocupadas por él se resaltan (varias si se juntaron). */
  pedidoId?: string | number | null;
  mesaId?: string | number | null;
  /** «Mesa 3», «3» o el nombre de la mesa; se usa si no hay mesaId ni pedido ligado. */
  mesaNombre?: string | null;
}

const limpiar = (t: unknown) => String(t ?? '').trim().toLowerCase().replace(/^mesa\s*/, '');

/** Texto de respaldo: «Mesa 3» aunque el nombre ya traiga «Mesa». */
const textoMesa = (nombre?: string | null) => {
  const n = String(nombre ?? '').trim();
  return !n ? 'Mesa' : /^mesa/i.test(n) ? n : `Mesa ${n}`;
};

/**
 * Croquis real del local, solo lectura: el piso que contiene la mesa del pedido, con esa mesa resaltada
 * (anillo naranja y «Esta mesa»). Sin permiso plano/ver, o si el plano no carga o no se halla la mesa,
 * muestra solo el texto «Mesa N».
 */
export function PlanoMesaResaltada({ pedidoId, mesaId, mesaNombre }: PlanoMesaResaltadaProps) {
  const { tiene } = useSesion();
  const puedeVer = tiene('plano/ver');
  const [pisos, setPisos] = useState<PisoSalon[] | null>(null);
  const [planos, setPlanos] = useState<PisoPlano[]>([]);
  const [fallo, setFallo] = useState(false);
  const [completo, setCompleto] = useState(false);
  const [pisoElegido, setPisoElegido] = useState<string | null>(null);

  useEffect(() => {
    if (!puedeVer) return;
    let vigente = true;
    setFallo(false);
    salonApi
      .obtenerMesas()
      .then((r) => vigente && setPisos(Array.isArray(r?.pisos) ? r.pisos : []))
      .catch(() => vigente && setFallo(true));
    // El dibujo (paredes, barra...) es un extra: si no llega, se ven solo las mesas
    Promise.resolve()
      .then(() => salonApi.obtenerPlano())
      .then((r) => vigente && setPlanos(Array.isArray(r) ? r : []))
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [puedeVer]);

  const pisosActivos = useMemo(() => (pisos ?? []).filter((p) => p.activo !== false), [pisos]);

  const resaltadas: MesaSalon[] = useMemo(() => {
    const todas = pisosActivos.flatMap((p) => p.mesas || []);
    const porId = mesaId != null ? todas.filter((m) => String(m.id) === String(mesaId)) : [];
    if (porId.length) return porId;
    const porPedido = pedidoId != null ? todas.filter((m) => m.pedido && String(m.pedido.id) === String(pedidoId)) : [];
    if (porPedido.length) return porPedido;
    const n = limpiar(mesaNombre);
    return n ? todas.filter((m) => limpiar(m.numero) === n || limpiar(m.nombre) === n) : [];
  }, [pisosActivos, mesaId, pedidoId, mesaNombre]);

  const texto = textoMesa(mesaNombre);
  if (!puedeVer || fallo || (pisos !== null && resaltadas.length === 0)) {
    return <div data-testid="mesa-texto" style={{ fontSize: 17, fontWeight: 700 }}>{texto}</div>;
  }
  if (pisos === null) return <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>Cargando el croquis…</div>;

  const pisoDeLaMesa = pisosActivos.find((p) => p.id === resaltadas[0].pisoId) ?? pisosActivos[0];
  const piso = completo ? pisosActivos.find((p) => p.id === pisoElegido) ?? pisoDeLaMesa : pisoDeLaMesa;
  const elementos: ElementoPlano[] = [
    ...(planos.find((pl) => pl.id === piso.id)?.elementos ?? piso.elementos ?? []).filter((e) => e.tipo !== 'MESA' && e.activo !== false),
    ...(piso.mesas || [])
      .filter((m) => m.activo)
      .map((m) => ({ id: m.id, pisoId: m.pisoId, tipo: 'MESA', nombre: m.nombre, x: m.x, y: m.y, ancho: m.ancho, alto: m.alto, numero: m.numero, asientos: m.asientos, activo: m.activo })),
  ];

  return (
    <div data-testid="plano-mesa-resaltada" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 17, fontWeight: 700 }}>
          {texto} · {piso.nombre}
        </span>
        {pisosActivos.length > 1 && (
          <button
            type="button"
            onClick={() => setCompleto((v) => !v)}
            style={{ minHeight: 44, padding: '0 14px', borderRadius: 9999, border: '1.5px solid var(--cp-navy)', background: 'transparent', color: 'var(--cp-navy)', fontWeight: 800, cursor: 'pointer' }}
          >
            {completo ? 'Ver solo mi mesa' : 'Ver piso completo'}
          </button>
        )}
      </div>
      {completo && pisosActivos.length > 1 && (
        <div role="group" aria-label="Pisos" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {pisosActivos.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={p.id === piso.id}
              onClick={() => setPisoElegido(p.id)}
              style={{ minHeight: 44, padding: '0 14px', borderRadius: 10, border: '1.5px solid var(--cp-navy)', background: p.id === piso.id ? 'var(--cp-navy)' : 'var(--cp-white)', color: p.id === piso.id ? 'var(--cp-cream)' : 'var(--cp-navy)', fontWeight: 800, cursor: 'pointer' }}
            >
              {p.nombre}
            </button>
          ))}
        </div>
      )}
      <div style={{ maxHeight: completo ? undefined : 270, overflow: 'auto', borderRadius: 16 }}>
        <CuadriculaPlano
          columnas={piso.cuadriculaAncho || piso.cuadricula_ancho || 20}
          filas={piso.cuadriculaAlto || piso.cuadricula_alto || 12}
          elementos={elementos}
          modoSalon
          mesasSalon={piso.mesas}
          mesasResaltadasIds={resaltadas.map((m) => m.id)}
        />
      </div>
    </div>
  );
}
