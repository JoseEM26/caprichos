import { useState, useEffect } from 'react';
import { OfertaItem, ofertasApi } from './ofertasApi';
import { ModalConfirmacion } from './ModalConfirmacion';

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

interface ModalDescuentoProps {
  abierto: boolean;
  descuentoAEditar?: OfertaItem | null;
  onCerrar: () => void;
  onGuardar: (datos: any) => Promise<void>;
  productosDisponibles?: Array<{ id: string; nombre: string; categoria?: string }>;
  categoriasDisponibles?: string[];
}

export function ModalDescuento({
  abierto,
  descuentoAEditar,
  onCerrar,
  onGuardar,
  productosDisponibles = [],
  categoriasDisponibles = CATEGORIAS_DEF,
}: ModalDescuentoProps) {
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<'pct' | 'monto'>('pct');
  const [valor, setValor] = useState('');
  const [minima, setMinima] = useState('0');
  const [aplica, setAplica] = useState<'toda' | 'cat' | 'prod'>('toda');
  const [categoria, setCategoria] = useState('');
  const [producto, setProducto] = useState('');
  const [productoComboAbierto, setProductoComboAbierto] = useState(false);
  const [productoBusqueda, setProductoBusqueda] = useState('');
  const [dias, setDias] = useState<string[]>([]);
  const [horaDesde, setHoraDesde] = useState('');
  const [horaHasta, setHoraHasta] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [canal, setCanal] = useState('todos');
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [fotoArchivoId, setFotoArchivoId] = useState<string | null>(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [confirmarQuitarFoto, setConfirmarQuitarFoto] = useState(false);
  const [mensajeError, setMensajeError] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (descuentoAEditar) {
      setNombre(descuentoAEditar.nombre || '');
      setFotoUrl(descuentoAEditar.imagenUrl || null);
      setFotoArchivoId(descuentoAEditar.imagenArchivoId || null);
      setTipo(
        descuentoAEditar.descuentoTipo === 'MONTO_FIJO' || descuentoAEditar.descuentoTipo === 'MONTO'
          ? 'monto'
          : 'pct',
      );
      setValor(
        descuentoAEditar.descuentoValor !== undefined && descuentoAEditar.descuentoValor !== null
          ? String(descuentoAEditar.descuentoValor)
          : '',
      );
      setMinima(
        descuentoAEditar.compraMinima !== undefined && descuentoAEditar.compraMinima !== null
          ? String(descuentoAEditar.compraMinima)
          : '0',
      );
      if (descuentoAEditar.aplicaA === 'CATEGORIA' || descuentoAEditar.alcanceCategoriaId) {
        setAplica('cat');
        setCategoria(descuentoAEditar.categoriaNombre || '');
      } else if (descuentoAEditar.aplicaA === 'PRODUCTO' || descuentoAEditar.alcanceProductoId) {
        setAplica('prod');
        setProducto(descuentoAEditar.productoNombre || '');
      } else {
        setAplica('toda');
      }
      const diasArr = descuentoAEditar.dias || descuentoAEditar.diasSemana;
      setDias(
        (diasArr || []).map((d) => DIAS[d % 7]?.[0] || 'lun'),
      );
      setHoraDesde(descuentoAEditar.horaDesde || descuentoAEditar.horaInicio || '');
      setHoraHasta(descuentoAEditar.horaHasta || descuentoAEditar.horaFin || '');
      const fDesde = descuentoAEditar.fechaDesde || descuentoAEditar.fechaInicio;
      const fHasta = descuentoAEditar.fechaHasta || descuentoAEditar.fechaFin;
      setFechaDesde(fDesde ? fDesde.slice(0, 10) : '');
      setFechaHasta(fHasta ? fHasta.slice(0, 10) : '');
      setCanal(descuentoAEditar.canales && descuentoAEditar.canales[0] ? descuentoAEditar.canales[0].toLowerCase() : 'todos');
      setMensajeError('');
    } else {
      setNombre('');
      setFotoUrl(null);
      setFotoArchivoId(null);
      setTipo('pct');
      setValor('');
      setMinima('0');
      setAplica('toda');
      setCategoria('');
      setProducto('');
      setDias([]);
      setHoraDesde('');
      setHoraHasta('');
      setFechaDesde('');
      setFechaHasta('');
      setCanal('todos');
      setMensajeError('');
    }
  }, [descuentoAEditar, abierto]);

  if (!abierto) return null;

  const toggleDia = (d: string) => {
    setDias((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
    setMensajeError('');
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

  const pedirQuitarFoto = () => {
    setConfirmarQuitarFoto(true);
  };

  const confirmarQuitar = () => {
    setFotoUrl(null);
    setFotoArchivoId(null);
    setConfirmarQuitarFoto(false);
  };

  const validarYGuardar = async () => {
    if (!nombre.trim()) {
      setMensajeError('Escribe el nombre del descuento.');
      return;
    }
    const valNum = parseFloat(valor.replace(',', '.'));
    if (isNaN(valNum) || !(valNum > 0)) {
      setMensajeError('Escribe el valor del descuento.');
      return;
    }
    if (tipo === 'pct' && valNum > 100) {
      setMensajeError('Un porcentaje no puede pasar de 100.');
      return;
    }
    if (aplica === 'cat' && !categoria) {
      setMensajeError('Elige la categoría.');
      return;
    }
    if (aplica === 'prod' && !producto) {
      setMensajeError('Elige el producto.');
      return;
    }
    if ((horaDesde && !horaHasta) || (!horaDesde && horaHasta)) {
      setMensajeError('Escribe las dos horas (desde y hasta) o déjalas vacías.');
      return;
    }
    if (horaDesde && horaHasta && horaDesde >= horaHasta) {
      setMensajeError('La hora de inicio debe ser antes de la hora final.');
      return;
    }
    if (fechaDesde && fechaHasta && fechaDesde > fechaHasta) {
      setMensajeError('La fecha de inicio no puede ser después de la final.');
      return;
    }

    setGuardando(true);
    setMensajeError('');
    try {
      // Mapear dias a números (0=dom, 1=lun, etc. o 1=lun..7=dom)
      const diasNum = dias.map((code) => {
        const idx = DIAS.findIndex((x) => x[0] === code);
        return idx + 1;
      });

      const prodObj = productosDisponibles.find((p) => p.nombre === producto);

      const payload = {
        nombre: nombre.trim(),
        tipo: 'DESCUENTO',
        aplicaA: aplica === 'toda' ? 'TODA_LA_CARTA' : aplica === 'cat' ? 'CATEGORIA' : 'PRODUCTO',
        categoriaNombre: aplica === 'cat' ? categoria : undefined,
        productoId: aplica === 'prod' && prodObj ? prodObj.id : undefined,
        productoNombre: aplica === 'prod' ? producto : undefined,
        descuentoTipo: tipo === 'pct' ? 'PORCENTAJE' : 'MONTO',
        descuentoValor: valNum,
        compraMinima: parseFloat(minima) || 0,
        dias: diasNum,
        diasSemana: diasNum,
        horaDesde: horaDesde || undefined,
        horaInicio: horaDesde || undefined,
        horaHasta: horaHasta || undefined,
        horaFin: horaHasta || undefined,
        fechaDesde: fechaDesde || undefined,
        fechaInicio: fechaDesde || undefined,
        fechaHasta: fechaHasta || undefined,
        fechaFin: fechaHasta || undefined,
        canales: canal === 'todos' ? ['CARTA', 'ADMIN', 'BOT'] : [canal.toUpperCase()],
        imagenArchivoId: fotoArchivoId,
      };

      await onGuardar(payload);
      onCerrar();
    } catch (err: any) {
      setMensajeError(err.response?.data?.mensaje || err.message || 'Error al guardar el descuento.');
    } finally {
      setGuardando(false);
    }
  };

  const prodsFiltrados = productosDisponibles.filter((p) =>
    !productoBusqueda.trim() || p.nombre.toLowerCase().includes(productoBusqueda.toLowerCase()),
  );

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
        aria-label="Descuento automático"
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
            {descuentoAEditar ? 'Editar descuento' : 'Nuevo descuento automático'}
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

        <div>
          <label htmlFor="dd-n" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
            Nombre
          </label>
          <input
            id="dd-n"
            type="text"
            value={nombre}
            onChange={(e) => {
              setNombre(e.target.value);
              setMensajeError('');
            }}
            placeholder="Ejemplo: Happy hour de la tarde"
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

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontWeight: 700, marginBottom: '4px' }}>Tipo</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  setTipo('pct');
                  setMensajeError('');
                }}
                style={{
                  minHeight: '44px',
                  padding: '0 12px',
                  borderRadius: '9999px',
                  border: '1.5px solid var(--cp-navy)',
                  backgroundColor: tipo === 'pct' ? 'var(--cp-navy)' : 'transparent',
                  color: tipo === 'pct' ? 'var(--cp-cream)' : 'var(--cp-navy)',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Porcentaje
              </button>
              <button
                type="button"
                onClick={() => {
                  setTipo('monto');
                  setMensajeError('');
                }}
                style={{
                  minHeight: '44px',
                  padding: '0 12px',
                  borderRadius: '9999px',
                  border: '1.5px solid var(--cp-navy)',
                  backgroundColor: tipo === 'monto' ? 'var(--cp-navy)' : 'transparent',
                  color: tipo === 'monto' ? 'var(--cp-cream)' : 'var(--cp-navy)',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Monto fijo (s/)
              </button>
            </div>
          </div>

          <div style={{ flex: '1 1 110px' }}>
            <label htmlFor="dd-v" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
              Valor
            </label>
            <input
              id="dd-v"
              type="text"
              value={valor}
              onChange={(e) => {
                setValor(e.target.value);
                setMensajeError('');
              }}
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
            <label htmlFor="dd-m" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
              Compra mínima (s/)
            </label>
            <input
              id="dd-m"
              type="text"
              value={minima}
              onChange={(e) => setMinima(e.target.value)}
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
          <div style={{ fontWeight: 700, marginBottom: '4px' }}>Aplica a</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                setAplica('toda');
                setMensajeError('');
              }}
              style={{
                minHeight: '44px',
                padding: '0 12px',
                borderRadius: '9999px',
                border: '1.5px solid var(--cp-navy)',
                backgroundColor: aplica === 'toda' ? 'var(--cp-navy)' : 'transparent',
                color: aplica === 'toda' ? 'var(--cp-cream)' : 'var(--cp-navy)',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Toda la carta
            </button>
            <button
              type="button"
              onClick={() => {
                setAplica('cat');
                setMensajeError('');
              }}
              style={{
                minHeight: '44px',
                padding: '0 12px',
                borderRadius: '9999px',
                border: '1.5px solid var(--cp-navy)',
                backgroundColor: aplica === 'cat' ? 'var(--cp-navy)' : 'transparent',
                color: aplica === 'cat' ? 'var(--cp-cream)' : 'var(--cp-navy)',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Una categoría
            </button>
            <button
              type="button"
              onClick={() => {
                setAplica('prod');
                setMensajeError('');
              }}
              style={{
                minHeight: '44px',
                padding: '0 12px',
                borderRadius: '9999px',
                border: '1.5px solid var(--cp-navy)',
                backgroundColor: aplica === 'prod' ? 'var(--cp-navy)' : 'transparent',
                color: aplica === 'prod' ? 'var(--cp-cream)' : 'var(--cp-navy)',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Un producto
            </button>
          </div>

          {aplica === 'cat' && (
            <div style={{ marginTop: '6px' }}>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {categoriasDisponibles.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setCategoria(cat);
                      setMensajeError('');
                    }}
                    style={{
                      minHeight: '44px',
                      padding: '0 12px',
                      borderRadius: '9999px',
                      border: '1.5px solid var(--cp-navy)',
                      backgroundColor: categoria === cat ? 'var(--cp-navy)' : 'transparent',
                      color: categoria === cat ? 'var(--cp-cream)' : 'var(--cp-navy)',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}

          {aplica === 'prod' && (
            <div style={{ marginTop: '6px' }}>
              <div>
                <button
                  type="button"
                  onClick={() => setProductoComboAbierto(!productoComboAbierto)}
                  aria-haspopup="listbox"
                  aria-expanded={productoComboAbierto}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    minHeight: '44px',
                    padding: '0 12px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--cp-navy)',
                    backgroundColor: 'var(--cp-white)',
                    color: 'var(--cp-navy)',
                    fontWeight: 700,
                    fontSize: '13px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <span>{producto ? `PRODUCTO: ${producto}` : 'PRODUCTO: Elige un producto'}</span>
                  <span aria-hidden="true">{productoComboAbierto ? '▴' : '▾'}</span>
                </button>

                {productoComboAbierto && (
                  <div
                    role="listbox"
                    style={{
                      marginTop: '4px',
                      border: '1.5px solid var(--cp-navy)',
                      borderRadius: '10px',
                      backgroundColor: 'var(--cp-white)',
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{ padding: '6px', borderBottom: '1px solid var(--cp-line)' }}>
                      <label htmlFor="dd-search-prod" style={{ position: 'absolute', left: '-9999px' }}>
                        Buscar producto
                      </label>
                      <input
                        id="dd-search-prod"
                        type="search"
                        value={productoBusqueda}
                        onChange={(e) => setProductoBusqueda(e.target.value)}
                        placeholder="Buscar producto…"
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          minHeight: '38px',
                          borderRadius: '9999px',
                          border: '1.5px solid var(--cp-line)',
                          backgroundColor: 'var(--cp-cream)',
                          padding: '0 12px',
                          fontSize: '13px',
                        }}
                      />
                    </div>
                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                      {prodsFiltrados.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          role="option"
                          aria-selected={producto === p.nombre}
                          onClick={() => {
                            setProducto(p.nombre);
                            setProductoComboAbierto(false);
                            setMensajeError('');
                          }}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            minHeight: '44px',
                            padding: '0 12px',
                            border: 0,
                            borderBottom: '1px solid var(--cp-sand)',
                            backgroundColor: producto === p.nombre ? 'var(--cp-sand)' : 'transparent',
                            color: 'var(--cp-navy)',
                            fontWeight: producto === p.nombre ? 800 : 500,
                            fontSize: '13px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            textAlign: 'left',
                            cursor: 'pointer',
                          }}
                        >
                          <span>{p.nombre}</span>
                          {producto === p.nombre && <span aria-hidden="true">✓</span>}
                        </button>
                      ))}
                      {prodsFiltrados.length === 0 && (
                        <div style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--cp-soft)' }}>
                          Nada coincide.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

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
              <label htmlFor="dd-hd" style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                Desde la hora
              </label>
              <input
                id="dd-hd"
                type="time"
                value={horaDesde}
                onChange={(e) => {
                  setHoraDesde(e.target.value);
                  setMensajeError('');
                }}
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
              <label htmlFor="dd-hh" style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                Hasta la hora
              </label>
              <input
                id="dd-hh"
                type="time"
                value={horaHasta}
                onChange={(e) => {
                  setHoraHasta(e.target.value);
                  setMensajeError('');
                }}
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
              <label htmlFor="dd-vd" style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                Vigente desde
              </label>
              <input
                id="dd-vd"
                type="date"
                value={fechaDesde}
                onChange={(e) => {
                  setFechaDesde(e.target.value);
                  setMensajeError('');
                }}
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
              <label htmlFor="dd-vh" style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                Hasta
              </label>
              <input
                id="dd-vh"
                type="date"
                value={fechaHasta}
                onChange={(e) => {
                  setFechaHasta(e.target.value);
                  setMensajeError('');
                }}
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

          <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
            Sin horas, vale todo el día. Sin fechas, vale siempre.
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>Dónde vale</div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {CANALES.map((c) => (
                  <button
                    key={c.clave}
                    type="button"
                    onClick={() => {
                      setCanal(c.clave);
                      setMensajeError('');
                    }}
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
        </div>

        {/* Foto de la oferta */}
        <div
          style={{
            border: '1.5px solid var(--cp-navy)',
            borderRadius: '16px',
            padding: '16px',
            backgroundColor: 'var(--cp-white)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ fontWeight: 800, color: 'var(--cp-navy)' }}>
            Foto de la oferta (opcional)
          </div>
          <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
            Si no subes una foto, en la carta y en el panel se mostrará la letra inicial.
          </div>

          <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div
              style={{
                width: '100px',
                height: '100px',
                borderRadius: '12px',
                border: '1.5px dashed var(--cp-soft)',
                backgroundColor: 'var(--cp-sand)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              {fotoUrl ? (
                <img
                  src={fotoUrl}
                  alt="Vista previa"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <span
                  style={{
                    fontFamily: 'Montserrat, sans-serif',
                    fontWeight: 800,
                    fontSize: '32px',
                    color: 'var(--cp-navy)',
                  }}
                >
                  {nombre.trim() ? nombre.trim()[0].toUpperCase() : '%'}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <label
                style={{
                  minHeight: '44px',
                  padding: '0 16px',
                  border: '1.5px solid var(--cp-navy)',
                  borderRadius: '12px',
                  backgroundColor: 'var(--cp-navy)',
                  color: 'var(--cp-cream)',
                  fontWeight: 700,
                  fontSize: '13px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                }}
              >
                {subiendoFoto ? 'Subiendo...' : fotoUrl ? 'Cambiar foto' : 'Subir foto'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={manejarSubidaFoto}
                  disabled={subiendoFoto}
                  style={{ position: 'absolute', left: -9999 }}
                />
              </label>

              {fotoUrl && (
                <button
                  type="button"
                  onClick={pedirQuitarFoto}
                  style={{
                    minHeight: '44px',
                    padding: '0 16px',
                    border: '1.5px solid var(--cp-rust)',
                    borderRadius: '12px',
                    backgroundColor: 'transparent',
                    color: 'var(--cp-rust)',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Quitar foto
                </button>
              )}
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
            {guardando ? 'Guardando...' : 'Guardar descuento'}
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
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
        </div>

        <ModalConfirmacion
          abierto={confirmarQuitarFoto}
          titulo="¿Quitar la foto del descuento?"
          mensaje="Se mostrará la letra inicial hasta que subas otra."
          onConfirmar={confirmarQuitar}
          onCancelar={() => setConfirmarQuitarFoto(false)}
        />
      </div>
    </div>
  );
}
