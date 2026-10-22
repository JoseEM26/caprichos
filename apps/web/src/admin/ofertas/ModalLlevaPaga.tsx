import { useState, useEffect } from 'react';
import { OfertaItem } from './ofertasApi';

const DIAS = [
  ['lun', 'Lunes', 'Lun'],
  ['mar', 'Martes', 'Mar'],
  ['mie', 'Miércoles', 'Mié'],
  ['jue', 'Jueves', 'Jue'],
  ['vie', 'Viernes', 'Vie'],
  ['sab', 'Sábado', 'Sáb'],
  ['dom', 'Domingo', 'Dom'],
];

const CANALES = [
  { clave: 'todos', nombre: 'Todos los canales' },
  { clave: 'carta', nombre: 'Solo carta web' },
  { clave: 'local', nombre: 'Solo en el local' },
  { clave: 'whatsapp', nombre: 'Solo WhatsApp' },
];

const CATEGORIAS_DEF = [
  'Frappes',
  'Iced',
  'Frozen',
  'Calientes',
  'Waffles',
  'Salados',
  'Croissants',
  'Postres',
];

interface ComponenteLlevaPaga {
  tipo: 'PRODUCTO' | 'CATEGORIA' | 'TIPO';
  nombre: string;
  cantidad: number;
}

interface ModalLlevaPagaProps {
  abierto: boolean;
  ofertaAEditar?: OfertaItem | null;
  onCerrar: () => void;
  onGuardar: (datos: any) => Promise<void>;
  productosDisponibles?: Array<{ id: string; nombre: string; categoria?: string; precio?: number }>;
  categoriasDisponibles?: string[];
}

