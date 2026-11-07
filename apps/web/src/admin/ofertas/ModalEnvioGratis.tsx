import { useEffect, useRef, useState } from 'react';
import { OfertaItem } from './ofertasApi';
import { CanalesEstado, ERROR_SIN_CANALES, SelectorCanales, SelectorVisibleCarta, canalesDesdeEstado, canalesPorDefecto, estadoDesdeCanales } from './canalesPromo';

const DIAS = [
  ['lun', 'Lun'],
  ['mar', 'Mar'],
  ['mie', 'Mié'],
  ['jue', 'Jue'],
  ['vie', 'Vie'],
  ['sab', 'Sáb'],
  ['dom', 'Dom'],
];

interface ModalEnvioGratisProps {
  abierto: boolean;
  ofertaAEditar?: OfertaItem | null;
  onCerrar: () => void;
  onGuardar: (datos: any) => Promise<void>;
}

/**
 * Promoción «Envío gratis»: el delivery no cobra envío en el horario, días, fechas y canal elegidos.
 * No lleva descuento ni productos. Con WhatsApp (bot) activo, el bot también cobra el delivery sin envío.
 */
export function ModalEnvioGratis({ abierto, ofertaAEditar, onCerrar, onGuardar }: ModalEnvioGratisProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [nombre, setNombre] = useState('');
  const [dias, setDias] = useState<string[]>([]);
  const [horaDesde, setHoraDesde] = useState('');
  const [horaHasta, setHoraHasta] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [canales, setCanales] = useState<CanalesEstado>(canalesPorDefecto('ENVIO_GRATIS'));
  const [compraMinima, setCompraMinima] = useState('');
  const [limiteUsos, setLimiteUsos] = useState('');
  const [orden, setOrden] = useState('0');
  const [visibleCarta, setVisibleCarta] = useState(true);
  const [mensajeError, setMensajeError] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setMensajeError('');
    if (ofertaAEditar) {
      setNombre(ofertaAEditar.nombre || '');
      setDias((ofertaAEditar.dias || []).map((d) => DIAS[(d - 1 + 7) % 7]?.[0] || 'lun'));
      setHoraDesde(ofertaAEditar.horaDesde || '');
      setHoraHasta(ofertaAEditar.horaHasta || '');
      setFechaDesde(ofertaAEditar.fechaDesde ? ofertaAEditar.fechaDesde.slice(0, 10) : '');
      setFechaHasta(ofertaAEditar.fechaHasta ? ofertaAEditar.fechaHasta.slice(0, 10) : '');
      setCanales(estadoDesdeCanales(ofertaAEditar.canales));
      setCompraMinima(ofertaAEditar.compraMinima ? String(ofertaAEditar.compraMinima) : '');
      setLimiteUsos(ofertaAEditar.limiteUsos ? String(ofertaAEditar.limiteUsos) : '');
      setOrden(String(ofertaAEditar.orden ?? 0));
      setVisibleCarta(ofertaAEditar.visibleCarta !== false);
    } else {
      setNombre('');
      setDias([]);
      setHoraDesde('');
      setHoraHasta('');
      setFechaDesde('');
      setFechaHasta('');
      setCanales(canalesPorDefecto('ENVIO_GRATIS'));
      setCompraMinima('');
      setLimiteUsos('');
      setOrden('0');
      setVisibleCarta(true);
    }
  }, [abierto, ofertaAEditar]);

  useEffect(() => {
    if (abierto) dialogRef.current?.focus();
  }, [abierto]);

  if (!abierto) return null;

  const alternarDia = (codigo: string) => {
    setDias((prev) => (prev.includes(codigo) ? prev.filter((d) => d !== codigo) : [...prev, codigo]));
  };

  const guardar = async () => {
    if (!nombre.trim()) {
      setMensajeError('Escribe el nombre de la promoción, por ejemplo «Delivery gratis de 2 a 6 pm».');
      return;
    }
    if (horaDesde && horaHasta && horaDesde >= horaHasta) {
      setMensajeError('La hora de fin debe ser después de la hora de inicio.');
      return;
    }
    if (fechaDesde && fechaHasta && fechaDesde > fechaHasta) {
      setMensajeError('La fecha de inicio no puede ser después de la final.');
      return;
    }
    const minima = parseFloat(compraMinima.replace(',', '.'));
    if (compraMinima.trim() && (isNaN(minima) || minima < 0)) {
      setMensajeError('La compra mínima debe ser un monto mayor o igual a 0, o déjala vacía.');
      return;
    }

    const diasNum = dias.map((code) => DIAS.findIndex((x) => x[0] === code) + 1);
    if (!canales.carta && !canales.local && !canales.bot) {
      setMensajeError(ERROR_SIN_CANALES);
      return;
    }

    setGuardando(true);
    setMensajeError('');
    try {
      await onGuardar({
        nombre: nombre.trim(),
        tipo: 'ENVIO_GRATIS',
        dias: diasNum,
        diasSemana: diasNum,
        horaDesde: horaDesde || null,
        horaInicio: horaDesde || null,
        horaHasta: horaHasta || null,
        horaFin: horaHasta || null,
        fechaDesde: fechaDesde || null,
        fechaInicio: fechaDesde || null,
        fechaHasta: fechaHasta || null,
        fechaFin: fechaHasta || null,
        canales: canalesDesdeEstado(canales),
        compraMinima: compraMinima.trim() ? minima : null,
        limiteUsos: limiteUsos.trim() ? parseInt(limiteUsos, 10) : null,
        orden: parseInt(orden, 10) || 0,
        // La visibilidad en la carta solo se cambia al editar (el alta la deja visible)
        ...(ofertaAEditar ? { visibleCarta } : {}),
      });
      onCerrar();
    } catch (err: any) {
      setMensajeError(err.response?.data?.mensaje || err.message || 'No se pudo guardar la promoción.');
    } finally {
      setGuardando(false);
    }
  };

  const titulo = ofertaAEditar ? 'Editar envío gratis' : 'Nuevo envío gratis';
  const campo = { display: 'flex', flexDirection: 'column' as const, gap: '4px', fontSize: '13px', fontWeight: 700 };
  const input = { minHeight: '44px', padding: '0 10px', borderRadius: '10px', border: '1.5px solid var(--cp-line)', fontSize: '14px' };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onCerrar} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(11, 44, 62, 0.55)' }} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        style={{
          position: 'relative',
          width: 'min(560px, calc(100% - 24px))',
          maxHeight: 'calc(100% - 24px)',
          overflowY: 'auto',
          backgroundColor: 'var(--cp-cream)',
          borderRadius: '20px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '22px', color: 'var(--cp-navy)' }}>{titulo}</div>
        <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
          El delivery no cobra envío dentro del horario, días y fechas que elijas. No descuenta productos.
        </div>

        <label style={campo}>
          Nombre de la promoción
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} style={input} maxLength={120} placeholder="Delivery gratis de 2 a 6 pm" />
        </label>

        <div style={campo}>
          Días (si no eliges ninguno, todos los días)
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {DIAS.map(([codigo, etiqueta]) => {
              const on = dias.includes(codigo);
              return (
                <button
                  key={codigo}
                  type="button"
                  aria-pressed={on}
                  onClick={() => alternarDia(codigo)}
                  style={{
                    minHeight: '44px',
                    minWidth: '52px',
                    borderRadius: '9999px',
                    border: '1.5px solid var(--cp-navy)',
                    backgroundColor: on ? 'var(--cp-navy)' : 'transparent',
                    color: on ? 'var(--cp-cream)' : 'var(--cp-navy)',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {etiqueta}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <label style={{ ...campo, flex: '1 1 160px' }}>
            Desde las (vacío = todo el día)
            <input type="time" value={horaDesde} onChange={(e) => setHoraDesde(e.target.value)} style={input} />
          </label>
          <label style={{ ...campo, flex: '1 1 160px' }}>
            Hasta las (no incluye esa hora)
            <input type="time" value={horaHasta} onChange={(e) => setHoraHasta(e.target.value)} style={input} />
          </label>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <label style={{ ...campo, flex: '1 1 160px' }}>
            Desde el día (vacío = sin fecha)
            <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} style={input} />
          </label>
          <label style={{ ...campo, flex: '1 1 160px' }}>
            Hasta el día (incluido)
            <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} style={input} />
          </label>
        </div>

        <SelectorCanales id="envio-canal" tipo="ENVIO_GRATIS" valor={canales} onChange={setCanales} />

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <label style={{ ...campo, flex: '1 1 140px' }}>
            Compra mínima S/ (opcional)
            <input inputMode="decimal" value={compraMinima} onChange={(e) => setCompraMinima(e.target.value)} style={input} placeholder="Sin mínimo" />
          </label>
          <label style={{ ...campo, flex: '1 1 140px' }}>
            Límite de pedidos (opcional)
            <input inputMode="numeric" value={limiteUsos} onChange={(e) => setLimiteUsos(e.target.value)} style={input} placeholder="Sin límite" />
          </label>
          <label style={{ ...campo, flex: '0 1 100px' }}>
            Orden
            <input inputMode="numeric" value={orden} onChange={(e) => setOrden(e.target.value)} style={input} />
          </label>
        </div>

        {ofertaAEditar && <SelectorVisibleCarta id="envio-visible-carta" visibleCarta={visibleCarta} onChange={setVisibleCarta} />}

        {mensajeError && (
          <div role="alert" style={{ fontSize: '13px', color: 'var(--cp-rust)' }}>
            {mensajeError}
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCerrar}
            style={{ minHeight: '44px', padding: '0 16px', borderRadius: '12px', border: '1.5px solid var(--cp-navy)', background: 'transparent', color: 'var(--cp-navy)', fontWeight: 700, cursor: 'pointer' }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={guardar}
            disabled={guardando}
            style={{ minHeight: '44px', padding: '0 18px', borderRadius: '12px', border: 0, backgroundColor: 'var(--cp-orange)', color: 'var(--cp-navy)', fontWeight: 800, cursor: guardando ? 'not-allowed' : 'pointer' }}
          >
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
