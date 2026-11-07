import { useState, useEffect } from 'react';
import { CuponItem } from './ofertasApi';
import { CanalesEstado, SelectorCanales, canalesDesdeEstado, estadoDesdeCanales } from './canalesPromo';

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

const DIAS = [
  ['lun', 'Lun', 1],
  ['mar', 'Mar', 2],
  ['mie', 'Mié', 3],
  ['jue', 'Jue', 4],
  ['vie', 'Vie', 5],
  ['sab', 'Sáb', 6],
  ['dom', 'Dom', 7],
] as const;

interface ModalCuponProps {
  abierto: boolean;
  cuponAEditar?: CuponItem | null;
  validezReglasDefecto?: number;
  onCerrar: () => void;
  onGuardar: (datos: any) => Promise<void>;
  productosDisponibles?: Array<{ id: string; nombre: string; categoria?: string }>;
  categoriasDisponibles?: string[];
  /** Categorías con id (la API guarda el id del alcance). */
  categorias?: Array<{ id: string; nombre: string }>;
}

export function ModalCupon({
  abierto,
  cuponAEditar,
  validezReglasDefecto = 15,
  onCerrar,
  onGuardar,
  productosDisponibles = [],
  categoriasDisponibles = CATEGORIAS_DEF,
  categorias = [],
}: ModalCuponProps) {
  const [modo, setModo] = useState<'UNICO_COMPROBANTE' | 'COMPARTIDO'>('UNICO_COMPROBANTE');
  const [codigoBase, setCodigoBase] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [tipo, setTipo] = useState<'pct' | 'monto' | 'envio'>('pct');
  const [dias, setDias] = useState<string[]>([]);
  const [horaDesde, setHoraDesde] = useState('');
  const [horaHasta, setHoraHasta] = useState('');
  const [valor, setValor] = useState('');
  const [minima, setMinima] = useState('0');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [maxUsos, setMaxUsos] = useState('');
  const [porCliente, setPorCliente] = useState('1');
  const [aplica, setAplica] = useState<'toda' | 'cat' | 'prod'>('toda');
  const [categoria, setCategoria] = useState('');
  const [producto, setProducto] = useState('');
  const [productoComboAbierto, setProductoComboAbierto] = useState(false);
  const [productoBusqueda, setProductoBusqueda] = useState('');
  const [tituloImpreso, setTituloImpreso] = useState('En tu siguiente compra');
  const [validezDias, setValidezDias] = useState(String(validezReglasDefecto));
  const [canales, setCanales] = useState<CanalesEstado>({ carta: true, local: true, bot: false });
  const [requiereCuenta, setRequiereCuenta] = useState(false);
  const [mensajeError, setMensajeError] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (cuponAEditar) {
      setModo(cuponAEditar.modo || 'UNICO_COMPROBANTE');
      setCodigoBase(cuponAEditar.codigoBase || '');
      setDescripcion(cuponAEditar.descripcion || '');
      setTipo(cuponAEditar.descuentoTipo === 'ENVIO_GRATIS' ? 'envio' : cuponAEditar.descuentoTipo === 'MONTO' || cuponAEditar.tipo === 'MONTO_FIJO' ? 'monto' : 'pct');
      const valorActual = cuponAEditar.descuentoValor ?? cuponAEditar.valor;
      setValor(valorActual !== undefined && valorActual !== null ? String(valorActual) : '');
      setDias((cuponAEditar.dias || []).map((d) => DIAS[d - 1]?.[0] || 'lun'));
      setHoraDesde(cuponAEditar.horaDesde || '');
      setHoraHasta(cuponAEditar.horaHasta || '');
      setMinima(cuponAEditar.compraMinima !== undefined && cuponAEditar.compraMinima !== null ? String(cuponAEditar.compraMinima) : '0');
      setFechaDesde(cuponAEditar.fechaDesde ? cuponAEditar.fechaDesde.slice(0, 10) : '');
      setFechaHasta(cuponAEditar.fechaHasta ? cuponAEditar.fechaHasta.slice(0, 10) : '');
      setMaxUsos(cuponAEditar.topeUsos ? String(cuponAEditar.topeUsos) : '');
      setPorCliente(cuponAEditar.maxPorCliente ? String(cuponAEditar.maxPorCliente) : '1');
      if (cuponAEditar.aplicaA === 'CATEGORIA') {
        setAplica('cat');
        setCategoria(cuponAEditar.categoriaNombre || '');
      } else if (cuponAEditar.aplicaA === 'PRODUCTO') {
        setAplica('prod');
        setProducto(cuponAEditar.productoNombre || '');
      } else {
        setAplica('toda');
      }
      setTituloImpreso(cuponAEditar.tituloImpreso || 'En tu siguiente compra');
      setValidezDias(cuponAEditar.diasValidez || cuponAEditar.diasValidezImpreso ? String(cuponAEditar.diasValidez || cuponAEditar.diasValidezImpreso) : String(validezReglasDefecto));
      setCanales({ ...estadoDesdeCanales(cuponAEditar.canales), bot: false });
      setRequiereCuenta(Boolean(cuponAEditar.requiereCuenta));
      setMensajeError('');
    } else {
      setModo('UNICO_COMPROBANTE');
      setCodigoBase('');
      setDescripcion('');
      setTipo('pct');
      setDias([]);
      setHoraDesde('');
      setHoraHasta('');
      setValor('');
      setMinima('0');
      setFechaDesde('');
      setFechaHasta('');
      setMaxUsos('');
      setPorCliente('1');
      setAplica('toda');
      setCategoria('');
      setProducto('');
      setTituloImpreso('En tu siguiente compra');
      setValidezDias(String(validezReglasDefecto));
      setCanales({ carta: true, local: true, bot: false });
      setRequiereCuenta(false);
      setMensajeError('');
    }
  }, [cuponAEditar, abierto, validezReglasDefecto]);

  if (!abierto) return null;

  const validarYGuardar = async () => {
    if (!codigoBase.trim()) {
      setMensajeError('Escribe el código base del cupón.');
      return;
    }
    if (!canales.carta && !canales.local) {
      setMensajeError('Elige al menos un lugar donde aplica: carta web o en el local.');
      return;
    }
    if (!descripcion.trim()) {
      setMensajeError('Escribe una descripción.');
      return;
    }
    const esEnvio = tipo === 'envio';
    const valNum = esEnvio ? 0 : parseFloat(valor.replace(',', '.'));
    if (!esEnvio && (isNaN(valNum) || !(valNum > 0))) {
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
    if (horaDesde && horaHasta && horaDesde >= horaHasta) {
      setMensajeError('La hora de fin debe ser después de la hora de inicio.');
      return;
    }
    if (fechaDesde && fechaHasta && fechaDesde > fechaHasta) {
      setMensajeError('La fecha de inicio no puede ser después de la final.');
      return;
    }

    setGuardando(true);
    setMensajeError('');
    try {
      const prodObj = productosDisponibles.find((p) => p.nombre === producto);

      const categoriaObj = (categorias || []).find((c) => c.nombre === categoria);
      if (aplica === 'cat' && !categoriaObj) {
        throw new Error('Esa categoría ya no existe. Elige otra.');
      }
      // Nombres y campos de la API (CrearCuponDto / ActualizarCuponDto)
      const payload = {
        codigoBase: codigoBase.trim().toUpperCase(),
        descripcion: descripcion.trim(),
        modo,
        descuentoTipo: esEnvio ? 'ENVIO_GRATIS' : tipo === 'pct' ? 'PORCENTAJE' : 'MONTO',
        descuentoValor: valNum,
        compraMinima: parseFloat(minima) || 0,
        categoriaId: aplica === 'cat' && categoriaObj ? categoriaObj.id : undefined,
        productoId: aplica === 'prod' && prodObj ? prodObj.id : undefined,
        canales: canalesDesdeEstado(canales, 'CAJA'),
        requiereCuenta,
        diasValidez: modo === 'UNICO_COMPROBANTE' ? (parseInt(validezDias, 10) || 15) : undefined,
        topeUsos: modo === 'COMPARTIDO' ? (parseInt(maxUsos, 10) || 5000) : undefined,
        maxPorCliente: modo === 'COMPARTIDO' ? (parseInt(porCliente, 10) || 1) : undefined,
        // Horario opcional: vacío = el cupón vale todo el tiempo
        dias: dias.map((code) => DIAS.findIndex((x) => x[0] === code) + 1),
        horaDesde: horaDesde || null,
        horaHasta: horaHasta || null,
        fechaDesde: fechaDesde || null,
        fechaHasta: fechaHasta || null,
      };

      await onGuardar(payload);
      onCerrar();
    } catch (err: any) {
      setMensajeError(err.response?.data?.mensaje || err.message || 'Error al guardar el cupón.');
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
        aria-label="Nuevo cupón"
        style={{
          position: 'absolute',
          zIndex: 65,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(860px, calc(100% - 24px))',
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
            {cuponAEditar ? 'Editar cupón' : 'Nuevo cupón'}
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

        {/* ¿Cómo se entrega este cupón? */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontWeight: 800 }}>¿Cómo se entrega este cupón?</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
            <button
              type="button"
              role="radio"
              aria-checked={modo === 'UNICO_COMPROBANTE'}
              onClick={() => {
                setModo('UNICO_COMPROBANTE');
                setMensajeError('');
              }}
              style={{
                textAlign: 'left',
                minHeight: '88px',
                padding: '12px 14px',
                borderRadius: '14px',
                border: modo === 'UNICO_COMPROBANTE' ? '2px solid var(--cp-navy)' : '2px solid var(--cp-line)',
                backgroundColor: modo === 'UNICO_COMPROBANTE' ? 'var(--cp-navy)' : 'var(--cp-white)',
                color: modo === 'UNICO_COMPROBANTE' ? 'var(--cp-cream)' : 'var(--cp-navy)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '15px' }}>
                Código único en el comprobante
              </span>
              <span style={{ fontSize: '12px', lineHeight: '17px', opacity: 0.9 }}>
                Cada comprobante imprime un código distinto, al azar y de un solo uso. Ideal para premiar la siguiente compra.
              </span>
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={modo === 'COMPARTIDO'}
              onClick={() => {
                setModo('COMPARTIDO');
                setMensajeError('');
              }}
              style={{
                textAlign: 'left',
                minHeight: '88px',
                padding: '12px 14px',
                borderRadius: '14px',
                border: modo === 'COMPARTIDO' ? '2px solid var(--cp-navy)' : '2px solid var(--cp-line)',
                backgroundColor: modo === 'COMPARTIDO' ? 'var(--cp-navy)' : 'var(--cp-white)',
                color: modo === 'COMPARTIDO' ? 'var(--cp-cream)' : 'var(--cp-navy)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '15px' }}>
                Código compartido con tope
              </span>
              <span style={{ fontSize: '12px', lineHeight: '17px', opacity: 0.9 }}>
                Un mismo código para afiches, volantes y redes. No se imprime en el comprobante y se acaba al llegar a su tope de usos.
              </span>
            </button>
          </div>
        </div>

        {/* Inputs código y descripción */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 180px' }}>
            <label htmlFor="cp-c" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
              {modo === 'UNICO_COMPROBANTE' ? 'Nombre del cupón (base del código)' : 'Código del cupón'}
            </label>
            <input
              id="cp-c"
              type="text"
              value={codigoBase}
              onChange={(e) => {
                setCodigoBase(e.target.value);
                setMensajeError('');
              }}
              placeholder={modo === 'UNICO_COMPROBANTE' ? 'Ejemplo: DUO20' : 'Ejemplo: BIENVENIDA'}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                minHeight: '48px',
                borderRadius: '12px',
                border: '1.5px solid var(--cp-line)',
                backgroundColor: 'var(--cp-white)',
                padding: '0 12px',
                textTransform: 'uppercase',
                fontSize: '14px',
              }}
            />
            <div style={{ fontSize: '12px', lineHeight: '16px', color: 'var(--cp-soft)', marginTop: '4px' }}>
              {modo === 'UNICO_COMPROBANTE'
                ? `Cada comprobante le agrega 6 letras y números al azar: ${codigoBase ? codigoBase.toUpperCase() : 'DUO20'}-K7M2QX.`
                : 'Los clientes escribirán este código en la carta virtual o en caja.'}
            </div>
          </div>

          <div style={{ flex: '2 1 240px' }}>
            <label htmlFor="cp-d" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
              Descripción
            </label>
            <input
              id="cp-d"
              type="text"
              value={descripcion}
              onChange={(e) => {
                setDescripcion(e.target.value);
                setMensajeError('');
              }}
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
        </div>

        {/* Tipo descuento, valor, compra mínima */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontWeight: 700, marginBottom: '4px' }}>Tipo de descuento</div>
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
              <button
                type="button"
                onClick={() => {
                  setTipo('envio');
                  setMensajeError('');
                }}
                style={{
                  minHeight: '44px',
                  padding: '0 12px',
                  borderRadius: '9999px',
                  border: '1.5px solid var(--cp-navy)',
                  backgroundColor: tipo === 'envio' ? 'var(--cp-navy)' : 'transparent',
                  color: tipo === 'envio' ? 'var(--cp-cream)' : 'var(--cp-navy)',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Envío gratis
              </button>
            </div>
          </div>

          {tipo !== 'envio' && (
          <div style={{ flex: '1 1 100px' }}>
            <label htmlFor="cp-v" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
              Valor
            </label>
            <input
              id="cp-v"
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
                borderRadius: '12px',
                border: '1.5px solid var(--cp-line)',
                backgroundColor: 'var(--cp-white)',
                padding: '0 12px',
                fontSize: '14px',
              }}
            />
          </div>
          )}

          <div style={{ flex: '1 1 100px' }}>
            <label htmlFor="cp-m" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
              Compra mínima (s/)
            </label>
            <input
              id="cp-m"
              type="text"
              value={minima}
              onChange={(e) => setMinima(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                minHeight: '44px',
                borderRadius: '12px',
                border: '1.5px solid var(--cp-line)',
                backgroundColor: 'var(--cp-white)',
                padding: '0 12px',
                fontSize: '14px',
              }}
            />
          </div>
        </div>

        {/* Horario opcional del cupón (vacío = todo el tiempo) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontWeight: 700 }}>Días (si no eliges ninguno, todos los días)</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {DIAS.map(([codigo, etiqueta]) => {
              const on = dias.includes(codigo);
              return (
                <button
                  key={codigo}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setDias((prev) => (on ? prev.filter((d) => d !== codigo) : [...prev, codigo]))}
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
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <label style={{ flex: '1 1 150px', display: 'flex', flexDirection: 'column', gap: '4px', fontWeight: 700 }}>
              Desde las (vacío = todo el día)
              <input type="time" value={horaDesde} onChange={(e) => setHoraDesde(e.target.value)} style={{ minHeight: '44px', borderRadius: '12px', border: '1.5px solid var(--cp-line)', padding: '0 12px' }} />
            </label>
            <label style={{ flex: '1 1 150px', display: 'flex', flexDirection: 'column', gap: '4px', fontWeight: 700 }}>
              Hasta las (no incluye esa hora)
              <input type="time" value={horaHasta} onChange={(e) => setHoraHasta(e.target.value)} style={{ minHeight: '44px', borderRadius: '12px', border: '1.5px solid var(--cp-line)', padding: '0 12px' }} />
            </label>
          </div>
        </div>

        {/* Vigencia y topes */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 150px' }}>
            <label htmlFor="cp-a" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
              Vigente desde
            </label>
            <input
              id="cp-a"
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
                borderRadius: '12px',
                border: '1.5px solid var(--cp-line)',
                backgroundColor: 'var(--cp-white)',
                padding: '0 12px',
                fontSize: '14px',
              }}
            />
          </div>

          <div style={{ flex: '1 1 150px' }}>
            <label htmlFor="cp-h" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
              Hasta
            </label>
            <input
              id="cp-h"
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
                borderRadius: '12px',
                border: '1.5px solid var(--cp-line)',
                backgroundColor: 'var(--cp-white)',
                padding: '0 12px',
                fontSize: '14px',
              }}
            />
          </div>

          {modo === 'COMPARTIDO' && (
            <>
              <div style={{ flex: '1 1 120px' }}>
                <label htmlFor="cp-x" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  Tope de usos (en total)
                </label>
                <input
                  id="cp-x"
                  type="text"
                  value={maxUsos}
                  onChange={(e) => setMaxUsos(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    minHeight: '44px',
                    borderRadius: '12px',
                    border: '1.5px solid var(--cp-line)',
                    backgroundColor: 'var(--cp-white)',
                    padding: '0 12px',
                    fontSize: '14px',
                  }}
                />
              </div>

              <div style={{ flex: '1 1 120px' }}>
                <label htmlFor="cp-p" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  Por cliente (con cuenta)
                </label>
                <input
                  id="cp-p"
                  type="text"
                  value={porCliente}
                  onChange={(e) => setPorCliente(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    minHeight: '44px',
                    borderRadius: '12px',
                    border: '1.5px solid var(--cp-line)',
                    backgroundColor: 'var(--cp-white)',
                    padding: '0 12px',
                    fontSize: '14px',
                  }}
                />
              </div>
            </>
          )}
        </div>

        {/* Aplica a */}
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
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
              {categoriasDisponibles.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setCategoria(cat);
                    setMensajeError('');
                  }}
                  style={{
                    minHeight: '38px',
                    padding: '0 10px',
                    borderRadius: '10px',
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
                      <label htmlFor="cp-search-prod" style={{ position: 'absolute', left: '-9999px' }}>
                        Buscar producto
                      </label>
                      <input
                        id="cp-search-prod"
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

        {/* Sección comprobante o compartido */}
        <div
          style={{
            border: '1.5px dashed var(--cp-navy)',
            borderRadius: '12px',
            padding: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {modo === 'COMPARTIDO' ? (
            <div style={{ fontSize: '13px', lineHeight: '19px' }}>
              Este cupón <b>no se imprime</b> en el comprobante: tú lo repartes en afiches, volantes o redes y el cliente
              escribe el código en la carta. Se acaba cuando llega al tope de usos.
            </div>
          ) : (
            <>
              <div style={{ fontWeight: 700 }}>Cómo sale en el comprobante</div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ flex: '2 1 200px' }}>
                  <label htmlFor="cp-ti" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    Frase de arriba
                  </label>
                  <input
                    id="cp-ti"
                    type="text"
                    value={tituloImpreso}
                    onChange={(e) => setTituloImpreso(e.target.value)}
                    placeholder="En tu siguiente compra"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      minHeight: '48px',
                      borderRadius: '12px',
                      border: '1.5px solid var(--cp-line)',
                      backgroundColor: 'var(--cp-white)',
                      padding: '0 12px',
                    }}
                  />
                </div>
                <div style={{ flex: '1 1 120px' }}>
                  <label htmlFor="cp-va" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    Vale (días)
                  </label>
                  <input
                    id="cp-va"
                    type="text"
                    value={validezDias}
                    onChange={(e) => setValidezDias(e.target.value)}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      minHeight: '48px',
                      borderRadius: '12px',
                      border: '1.5px solid var(--cp-line)',
                      backgroundColor: 'var(--cp-white)',
                      padding: '0 12px',
                    }}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Dónde aplica */}
        <SelectorCanales id="cupon-canal" tipo="CUPON" valor={canales} onChange={setCanales} />

        {/* Requiere cuenta */}
        <div>
          <div style={{ fontWeight: 700, marginBottom: '4px' }}>Requiere que el cliente pida con su cuenta</div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              onClick={() => setRequiereCuenta(false)}
              style={{
                minHeight: '44px',
                padding: '0 16px',
                borderRadius: '9999px',
                border: '1.5px solid var(--cp-navy)',
                backgroundColor: !requiereCuenta ? 'var(--cp-navy)' : 'transparent',
                color: !requiereCuenta ? 'var(--cp-cream)' : 'var(--cp-navy)',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              No
            </button>
            <button
              type="button"
              onClick={() => setRequiereCuenta(true)}
              style={{
                minHeight: '44px',
                padding: '0 16px',
                borderRadius: '9999px',
                border: '1.5px solid var(--cp-navy)',
                backgroundColor: requiereCuenta ? 'var(--cp-navy)' : 'transparent',
                color: requiereCuenta ? 'var(--cp-cream)' : 'var(--cp-navy)',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Sí
            </button>
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
            {guardando ? 'Guardando...' : 'Guardar cupón'}
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
      </div>
    </div>
  );
}
