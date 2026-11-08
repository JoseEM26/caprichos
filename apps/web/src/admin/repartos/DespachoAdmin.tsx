import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { MapaRepartos, PuntoRepartoMapa } from './MapaRepartos';
import { ZonaGeoItem } from './zonasGeo';
import { ConfigReparto } from './calculoRuta';
import { repartosApi, PedidoSeguimiento, RepartidorPanel } from './repartosApi';
import { CocinaCheck } from './CocinaCheck';
import { contarDespacho, FASES, pedidosDespacho, PedidoDespacho, ResumenDespacho, rutaDespacho } from './despachoModelo';
import { nombreClienteVisible } from './textoVisible';
import { useEsMovil } from '../../carta/useEsMovil';

const MOTIVO_ASIGNAR = 'Asignado por el administrador desde el despacho';

const hh = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Lima' }) : '';

const boton: CSSProperties = {
  minHeight: 44,
  minWidth: 44,
  padding: '0 14px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 12,
  border: '1.5px solid var(--cp-navy, #0B2C3E)',
  background: 'var(--cp-cream, #FFFDF8)',
  color: 'var(--cp-navy, #0B2C3E)',
  fontWeight: 800,
  fontSize: 13,
  textDecoration: 'none',
  cursor: 'pointer',
  boxSizing: 'border-box',
};

