import { useState, useEffect, useMemo, useRef } from 'react';
import { OfertaItem, ofertasApi } from './ofertasApi';
import { ModalConfirmacion } from './ModalConfirmacion';
import { PrevisualizacionCarta } from './PrevisualizacionCarta';

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
  'Combos',
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
  tipo: 'PRODUCTO' | 'CATEGORIA';
  nombre: string;
  cantidad: number;
}

interface ModalLlevaPagaProps {
  abierto: boolean;
  ofertaAEditar?: OfertaItem | null;
  onCerrar: () => void;
  onGuardar: (datos: any) => Promise<void>;
  productosDisponibles?: Array<{ id: string; nombre: string; categoriaId?: string; categoria?: string; precio?: number; noSumaBeneficios?: boolean }>;
  categoriasDisponibles?: string[];
  categorias?: Array<{ id: string; nombre: string; productos?: any[] }>;
}

export function ModalLlevaPaga({
  abierto,
  ofertaAEditar,
  onCerrar,
  onGuardar,
  productosDisponibles = [],
  categoriasDisponibles = CATEGORIAS_DEF,
  categorias = [],
}: ModalLlevaPagaProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Paso del asistente (1 a 4)
  const [paso, setPaso] = useState<1 | 2 | 3 | 4>(1);

  // Paso 1: Nombre, foto y a qué aplica
  const [nombre, setNombre] = useState('');
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [fotoArchivoId, setFotoArchivoId] = useState<string | null>(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [confirmarQuitarFoto, setConfirmarQuitarFoto] = useState(false);
  const [componentes, setComponentes] = useState<ComponenteLlevaPaga[]>([]);
  const [modoComp, setModoComp] = useState<'PRODUCTO' | 'CATEGORIA'>('PRODUCTO');
  const [catSeleccionada, setCatSeleccionada] = useState('Frappes');
  const [prodSeleccionado, setProdSeleccionado] = useState('');

  // Paso 2: Condiciones
  const [dias, setDias] = useState<string[]>([]);
  const [horaDesde, setHoraDesde] = useState('');
  const [horaHasta, setHoraHasta] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [canal, setCanal] = useState('todos');

  // Paso 3: Beneficio
  const [qLleva, setQLleva] = useState(2);
  const [qPaga, setQPaga] = useState(1);
  const [precio, setPrecio] = useState('');

  // Control
  const [mensajeError, setMensajeError] = useState('');
  const [confirmarGuardar, setConfirmarGuardar] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const listaCategoriasNombres = useMemo(() => {
    if (categorias && categorias.length > 0) {
      return categorias.map((c) => c.nombre);
    }
    return categoriasDisponibles;
  }, [categorias, categoriasDisponibles]);

  useEffect(() => {
    if (!abierto) return;

    if (ofertaAEditar) {
      setNombre(ofertaAEditar.nombre || '');
      setFotoUrl(ofertaAEditar.imagenUrl || null);
      setFotoArchivoId(ofertaAEditar.imagenArchivoId || null);
      const mm = /^(\d+)x(\d+)$/.exec(ofertaAEditar.subtipo || '');
      setQLleva(mm ? Number(mm[1]) : 2);
      setQPaga(mm ? Number(mm[2]) : 1);
      setPrecio(ofertaAEditar.descuentoValor ? String(ofertaAEditar.descuentoValor) : '11.5');
      if (ofertaAEditar.llevaPaga && ofertaAEditar.llevaPaga.componentes) {
        setComponentes(
          ofertaAEditar.llevaPaga.componentes.map((c) => ({
            tipo: c.tipo === 'CATEGORIA' ? 'CATEGORIA' : 'PRODUCTO',
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
      } else {
        setComponentes([]);
      }
      setDias((ofertaAEditar.diasSemana || ofertaAEditar.dias || []).map((d) => DIAS[d % 7]?.[0] || 'lun'));
      setHoraDesde(ofertaAEditar.horaInicio || ofertaAEditar.horaDesde || '');
      setHoraHasta(ofertaAEditar.horaFin || ofertaAEditar.horaHasta || '');
      setFechaDesde(ofertaAEditar.fechaInicio ? ofertaAEditar.fechaInicio.slice(0, 10) : ofertaAEditar.fechaDesde ? ofertaAEditar.fechaDesde.slice(0, 10) : '');
      setFechaHasta(ofertaAEditar.fechaFin ? ofertaAEditar.fechaFin.slice(0, 10) : ofertaAEditar.fechaHasta ? ofertaAEditar.fechaHasta.slice(0, 10) : '');
      setCanal(ofertaAEditar.canales && ofertaAEditar.canales[0] ? ofertaAEditar.canales[0].toLowerCase() : 'todos');
      setPaso(1);
      setMensajeError('');
    } else {
      setNombre('');
      setFotoUrl(null);
      setFotoArchivoId(null);
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
      setPaso(1);
      setMensajeError('');
    }
  }, [ofertaAEditar, abierto]);

  // Accesibilidad: auto-focus y Escape
  useEffect(() => {
    if (!abierto) return;

    const timer = setTimeout(() => {
      dialogRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmarQuitarFoto) {
          setConfirmarQuitarFoto(false);
          return;
        }
        if (confirmarGuardar) {
          setConfirmarGuardar(false);
          return;
        }
        onCerrar();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [abierto, confirmarQuitarFoto, confirmarGuardar, onCerrar]);

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

  const manejarSubidaFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubiendoFoto(true);
    try {
      const res = await ofertasApi.subirFoto(file);
      setFotoUrl(res.url);
      setFotoArchivoId(res.id);
    } catch (err: any) {
      setMensajeError(err?.message || 'Error al subir la imagen');
    } finally {
      setSubiendoFoto(false);
    }
  };

  const confirmarQuitar = () => {
    setFotoUrl(null);
    setFotoArchivoId(null);
    setConfirmarQuitarFoto(false);
  };

  // CÁLCULO DEL EJEMPLO DIDÁCTICO CON PRODUCTOS REALES
  const ejemploCalculado = useMemo(() => {
    // Buscar un producto representativo del catálogo aplicable
    let productoEjemplo = productosDisponibles.find((p) => {
      return componentes.some((c) => {
        if (c.tipo === 'PRODUCTO') return c.nombre.toLowerCase() === p.nombre.toLowerCase();
        if (c.tipo === 'CATEGORIA') return p.categoria && c.nombre.toLowerCase() === p.categoria.toLowerCase();
        return false;
      });
    });

    if (!productoEjemplo && productosDisponibles.length > 0) {
      productoEjemplo = productosDisponibles[0];
    }

    const nombreProd = productoEjemplo?.nombre || 'Iced Coffee';
    const precioUnit = productoEjemplo?.precio || 9;

    const pNum = parseFloat(precio.replace(',', '.')) || (precioUnit * qPaga);
    const totalNormal = precioUnit * qLleva;
    const totalPaga = pNum;
    const totalAhorro = Math.max(0, totalNormal - totalPaga);
    const pctAhorro = totalNormal > 0 ? Math.round((totalAhorro / totalNormal) * 100) : 0;

    return {
      nombreProducto: nombreProd,
      precioUnitario: precioUnit,
      totalNormal,
      totalPaga,
      totalAhorro,
      pctAhorro,
      texto: `Si el cliente pide ${qLleva} ${nombreProd} de S/ ${precioUnit.toFixed(2)}: paga S/ ${totalPaga.toFixed(2)}, ahorra S/ ${totalAhorro.toFixed(2)}${pctAhorro > 0 ? ` (${pctAhorro} %)` : ''}.`,
    };
  }, [componentes, productosDisponibles, precio, qLleva, qPaga]);

  // Validación por paso
  const validarPasoActual = (pasoAValidar: number): boolean => {
    setMensajeError('');
    if (pasoAValidar === 1) {
      if (!nombre.trim()) {
        setMensajeError('Escribe el nombre de la promoción.');
        return false;
      }
      if (componentes.length === 0) {
        setMensajeError('Agrega al menos un producto o categoría a la promoción.');
        return false;
      }
      return true;
    }

    if (pasoAValidar === 2) {
      if ((horaDesde && !horaHasta) || (!horaDesde && horaHasta)) {
        setMensajeError('Escribe las dos horas (desde y hasta) o déjalas vacías.');
        return false;
      }
      if (horaDesde && horaHasta && horaDesde >= horaHasta) {
        setMensajeError('La hora de inicio debe ser antes de la hora final.');
        return false;
      }
      if (fechaDesde && fechaHasta && fechaDesde > fechaHasta) {
        setMensajeError('La fecha de inicio no puede ser después de la final.');
        return false;
      }
      return true;
    }

    if (pasoAValidar === 3) {
      const pNum = parseFloat(precio.replace(',', '.'));
      if (isNaN(pNum) || !(pNum > 0)) {
        setMensajeError('Escribe el precio de la promoción.');
        return false;
      }
      if (qPaga >= qLleva) {
        setMensajeError('Debe pagar menos de lo que lleva (por ejemplo, lleva 2 y paga 1).');
        return false;
      }
      if (totalUnidades !== qLleva) {
        setMensajeError(
          `Esta promoción lleva ${qLleva} unidades y el contenido suma ${totalUnidades}. Agrega o quita unidades para que coincida.`,
        );
        return false;
      }
      return true;
    }

    return true;
  };

  const irSiguientePaso = () => {
    if (validarPasoActual(paso)) {
      if (paso < 4) {
        setPaso((prev) => (prev + 1) as any);
      }
    }
  };

  const irPasoAnterior = () => {
    setMensajeError('');
    if (paso > 1) {
      setPaso((prev) => (prev - 1) as any);
    }
  };

  const ejecutarGuardar = async () => {
    setConfirmarGuardar(false);
    setGuardando(true);
    setMensajeError('');
    try {
      const diasNum = dias.map((code) => {
        const idx = DIAS.findIndex((x) => x[0] === code);
        return idx + 1;
      });
      const pNum = parseFloat(precio.replace(',', '.'));

      const payload = {
        nombre: nombre.trim(),
        tipo: 'LLEVA_PAGA',
        subtipo: `${qLleva}x${qPaga}`,
        aplicaA: 'TODA_LA_CARTA',
        descuentoTipo: 'MONTO_FIJO',
        descuentoValor: pNum,
        diasSemana: diasNum,
        dias: diasNum,
        horaInicio: horaDesde || undefined,
        horaDesde: horaDesde || undefined,
        horaFin: horaHasta || undefined,
        horaHasta: horaHasta || undefined,
        fechaInicio: fechaDesde || undefined,
        fechaDesde: fechaDesde || undefined,
        fechaFin: fechaHasta || undefined,
        fechaHasta: fechaHasta || undefined,
        canales: canal === 'todos' ? ['TODOS'] : [canal.toUpperCase()],
        imagenArchivoId: fotoArchivoId,
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

  const letraInicial = (nombre.trim()[0] || 'P').toUpperCase();

  const ofertaEnVivo: Partial<OfertaItem> = {
    id: ofertaAEditar?.id || 'nuevo-lleva-paga',
    nombre: nombre || 'Promoción 2x1',
    tipo: 'LLEVA_PAGA',
    subtipo: `${qLleva}x${qPaga}`,
    descuentoValor: parseFloat(precio.replace(',', '.')) || 0,
    imagenUrl: fotoUrl,
    imagenArchivoId: fotoArchivoId,
    dias: dias.map((code) => DIAS.findIndex((x) => x[0] === code) + 1),
    horaDesde: horaDesde || null,
    horaHasta: horaHasta || null,
    fechaDesde: fechaDesde || null,
    fechaHasta: fechaHasta || null,
    canales: canal === 'todos' ? ['TODOS'] : [canal.toUpperCase()],
    activo: true,
  };

  if (!abierto) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={onCerrar}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(11, 44, 62, 0.55)',
          zIndex: 60,
        }}
        aria-hidden="true"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ofertaAEditar ? 'Editar promoción 2x1' : 'Nueva promoción 2x1'}
        tabIndex={-1}
        style={{
          position: 'relative',
          zIndex: 65,
          width: 'min(920px, calc(100% - 24px))',
          maxHeight: 'min(860px, calc(100% - 24px))',
          backgroundColor: 'var(--cp-cream)',
          borderRadius: '20px',
          boxShadow: '0 20px 50px rgba(11, 44, 62, 0.4)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          boxSizing: 'border-box',
          overflowY: 'auto',
        }}
      >
        {/* Cabecera */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1.5px solid var(--cp-line)', paddingBottom: '12px' }}>
          <div>
            <div
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: '22px',
                color: 'var(--cp-navy)',
              }}
            >
              {ofertaAEditar ? 'Editar promoción 2x1' : 'Nueva promoción 2x1 (lleva X paga Y)'}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
              Asistente por pasos para configurar promociones por volumen
            </div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar modal"
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
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>

        {/* Indicador de progreso por pasos */}
        <nav
          aria-label="Progreso del asistente"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'var(--cp-white)',
            borderRadius: '14px',
            padding: '10px 14px',
            border: '1px solid var(--cp-line)',
            flexWrap: 'wrap',
          }}
        >
          {[
            { num: 1, titulo: '1. Nombre y a qué aplica' },
            { num: 2, titulo: '2. Condiciones' },
            { num: 3, titulo: '3. Beneficio' },
            { num: 4, titulo: '4. Vista previa y ejemplo' },
          ].map((st) => {
            const esActivo = paso === st.num;
            const esCompletado = paso > st.num;
            return (
              <button
                key={st.num}
                type="button"
                onClick={() => {
                  if (st.num < paso || validarPasoActual(paso)) {
                    setPaso(st.num as any);
                  }
                }}
                aria-current={esActivo ? 'step' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'transparent',
                  border: 0,
                  padding: '6px 10px',
                  borderRadius: '8px',
                  backgroundColor: esActivo ? 'var(--cp-sand)' : 'transparent',
                  color: esActivo ? 'var(--cp-navy)' : esCompletado ? '#2E7D32' : 'var(--cp-soft)',
                  fontWeight: esActivo ? 800 : 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '12px',
                    backgroundColor: esActivo ? 'var(--cp-navy)' : esCompletado ? '#2E7D32' : 'var(--cp-line)',
                    color: esActivo || esCompletado ? '#fff' : 'var(--cp-navy)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 800,
                  }}
                >
                  {esCompletado ? '✓' : st.num}
                </span>
                <span>{st.titulo}</span>
              </button>
            );
          })}
        </nav>

        {/* Error de validación */}
        {mensajeError && (
          <div
            role="alert"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--cp-rust) 15%, var(--cp-cream))',
              border: '1.5px solid var(--cp-rust)',
              borderRadius: '12px',
              padding: '10px 14px',
              color: 'var(--cp-rust)',
              fontWeight: 700,
              fontSize: '13px',
            }}
          >
            {mensajeError}
          </div>
        )}

        {/* ============================================================== */}
        {/* PASO 1: NOMBRE Y A QUÉ APLICA                                 */}
        {/* ============================================================== */}
        {paso === 1 && (
          <div
            data-testid="paso-1-lleva-paga"
            style={{
              backgroundColor: 'var(--cp-white)',
              border: '1px solid var(--cp-line)',
              borderRadius: '14px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--cp-navy)' }}>
              Paso 1 de 4: Nombre y a qué aplica
            </div>

            <div>
              <label htmlFor="lp-nombre" style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                Nombre de la promoción *
              </label>
              <input
                id="lp-nombre"
                type="text"
                value={nombre}
                onChange={(e) => {
                  setNombre(e.target.value);
                  setMensajeError('');
                }}
                placeholder="Ej.: 2x1 en Frappes, Lleva 3 Paga 2 en Postres"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: '44px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--cp-line)',
                  padding: '0 12px',
                  fontSize: '14px',
                }}
              />
            </div>

            {/* Foto opcional */}
            <div>
              <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>Foto de la promoción (opcional)</div>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                {fotoUrl ? (
                  <div style={{ width: '80px', height: '80px', borderRadius: '10px', overflow: 'hidden' }}>
                    <img src={fotoUrl} alt="Vista previa" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ) : (
                  <div
                    style={{
                      width: '80px',
                      height: '80px',
                      borderRadius: '10px',
                      backgroundColor: 'var(--cp-gold)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '28px',
                      color: 'var(--cp-navy)',
                    }}
                  >
                    {letraInicial}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      minHeight: '36px',
                      padding: '0 12px',
                      borderRadius: '8px',
                      border: '1.5px solid var(--cp-navy)',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    {subiendoFoto ? 'Subiendo...' : fotoUrl ? 'Cambiar foto' : 'Subir foto'}
                    <input type="file" accept="image/*" onChange={manejarSubidaFoto} style={{ display: 'none' }} />
                  </label>
                  {fotoUrl && (
                    <button
                      type="button"
                      onClick={() => setConfirmarQuitarFoto(true)}
                      style={{ border: 0, background: 'transparent', color: 'var(--cp-rust)', fontSize: '11px', fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}
                    >
                      Quitar foto
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* A qué aplica: Selector de productos / categorías */}
            <div style={{ borderTop: '1px solid var(--cp-line)', paddingTop: '12px' }}>
              <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '8px' }}>
                ¿Qué productos o categorías entran en la promoción?
              </div>
              <div style={{ fontSize: '12px', color: 'var(--cp-soft)', marginBottom: '8px' }}>Los productos con descuento no suman puntos ni se pagan con puntos mientras la promoción esté activa</div>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <button
                  type="button"
                  onClick={() => setModoComp('PRODUCTO')}
                  style={{
                    minHeight: '36px',
                    padding: '0 14px',
                    borderRadius: '8px',
                    border: '1.5px solid var(--cp-navy)',
                    backgroundColor: modoComp === 'PRODUCTO' ? 'var(--cp-navy)' : 'transparent',
                    color: modoComp === 'PRODUCTO' ? 'var(--cp-cream)' : 'var(--cp-navy)',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Por producto
                </button>
                <button
                  type="button"
                  onClick={() => setModoComp('CATEGORIA')}
                  style={{
                    minHeight: '36px',
                    padding: '0 14px',
                    borderRadius: '8px',
                    border: '1.5px solid var(--cp-navy)',
                    backgroundColor: modoComp === 'CATEGORIA' ? 'var(--cp-navy)' : 'transparent',
                    color: modoComp === 'CATEGORIA' ? 'var(--cp-cream)' : 'var(--cp-navy)',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Por categoría completa
                </button>
              </div>

              {modoComp === 'PRODUCTO' ? (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    value={prodSeleccionado}
                    onChange={(e) => setProdSeleccionado(e.target.value)}
                    style={{ flex: 1, minWidth: '200px', minHeight: '40px', borderRadius: '8px', border: '1.5px solid var(--cp-line)', padding: '0 10px' }}
                  >
                    <option value="">Selecciona un producto...</option>
                    {productosDisponibles.map((p) => (
                      <option key={p.id} value={p.nombre}>
                        {p.nombre} {p.precio ? `(s/ ${p.precio.toFixed(2)})` : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={agregarComponente}
                    style={{ minHeight: '40px', padding: '0 16px', borderRadius: '8px', border: 0, backgroundColor: 'var(--cp-orange)', color: 'var(--cp-navy)', fontWeight: 800, cursor: 'pointer' }}
                  >
                    + Agregar
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    value={catSeleccionada}
                    onChange={(e) => setCatSeleccionada(e.target.value)}
                    style={{ flex: 1, minWidth: '200px', minHeight: '40px', borderRadius: '8px', border: '1.5px solid var(--cp-line)', padding: '0 10px' }}
                  >
                    {listaCategoriasNombres.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={agregarComponente}
                    style={{ minHeight: '40px', padding: '0 16px', borderRadius: '8px', border: 0, backgroundColor: 'var(--cp-orange)', color: 'var(--cp-navy)', fontWeight: 800, cursor: 'pointer' }}
                  >
                    + Agregar categoría
                  </button>
                </div>
              )}

              {/* Lista de componentes agregados */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '12px' }}>
                {componentes.map((c, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--cp-sand)',
                      fontSize: '13px',
                    }}
                  >
                    <span><strong>{c.nombre}</strong> ({c.tipo === 'PRODUCTO' ? 'Producto' : 'Toda la categoría'})</span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button type="button" onClick={() => modificarCantidadComp(idx, -1)} style={{ width: '28px', height: '28px', borderRadius: '14px', border: '1px solid var(--cp-navy)', background: 'transparent', fontWeight: 800, cursor: 'pointer' }}>-</button>
                      <span style={{ fontWeight: 800 }}>{c.cantidad}</span>
                      <button type="button" onClick={() => modificarCantidadComp(idx, 1)} style={{ width: '28px', height: '28px', borderRadius: '14px', border: '1px solid var(--cp-navy)', background: 'transparent', fontWeight: 800, cursor: 'pointer' }}>+</button>
                      <button type="button" onClick={() => quitarComponente(idx)} style={{ border: 0, background: 'transparent', color: 'var(--cp-rust)', fontWeight: 800, cursor: 'pointer', marginLeft: '6px' }}>×</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* PASO 2: CONDICIONES (DÍAS, HORARIOS, CANALES, VIGENCIA)        */}
        {/* ============================================================== */}
        {paso === 2 && (
          <div
            data-testid="paso-2-lleva-paga"
            style={{
              backgroundColor: 'var(--cp-white)',
              border: '1px solid var(--cp-line)',
              borderRadius: '14px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--cp-navy)' }}>
              Paso 2 de 4: Condiciones de aplicación
            </div>

            {/* Días */}
            <div>
              <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>Días que aplica:</div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {DIAS.map(([code, full]) => {
                  const on = dias.includes(code);
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => toggleDia(code)}
                      aria-pressed={on}
                      style={{
                        minHeight: '34px',
                        padding: '0 12px',
                        borderRadius: '9999px',
                        border: '1.5px solid var(--cp-navy)',
                        backgroundColor: on ? 'var(--cp-navy)' : 'transparent',
                        color: on ? 'var(--cp-cream)' : 'var(--cp-navy)',
                        fontWeight: 700,
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      {full}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Horario */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '130px' }}>
                <label htmlFor="lp-h-desde" style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '2px' }}>
                  Hora desde:
                </label>
                <input
                  id="lp-h-desde"
                  type="time"
                  value={horaDesde}
                  onChange={(e) => setHoraDesde(e.target.value)}
                  style={{ width: '100%', minHeight: '38px', borderRadius: '8px', border: '1.5px solid var(--cp-line)', padding: '0 8px' }}
                />
              </div>
              <div style={{ flex: 1, minWidth: '130px' }}>
                <label htmlFor="lp-h-hasta" style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '2px' }}>
                  Hora hasta:
                </label>
                <input
                  id="lp-h-hasta"
                  type="time"
                  value={horaHasta}
                  onChange={(e) => setHoraHasta(e.target.value)}
                  style={{ width: '100%', minHeight: '38px', borderRadius: '8px', border: '1.5px solid var(--cp-line)', padding: '0 8px' }}
                />
              </div>
            </div>

            {/* Canales y Fechas */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '140px' }}>
                <label htmlFor="lp-canal" style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '2px' }}>
                  Canales válidos:
                </label>
                <select
                  id="lp-canal"
                  value={canal}
                  onChange={(e) => setCanal(e.target.value)}
                  style={{ width: '100%', minHeight: '38px', borderRadius: '8px', border: '1.5px solid var(--cp-line)', padding: '0 8px' }}
                >
                  {CANALES.map((c) => (
                    <option key={c.clave} value={c.clave}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: '130px' }}>
                <label htmlFor="lp-f-desde" style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '2px' }}>
                  Fecha inicio (opcional):
                </label>
                <input
                  id="lp-f-desde"
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                  style={{ width: '100%', minHeight: '38px', borderRadius: '8px', border: '1.5px solid var(--cp-line)', padding: '0 8px' }}
                />
              </div>
              <div style={{ flex: 1, minWidth: '130px' }}>
                <label htmlFor="lp-f-hasta" style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '2px' }}>
                  Fecha fin (opcional):
                </label>
                <input
                  id="lp-f-hasta"
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                  style={{ width: '100%', minHeight: '38px', borderRadius: '8px', border: '1.5px solid var(--cp-line)', padding: '0 8px' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* PASO 3: BENEFICIO (LLEVA X PAGA Y, PRECIO)                    */}
        {/* ============================================================== */}
        {paso === 3 && (
          <div
            data-testid="paso-3-lleva-paga"
            style={{
              backgroundColor: 'var(--cp-white)',
              border: '1px solid var(--cp-line)',
              borderRadius: '14px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--cp-navy)' }}>
              Paso 3 de 4: Beneficio (Lleva X, Paga Y)
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '130px' }}>
                <label htmlFor="lp-q-lleva" style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                  Lleva (unidades) *
                </label>
                <input
                  id="lp-q-lleva"
                  type="number"
                  min={2}
                  max={20}
                  value={qLleva}
                  onChange={(e) => setQLleva(parseInt(e.target.value) || 2)}
                  style={{ width: '100%', minHeight: '42px', borderRadius: '8px', border: '1.5px solid var(--cp-line)', padding: '0 12px', fontSize: '16px', fontWeight: 800 }}
                />
              </div>

              <div style={{ flex: 1, minWidth: '130px' }}>
                <label htmlFor="lp-q-paga" style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                  Paga (unidades) *
                </label>
                <input
                  id="lp-q-paga"
                  type="number"
                  min={1}
                  max={qLleva - 1}
                  value={qPaga}
                  onChange={(e) => setQPaga(parseInt(e.target.value) || 1)}
                  style={{ width: '100%', minHeight: '42px', borderRadius: '8px', border: '1.5px solid var(--cp-line)', padding: '0 12px', fontSize: '16px', fontWeight: 800 }}
                />
              </div>

              <div style={{ flex: 1, minWidth: '150px' }}>
                <label htmlFor="lp-precio" style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                  Precio final de la promo (S/) *
                </label>
                <input
                  id="lp-precio"
                  type="number"
                  step="0.5"
                  min={0.1}
                  value={precio}
                  onChange={(e) => setPrecio(e.target.value)}
                  placeholder="Ej.: 11.50"
                  style={{ width: '100%', minHeight: '42px', borderRadius: '8px', border: '1.5px solid var(--cp-line)', padding: '0 12px', fontSize: '16px', fontWeight: 800, color: 'var(--cp-rust)' }}
                />
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'var(--cp-sand)',
                borderRadius: '10px',
                padding: '10px 14px',
                fontSize: '13px',
                color: 'var(--cp-navy)',
              }}
            >
              <strong>Resumen del beneficio:</strong> Promoción <strong>{qLleva}x{qPaga}</strong> con precio especial de <strong>S/ {parseFloat(precio) ? parseFloat(precio).toFixed(2) : '0.00'}</strong>.
              Total de unidades asignadas en el Paso 1: <strong>{totalUnidades}</strong> de <strong>{qLleva}</strong> necesarias.
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* PASO 4: PREVISUALIZACIÓN Y EJEMPLO CALCULADO                   */}
        {/* ============================================================== */}
        {paso === 4 && (
          <div
            data-testid="paso-4-lleva-paga"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            {/* Ejemplo didáctico calculado con productos reales */}
            <div
              data-testid="ejemplo-calculado-lleva-paga"
              style={{
                backgroundColor: '#DCFCE7',
                border: '1.5px solid #2E7D32',
                borderRadius: '14px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div style={{ fontWeight: 800, fontSize: '15px', color: '#166534' }}>
                Ejemplo real calculado para el cliente
              </div>
              <div style={{ fontSize: '14px', lineHeight: '20px', color: '#14532D', fontWeight: 700 }}>
                {ejemploCalculado.texto}
              </div>
              <div style={{ fontSize: '12px', color: '#166534' }}>
                Calculado con los precios reales del catálogo para demostrar exactamente el valor para tu cliente.
              </div>
            </div>

            {/* Previsualización interactiva */}
            <div
              style={{
                backgroundColor: 'var(--cp-white)',
                border: '1px solid var(--cp-line)',
                borderRadius: '14px',
                padding: '16px',
              }}
            >
              <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--cp-navy)', marginBottom: '8px' }}>
                Previsualización en la carta
              </div>
              <PrevisualizacionCarta
                oferta={ofertaEnVivo}
                productosDisponibles={productosDisponibles}
                categoriasDisponibles={categorias}
                vistaInicial="tarjeta"
                dispositivoInicial="pc"
              />
            </div>
          </div>
        )}

        {/* Navegación inferior */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '10px',
            borderTop: '1.5px solid var(--cp-line)',
            paddingTop: '12px',
          }}
        >
          <button
            type="button"
            onClick={irPasoAnterior}
            disabled={paso === 1}
            style={{
              minHeight: '44px',
              padding: '0 20px',
              borderRadius: '12px',
              border: '1.5px solid var(--cp-navy)',
              backgroundColor: 'transparent',
              color: 'var(--cp-navy)',
              fontWeight: 800,
              fontSize: '14px',
              cursor: paso === 1 ? 'not-allowed' : 'pointer',
              opacity: paso === 1 ? 0.3 : 1,
            }}
          >
            ← Atrás
          </button>

          {paso < 4 ? (
            <button
              type="button"
              onClick={irSiguientePaso}
              data-testid="btn-siguiente-paso"
              style={{
                minHeight: '44px',
                padding: '0 24px',
                borderRadius: '12px',
                border: 0,
                backgroundColor: 'var(--cp-orange)',
                color: 'var(--cp-navy)',
                fontWeight: 800,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Siguiente →
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmarGuardar(true)}
              disabled={guardando}
              data-testid="btn-guardar-lleva-paga"
              style={{
                minHeight: '44px',
                padding: '0 28px',
                borderRadius: '12px',
                border: 0,
                backgroundColor: 'var(--cp-orange)',
                color: 'var(--cp-navy)',
                fontWeight: 800,
                fontSize: '14px',
                cursor: guardando ? 'wait' : 'pointer',
              }}
            >
              {guardando ? 'Guardando...' : 'Guardar promoción'}
            </button>
          )}
        </div>

        {/* Confirmación para quitar foto */}
        <ModalConfirmacion
          abierto={confirmarQuitarFoto}
          titulo="¿Quitar foto de la promoción?"
          mensaje="La promoción se mostrará con la letra inicial sobre fondo dorado."
          onConfirmar={confirmarQuitar}
          onCancelar={() => setConfirmarQuitarFoto(false)}
        />

        {/* Confirmación para guardar */}
        <ModalConfirmacion
          abierto={confirmarGuardar}
          titulo={ofertaAEditar ? '¿Guardar cambios de la promoción?' : '¿Guardar nueva promoción?'}
          mensaje={`¿Deseas confirmar y guardar "${nombre}" en la carta virtual?`}
          onConfirmar={ejecutarGuardar}
          onCancelar={() => setConfirmarGuardar(false)}
        />
      </div>
    </div>
  );
}
