import { useEffect, useState } from 'react';
import { Confirmar } from '../../comun/Confirmar';
import { obtenerCuentaCredito, saldarConsumos, marcarPlanilla, marcarCobrado, type CuentaCredito } from './creditosApi';

const MEDIOS = ['EFECTIVO', 'YAPE', 'PLIN', 'TARJETA', 'TRANSFERENCIA'];

/** «Debe esta semana: S/ X · Este mes: S/ Y» del trabajador (solo lo pendiente). */
export function ResumenCuenta({ partyId, version }: { partyId: string; version: number }) {
  const [cuenta, setCuenta] = useState<CuentaCredito | null>(null);
  useEffect(() => {
    let vivo = true;
    obtenerCuentaCredito(partyId).then((c) => vivo && setCuenta(c)).catch(() => vivo && setCuenta(null));
    return () => { vivo = false; };
  }, [partyId, version]);
  if (!cuenta) return null;
  return (
    <div data-testid="cuenta-resumen" style={{ fontSize: 13, fontWeight: 800, color: 'var(--cp-navy)' }}>
      {cuenta.resumen}
    </div>
  );
}

/** Pagar ahora: el trabajador salda en Caja los consumos que marcó (un solo ingreso por el total). */
export function BotonPagarAhora({ consumoIds, total, alTerminar }: { consumoIds: string[]; total: number; alTerminar: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [medio, setMedio] = useState('EFECTIVO');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  if (consumoIds.length === 0) return null;
  const ejecutar = async () => {
    setCargando(true);
    setError('');
    try {
      await saldarConsumos(consumoIds, medio);
      setAbierto(false);
      alTerminar();
    } catch (e: any) {
      setError(e?.message || 'No se pudo registrar el pago');
      setAbierto(false);
    } finally {
      setCargando(false);
    }
  };
  return (
    <>
      <button type="button" className="btn" onClick={() => setAbierto(true)} style={{ minHeight: 44, fontWeight: 800 }}>
        Pagar ahora ({consumoIds.length}) · s/ {total.toFixed(2)}
      </button>
      {error && <div role="alert" style={{ color: 'var(--cp-rust)', fontSize: 12, fontWeight: 700 }}>{error}</div>}
      {abierto && (
        <Confirmar
          abierto
          titulo="¿El trabajador paga ahora?"
          mensaje={`Se registra el pago de s/ ${total.toFixed(2)} (${consumoIds.length} consumo${consumoIds.length === 1 ? '' : 's'}). Efectivo entra a la caja abierta.`}
          textoSi="Sí, registrar pago"
          textoNo="No, cancelar"
          cargando={cargando}
          alConfirmar={ejecutar}
          alCancelar={() => setAbierto(false)}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 700 }}>
            ¿Con qué paga?
            <select value={medio} onChange={(e) => setMedio(e.target.value)} style={{ minHeight: 44 }}>
              {MEDIOS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
        </Confirmar>
      )}
    </>
  );
}

/** Cierre opcional del periodo mostrado: descontado por planilla, sin mover caja. */
export function BotonPlanilla({ desde, hasta, etiqueta, alTerminar }: { desde: string; hasta: string; etiqueta: string; alTerminar: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const ejecutar = async () => {
    setCargando(true);
    try {
      const r = await marcarPlanilla(desde, hasta, motivo.trim());
      setMensaje(`Listo: ${r.cantidad} consumo(s) marcados como pagados por planilla (s/ ${r.total.toFixed(2)}).`);
      setAbierto(false);
      alTerminar();
    } catch (e: any) {
      setMensaje(e?.message || 'No se pudo marcar el periodo');
      setAbierto(false);
    } finally {
      setCargando(false);
    }
  };
  return (
    <>
      <button type="button" className="btn" onClick={() => { setMotivo(''); setAbierto(true); }} style={{ minHeight: 44, fontWeight: 700 }}>
        Marcar periodo como descontado por planilla
      </button>
      {mensaje && <div role="status" style={{ fontSize: 12, fontWeight: 700 }}>{mensaje}</div>}
      {abierto && (
        <Confirmar
          abierto
          titulo="¿Marcar el periodo como descontado por planilla?"
          mensaje={`Todos los consumos pendientes de ${etiqueta} pasan a «Pagado». No mueve la caja.`}
          textoSi="Sí, marcar como pagado"
          textoNo="No, cancelar"
          cargando={cargando}
          deshabilitarConfirmar={motivo.trim().length < 3}
          alConfirmar={ejecutar}
          alCancelar={() => setAbierto(false)}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 700 }}>
            Motivo (obligatorio)
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Descontado en la planilla de la semana" style={{ minHeight: 44 }} />
          </label>
        </Confirmar>
      )}
    </>
  );
}