export function ContadoresDespacho({ r }: { r: ResumenDespacho }) {
  const items: Array<[string, number, string, string]> = [
    ['Sin repartidor', r.sinRepartidor, 'cont-sin-repartidor', '#B91C1C'],
    ['En cocina', r.enCocina, 'cont-cocina', FASES.cocina.color],
    ['Listos para salir', r.porSalir, 'cont-por-salir', FASES.porSalir.color],
    ['En camino', r.enCamino, 'cont-en-camino', FASES.enCamino.color],
    ['Llegaron', r.llegaron, 'cont-llegaron', FASES.llego.color],
  ];
  return (
    <div role="group" aria-label="Contadores del despacho" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
      {items.map(([texto, n, id, color]) => (
        <div key={id} data-testid={id} role="status" aria-label={`${texto}: ${n}`} style={{ minHeight: 60, padding: '6px 12px', borderRadius: 12, border: `2px solid ${n > 0 ? color : 'var(--cp-line, #E3D6C6)'}`, background: 'var(--cp-white, #fff)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <span style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.1, color: n > 0 ? color : 'var(--cp-soft, #5A6E78)' }}>{n}</span>
          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--cp-navy, #0B2C3E)' }}>{texto}</span>
        </div>
      ))}
    </div>
  );
}

export function TarjetaDespacho({
  d, seleccionada, repartidores, puedeAsignar, alSeleccionar, alAbrirDetalle, alAsignar,
}: {
  d: PedidoDespacho;
  seleccionada: boolean;
  repartidores: RepartidorPanel[];
  puedeAsignar: boolean;
  alSeleccionar: (id: string) => void;
  alAbrirDetalle: (id: string) => void;
  alAsignar: (pedido: PedidoSeguimiento, repartidorPartyId: string) => void;
}) {
  const p = d.pedido;
  const fase = FASES[d.fase];
  const digitos = p.cliente_telefono ? p.cliente_telefono.replace(/\D/g, '').slice(-9) : '';
  const pagado = p.pago_estado === 'PAGADO';
  const urgente = p.minutosEspera >= 30;
  const horaEtapa = d.fase === 'llego' ? `Llegó ${hh(p.llego_en)}` : d.fase === 'enCamino' ? `Salió ${hh(p.salio_en)}` : '';
  const elegibles = repartidores.filter((r) => !r.es_admin);

  return (
    <article
      data-testid={`tarjeta-despacho-${p.id}`}
      aria-current={seleccionada ? 'true' : undefined}
      style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, borderRadius: 14, background: 'var(--cp-white, #fff)', border: seleccionada ? `3px solid ${fase.color}` : '1.5px solid var(--cp-line, #E3D6C6)' }}
    >
      <button
        type="button"
        aria-pressed={seleccionada}
        aria-label={`Pedido ${d.numero}, ${p.codigo}`}
        onClick={() => alSeleccionar(p.id)}
        style={{ all: 'unset', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start', minHeight: 44 }}
      >
        <span style={{ flex: 'none', width: 40, height: 40, borderRadius: '50%', background: fase.color, color: '#fff', fontWeight: 900, fontSize: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{d.numero}</span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
          <strong style={{ fontSize: 15, color: 'var(--cp-navy, #0B2C3E)' }}>{p.codigo} · {nombreClienteVisible(p.cliente_nombre)}</strong>
          <span style={{ fontSize: 13, color: 'var(--cp-soft, #5A6E78)' }}>{p.direccion ?? 'Sin dirección'}{p.lat == null ? ' · sin ubicación en el mapa' : ''}</span>
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 800, padding: '2px 8px', borderRadius: 999, color: '#fff', background: fase.color }}>{fase.texto}{horaEtapa ? ` · ${horaEtapa}` : ''}</span>
            <span style={{ fontSize: 12, fontWeight: 800, padding: '2px 8px', borderRadius: 999, color: '#fff', background: urgente ? '#B91C1C' : '#4B5B64' }}>{p.minutosEspera} min</span>
            <span style={{ fontSize: 12, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: pagado ? '#DCFCE7' : '#FEF3C7', color: 'var(--cp-navy, #0B2C3E)' }}>{pagado ? 'Pagado' : `Falta cobrar S/ ${Number(p.total).toFixed(2)}`}</span>
          </span>
        </span>
      </button>

      <CocinaCheck pedido={p} />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {puedeAsignar && d.fase !== 'cocina' ? (
          <select
            aria-label={`${p.repartidor_party_id ? 'Reasignar' : 'Asignar'} repartidor del pedido ${p.codigo}`}
            value={p.repartidor_party_id ?? ''}
            onChange={(e) => e.target.value && alAsignar(p, e.target.value)}
            style={{ ...boton, flex: '1 1 160px', fontWeight: 700, background: p.repartidor_party_id ? 'var(--cp-cream, #FFFDF8)' : '#FEE2E2' }}
          >
            <option value="">{p.repartidor_party_id ? 'Reasignar a…' : 'Asignar repartidor…'}</option>
            {elegibles.map((r) => (
              <option key={r.party_id} value={r.party_id}>
                {r.nombre}{r.party_id === p.repartidor_party_id ? ' (actual)' : ''}
              </option>
            ))}
          </select>
        ) : (
          <span style={{ fontSize: 13, fontWeight: 700 }}>{p.repartidor?.nombre ?? 'Sin repartidor'}</span>
        )}
        {digitos && <a href={`tel:${digitos}`} style={boton}>Llamar</a>}
        {digitos && <a href={`https://wa.me/51${digitos}`} target="_blank" rel="noreferrer" style={boton}>WhatsApp</a>}
        <button type="button" onClick={() => alAbrirDetalle(p.id)} style={boton}>Detalle y cobro</button>
      </div>
      {p.repartidor && puedeAsignar && d.fase !== 'cocina' && (
        <span style={{ fontSize: 12, color: 'var(--cp-soft, #5A6E78)' }}>Lo lleva {p.repartidor.nombre}</span>
      )}
    </article>
  );
}

/**
 * Despacho del ADMIN: mapa con pines numerados y color por estado, y al lado las tarjetas con los mismos
 * números. Tocar un pin o una tarjeta resalta el otro. Tablet y PC: dos columnas; celular: mapa arriba y lista abajo.
 */
export function DespachoAdmin({
  pedidos, repartidores, config, zonas, puedeAsignar, seleccionadoId, alSeleccionar, alAbrirDetalle, alActualizar,
}: {
  pedidos: PedidoSeguimiento[];
  repartidores: RepartidorPanel[];
  config: ConfigReparto;
  zonas: ZonaGeoItem[];
  puedeAsignar: boolean;
  seleccionadoId: string | null;
  alSeleccionar: (id: string | null) => void;
  alAbrirDetalle: (id: string) => void;
  alActualizar: () => void;
}) {
  const [filtro, setFiltro] = useState('todos');
  const [error, setError] = useState<string | null>(null);
  const listaRef = useRef<HTMLDivElement>(null);
  const movil = useEsMovil();

  const todos = useMemo(() => pedidosDespacho(pedidos), [pedidos]);
  const visibles = useMemo(
    () => todos.filter((d) => filtro === 'todos' || (filtro === 'sin' ? !d.pedido.repartidor_party_id : d.pedido.repartidor_party_id === filtro)),
    [todos, filtro],
  );
  const resumen = useMemo(() => contarDespacho(todos), [todos]);
  const ruta = useMemo(() => rutaDespacho(visibles.filter((d) => d.fase !== 'cocina'), config.velocidadMediaKmH), [visibles, config.velocidadMediaKmH]);

  const puntos: PuntoRepartoMapa[] = useMemo(
    () =>
      visibles
        .filter((d) => d.pedido.lat != null && d.pedido.lng != null)
        .map((d) => ({
          id: d.pedido.id,
          lat: d.pedido.lat!,
          lng: d.pedido.lng!,
          etiqueta: d.pedido.cliente_nombre,
          codigo: d.pedido.codigo,
          detalle: FASES[d.fase].texto,
          color: d.pedido.color,
          colorFase: FASES[d.fase].color,
          orden: d.numero,
          minutosEspera: d.pedido.minutosEspera,
          enReparto: !!d.pedido.repartidor_party_id,
        })),
    [visibles],
  );

  // Al tocar un pin, la tarjeta correspondiente se muestra en la lista
  useEffect(() => {
    if (!seleccionadoId) return;
    const el = listaRef.current?.querySelector(`[data-testid="tarjeta-despacho-${seleccionadoId}"]`) as HTMLElement | null;
    el?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [seleccionadoId]);

  const asignar = async (pedido: PedidoSeguimiento, repartidorPartyId: string) => {
    setError(null);
    try {
      await repartosApi.reasignarPedido(pedido.id, repartidorPartyId, MOTIVO_ASIGNAR);
      alActualizar();
    } catch (e: any) {
      setError(e?.message || 'No se pudo asignar el repartidor');
    }
  };

  const opcionesFiltro = [
    { valor: 'todos', texto: 'Todos los repartidores' },
    { valor: 'sin', texto: 'Sin repartidor' },
    ...repartidores.filter((r) => !r.es_admin).map((r) => ({ valor: r.party_id, texto: r.nombre })),
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} data-testid="despacho-admin">
      <ContadoresDespacho r={resumen} />
      {error && <p role="alert" style={{ margin: 0, fontWeight: 700, color: 'var(--cp-rust, #B2500F)' }}>{error}</p>}
      <div className="despacho-layout">
        <div className="despacho-mapa">
          <MapaRepartos
            puntos={puntos}
            zonas={zonas}
            seleccionadoId={seleccionadoId}
            onSeleccionarPunto={(id) => alSeleccionar(seleccionadoId === id ? null : id)}
            altura={movil ? '42vh' : 'max(420px, calc(100vh - 300px))'}
          />
        </div>
        <div className="despacho-lista" ref={listaRef}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <select aria-label="Ver pedidos de" value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{ ...boton, flex: '1 1 180px' }}>
              {opcionesFiltro.map((o) => (
                <option key={o.valor} value={o.valor}>{o.texto}</option>
              ))}
            </select>
            {ruta && (
              <a href={ruta.urlGoogleMaps} target="_blank" rel="noreferrer" style={{ ...boton, background: 'var(--cp-navy, #0B2C3E)', color: 'var(--cp-cream, #FFFDF8)' }}>
                Ruta en Google Maps
              </a>
            )}
          </div>
          {ruta && (
            <p data-testid="ruta-despacho" style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--cp-navy, #0B2C3E)' }}>
              Paradas {ruta.numeros.join(', ')} · {ruta.distanciaAproxKm} km · unos {ruta.tiempoAproxMin} min
            </p>
          )}
          {visibles.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--cp-soft, #5A6E78)', fontWeight: 700 }}>No hay pedidos de delivery en curso.</p>
          ) : (
            visibles.map((d) => (
              <TarjetaDespacho
                key={d.pedido.id}
                d={d}
                seleccionada={d.pedido.id === seleccionadoId}
                repartidores={repartidores}
                puedeAsignar={puedeAsignar}
                alSeleccionar={(id) => alSeleccionar(seleccionadoId === id ? null : id)}
                alAbrirDetalle={alAbrirDetalle}
                alAsignar={asignar}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
