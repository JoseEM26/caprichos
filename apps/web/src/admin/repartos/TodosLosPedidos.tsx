import { useMemo, useState } from 'react';
import { clasificarEspera, ConfigReparto } from './calculoRuta';
import { nombreClienteVisible } from './textoVisible';
import { EstadoVacio } from '../../comun/EstadoVacio';
import type { PedidoSeguimiento, SeccionSeguimiento } from './repartosApi';

export const SECCIONES: Array<{ clave: SeccionSeguimiento; titulo: string }> = [
  { clave: 'ESPERANDO', titulo: 'Esperando repartidor' },
  { clave: 'PREPARACION', titulo: 'En preparación / en espera' },
  { clave: 'EN_CAMINO', titulo: 'Tomados · en camino' },
  { clave: 'ENTREGADOS', titulo: 'Entregados hoy' },
  { clave: 'INCIDENTE', titulo: 'No entregados / con incidente' },
];

const hh = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Lima' }) : '';

const ESTADO_PREP: Record<string, string> = { COLA: 'En cola', EN_COCINA: 'En cocina', PREPARANDO: 'En preparación' };

/** Etapa legible de cada fila según su sección. */
function etapaTexto(p: PedidoSeguimiento): string {
  switch (p.seccion) {
    case 'ESPERANDO':
      return 'Listo, sin tomar';
    case 'PREPARACION':
      return ESTADO_PREP[p.estado] ?? 'Por confirmar';
    case 'EN_CAMINO':
      return p.etapa === 'LLEGADO' ? `Llegó ${hh(p.llego_en)}` : p.etapa === 'EN_CAMINO' ? `En camino ${hh(p.salio_en)}` : `Tomado ${hh(p.tomado_en)}`;
    case 'ENTREGADOS':
      return `Entregado ${hh(p.entregado_en)}`;
    default:
      return p.estado === 'ANULADO' ? 'Anulado' : `Incidente: ${p.motivo_falla ?? 'sin detalle'}`;
  }
}

function Fila({ p, config, alAbrir }: { p: PedidoSeguimiento; config: ConfigReparto; alAbrir: (id: string) => void }) {
  const vivo = p.seccion !== 'ENTREGADOS' && p.seccion !== 'INCIDENTE';
  const color = vivo ? clasificarEspera(p.minutosEspera, config).colorHex : '#6B7C86';
  return (
    <button
      type="button"
      onClick={() => alAbrir(p.id)}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        minHeight: 52,
        padding: '8px 10px',
        textAlign: 'left',
        cursor: 'pointer',
        borderRadius: 10,
        border: '1px solid rgba(11,44,62,.15)',
        background: 'var(--cp-cream, #FBF4EC)',
        color: 'var(--cp-navy, #0B2C3E)',
      }}
    >
      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <strong style={{ fontSize: 13 }}>
          {p.codigo} · {nombreClienteVisible(p.cliente_nombre)}
        </strong>
        <span style={{ fontSize: 12, color: 'var(--cp-soft, #5A6E78)' }}>
          {p.zona ?? 'Sin zona'} · {p.repartidor?.nombre ?? 'Sin repartidor'} · {etapaTexto(p)}
        </span>
      </span>
      {vivo && (
        <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 800, padding: '3px 8px', borderRadius: 999, color: '#fff', background: color }}>
          {p.minutosEspera} min
        </span>
      )}
    </button>
  );
}

/** Pestaña «Todos los pedidos»: los deliveries de hoy en secciones con conteo, chips y buscador. Solo lectura. */
export function TodosLosPedidos({
  pedidos,
  config,
  alAbrir,
}: {
  pedidos: PedidoSeguimiento[];
  config: ConfigReparto;
  alAbrir: (id: string) => void;
}) {
  const [seccion, setSeccion] = useState<SeccionSeguimiento | 'TODAS'>('TODAS');
  const [busqueda, setBusqueda] = useState('');

  const encontrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return q
      ? pedidos.filter((p) => p.codigo.toLowerCase().includes(q) || nombreClienteVisible(p.cliente_nombre).toLowerCase().includes(q))
      : pedidos;
  }, [pedidos, busqueda]);

  const porSeccion = (c: SeccionSeguimiento) =>
    encontrados.filter((p) => p.seccion === c).sort((a, b) => b.minutosEspera - a.minutosEspera);

  const chip = (activo: boolean) => ({
    minHeight: 36,
    padding: '0 12px',
    borderRadius: 999,
    border: '1.5px solid var(--cp-navy, #0B2C3E)',
    background: activo ? 'var(--cp-navy, #0B2C3E)' : 'transparent',
    color: activo ? 'var(--cp-cream, #FFFDF8)' : 'var(--cp-navy, #0B2C3E)',
    fontWeight: 800,
    fontSize: 12,
    cursor: 'pointer',
  });

  const visibles = SECCIONES.filter((s) => seccion === 'TODAS' || seccion === s.clave);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <input
        type="search"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por código o cliente"
        aria-label="Buscar por código o cliente"
        style={{ minHeight: 44, padding: '0 12px', borderRadius: 10, border: '1.5px solid var(--cp-line, #E3D6C6)', fontSize: 14, boxSizing: 'border-box', width: '100%' }}
      />
      <div role="group" aria-label="Filtrar por sección" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button type="button" aria-pressed={seccion === 'TODAS'} onClick={() => setSeccion('TODAS')} style={chip(seccion === 'TODAS')}>
          Todos ({encontrados.length})
        </button>
        {SECCIONES.map((s) => (
          <button key={s.clave} type="button" aria-pressed={seccion === s.clave} onClick={() => setSeccion(s.clave)} style={chip(seccion === s.clave)}>
            {s.titulo} ({porSeccion(s.clave).length})
          </button>
        ))}
      </div>
      {encontrados.length === 0 ? (
        <EstadoVacio mensaje="No hay pedidos de delivery para mostrar hoy." />
      ) : (
        visibles.map((s) => {
          const lista = porSeccion(s.clave);
          return (
            <section
              key={s.clave}
              aria-label={s.titulo}
              style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 14, borderRadius: 14, background: 'var(--cp-white, #FFFFFF)', border: '1.5px solid rgba(11,44,62,.2)' }}
            >
              <h3 style={{ margin: 0, fontSize: 16, color: 'var(--cp-navy, #0B2C3E)' }}>
                {s.titulo} ({lista.length})
              </h3>
              {lista.length === 0 ? (
                <span style={{ fontSize: 13, color: 'var(--cp-soft, #5A6E78)' }}>Ninguno.</span>
              ) : (
                lista.map((p) => <Fila key={p.id} p={p} config={config} alAbrir={alAbrir} />)
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
