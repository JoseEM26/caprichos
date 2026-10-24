import { useEffect, useState } from 'react';
import { api } from '../comun/api';
import { Boton } from '../comun/Boton';
import { EstadoError } from '../comun/EstadoError';
import { EstadoVacio } from '../comun/EstadoVacio';
import { Icono } from '../comun/Icono';
import { useCarrito } from './CarritoContext';
import { useCuentaOpcional } from './cuenta/CuentaContext';
import { PasoPedido } from './PantallaConfirmacion';
import {
  consultarLote,
  EstadoSeguimiento,
  INTERVALO_SEGUIMIENTO_MS,
  leerPedidosGuardados,
  PedidoGuardado,
  usePedidosGuardados,
  useSeguimientoPedido,
} from './seguimiento';
import { useEsMovil } from './useEsMovil';
import type { ModalidadEntrega } from './tipos';

interface PedidoCuenta extends EstadoSeguimiento {
  creadoEn: string;
  resumen: string;
  seguimientoToken: string;
}

interface RespuestaCuenta {
  pedidos: PedidoCuenta[];
  pagina: number;
  hayMas: boolean;
}

// Fila de la lista: viene del historial de la cuenta o del navegador
interface Fila {
  codigo: string;
  token: string;
  modalidad: ModalidadEntrega;
  creadoEn: string;
  estado?: string;
  estadoEtiqueta?: string;
  terminado: boolean;
  anulado: boolean;
  total?: number;
  resumen?: string;
}

const RANGO_ESTADO: Record<string, number> = { COLA: 0, PREPARANDO: 1, LISTO: 2, EN_CAMINO: 3, ENTREGADO: 4 };

/** «Mi pedido» (uno) o «Mis pedidos» (varios): historial del invitado y de la cuenta, con estado en vivo. */
export function MisPedidos() {
  const { listaPedidosAbierta, setListaPedidosAbierta } = useCarrito();
  if (!listaPedidosAbierta) return null;
  return <ContenidoMisPedidos alCerrar={() => setListaPedidosAbierta(false)} />;
}