/** Check visible de un consumo: «✓ Cobrado» (verde) o «Pendiente» (ámbar), con texto, no solo color. */
export function EstadoCobro({ item }: { item: { estadoPago?: 'PENDIENTE' | 'PAGADO'; pagadoEn?: string | null; pagoMedio?: string | null; cobradoPor?: string | null } }) {
  const cobrado = item.estadoPago === 'PAGADO';
  const cuando = item.pagadoEn
    ? new Date(item.pagadoEn).toLocaleString('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
    : '';
  return (
    <span data-testid="estado-cobro" data-estado-pago={item.estadoPago ?? 'PENDIENTE'} style={{ display: 'inline-flex', flexDirection: 'column', gap: 1 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 800,
          padding: '2px 8px',
          borderRadius: 9999,
          background: cobrado ? '#E3F2E7' : '#FFF1CC',
          color: cobrado ? '#2F7A45' : '#8A5A00',
          alignSelf: 'flex-start',
        }}
      >
        {cobrado ? '✓ Cobrado' : '⏳ Pendiente'}
      </span>
      {cobrado && (
        <span style={{ fontSize: 11, color: 'var(--cp-soft)' }}>
          {cuando}
          {item.cobradoPor ? ` · cobró ${item.cobradoPor}` : ''}
          {item.pagoMedio ? ` · ${item.pagoMedio === 'PLANILLA' ? 'por planilla' : item.pagoMedio.toLowerCase()}` : ''}
        </span>
      )}
    </span>
  );
}

/** ADMIN: «Ya se le descontó» (marcar) o desmarcar un consumo a mano, con confirmación Sí/No. */
export function BotonCobradoManual({ consumoId, cobrado, codigo, alTerminar }: { consumoId: string; cobrado: boolean; codigo: string; alTerminar: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const ejecutar = async () => {
    setCargando(true);
    try {
      await marcarCobrado(consumoId, !cobrado);
      setAbierto(false);
      alTerminar();
    } catch (e: any) {
      setError(e?.message || 'No se pudo cambiar el estado');
      setAbierto(false);
    } finally {
      setCargando(false);
    }
  };
  return (
    <>
      <button type="button" className="btn" onClick={() => setAbierto(true)} style={{ minHeight: 44, fontSize: 12, fontWeight: 700 }}>
        {cobrado ? `Desmarcar ${codigo}` : `Ya se le descontó ${codigo}`}
      </button>
      {error && <div role="alert" style={{ color: 'var(--cp-rust)', fontSize: 12, fontWeight: 700 }}>{error}</div>}
      {abierto && (
        <Confirmar
          abierto
          titulo={cobrado ? '¿Volver este consumo a Pendiente?' : '¿Ya se le descontó este consumo?'}
          mensaje={cobrado ? `${codigo} vuelve a «Pendiente». Queda registrado quién lo hizo.` : `${codigo} pasa a «Cobrado» (sin mover la caja). Queda registrado quién y cuándo.`}
          textoSi="Sí"
          textoNo="No"
          cargando={cargando}
          alConfirmar={ejecutar}
          alCancelar={() => setAbierto(false)}
        />
      )}
    </>
  );
}
