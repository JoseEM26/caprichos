import { useEffect, useState } from 'react';
import { ModalConPestanas } from '../../comun/ModalConPestanas';
import { AvisoErrorOferta, ConfirmarSalir, PieOferta, primeraConError, useCambiosSinGuardar, useCierreConConfirmacion } from './modalOfertaComun';
import { OfertaItem } from './ofertasApi';
import { CanalesEstado, ERROR_SIN_CANALES, SelectorCanales, SelectorVisibleCarta, canalesDesdeEstado, canalesPorDefecto, errorModalidades, estadoDesdeOferta, modalidadesDesdeEstado } from './canalesPromo';

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
  const [pestana, setPestana] = useState('datos');
  const [verErrores, setVerErrores] = useState(false);
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
    setPestana('datos');
    setVerErrores(false);
    if (ofertaAEditar) {
      setNombre(ofertaAEditar.nombre || '');
      setDias((ofertaAEditar.dias || []).map((d) => DIAS[(d - 1 + 7) % 7]?.[0] || 'lun'));
      setHoraDesde(ofertaAEditar.horaDesde || '');
      setHoraHasta(ofertaAEditar.horaHasta || '');
      setFechaDesde(ofertaAEditar.fechaDesde ? ofertaAEditar.fechaDesde.slice(0, 10) : '');
      setFechaHasta(ofertaAEditar.fechaHasta ? ofertaAEditar.fechaHasta.slice(0, 10) : '');
      setCanales(estadoDesdeOferta(ofertaAEditar));
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

  const minimaNum = parseFloat(compraMinima.replace(',', '.'));
  const errorDatos = (): string | null => {
    if (!nombre.trim()) return 'Escribe el nombre de la promoción, por ejemplo «Delivery gratis de 2 a 6 pm».';
    if (compraMinima.trim() && (isNaN(minimaNum) || minimaNum < 0)) return 'La compra mínima debe ser un monto mayor o igual a 0, o déjala vacía.';
    return null;
  };
  const errorCuando = (): string | null => {
    if (horaDesde && horaHasta && horaDesde >= horaHasta) return 'La hora de fin debe ser después de la hora de inicio.';
    if (fechaDesde && fechaHasta && fechaDesde > fechaHasta) return 'La fecha de inicio no puede ser después de la final.';
    if (!canales.carta && !canales.local && !canales.bot) return ERROR_SIN_CANALES;
    { const errMod = errorModalidades('ENVIO_GRATIS', canales); if (errMod) return errMod; }
    return null;
  };
  const erroresPestanas = [
    { id: 'datos', error: errorDatos() },
    { id: 'cuando', error: errorCuando() },
  ];
  const marca = (id: string) => {
    const hay = verErrores && !!erroresPestanas.find((e) => e.id === id)?.error;
    return hay ? { insignia: '!', insigniaError: true } : {};
  };
  const firma = JSON.stringify([nombre, dias, horaDesde, horaHasta, fechaDesde, fechaHasta, canales, compraMinima, limiteUsos, orden, visibleCarta]);
  const sucio = useCambiosSinGuardar(abierto, firma);
  const { cerrar, confirmando, setConfirmando } = useCierreConConfirmacion(sucio, onCerrar);

  if (!abierto) return null;

  const alternarDia = (codigo: string) => {
    setDias((prev) => (prev.includes(codigo) ? prev.filter((d) => d !== codigo) : [...prev, codigo]));
  };

  // Guardar: si hay un error, salta a la primera pestaña con error y lo muestra.
  const guardar = async () => {
    setVerErrores(true);
    const e = primeraConError(erroresPestanas);
    if (e) {
      setPestana(e.id);
      setMensajeError(e.error as string);
      return;
    }
    const minima = minimaNum;
    const diasNum = dias.map((code) => DIAS.findIndex((x) => x[0] === code) + 1);

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
        modalidades: modalidadesDesdeEstado(canales.modalidades),
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
    <>
      <ModalConPestanas
        titulo={titulo}
        subtitulo="El delivery no cobra envío dentro del horario, días y fechas que elijas. No descuenta productos."
        alCerrar={cerrar}
        bloquearCierre={guardando || confirmando}
        pestanaActiva={pestana}
        alCambiarPestana={setPestana}
        ancho={600}
        bajoPestanas={<AvisoErrorOferta mensaje={mensajeError} />}
        pie={<PieOferta sucio={sucio} alCancelar={cerrar} alGuardar={guardar} guardando={guardando} textoGuardar="Guardar" />}
        pestanas={[
          { id: 'datos', etiqueta: 'Datos', ...marca('datos'), contenido: (
            <>
            <label style={campo}>
              Nombre de la promoción
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} style={input} maxLength={120} placeholder="Delivery gratis de 2 a 6 pm" />
            </label>
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
            </>
          ) },
          { id: 'cuando', etiqueta: 'Cuándo y dónde', ...marca('cuando'), contenido: (
            <>
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
            </>
          ) },
        ]}
      />
      <ConfirmarSalir abierto={confirmando} alSalir={() => { setConfirmando(false); onCerrar(); }} alQuedarse={() => setConfirmando(false)} />
    </>
  );
}