function ContenidoMisPedidos({ alCerrar }: { alCerrar: () => void }) {
  const cuenta = useCuentaOpcional();
  const cliente = cuenta?.cliente ?? null;
  const movil = useEsMovil();
  const guardados = usePedidosGuardados();
  const historial = useHistorialCuenta(cliente !== null);
  const [detalle, setDetalle] = useState<Fila | null>(null);
  const [errorGuardados, setErrorGuardados] = useState(false);

  // Invitado: solo se consultan los pedidos que no han terminado; el resto usa su copia local
  const claveActivos = guardados
    .filter((p) => !p.terminado)
    .map((p) => p.codigo)
    .join(',');

  useEffect(() => {
    if (!claveActivos) return;
    let activo = true;
    let temporizador: ReturnType<typeof setTimeout> | undefined;

    const ciclo = async () => {
      clearTimeout(temporizador);
      if (document.visibilityState !== 'hidden') {
        try {
          await consultarLote(leerPedidosGuardados().filter((p) => !p.terminado));
          if (activo) setErrorGuardados(false);
        } catch {
          if (activo) setErrorGuardados(true);
        }
      }
      if (activo) temporizador = setTimeout(ciclo, INTERVALO_SEGUIMIENTO_MS);
    };

    void ciclo();
    return () => {
      activo = false;
      clearTimeout(temporizador);
    };
  }, [claveActivos]);

  const reintentar = () => {
    if (cliente) historial.reintentar();
    consultarLote(leerPedidosGuardados().filter((p) => !p.terminado))
      .then(() => setErrorGuardados(false))
      .catch(() => setErrorGuardados(true));
  };

  const filas = combinarFilas(historial.pedidos, guardados, !!cliente);
  // Error sin ningún estado que mostrar: la lista pide reintentar en lugar de tarjetas vacías
  const errorTotal = (historial.error || errorGuardados) && filas.every((f) => f.estado === undefined);
  const cargando = (historial.cargando && historial.pedidos.length === 0) || (!errorGuardados && guardados.some((p) => !p.terminado && p.estado === undefined));

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 80, backgroundColor: 'rgba(11, 44, 62, 0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: movil ? 0 : 16 }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Mis pedidos"
        style={{
          width: movil ? '100%' : 'min(720px, 100%)',
          height: movil ? '100%' : 'auto',
          maxHeight: movil ? '100%' : '90vh',
          backgroundColor: 'var(--cp-cream)',
          borderRadius: movil ? 0 : 24,
          boxShadow: movil ? 'none' : '0 20px 50px rgba(11, 44, 62, 0.35)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: movil ? '14px 16px' : '18px 20px', borderBottom: '1px solid var(--cp-line)', backgroundColor: 'var(--cp-white)' }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 20, color: 'var(--cp-navy)' }}>
            {detalle ? `Pedido #${detalle.codigo}` : 'Mis pedidos'}
          </h2>
          <button onClick={alCerrar} aria-label="Cerrar mis pedidos" style={{ width: 44, height: 44, borderRadius: 22, border: '1.5px solid var(--cp-navy)', backgroundColor: 'transparent', color: 'var(--cp-navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            <Icono nombre="cerrar" />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: movil ? 16 : 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {detalle ? (
            <DetallePedido fila={detalle} onVolver={() => setDetalle(null)} />
          ) : cargando ? (
            <div role="status" aria-label="Cargando tus pedidos" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ height: 96, borderRadius: 16, backgroundColor: 'var(--cp-line)', opacity: 0.55 }} />
              ))}
            </div>
          ) : errorTotal ? (
            <EstadoError titulo="No pudimos cargar tus pedidos" mensaje="Revisa tu conexión y vuelve a intentarlo." alReintentar={reintentar} />
          ) : filas.length === 0 ? (
            <EstadoVacio
              titulo="Aún no tienes pedidos"
              descripcion="Cuando hagas un pedido, aquí verás su estado en vivo."
              accion={
                <Boton onClick={alCerrar}>Ver la carta</Boton>
              }
            />
          ) : (
            <>
              {(historial.error || errorGuardados) && (
                <div role="alert" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-rust)' }}>
                  No pudimos actualizar tus pedidos. Reintentaremos en unos segundos.
                </div>
              )}
              {filas.map((f) => (
                <TarjetaPedido key={f.codigo} fila={f} onElegir={() => setDetalle(f)} />
              ))}
              {cliente && historial.hayMas && (
                <Boton variante="secundario" onClick={historial.verMas} deshabilitado={historial.cargando}>
                  {historial.cargando ? 'Cargando...' : 'Ver más'}
                </Boton>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TarjetaPedido({ fila, onElegir }: { fila: Fila; onElegir: () => void }) {
  const color = colorEstado(fila);
  const hechos = pasosHechos(fila);
  return (
    <button
      onClick={onElegir}
      style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8, padding: 14, borderRadius: 16, border: '1.5px solid var(--cp-line)', backgroundColor: 'var(--cp-white)', color: 'var(--cp-navy)', width: '100%' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 15 }}>#{fila.codigo}</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: '#FFFFFF', backgroundColor: color, borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap' }}>
          {fila.anulado ? 'Anulado' : fila.estadoEtiqueta ?? 'Consultando...'}
        </span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--cp-soft)' }}>
        {formatearFecha(fila.creadoEn)} · {fila.modalidad === 'DELIVERY' ? 'Delivery' : 'Recojo en local'}
        {fila.total !== undefined && ` · S/ ${Number(fila.total).toFixed(2)}`}
      </div>
      <div role="img" aria-label={fila.anulado ? 'Pedido anulado' : `${hechos} de 4 pasos`} style={{ display: 'flex', gap: 4 }}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i < hechos ? color : 'var(--cp-line)' }} />
        ))}
      </div>
      {fila.resumen && <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>{fila.resumen}</div>}
    </button>
  );
}