export function ModalLlevaPaga({
  abierto,
  ofertaAEditar,
  onCerrar,
  onGuardar,
  productosDisponibles = [],
  categoriasDisponibles = CATEGORIAS_DEF,
}: ModalLlevaPagaProps) {
  const [nombre, setNombre] = useState('');
  const [qLleva, setQLleva] = useState(2);
  const [qPaga, setQPaga] = useState(1);
  const [precio, setPrecio] = useState('');
  const [componentes, setComponentes] = useState<ComponenteLlevaPaga[]>([]);
  const [modoComp, setModoComp] = useState<'PRODUCTO' | 'CATEGORIA'>('PRODUCTO');
  const [catSeleccionada, setCatSeleccionada] = useState('Frappes');
  const [prodSeleccionado, setProdSeleccionado] = useState('');
  const [dias, setDias] = useState<string[]>([]);
  const [horaDesde, setHoraDesde] = useState('');
  const [horaHasta, setHoraHasta] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [canal, setCanal] = useState('todos');
  const [mensajeError, setMensajeError] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (ofertaAEditar) {
      setNombre(ofertaAEditar.nombre || '');
      const mm = /^(\d+)x(\d+)$/.exec(ofertaAEditar.subtipo || '');
      setQLleva(mm ? Number(mm[1]) : 2);
      setQPaga(mm ? Number(mm[2]) : 1);
      setPrecio(ofertaAEditar.descuentoValor ? String(ofertaAEditar.descuentoValor) : '11.5');
      if (ofertaAEditar.llevaPaga && ofertaAEditar.llevaPaga.componentes) {
        setComponentes(
          ofertaAEditar.llevaPaga.componentes.map((c) => ({
            tipo: c.tipo,
            nombre: c.nombre,
            cantidad: c.cantidad,
          })),
        );
      } else if (ofertaAEditar.productoNombre) {
        setComponentes([
          {
            tipo: 'PRODUCTO',
            nombre: ofertaAEditar.productoNombre,
            cantidad: mm ? Number(mm[1]) : 2,
          },
        ]);
      }
      setDias((ofertaAEditar.diasSemana || []).map((d) => DIAS[d % 7]?.[0] || 'lun'));
      setHoraDesde(ofertaAEditar.horaInicio || '');
      setHoraHasta(ofertaAEditar.horaFin || '');
      setFechaDesde(ofertaAEditar.fechaInicio ? ofertaAEditar.fechaInicio.slice(0, 10) : '');
      setFechaHasta(ofertaAEditar.fechaFin ? ofertaAEditar.fechaFin.slice(0, 10) : '');
      setCanal(ofertaAEditar.canales && ofertaAEditar.canales[0] ? ofertaAEditar.canales[0].toLowerCase() : 'todos');
      setMensajeError('');
    } else {
      setNombre('');
      setQLleva(2);
      setQPaga(1);
      setPrecio('');
      setComponentes([]);
      setDias([]);
      setHoraDesde('');
      setHoraHasta('');
      setFechaDesde('');
      setFechaHasta('');
      setCanal('todos');
      setMensajeError('');
    }
  }, [ofertaAEditar, abierto]);

  if (!abierto) return null;

  const totalUnidades = componentes.reduce((acc, c) => acc + c.cantidad, 0);

  const toggleDia = (d: string) => {
    setDias((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  const agregarComponente = () => {
    if (modoComp === 'PRODUCTO' && !prodSeleccionado) {
      setMensajeError('Elige el producto para agregar.');
      return;
    }
    const nombreItem = modoComp === 'PRODUCTO' ? prodSeleccionado : catSeleccionada;
    setComponentes((prev) => {
      const idx = prev.findIndex((c) => c.nombre === nombreItem && c.tipo === modoComp);
      if (idx >= 0) {
        return prev.map((item, i) => (i === idx ? { ...item, cantidad: item.cantidad + 1 } : item));
      }
      return [...prev, { tipo: modoComp, nombre: nombreItem, cantidad: 1 }];
    });
    setMensajeError('');
  };

  const modificarCantidadComp = (idx: number, delta: number) => {
    setComponentes((prev) =>
      prev
        .map((c, i) => (i === idx ? { ...c, cantidad: Math.max(0, c.cantidad + delta) } : c))
        .filter((c) => c.cantidad > 0),
    );
  };

  const quitarComponente = (idx: number) => {
    setComponentes((prev) => prev.filter((_, i) => i !== idx));
  };

  const prodsCategoria = productosDisponibles.filter(
    (p) => !catSeleccionada || (p.categoria && p.categoria.toLowerCase() === catSeleccionada.toLowerCase()),
  );

  const validarYGuardar = async () => {
    if (!nombre.trim()) {
      setMensajeError('Escribe el nombre de la promoción.');
      return;
    }
    const pNum = parseFloat(precio.replace(',', '.'));
    if (isNaN(pNum) || !(pNum > 0)) {
      setMensajeError('Escribe el precio.');
      return;
    }
    if (qPaga >= qLleva) {
      setMensajeError('Debe pagar menos de lo que lleva (por ejemplo, lleva 2 y paga 1).');
      return;
    }
    if (totalUnidades !== qLleva) {
      setMensajeError(
        `Esta promoción lleva ${qLleva} unidades y el contenido suma ${totalUnidades}. Agrega o quita unidades para que coincida.`,
      );
      return;
    }

    setGuardando(true);
    setMensajeError('');
    try {
      const diasNum = dias.map((code) => {
        const idx = DIAS.findIndex((x) => x[0] === code);
        return idx + 1;
      });

      const payload = {
        nombre: nombre.trim(),
        tipo: 'LLEVA_PAGA',
        subtipo: `${qLleva}x${qPaga}`,
        aplicaA: 'TODA_LA_CARTA',
        descuentoTipo: 'MONTO_FIJO',
        descuentoValor: pNum,
        diasSemana: diasNum,
        horaInicio: horaDesde || undefined,
        horaFin: horaHasta || undefined,
        fechaInicio: fechaDesde || undefined,
        fechaFin: fechaHasta || undefined,
        canales: canal === 'todos' ? ['TODOS'] : [canal.toUpperCase()],
        llevaPaga: {
          lleva: qLleva,
          paga: qPaga,
          precio: pNum,
          componentes: componentes.map((c) => ({
            tipo: c.tipo,
            nombre: c.nombre,
            cantidad: c.cantidad,
          })),
        },
      };

      await onGuardar(payload);
      onCerrar();
    } catch (err: any) {
      setMensajeError(err.response?.data?.mensaje || err.message || 'Error al guardar la oferta.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
      {/* Fondo clickeable */}
      <div
        onClick={onCerrar}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(11, 44, 62, 0.55)',
          zIndex: 60,
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Llevas más, pagas menos"
        style={{
          position: 'absolute',
          zIndex: 65,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(840px, calc(100% - 24px))',
          maxHeight: 'calc(100% - 24px)',
          overflowY: 'auto',
          backgroundColor: 'var(--cp-cream)',
          borderRadius: '20px',
          boxShadow: '0 20px 50px rgba(11, 44, 62, 0.4)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '20px',
              color: 'var(--cp-navy)',
            }}
          >
            {ofertaAEditar ? 'Editar oferta' : 'Llevas más, pagas menos'}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '22px',
              border: '1.5px solid var(--cp-navy)',
              backgroundColor: 'transparent',
              color: 'var(--cp-navy)',
              fontSize: '20px',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>

        {/* Nombre */}
        <div>
          <label htmlFor="pb-n" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
            Nombre de la promoción
          </label>
          <input
            id="pb-n"
            type="text"
            value={nombre}
            onChange={(e) => {
              setNombre(e.target.value);
              setMensajeError('');
            }}
            placeholder="Ejemplo: 2x1 LATTE COFFE"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              minHeight: '48px',
              borderRadius: '12px',
              border: '1.5px solid var(--cp-line)',
              backgroundColor: 'var(--cp-white)',
              padding: '0 12px',
              fontSize: '14px',
            }}
          />
        </div>

        {/* Cantidad: lleva y paga */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 100%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ fontWeight: 700 }}>Cantidad: lleva y paga</div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 700, fontSize: '13px' }}>Lleva</span>
                <button
                  type="button"
                  onClick={() => {
                    const nextL = Math.max(2, qLleva - 1);
                    setQLleva(nextL);
                    setQPaga((p) => Math.min(p, nextL - 1));
                  }}
                  aria-label="Llevar menos"
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '22px',
                    border: '1.5px solid var(--cp-navy)',
                    backgroundColor: 'transparent',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  −
                </button>
                <b style={{ minWidth: '24px', textAlign: 'center', fontSize: '18px' }}>{qLleva}</b>
                <button
                  type="button"
                  onClick={() => setQLleva(Math.min(12, qLleva + 1))}
                  aria-label="Llevar más"
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '22px',
                    border: '1.5px solid var(--cp-navy)',
                    backgroundColor: 'transparent',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  +
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 700, fontSize: '13px' }}>Paga</span>
                <button
                  type="button"
                  onClick={() => setQPaga(Math.max(1, qPaga - 1))}
                  aria-label="Pagar menos"
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '22px',
                    border: '1.5px solid var(--cp-navy)',
                    backgroundColor: 'transparent',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  −
                </button>
                <b style={{ minWidth: '24px', textAlign: 'center', fontSize: '18px' }}>{qPaga}</b>
                <button
                  type="button"
                  onClick={() => setQPaga(Math.min(qLleva - 1, qPaga + 1))}
                  aria-label="Pagar más"
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '22px',
                    border: '1.5px solid var(--cp-navy)',
                    backgroundColor: 'transparent',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  +
                </button>
              </div>

              <span style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '18px' }}>
                = {qLleva}x{qPaga}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>Atajos:</span>
              {[
                [2, 1],
                [3, 2],
              ].map(([l, p]) => (
                <button
                  key={`${l}x${p}`}
                  type="button"
                  onClick={() => {
                    setQLleva(l);
                    setQPaga(p);
                  }}
                  style={{
                    minHeight: '44px',
                    padding: '0 12px',
                    borderRadius: '9999px',
                    border: '1.5px solid var(--cp-navy)',
                    backgroundColor: qLleva === l && qPaga === p ? 'var(--cp-navy)' : 'transparent',
                    color: qLleva === l && qPaga === p ? 'var(--cp-cream)' : 'var(--cp-navy)',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  {l}x{p}
                </button>
              ))}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
              Puedes crear cualquier combinación (5x4, 4x3…). Las que guardes quedan como atajo y como tipo en Ofertas.
            </div>
          </div>

          <div style={{ flex: '1 1 120px' }}>
            <label htmlFor="pb-p" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
              Precio (s/)
            </label>
            <input
              id="pb-p"
              type="text"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                minHeight: '44px',
                borderRadius: '12px',
                border: '1.5px solid var(--cp-line)',
                backgroundColor: 'var(--cp-white)',
                padding: '0 12px',
              }}
            />
          </div>
        </div>

        {/* Qué contiene */}
        <div style={{ borderTop: '1px solid var(--cp-line)', paddingTop: '10px' }}>
          <div style={{ fontWeight: 800, marginBottom: '2px' }}>Qué contiene (se descuenta cada uno por separado)</div>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: totalUnidades === qLleva ? 'var(--cp-ok)' : 'var(--cp-rust)',
              marginBottom: '6px',
            }}
          >
            Llevas {totalUnidades} de {qLleva} unidades {totalUnidades === qLleva ? '✓' : `(faltan ${qLleva - totalUnidades})`}.
            El contenido es el límite: solo se puede llevar lo que agregues aquí.
          </div>

          {componentes.map((c, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0' }}>
              <span style={{ flex: 1, fontSize: '14px' }}>
                {c.cantidad} × {c.nombre}
              </span>
              <button
                type="button"
                onClick={() => modificarCantidadComp(idx, -1)}
                aria-label="Menos"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '18px',
                  border: '1.5px solid var(--cp-navy)',
                  backgroundColor: 'transparent',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                −
              </button>
              <button
                type="button"
                onClick={() => modificarCantidadComp(idx, 1)}
                aria-label="Más"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '18px',
                  border: '1.5px solid var(--cp-navy)',
                  backgroundColor: 'transparent',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                +
              </button>
              <button
                type="button"
                onClick={() => quitarComponente(idx)}
                style={{
                  minHeight: '44px',
                  padding: '0 8px',
                  border: 0,
                  backgroundColor: 'transparent',
                  color: 'var(--cp-rust)',
                  fontWeight: 700,
                  textDecoration: 'underline',
                  cursor: 'pointer',
                }}
              >
                Quitar
              </button>
            </div>
          ))}
        </div>

        {/* Agregar un componente */}
        <div
          style={{
            border: '1.5px dashed var(--cp-soft)',
            borderRadius: '12px',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ fontWeight: 700 }}>Agregar un componente</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setModoComp('PRODUCTO')}
              style={{
                minHeight: '44px',
                padding: '0 12px',
                borderRadius: '9999px',
                border: '1.5px solid var(--cp-navy)',
                backgroundColor: modoComp === 'PRODUCTO' ? 'var(--cp-navy)' : 'transparent',
                color: modoComp === 'PRODUCTO' ? 'var(--cp-cream)' : 'var(--cp-navy)',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Un producto
            </button>
            <button
              type="button"
              onClick={() => setModoComp('CATEGORIA')}
              style={{
                minHeight: '44px',
                padding: '0 12px',
                borderRadius: '9999px',
                border: '1.5px solid var(--cp-navy)',
                backgroundColor: modoComp === 'CATEGORIA' ? 'var(--cp-navy)' : 'transparent',
                color: modoComp === 'CATEGORIA' ? 'var(--cp-cream)' : 'var(--cp-navy)',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Cualquiera de una categoría
            </button>
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {categoriasDisponibles.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCatSeleccionada(cat)}
                style={{
                  minHeight: '44px',
                  padding: '0 12px',
                  borderRadius: '9999px',
                  border: '1.5px solid var(--cp-navy)',
                  backgroundColor: catSeleccionada === cat ? 'var(--cp-navy)' : 'transparent',
                  color: catSeleccionada === cat ? 'var(--cp-cream)' : 'var(--cp-navy)',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {modoComp === 'PRODUCTO' && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', maxHeight: '130px', overflowY: 'auto' }}>
              {prodsCategoria.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProdSeleccionado(p.nombre)}
                  style={{
                    minHeight: '38px',
                    padding: '0 10px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--cp-navy)',
                    backgroundColor: prodSeleccionado === p.nombre ? 'var(--cp-navy)' : 'transparent',
                    color: prodSeleccionado === p.nombre ? 'var(--cp-cream)' : 'var(--cp-navy)',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  {p.nombre}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={agregarComponente}
            style={{
              minHeight: '44px',
              border: '1.5px solid var(--cp-navy)',
              borderRadius: '12px',
              backgroundColor: 'transparent',
              color: 'var(--cp-navy)',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Agregar al contenido
          </button>
        </div>

        {/* ¿Cuándo vale? */}
        <div
          style={{
            border: '1.5px dashed var(--cp-soft)',
            borderRadius: '12px',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ fontWeight: 800 }}>¿Cuándo vale?</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>
              Días{' '}
              <span style={{ fontWeight: 600, color: 'var(--cp-soft)' }}>
                · {dias.length && dias.length < 7 ? 'solo los marcados' : 'todos los días (sin marcar)'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {DIAS.map(([code, , abrev]) => {
                const activo = dias.includes(code);
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => toggleDia(code)}
                    aria-pressed={activo}
                    style={{
                      minWidth: '48px',
                      minHeight: '44px',
                      padding: '0 8px',
                      borderRadius: '10px',
                      border: '1.5px solid var(--cp-navy)',
                      backgroundColor: activo ? 'var(--cp-navy)' : 'transparent',
                      color: activo ? 'var(--cp-cream)' : 'var(--cp-navy)',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    {abrev}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 110px' }}>
              <label htmlFor="pb-hd" style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                Desde la hora
              </label>
              <input
                id="pb-hd"
                type="time"
                value={horaDesde}
                onChange={(e) => setHoraDesde(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: '44px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--cp-line)',
                  backgroundColor: 'var(--cp-white)',
                  color: 'var(--cp-navy)',
                  padding: '0 10px',
                  fontSize: '14px',
                }}
              />
            </div>
            <div style={{ flex: '1 1 110px' }}>
              <label htmlFor="pb-hh" style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                Hasta la hora
              </label>
              <input
                id="pb-hh"
                type="time"
                value={horaHasta}
                onChange={(e) => setHoraHasta(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: '44px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--cp-line)',
                  backgroundColor: 'var(--cp-white)',
                  color: 'var(--cp-navy)',
                  padding: '0 10px',
                  fontSize: '14px',
                }}
              />
            </div>
            <div style={{ flex: '1 1 130px' }}>
              <label htmlFor="pb-vd" style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                Vigente desde
              </label>
              <input
                id="pb-vd"
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: '44px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--cp-line)',
                  backgroundColor: 'var(--cp-white)',
                  color: 'var(--cp-navy)',
                  padding: '0 10px',
                  fontSize: '14px',
                }}
              />
            </div>
            <div style={{ flex: '1 1 130px' }}>
              <label htmlFor="pb-vh" style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                Hasta
              </label>
              <input
                id="pb-vh"
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: '44px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--cp-line)',
                  backgroundColor: 'var(--cp-white)',
                  color: 'var(--cp-navy)',
                  padding: '0 10px',
                  fontSize: '14px',
                }}
              />
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>Dónde vale</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {CANALES.map((c) => (
                <button
                  key={c.clave}
                  type="button"
                  onClick={() => setCanal(c.clave)}
                  style={{
                    minHeight: '44px',
                    padding: '0 12px',
                    borderRadius: '9999px',
                    border: '1.5px solid var(--cp-navy)',
                    backgroundColor: canal === c.clave ? 'var(--cp-navy)' : 'transparent',
                    color: canal === c.clave ? 'var(--cp-cream)' : 'var(--cp-navy)',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  {c.nombre}
                </button>
              ))}
            </div>
          </div>
        </div>

        {mensajeError && (
          <div role="alert" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cp-rust)' }}>
            {mensajeError}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={validarYGuardar}
            disabled={guardando}
            style={{
              flex: 1,
              minHeight: '52px',
              border: 0,
              borderRadius: '12px',
              backgroundColor: 'var(--cp-orange)',
              color: 'var(--cp-navy)',
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '15px',
              cursor: guardando ? 'not-allowed' : 'pointer',
            }}
          >
            {guardando ? 'Guardando...' : 'Guardar oferta'}
          </button>
          <button
            type="button"
            onClick={onCerrar}
            style={{
              flex: 1,
              minHeight: '52px',
              border: '1.5px solid var(--cp-navy)',
              borderRadius: '12px',
              backgroundColor: 'transparent',
              color: 'var(--cp-navy)',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