function DetallePedido({ fila, onVolver }: { fila: Fila; onVolver: () => void }) {
  const { estado, error } = useSeguimientoPedido(fila.codigo, fila.token);

  if (error === 'NO_ENCONTRADO') {
    return (
      <>
        <BotonVolver onVolver={onVolver} />
        <EstadoError titulo="Pedido no disponible" mensaje="No encontramos este pedido. Puede que ya no esté disponible." />
      </>
    );
  }

  return (
    <>
      <BotonVolver onVolver={onVolver} />
      <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>
        {formatearFecha(fila.creadoEn)} · {fila.modalidad === 'DELIVERY' ? 'Delivery' : 'Recojo en local'}
      </div>
      {estado?.anulado || fila.anulado ? (
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--cp-rust)' }}>Tu pedido fue anulado</p>
      ) : estado ? (
        <div style={{ backgroundColor: 'var(--cp-cream)', border: '1px solid var(--cp-line)', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {estado.pasos.map((p, idx) => (
            <PasoPedido key={p.clave} paso={p} numero={idx + 1} />
          ))}
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--cp-soft)' }}>
          {error === 'RED' ? 'No pudimos consultar el estado. Reintentaremos en unos segundos.' : 'Consultando el estado de tu pedido...'}
        </p>
      )}
      {estado && (
        <div style={{ backgroundColor: 'var(--cp-sand)', borderRadius: 14, padding: 14, display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--fuente-titulos)', fontWeight: 800, color: 'var(--cp-navy)' }}>
          <span>Total</span>
          <span style={{ color: 'var(--cp-rust)' }}>S/ {Number(estado.total).toFixed(2)}</span>
        </div>
      )}
    </>
  );
}

function BotonVolver({ onVolver }: { onVolver: () => void }) {
  return (
    <button onClick={onVolver} style={{ alignSelf: 'flex-start', minHeight: 44, padding: '0 14px', borderRadius: 12, border: '1.5px solid var(--cp-navy)', backgroundColor: 'transparent', color: 'var(--cp-navy)', fontWeight: 800, fontFamily: 'var(--fuente-titulos)' }}>
      ← Mis pedidos
    </button>
  );
}

// Historial de la cuenta: página 1 al abrir, «Ver más» de 10 en 10 y refresco de la primera página mientras haya activos
function useHistorialCuenta(activa: boolean) {
  const [pedidos, setPedidos] = useState<PedidoCuenta[]>([]);
  const [pagina, setPagina] = useState(0);
  const [hayMas, setHayMas] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(false);
  const hayActivos = pedidos.some((p) => !p.terminado);

  const cargarPagina = async (numero: number) => {
    setCargando(true);
    setError(false);
    try {
      const res = await api.get<RespuestaCuenta>(`/carta/cuenta/pedidos?pagina=${numero}`);
      setPedidos((prev) => [...prev, ...res.pedidos.filter((p) => !prev.some((q) => q.codigo === p.codigo))]);
      setPagina(res.pagina);
      setHayMas(res.hayMas);
    } catch {
      setError(true);
    } finally {
      setCargando(false);
    }
  };

  // Refresca la primera página sin perder lo cargado después: lo nuevo va arriba
  const refrescarPrimera = async () => {
    try {
      const res = await api.get<RespuestaCuenta>('/carta/cuenta/pedidos?pagina=1');
      const codigos = new Set(res.pedidos.map((p) => p.codigo));
      setPedidos((prev) => [...res.pedidos, ...prev.filter((p) => !codigos.has(p.codigo))]);
    } catch {
      // Se conserva lo que ya se ve; el siguiente ciclo lo vuelve a intentar
    }
  };

  useEffect(() => {
    if (activa && pagina === 0) void cargarPagina(1);
    // Solo al abrir con sesión; el resto del estado lo maneja cada acción
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activa]);

  useEffect(() => {
    if (!activa || !hayActivos) return;
    const id = setInterval(() => {
      if (document.visibilityState !== 'hidden') void refrescarPrimera();
    }, INTERVALO_SEGUIMIENTO_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activa, hayActivos]);

  return {
    pedidos,
    cargando,
    error,
    hayMas,
    verMas: () => void cargarPagina(pagina + 1),
    reintentar: () => void cargarPagina(pagina === 0 ? 1 : pagina + 1),
  };
}

// Los pedidos de la cuenta van primero; del navegador, solo los que no están en ella
function combinarFilas(cuenta: PedidoCuenta[], guardados: PedidoGuardado[], conSesion: boolean): Fila[] {
  const deCuenta: Fila[] = cuenta.map((p) => ({
    codigo: p.codigo,
    token: p.seguimientoToken,
    modalidad: p.modalidad,
    creadoEn: p.creadoEn,
    estado: p.estado,
    estadoEtiqueta: p.estadoEtiqueta,
    terminado: p.terminado,
    anulado: p.anulado,
    total: p.total,
    resumen: p.resumen,
  }));
  const codigos = new Set(cuenta.map((p) => p.codigo));
  const deNavegador: Fila[] = guardados
    .filter((p) => !(conSesion && codigos.has(p.codigo)))
    .map((p) => ({
      codigo: p.codigo,
      token: p.token,
      modalidad: p.modalidad,
      creadoEn: p.creadoEn,
      estado: p.estado,
      estadoEtiqueta: p.estadoEtiqueta,
      terminado: !!p.terminado,
      anulado: !!p.anulado,
      total: p.total,
    }));
  return [...deCuenta, ...deNavegador].sort((a, b) => {
    if (a.terminado !== b.terminado) return a.terminado ? 1 : -1;
    return Date.parse(b.creadoEn) - Date.parse(a.creadoEn);
  });
}

function colorEstado(fila: Fila): string {
  if (fila.anulado) return 'var(--cp-rust)';
  if (fila.estado === 'ENTREGADO') return 'var(--cp-green)';
  if (fila.estado === 'PREPARANDO') return 'var(--cp-orange)';
  if (fila.estado === 'LISTO' || fila.estado === 'EN_CAMINO') return 'var(--cp-navy)';
  return 'var(--cp-soft)';
}

// Cuántos de los 4 pasos están hechos, según el estado y la modalidad (igual que la API)
function pasosHechos(fila: Fila): number {
  if (fila.anulado) return 0;
  const rango = RANGO_ESTADO[fila.estado ?? ''] ?? 0;
  const tercero = fila.modalidad === 'DELIVERY' ? rango >= 3 : rango >= 2;
  return 1 + (rango >= 1 ? 1 : 0) + (tercero ? 1 : 0) + (rango >= 4 ? 1 : 0);
}

function formatearFecha(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '';
  return fecha.toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
