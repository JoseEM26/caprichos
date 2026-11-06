import { useState, useEffect, useMemo, type CSSProperties } from 'react';
import {
  ofertasApi,
  OfertaItem,
  CuponItem,
  CuponEmitidoItem,
  ReglasAcumulacionItem,
} from './ofertasApi';
import { ModalArmarOferta } from './ModalArmarOferta';
import { ModalCombo } from './ModalCombo';
import { ModalLlevaPaga } from './ModalLlevaPaga';
import { ModalDescuento } from './ModalDescuento';
import { ModalEnvioGratis } from './ModalEnvioGratis';
import { ModalCupon } from './ModalCupon';
import { ModalHistorialCupones, HistorialMovimiento } from './ModalHistorialCupones';
import { ModalConfirmacion } from './ModalConfirmacion';
import { Confirmar } from '../../comun/Confirmar';
import { ModalPrevisualizacionCarta } from './ModalPrevisualizacionCarta';
import { api } from '../../comun/api';
import { BarraFiltros, FiltroCombo } from '../../comun/FiltroCombo';

const NOMBRES_DIAS_CORTO: Record<number, string> = {
  1: 'Lun',
  2: 'Mar',
  3: 'Mié',
  4: 'Jue',
  5: 'Vie',
  6: 'Sáb',
  7: 'Dom',
};

function getAhoraLima(): { diaSemana: number; isoFecha: string; minutos: number } {
  const now = new Date();
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = dtf.formatToParts(now);
  const partMap: Record<string, string> = {};
  for (const p of parts) partMap[p.type] = p.value;
  const isoFecha = `${partMap.year}-${partMap.month}-${partMap.day}`;
  const h = parseInt(partMap.hour || '0', 10);
  const m = parseInt(partMap.minute || '0', 10);
  const minutos = h * 60 + m;

  const dtfDay = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Lima',
    weekday: 'short',
  });
  const weekdayStr = dtfDay.format(now);
  const mapaDias: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  const diaSemana = mapaDias[weekdayStr] || 1;

  return { diaSemana, isoFecha, minutos };
}

function calcularVigenciaOferta(
  o: {
    activo: boolean;
    dias?: number[] | null;
    diasSemana?: number[] | null;
    horaDesde?: string | null;
    horaHasta?: string | null;
    horaInicio?: string | null;
    horaFin?: string | null;
    fechaDesde?: string | null;
    fechaHasta?: string | null;
    fechaInicio?: string | null;
    fechaFin?: string | null;
  },
  tipo: 'PROMO' | 'DESCUENTO',
): { texto: string; ok: boolean } {
  if (!o.activo) {
    return { texto: tipo === 'PROMO' ? 'Desactivada' : 'Desactivado', ok: false };
  }

  const { diaSemana, isoFecha, minutos } = getAhoraLima();

  const fDesde = (o.fechaDesde || o.fechaInicio || '').slice(0, 10);
  const fHasta = (o.fechaHasta || o.fechaFin || '').slice(0, 10);

  if (fDesde && isoFecha < fDesde) {
    return { texto: 'Programada', ok: false };
  }
  if (fHasta && isoFecha > fHasta) {
    return { texto: 'Vencida', ok: false };
  }

  const dias = o.dias || o.diasSemana;
  if (dias && dias.length > 0 && dias.length < 7) {
    if (!dias.includes(diaSemana)) {
      return { texto: 'Hoy no aplica', ok: false };
    }
  }

  const hDesdeStr = o.horaDesde || o.horaInicio;
  const hHastaStr = o.horaHasta || o.horaFin;
  if (hDesdeStr && hHastaStr) {
    const parseMin = (s: string) => {
      const p = s.split(':');
      return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
    };
    const minDesde = parseMin(hDesdeStr);
    const minHasta = parseMin(hHastaStr);
    if (minutos < minDesde || minutos >= minHasta) {
      return { texto: 'Fuera de horario', ok: false };
    }
  }

  return { texto: 'Vigente ahora', ok: true };
}

const botonVisibilidadCarta: CSSProperties = {
  width: '100%',
  minHeight: '34px',
  border: '1.5px dashed var(--cp-navy)',
  borderRadius: '10px',
  backgroundColor: 'transparent',
  color: 'var(--cp-navy)',
  fontWeight: 700,
  fontSize: '12px',
  cursor: 'pointer',
};

/** Qué se ve en la carta de una oferta desactivada (visible_carta). */
function etiquetaDesactivada(o: OfertaItem): string {
  return o.visibleCarta === false ? 'Desactivada · oculta en la carta' : 'Desactivada · se ve como No disponible';
}

function formatearHora12(hStr?: string | null): string {
  if (!hStr) return '';
  const parts = hStr.split(':');
  let h = parseInt(parts[0], 10);
  const m = parts[1] || '00';
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return m === '00' ? `${h} ${ampm}` : `${h}:${m} ${ampm}`;
}

function formatearHorarioOferta(o: {
  dias?: number[] | null;
  diasSemana?: number[] | null;
  horaDesde?: string | null;
  horaHasta?: string | null;
  horaInicio?: string | null;
  horaFin?: string | null;
  fechaDesde?: string | null;
  fechaHasta?: string | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  canales?: string[] | null;
}): string {
  const dias = o.dias || o.diasSemana;
  const diasTxt =
    dias && dias.length > 0 && dias.length < 7
      ? dias.map((d) => NOMBRES_DIAS_CORTO[d] || '').filter(Boolean).join(' ')
      : 'Todos los días';

  const hDesde = o.horaDesde || o.horaInicio;
  const hHasta = o.horaHasta || o.horaFin;
  const horasTxt =
    hDesde && hHasta
      ? `${formatearHora12(hDesde)} a ${formatearHora12(hHasta)}`
      : 'todo el día';

  const fDesdeRaw = o.fechaDesde || o.fechaInicio;
  const fHastaRaw = o.fechaHasta || o.fechaFin;
  const fDesde = fDesdeRaw ? `${fDesdeRaw.slice(8, 10)}/${fDesdeRaw.slice(5, 7)}` : '';
  const fHasta = fHastaRaw ? `${fHastaRaw.slice(8, 10)}/${fHastaRaw.slice(5, 7)}` : '';
  const fechasTxt =
    fDesde || fHasta
      ? ` · ${fDesde ? `desde ${fDesde}` : ''}${fHasta ? ` hasta ${fHasta}` : ''}`
      : '';

  let canalesTxt = 'Todos los canales';
  if (o.canales && o.canales.length > 0 && !o.canales.includes('TODOS')) {
    if (o.canales.length === 1) {
      const c = o.canales[0].toUpperCase();
      if (c === 'CARTA' || c === 'WEB') canalesTxt = 'Carta web';
      else if (c === 'ADMIN' || c === 'CAJA' || c === 'LOCAL') canalesTxt = 'En el local';
      else if (c === 'BOT' || c === 'WHATSAPP') canalesTxt = 'WhatsApp';
    }
  }

  return `${diasTxt} · ${horasTxt}${fechasTxt} · ${canalesTxt}`;
}

function generarPastillasPartes(
  pr: OfertaItem,
  categorias: Array<{ id: string; nombre: string; productos: any[] }>,
  productos: Array<{ id: string; nombre: string }>,
): string[] {
  if (pr.tipo === 'LLEVA_PAGA') {
    const prod = pr.alcanceProductoId
      ? productos.find((p) => p.id === String(pr.alcanceProductoId))
      : null;
    const prodNombre = prod ? prod.nombre : pr.productoNombre || pr.nombre.replace(/^2x1\s+/i, '');
    const cant = pr.lleva || 2;
    return [`${cant} × ${prodNombre.toUpperCase()}`];
  }

  const partes = pr.combosParte || pr.combosPartes || [];
  if (!partes || partes.length === 0) {
    return [];
  }

  return partes.map((cp: any) => {
    const tipo = cp.tipo || cp.tipoParte;
    const cant = cp.cantidad || 1;

    if (tipo === 'FIJO') {
      const prodId =
        cp.productos && cp.productos[0]
          ? String(typeof cp.productos[0] === 'object' ? cp.productos[0].id || cp.productos[0].productoId : cp.productos[0])
          : null;
      const prod = prodId ? productos.find((p) => p.id === prodId) : null;
      const prodNombre = prod ? prod.nombre : cp.nombre || 'Producto';
      const nAlt = (cp.alternativas || []).length;
      const sufijo = nAlt > 0 ? ` (o ${nAlt} ${nAlt === 1 ? 'alternativa' : 'alternativas'})` : '';
      return `${cant} × ${prodNombre.toUpperCase()}${sufijo}`;
    }

    if (tipo === 'A_ELECCION') {
      const catIds = (cp.categorias || []).map((c: any) =>
        String(typeof c === 'object' ? c.id || c.categoriaId : c),
      );
      const matchedCats = categorias.filter((c) => catIds.includes(c.id));
      const esBebidas =
        matchedCats.length > 0 &&
        matchedCats.every((c) =>
          ['FRAPPES', 'ICED', 'FROZEN', 'CALIENTES', 'BEBIDAS'].includes(c.nombre.toUpperCase()),
        );

      let label = 'producto';
      if (esBebidas) {
        label = 'bebida';
      } else if (matchedCats.length === 1) {
        const nom = matchedCats[0].nombre.toLowerCase();
        label = nom.endsWith('s') ? nom.slice(0, -1) : nom;
      } else if (matchedCats.length > 1) {
        label = 'opción';
      }

      let numOpciones = 0;
      matchedCats.forEach((c) => {
        numOpciones += (c.productos || []).length;
      });
      if (cp.productos && Array.isArray(cp.productos)) {
        numOpciones += cp.productos.length;
      }

      if (numOpciones > 0) {
        return `${cant} × ${label} a elección (${numOpciones} opciones)`;
      }
      return `${cant} × ${label} a elección`;
    }

    if (tipo === 'UNA_DE' || tipo === 'OPCIONES') {
      const prodsList = cp.productos || cp.opciones || [];
      const numAlts = prodsList.length;
      const nom = cp.nombre ? cp.nombre.toLowerCase() : 'complemento';
      return `${cant} × ${nom} a elegir entre ${numAlts}`;
    }

    return `${cant} × ${cp.nombre || 'parte'}`;
  });
}

export function OfertasAdminView() {
  const [tabActual, setTabActual] = useState<'promos' | 'descuentos' | 'cupones' | 'reglas'>('promos');

  // Datos
  const [ofertas, setOfertas] = useState<OfertaItem[]>([]);
  const [cupones, setCupones] = useState<CuponItem[]>([]);
  const [cuponesEmitidos, setCuponesEmitidos] = useState<CuponEmitidoItem[]>([]);
  const [reglas, setReglas] = useState<ReglasAcumulacionItem>({
    id: 1,
    cuponConDescuento: false,
    promoConDescuento: false,
    cuponesPorComprobante: 2,
    diasValidezCupon: 15,
    textoPie: 'Cupón no acumulable con otras promociones. Uno por compra.',
  });
  const [reglasOriginales, setReglasOriginales] = useState<ReglasAcumulacionItem | null>(null);

  // Catálogo para autocompletar y partes
  const [categorias, setCategorias] = useState<Array<{ id: string; nombre: string; productos: any[] }>>([]);
  const [productos, setProductos] = useState<Array<{ id: string; nombre: string; categoriaId?: string; categoria?: string; precio?: number; noSumaBeneficios?: boolean; tamanos?: Array<{ id: string; nombre: string; precio?: number }> }>>([]);
  const [, setCargando] = useState(false);

  // Estados de ayuda y modales
  const [ayudaAbierta, setAyudaAbierta] = useState(false);
  const [modalArmarOfertaAbierto, setModalArmarOfertaAbierto] = useState(false);
  const [modalComboAbierto, setModalComboAbierto] = useState(false);
  const [comboAEditar, setComboAEditar] = useState<OfertaItem | null>(null);

  const [modalLlevaPagaAbierto, setModalLlevaPagaAbierto] = useState(false);
  const [llevaPagaAEditar, setLlevaPagaAEditar] = useState<OfertaItem | null>(null);

  const [modalDescuentoAbierto, setModalDescuentoAbierto] = useState(false);
  const [modalEnvioAbierto, setModalEnvioAbierto] = useState(false);
  const [envioAEditar, setEnvioAEditar] = useState<OfertaItem | null>(null);
  const [descuentoAEditar, setDescuentoAEditar] = useState<OfertaItem | null>(null);

  const [modalCuponAbierto, setModalCuponAbierto] = useState(false);
  const [cuponAEditar, setCuponAEditar] = useState<CuponItem | null>(null);

  const [cuponesEmitidosAbierto, setCuponesEmitidosAbierto] = useState(false);
  const [filtroEstadoEmitidos, setFiltroEstadoEmitidos] = useState('Todos');
  const [busquedaEmitidos, setBusquedaEmitidos] = useState('');

  const [modalHistorialAbierto, setModalHistorialAbierto] = useState(false);

  // Modal para ver cómo se ve en la carta
  const [modalPreviewAbierto, setModalPreviewAbierto] = useState(false);
  const [ofertaParaPreview, setOfertaParaPreview] = useState<OfertaItem | null>(null);

  // Desactivar una promo/descuento: pregunta cómo se ve en la carta mientras esté desactivada
  const [desactivarOferta, setDesactivarOferta] = useState<{ oferta: OfertaItem; visibleCarta: boolean } | null>(null);

  // Modal confirmación
  const [confirmacion, setConfirmacion] = useState<{
    abierto: boolean;
    titulo: string;
    mensaje: string;
    onConfirmar: () => void;
  }>({
    abierto: false,
    titulo: '',
    mensaje: '',
    onConfirmar: () => {},
  });

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const [listaOf, listaCp, rgl, emitidos] = await Promise.all([
        ofertasApi.listarOfertas().catch(() => []),
        ofertasApi.listarCupones().catch(() => []),
        ofertasApi.obtenerReglas().catch(() => ({
          id: 1,
          cuponConDescuento: false,
          promoConDescuento: false,
          cuponesPorComprobante: 2,
          diasValidezCupon: 15,
          textoPie: 'Cupón no acumulable con otras promociones. Uno por compra.',
        })),
        ofertasApi.listarCuponesEmitidos().catch(() => []),
      ]);

      setOfertas(listaOf);
      setCupones(listaCp);
      setReglas(rgl);
      setReglasOriginales(JSON.parse(JSON.stringify(rgl)));
      setCuponesEmitidos(emitidos);

      // Cargar categorías y productos del catálogo
      try {
        const catRes = await api.get<any[]>('/carta');
        if (Array.isArray(catRes)) {
          const prods: any[] = [];
          const cats: Array<{ id: string; nombre: string; productos: any[] }> = [];
          catRes.forEach((c) => {
            cats.push({ id: String(c.id), nombre: c.nombre, productos: c.productos || [] });
            (c.productos || []).forEach((p: any) => {
              prods.push({
                id: String(p.id),
                nombre: p.nombre,
                categoriaId: String(c.id),
                categoria: c.nombre,
                precio: p.precio,
                noSumaBeneficios: Boolean(p.noSumaBeneficios),
                tamanos: (p.tamanos || []).map((t: any) => ({ id: String(t.id), nombre: t.nombre, precio: t.precio })),
              });
            });
          });
          setCategorias(cats);
          setProductos(prods);
        }
      } catch {
        // Ignora si no carga carta
      }
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  // Filtros de ofertas
  const promociones = useMemo(
    () => ofertas.filter((o) => o.tipo === 'COMBO' || o.tipo === 'LLEVA_PAGA'),
    [ofertas],
  );

  // Los combos tienen precio propio: no se descuentan ni entran a 2x1; se gestionan solo en Ofertas.
  const productosConDescuento = useMemo(() => {
    const deCombo = new Set(
      ofertas.filter((o) => o.tipo === 'COMBO' && o.alcanceProductoId).map((o) => String(o.alcanceProductoId)),
    );
    return productos.filter((p) => !p.noSumaBeneficios && !deCombo.has(p.id));
  }, [productos, ofertas]);

  // Las promos de envío gratis viven en esta pestaña: se aplican solas, sin código, como los descuentos
  const descuentos = useMemo(
    () => ofertas.filter((o) => o.tipo === 'DESCUENTO' || o.tipo === 'DESCUENTO_AUTOMATICO' || o.tipo === 'ENVIO_GRATIS'),
    [ofertas],
  );

  // Guardar reglas
  const hayCambiosReglas =
    reglasOriginales &&
    (reglas.cuponConDescuento !== reglasOriginales.cuponConDescuento ||
      reglas.cuponesPorComprobante !== reglasOriginales.cuponesPorComprobante ||
      (reglas.diasValidezCupon || 15) !== (reglasOriginales.diasValidezCupon || 15) ||
      reglas.textoPie !== reglasOriginales.textoPie);

  const guardarReglas = () => {
    setConfirmacion({
      abierto: true,
      titulo: '¿Guardar las reglas de ofertas y descuentos?',
      mensaje: 'La carta y los comprobantes usarán estas reglas desde ahora.',
      onConfirmar: async () => {
        try {
          const actualizada = await ofertasApi.actualizarReglas(reglas);
          setReglas(actualizada);
          setReglasOriginales(JSON.parse(JSON.stringify(actualizada)));
        } catch {
          // Ignorar o error
        } finally {
          setConfirmacion((prev) => ({ ...prev, abierto: false }));
        }
      },
    });
  };

  const descartarReglas = () => {
    setConfirmacion({
      abierto: true,
      titulo: '¿Descartar los cambios?',
      mensaje: 'Vuelven las últimas reglas guardadas.',
      onConfirmar: () => {
        if (reglasOriginales) {
          setReglas(JSON.parse(JSON.stringify(reglasOriginales)));
        }
        setConfirmacion((prev) => ({ ...prev, abierto: false }));
      },
    });
  };

  // Alternar estado de oferta. Al desactivar se pregunta cómo se ve en la carta (ver Desactivar abajo).
  const pedirCambioEstadoOferta = (oferta: OfertaItem) => {
    if (oferta.activo) {
      setDesactivarOferta({ oferta, visibleCarta: false });
      return;
    }
    setConfirmacion({
      abierto: true,
      titulo: `¿Activar "${oferta.nombre}"?`,
      mensaje:
        oferta.visibleCarta === false
          ? 'Volverá a ofrecerse, pero seguirá oculta en la carta porque la dejaste oculta. Para mostrarla, cámbialo en el Diseñador de la carta.'
          : 'Volverá a ofrecerse en la carta cuando le toque.',
      onConfirmar: async () => {
        try {
          await ofertasApi.cambiarEstadoOferta(oferta.id, true);
          setOfertas((prev) => prev.map((o) => (o.id === oferta.id ? { ...o, activo: true } : o)));
        } finally {
          setConfirmacion((prev) => ({ ...prev, abierto: false }));
        }
      },
    });
  };

  const confirmarDesactivarOferta = async () => {
    if (!desactivarOferta) return;
    const { oferta, visibleCarta } = desactivarOferta;
    try {
      await ofertasApi.cambiarEstadoOferta(oferta.id, false, visibleCarta);
      setOfertas((prev) => prev.map((o) => (o.id === oferta.id ? { ...o, activo: false, visibleCarta } : o)));
    } finally {
      setDesactivarOferta(null);
    }
  };

  // Interruptor de una oferta ya desactivada: oculta <-> «No disponible» sin editarla entera
  const cambiarVisibilidadDesactivada = async (oferta: OfertaItem) => {
    const visibleCarta = oferta.visibleCarta === false;
    await ofertasApi.cambiarEstadoOferta(oferta.id, false, visibleCarta);
    setOfertas((prev) => prev.map((o) => (o.id === oferta.id ? { ...o, visibleCarta } : o)));
  };

  // Alternar estado de cupón
  const pedirCambioEstadoCupon = (cupon: CuponItem) => {
    const nuevoEstado = !cupon.activo;
    setConfirmacion({
      abierto: true,
      titulo: `¿${nuevoEstado ? 'Activar' : 'Desactivar'} el cupón "${cupon.codigoBase}"?`,
      mensaje: nuevoEstado
        ? 'Volverá a estar activo y podrá ser canjeado.'
        : 'Dejará de ser aceptado en la carta y no saldrá en nuevos comprobantes.',
      onConfirmar: async () => {
        try {
          await ofertasApi.cambiarEstadoCupon(cupon.id, nuevoEstado);
          setCupones((prev) =>
            prev.map((c) => (c.id === cupon.id ? { ...c, activo: nuevoEstado } : c)),
          );
        } finally {
          setConfirmacion((prev) => ({ ...prev, abierto: false }));
        }
      },
    });
  };

  // Anular cupón emitido
  const pedirAnulacionCuponEmitido = (emitido: CuponEmitidoItem) => {
    setConfirmacion({
      abierto: true,
      titulo: `¿Anular el cupón emitido ${emitido.codigo}?`,
      mensaje: 'El cliente ya no podrá canjearlo. Esta acción queda en el historial.',
      onConfirmar: async () => {
        try {
          await ofertasApi.anularCuponEmitido(emitido.id, 'Anulado manualmente desde administración');
          setCuponesEmitidos((prev) =>
            prev.map((c) => (c.id === emitido.id ? { ...c, estado: 'ANULADO' } : c)),
          );
        } finally {
          setConfirmacion((prev) => ({ ...prev, abierto: false }));
        }
      },
    });
  };

  // Guardar ofertas desde modales
  const guardarOfertaHandler = async (datos: any) => {
    if (comboAEditar) {
      await ofertasApi.actualizarOferta(comboAEditar.id, datos);
    } else if (llevaPagaAEditar) {
      await ofertasApi.actualizarOferta(llevaPagaAEditar.id, datos);
    } else if (descuentoAEditar) {
      await ofertasApi.actualizarOferta(descuentoAEditar.id, datos);
    } else if (envioAEditar) {
      await ofertasApi.actualizarOferta(envioAEditar.id, datos);
    } else {
      await ofertasApi.crearOferta(datos);
    }
    setComboAEditar(null);
    setLlevaPagaAEditar(null);
    setDescuentoAEditar(null);
    setEnvioAEditar(null);
    await cargarDatos();
  };

  // Guardar cupón desde modal
  const guardarCuponHandler = async (datos: any) => {
    if (cuponAEditar) {
      await ofertasApi.actualizarCupon(cuponAEditar.id, datos);
    } else {
      await ofertasApi.crearCupon(datos);
    }
    setCuponAEditar(null);
    await cargarDatos();
  };

  // Resumen comprobante de cupones
  const cuponesImpresosActivos = useMemo(
    () => cupones.filter((c) => c.activo && c.modo === 'UNICO_COMPROBANTE'),
    [cupones],
  );

  const emitidosFiltrados = useMemo(() => {
    return cuponesEmitidos.filter((e) => {
      const matchEstado =
        filtroEstadoEmitidos === 'Todos' ||
        (filtroEstadoEmitidos === 'Vigentes' && e.estado === 'VIGENTE') ||
        (filtroEstadoEmitidos === 'Canjeados' && e.estado === 'CANJEADO') ||
        (filtroEstadoEmitidos === 'Vencidos' && e.estado === 'VENCIDO') ||
        (filtroEstadoEmitidos === 'Anulados' && e.estado === 'ANULADO');

      const matchBusqueda =
        !busquedaEmitidos.trim() ||
        `${e.codigo} ${e.pedidoOrigenCodigo || ''}`
          .toLowerCase()
          .includes(busquedaEmitidos.trim().toLowerCase());

      return matchEstado && matchBusqueda;
    });
  }, [cuponesEmitidos, filtroEstadoEmitidos, busquedaEmitidos]);

  const movimientosHistorial = useMemo(() => {
    const list: HistorialMovimiento[] = [];
    for (const e of cuponesEmitidos) {
      if (e.creadoEn) {
        const d = new Date(e.creadoEn);
        const fechaStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        list.push({
          t: fechaStr,
          who: 'Sistema',
          what: `Emisión de ${e.codigo}${e.pedidoOrigenCodigo ? ` en comprobante de ${e.pedidoOrigenCodigo}` : ''}`,
          tag: 'Emisión',
          bg: '#DDF1E3',
          fg: '#14502B',
        });
      }
      if (e.estado === 'CANJEADO' && e.canjeadoEn) {
        const d = new Date(e.canjeadoEn);
        const fechaStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        list.push({
          t: fechaStr,
          who: 'Sistema',
          what: `Canje de ${e.codigo}${e.pedidoCanjeCodigo ? ` en pedido ${e.pedidoCanjeCodigo}` : ''}`,
          tag: 'Canje',
          bg: '#E8E0F7',
          fg: '#4B2E8A',
        });
      }
      if (e.estado === 'ANULADO' && e.anuladoEn) {
        const d = new Date(e.anuladoEn);
        const fechaStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        list.push({
          t: fechaStr,
          who: 'Admin',
          what: `Anulación de cupón emitido ${e.codigo}${e.motivoAnulacion ? ` (${e.motivoAnulacion})` : ''}`,
          tag: 'Anulación',
          bg: '#FDECE8',
          fg: '#8A2A18',
        });
      }
    }
    for (const c of cupones) {
      if (c.creadoEn) {
        const d = new Date(c.creadoEn);
        const fechaStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        list.push({
          t: fechaStr,
          who: 'Admin',
          what: `Creó cupón ${c.codigoBase}${c.descripcion ? ` (${c.descripcion})` : ''}`,
          tag: 'Creación',
          bg: '#E3EEFB',
          fg: '#1B4B8A',
        });
      }
    }
    return list;
  }, [cuponesEmitidos, cupones]);


  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Pestañas: Promociones · Descuentos · Cupones · Reglas */}
      <div role="tablist" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {[
          { id: 'promos', nombre: 'Promociones', conteo: promociones.length },
          { id: 'descuentos', nombre: 'Descuentos', conteo: descuentos.length },
          { id: 'cupones', nombre: 'Cupones', conteo: cupones.length },
          { id: 'reglas', nombre: 'Reglas', conteo: '' },
        ].map((t) => {
          const on = tabActual === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={on}
              onClick={() => setTabActual(t.id as any)}
              style={{
                minHeight: '44px',
                padding: '0 16px',
                borderRadius: '9999px',
                border: '1.5px solid var(--cp-navy)',
                backgroundColor: on ? 'var(--cp-navy)' : 'transparent',
                color: on ? 'var(--cp-cream)' : 'var(--cp-navy)',
                fontWeight: 800,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              {t.nombre}{' '}
              {t.conteo !== '' && (
                <span style={{ opacity: 0.8, fontWeight: 700 }}>· {t.conteo}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ==================== PESTAÑA: PROMOCIONES ==================== */}
      {tabActual === 'promos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
              Un combo se arma con productos de la carta; al venderlo se descuenta cada producto por separado.
            </span>
            <span style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setAyudaAbierta(!ayudaAbierta)}
                aria-expanded={ayudaAbierta}
                aria-label="Qué diferencia hay entre combo y promoción"
                title="¿Combo o promoción?"
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '22px',
                  border: '1.5px solid var(--cp-navy)',
                  backgroundColor: 'var(--cp-cream)',
                  color: 'var(--cp-navy)',
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 800,
                  fontSize: '18px',
                  cursor: 'pointer',
                }}
              >
                {ayudaAbierta ? '×' : '?'}
              </button>
              <button
                type="button"
                onClick={() => setModalArmarOfertaAbierto(true)}
                style={{
                  minHeight: '44px',
                  padding: '0 18px',
                  border: 0,
                  borderRadius: '12px',
                  backgroundColor: 'var(--cp-orange)',
                  color: 'var(--cp-navy)',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                + Armar oferta
              </button>
            </span>
          </div>

          {/* Panel de Ayuda */}
          {ayudaAbierta && (
            <div
              role="region"
              aria-label="Combo o promoción"
              style={{
                backgroundColor: 'var(--cp-white)',
                border: '2px solid var(--cp-navy)',
                borderRadius: '14px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '16px' }}>
                ¿Qué diferencia hay entre una oferta y otra?
              </div>
              <div style={{ fontSize: '13px', lineHeight: '19px' }}>
                Todas se arman con el botón <b>+ Armar oferta</b> y todas se descuentan producto por producto al vender.
                Cambia lo que se arma:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                <div style={{ backgroundColor: 'var(--cp-cream)', borderRadius: '12px', padding: '12px', fontSize: '13px', lineHeight: '19px' }}>
                  <b>Combo</b>
                  <br />
                  Un <b>paquete con precio propio</b> que el cliente <b>arma eligiendo</b> por partes. Aparece en la carta
                  como un producto más.
                </div>
                <div style={{ backgroundColor: 'var(--cp-cream)', borderRadius: '12px', padding: '12px', fontSize: '13px', lineHeight: '19px' }}>
                  <b>Llevas más, pagas menos</b>
                  <br />
                  Un <b>precio especial por cantidad</b> (2x1, 3x2) sobre productos concretos.
                </div>
                <div style={{ backgroundColor: 'var(--cp-cream)', borderRadius: '12px', padding: '12px', fontSize: '13px', lineHeight: '19px' }}>
                  <b>Descuento</b>
                  <br />
                  Un <b>porcentaje o monto menos</b> que se aplica solo, sin código, en lo que elijas.
                </div>
              </div>
              <div style={{ fontSize: '13px', lineHeight: '19px', color: 'var(--cp-soft)' }}>
                <b>El tiempo es opcional en las tres:</b> días, horas, fechas y canal. Sin marcar nada, valen siempre.
              </div>
            </div>
          )}

          {/* Tarjetas de Promociones */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
            {promociones.map((pr) => {
              const precios = pr.combosPrecio || pr.combosPrecios || [];
              let minPrecio: number | null = null;
              if (precios.length > 0) {
                for (const cp of precios) {
                  const val = Number(cp.precio);
                  if (!isNaN(val) && (minPrecio === null || val < minPrecio)) {
                    minPrecio = val;
                  }
                }
              }
              if (minPrecio === null && pr.descuentoValor) {
                minPrecio = Number(pr.descuentoValor);
              }
              const precioTxt = minPrecio !== null ? `s/ ${Number(minPrecio.toFixed(2))}` : 's/ 0';

              const tipoBadge = pr.tipo === 'COMBO' ? 'Combo' : pr.subtipo || '2x1';
              const vig = calcularVigenciaOferta(pr, 'PROMO');
              const horarioTxt = formatearHorarioOferta(pr);
              const pastillas = generarPastillasPartes(pr, categorias, productos);

              return (
                <div
                  key={pr.id}
                  style={{
                    backgroundColor: 'var(--cp-white)',
                    border: '1px solid var(--cp-line)',
                    borderRadius: '14px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    opacity: pr.activo ? 1 : 0.6,
                  }}
                >
                  {pr.imagenUrl ? (
                    <div
                      style={{
                        width: '100%',
                        height: '140px',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        backgroundColor: 'var(--cp-sand)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <img
                        src={pr.imagenUrl}
                        alt={pr.nombre}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    </div>
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: '140px',
                        borderRadius: '10px',
                        backgroundColor: 'var(--cp-gold)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: 'Montserrat, sans-serif',
                        fontWeight: 800,
                        fontSize: '44px',
                        color: 'var(--cp-navy)',
                      }}
                    >
                      {(pr.nombre.trim()[0] || 'P').toUpperCase()}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'flex-start' }}>
                    <span
                      style={{
                        fontFamily: 'Montserrat, sans-serif',
                        fontWeight: 800,
                        fontSize: '15px',
                        lineHeight: '19px',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {pr.nombre}
                    </span>
                    <span
                      style={{
                        flex: 'none',
                        fontSize: '12px',
                        fontWeight: 700,
                        borderRadius: '9999px',
                        padding: '3px 9px',
                        backgroundColor: 'var(--cp-sand)',
                        color: 'var(--cp-navy)',
                      }}
                    >
                      {pr.activo ? 'Activa' : etiquetaDesactivada(pr)}
                    </span>
                  </div>
                  {pr.tipo === 'COMBO' && pr.disponible === false && (
                    <span
                      data-testid="insignia-agotado-auto"
                      style={{
                        alignSelf: 'flex-start',
                        fontSize: '12px',
                        fontWeight: 700,
                        borderRadius: '9999px',
                        padding: '3px 9px',
                        backgroundColor: 'var(--cp-rust)',
                        color: 'var(--cp-white)',
                      }}
                    >
                      Agotado automáticamente{pr.motivoAgotado ? `: ${pr.motivoAgotado.replace(/^Falta /, 'falta ')}` : ''}
                    </span>
                  )}

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontFamily: 'Montserrat, sans-serif',
                        fontWeight: 800,
                        fontSize: '20px',
                        color: 'var(--cp-rust)',
                      }}
                    >
                      {precioTxt}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>{tipoBadge}</span>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        borderRadius: '9999px',
                        padding: '2px 9px',
                        backgroundColor: 'var(--cp-sand)',
                        color: 'var(--cp-navy)',
                      }}
                    >
                      {vig.texto}
                    </span>
                  </div>

                  <div style={{ fontSize: '12px', lineHeight: '16px', color: 'var(--cp-soft)' }}>
                    {horarioTxt}
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {pastillas.map((pill, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: '12px',
                          lineHeight: '16px',
                          border: '1px solid var(--cp-line)',
                          borderRadius: '9999px',
                          padding: '3px 10px',
                          backgroundColor: 'var(--cp-cream)',
                        }}
                      >
                        {pill}
                      </span>
                    ))}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: 'auto' }}>
                    {!pr.activo && (
                      <button type="button" onClick={() => cambiarVisibilidadDesactivada(pr)} style={botonVisibilidadCarta}>
                        {pr.visibleCarta === false ? 'Mostrar como No disponible' : 'Ocultar de la carta'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setOfertaParaPreview(pr);
                        setModalPreviewAbierto(true);
                      }}
                      aria-label={`Ver cómo se ve ${pr.nombre} en la carta`}
                      style={{
                        width: '100%',
                        minHeight: '38px',
                        border: '1.5px solid var(--cp-line)',
                        borderRadius: '10px',
                        backgroundColor: 'var(--cp-sand)',
                        color: 'var(--cp-navy)',
                        fontWeight: 700,
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      Ver como se ve en la carta
                    </button>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          if (pr.tipo === 'COMBO') {
                            setComboAEditar(pr);
                            setModalComboAbierto(true);
                          } else {
                            setLlevaPagaAEditar(pr);
                            setModalLlevaPagaAbierto(true);
                          }
                        }}
                        style={{
                          flex: 1,
                          minHeight: '44px',
                          border: '1.5px solid var(--cp-navy)',
                          borderRadius: '10px',
                          backgroundColor: 'transparent',
                          color: 'var(--cp-navy)',
                          fontWeight: 700,
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => pedirCambioEstadoOferta(pr)}
                        style={{
                          flex: 1,
                          minHeight: '44px',
                          border: '1.5px solid var(--cp-navy)',
                          borderRadius: '10px',
                          backgroundColor: 'transparent',
                          color: 'var(--cp-navy)',
                          fontWeight: 700,
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        {pr.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================== PESTAÑA: DESCUENTOS ==================== */}
      {tabActual === 'descuentos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
              Se aplican solos, sin código, en la carta, en Nuevo pedido y en el chatbot, cuando les toca el día y la hora.
            </span>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  setEnvioAEditar(null);
                  setModalEnvioAbierto(true);
                }}
                style={{
                  minHeight: '44px',
                  padding: '0 18px',
                  borderRadius: '12px',
                  border: '1.5px solid var(--cp-navy)',
                  backgroundColor: 'transparent',
                  color: 'var(--cp-navy)',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                + Envío gratis
              </button>
              <button
                type="button"
                onClick={() => {
                  setDescuentoAEditar(null);
                  setModalDescuentoAbierto(true);
                }}
                style={{
                  minHeight: '44px',
                  padding: '0 18px',
                  border: 0,
                  borderRadius: '12px',
                  backgroundColor: 'var(--cp-orange)',
                  color: 'var(--cp-navy)',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                + Nuevo descuento
              </button>
            </div>
          </div>

          {descuentos.length === 0 && (
            <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
              Todavía no hay descuentos automáticos.
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px' }}>
            {descuentos.map((d) => {
              const esEnvio = d.tipo === 'ENVIO_GRATIS';
              const valorBig = esEnvio
                ? 'Envío gratis'
                : d.descuentoTipo === 'PORCENTAJE' ? `${d.descuentoValor} %` : `s/ ${d.descuentoValor}`;
              const aplicaTxt = esEnvio
                ? 'en el delivery, todas las zonas'
                : d.alcanceCategoriaId || d.categoriaNombre
                  ? `en ${d.categoriaNombre || 'Categoría'}`
                  : d.alcanceProductoId || d.productoNombre
                  ? `en ${d.productoNombre || 'Producto'}`
                  : 'en toda la carta';
              const st = calcularVigenciaOferta(d, 'DESCUENTO');
              const horarioTxt = formatearHorarioOferta(d);

              return (
                <div
                  key={d.id}
                  style={{
                    backgroundColor: 'var(--cp-white)',
                    border: '1px solid var(--cp-line)',
                    borderRadius: '14px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    opacity: d.activo ? 1 : 0.6,
                  }}
                >
                  {d.imagenUrl ? (
                    <div
                      style={{
                        width: '100%',
                        height: '140px',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        backgroundColor: 'var(--cp-sand)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <img
                        src={d.imagenUrl}
                        alt={d.nombre}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    </div>
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: '140px',
                        borderRadius: '10px',
                        backgroundColor: 'var(--cp-gold)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: 'Montserrat, sans-serif',
                        fontWeight: 800,
                        fontSize: '44px',
                        color: 'var(--cp-navy)',
                      }}
                    >
                      {(d.nombre.trim()[0] || 'D').toUpperCase()}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'flex-start' }}>
                    <span
                      style={{
                        fontFamily: 'Montserrat, sans-serif',
                        fontWeight: 800,
                        fontSize: '15px',
                        lineHeight: '19px',
                      }}
                    >
                      {d.nombre}
                    </span>
                    <span
                      style={{
                        flex: 'none',
                        fontSize: '12px',
                        fontWeight: 700,
                        borderRadius: '9999px',
                        padding: '3px 9px',
                        backgroundColor: 'var(--cp-sand)',
                        color: 'var(--cp-navy)',
                      }}
                    >
                      {d.activo ? 'Activo' : etiquetaDesactivada(d)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontFamily: 'Montserrat, sans-serif',
                        fontWeight: 800,
                        fontSize: '22px',
                        color: 'var(--cp-rust)',
                      }}
                    >
                      {valorBig}
                    </span>
                    <span style={{ fontSize: '13px' }}>{aplicaTxt}</span>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        borderRadius: '9999px',
                        padding: '2px 9px',
                        backgroundColor: 'var(--cp-sand)',
                        color: 'var(--cp-navy)',
                      }}
                    >
                      {st.texto}
                    </span>
                  </div>

                  <div style={{ fontSize: '12px', lineHeight: '16px', color: 'var(--cp-soft)' }}>
                    {horarioTxt}
                    <br />
                    {Number(d.compraMinima) > 0 ? `Compra mínima s/ ${d.compraMinima}` : 'Sin compra mínima'}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: 'auto' }}>
                    {!d.activo && (
                      <button type="button" onClick={() => cambiarVisibilidadDesactivada(d)} style={botonVisibilidadCarta}>
                        {d.visibleCarta === false ? 'Mostrar como No disponible' : 'Ocultar de la carta'}
                      </button>
                    )}
                    {!esEnvio && (
                    <button
                      type="button"
                      onClick={() => {
                        setOfertaParaPreview(d);
                        setModalPreviewAbierto(true);
                      }}
                      aria-label={`Ver cómo se ve ${d.nombre} en la carta`}
                      style={{
                        width: '100%',
                        minHeight: '38px',
                        border: '1.5px solid var(--cp-line)',
                        borderRadius: '10px',
                        backgroundColor: 'var(--cp-sand)',
                        color: 'var(--cp-navy)',
                        fontWeight: 700,
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      Ver como se ve en la carta
                    </button>
                    )}

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          if (esEnvio) {
                            setEnvioAEditar(d);
                            setModalEnvioAbierto(true);
                            return;
                          }
                          setDescuentoAEditar(d);
                          setModalDescuentoAbierto(true);
                        }}
                        style={{
                          flex: 1,
                          minHeight: '44px',
                          border: '1.5px solid var(--cp-navy)',
                          borderRadius: '10px',
                          backgroundColor: 'transparent',
                          color: 'var(--cp-navy)',
                          fontWeight: 700,
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => pedirCambioEstadoOferta(d)}
                        style={{
                          flex: 1,
                          minHeight: '44px',
                          border: '1.5px solid var(--cp-navy)',
                          borderRadius: '10px',
                          backgroundColor: 'transparent',
                          color: 'var(--cp-navy)',
                          fontWeight: 700,
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        {d.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================== PESTAÑA: CUPONES ==================== */}
      {tabActual === 'cupones' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 12px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => {
                setCuponAEditar(null);
                setModalCuponAbierto(true);
              }}
              style={{
                minHeight: '48px',
                padding: '0 20px',
                border: 0,
                borderRadius: '12px',
                backgroundColor: 'var(--cp-orange)',
                color: 'var(--cp-navy)',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              + Nuevo cupón
            </button>
            <button
              type="button"
              onClick={() => setCuponesEmitidosAbierto(!cuponesEmitidosAbierto)}
              style={{
                minHeight: '48px',
                padding: '0 16px',
                border: '1.5px solid var(--cp-navy)',
                borderRadius: '12px',
                backgroundColor: 'transparent',
                color: 'var(--cp-navy)',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              {cuponesEmitidosAbierto
                ? `Ocultar cupones emitidos (${cuponesEmitidos.length})`
                : `Ver cupones emitidos (${cuponesEmitidos.length})`}
            </button>
            <button
              type="button"
              onClick={() => setModalHistorialAbierto(true)}
              style={{
                minHeight: '48px',
                padding: '0 16px',
                border: '1.5px solid var(--cp-navy)',
                borderRadius: '12px',
                backgroundColor: 'transparent',
                color: 'var(--cp-navy)',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Historial de cambios{movimientosHistorial.length > 0 ? ` (${movimientosHistorial.length})` : ''}
            </button>
          </div>

          {/* KPI Tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
            <div
              style={{
                backgroundColor: 'var(--cp-white)',
                border: '1px solid var(--cp-line)',
                borderRadius: '12px',
                padding: '10px 12px',
              }}
            >
              <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>Cupones activos</div>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '22px' }}>
                {cupones.filter((c) => c.activo).length} de {cupones.length}
              </div>
            </div>
            <div
              style={{
                backgroundColor: 'var(--cp-white)',
                border: '1px solid var(--cp-line)',
                borderRadius: '12px',
                padding: '10px 12px',
              }}
            >
              <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>Emitidos con código</div>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '22px' }}>
                {cuponesEmitidos.length}
              </div>
            </div>
            <div
              style={{
                backgroundColor: 'var(--cp-white)',
                border: '1px solid var(--cp-line)',
                borderRadius: '12px',
                padding: '10px 12px',
              }}
            >
              <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>Canjeados</div>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '22px' }}>
                {cuponesEmitidos.filter((e) => e.estado === 'CANJEADO').length}
              </div>
            </div>
            <div
              style={{
                backgroundColor: 'var(--cp-white)',
                border: '1px solid var(--cp-line)',
                borderRadius: '12px',
                padding: '10px 12px',
              }}
            >
              <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>Vigentes por canjear</div>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '22px' }}>
                {cuponesEmitidos.filter((e) => e.estado === 'VIGENTE').length}
              </div>
            </div>
          </div>

          <div style={{ fontSize: '13px', lineHeight: '19px', color: 'var(--cp-soft)' }}>
            Los cupones impresos llevan un <b>código único y al azar</b> (por ejemplo DUO20-K7M2QX) que no se puede
            adivinar y se canjea <b>una sola vez</b>. El cliente lo escribe en la carta o lo muestra en el local.
          </div>

          {/* Panel inline de cupones emitidos */}
          {cuponesEmitidosAbierto && (
            <div
              style={{
                backgroundColor: 'var(--cp-white)',
                border: '1.5px solid var(--cp-navy)',
                borderRadius: '14px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '15px' }}>
                Cupones emitidos
              </div>
              <BarraFiltros>
                <input
                  type="search"
                  value={busquedaEmitidos}
                  onChange={(e) => setBusquedaEmitidos(e.target.value)}
                  placeholder="Buscar por código o pedido"
                  aria-label="Buscar cupón emitido"
                  style={{
                  flex: '2 1 220px',
                  minWidth: 0,
                  width: '100%',
                    boxSizing: 'border-box',
                    minHeight: '44px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--cp-line)',
                    backgroundColor: 'var(--cp-cream)',
                    padding: '0 12px',
                    fontSize: '14px',
                  }}
                />
                <FiltroCombo
                  etiqueta="Estado"
                  valor={filtroEstadoEmitidos}
                  valorPorDefecto="Todos"
                  opciones={['Todos', 'Vigentes', 'Canjeados', 'Vencidos', 'Anulados'].map((st) => ({ valor: st, etiqueta: st }))}
                  alCambiar={setFiltroEstadoEmitidos}
                />
              </BarraFiltros>

              {emitidosFiltrados.length === 0 && (
                <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
                  No hay cupones emitidos con ese filtro.
                </div>
              )}

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                  gap: '8px',
                }}
              >
                {emitidosFiltrados.map((r) => {
                  const bgBadge =
                    r.estado === 'VIGENTE'
                      ? 'rgb(221, 241, 227)'
                      : r.estado === 'CANJEADO'
                      ? 'var(--cp-sand)'
                      : 'rgb(253, 236, 232)';
                  const fgBadge =
                    r.estado === 'VIGENTE'
                      ? 'rgb(20, 80, 43)'
                      : r.estado === 'CANJEADO'
                      ? 'var(--cp-navy)'
                      : 'rgb(138, 42, 24)';

                  return (
                    <div
                      key={r.id}
                      style={{
                        border: '1px solid var(--cp-line)',
                        borderRadius: '12px',
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: '6px',
                          alignItems: 'center',
                        }}
                      >
                        <span
                          style={{
                            fontFamily: '"Courier New", monospace',
                            fontWeight: 800,
                            fontSize: '14px',
                            overflowWrap: 'anywhere',
                          }}
                        >
                          {r.codigo}
                        </span>
                        <span
                          style={{
                            flex: 'none',
                            fontSize: '11px',
                            fontWeight: 800,
                            borderRadius: '9999px',
                            padding: '2px 9px',
                            backgroundColor: bgBadge,
                            color: fgBadge,
                          }}
                        >
                          {r.estado === 'VIGENTE'
                            ? 'Vigente'
                            : r.estado === 'CANJEADO'
                            ? 'Canjeado'
                            : r.estado === 'VENCIDO'
                            ? 'Vencido'
                            : 'Anulado'}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                        {r.pedidoOrigenCodigo ? `Pedido ${r.pedidoOrigenCodigo} · ` : ''}emitido{' '}
                        {r.creadoEn ? r.creadoEn.slice(5, 10).replace('-', '/') : ''}
                        {r.venceEn ? ` · vence ${r.venceEn.slice(5, 10).replace('-', '/')}` : ''}
                      </div>
                      {r.estado === 'CANJEADO' && r.pedidoCanjeCodigo && (
                        <div style={{ fontSize: '12px', fontWeight: 700 }}>
                          Canjeado en {r.pedidoCanjeCodigo}
                        </div>
                      )}
                      {r.estado === 'VIGENTE' && (
                        <button
                          type="button"
                          onClick={() => pedirAnulacionCuponEmitido(r)}
                          style={{
                            alignSelf: 'flex-start',
                            minHeight: '44px',
                            padding: '0 12px',
                            border: '1.5px solid var(--cp-rust)',
                            borderRadius: '10px',
                            backgroundColor: 'transparent',
                            color: 'var(--cp-rust)',
                            fontWeight: 700,
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                        >
                          Anular
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Cupones tarjetas y Panel comprobante */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'flex-start' }}>
            <div
              style={{
                flex: '2 1 520px',
                minWidth: 0,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                gap: '12px',
              }}
            >
              {cupones.map((c) => {
                const isPrint = c.modo === 'UNICO_COMPROBANTE';
                const emitidosDeEsteCupon = cuponesEmitidos.filter((e) => e.cuponId === c.id);
                const totalEmitidos = emitidosDeEsteCupon.length;
                const totalCanjeados = emitidosDeEsteCupon.filter((e) => e.estado === 'CANJEADO').length;
                const totalVigentes = emitidosDeEsteCupon.filter((e) => e.estado === 'VIGENTE').length;

                const valNum = c.descuentoValor ?? c.valor ?? 0;
                const tipoDesc = c.descuentoTipo ?? c.tipo;
                const valorTxt = tipoDesc === 'PORCENTAJE' ? `${valNum} %` : `s/ ${valNum}`;

                const facts = [
                  valorTxt,
                  c.categoriaId || c.categoriaNombre
                    ? c.categoriaNombre || 'Categoría'
                    : c.productoId || c.productoNombre
                    ? c.productoNombre || 'Producto'
                    : 'Toda la carta',
                  c.fechaHasta ? `hasta ${c.fechaHasta.slice(8, 10)}/${c.fechaHasta.slice(5, 7)}` : 'sin fecha límite',
                  isPrint ? `impreso ${totalEmitidos} ${totalEmitidos === 1 ? 'vez' : 'veces'}` : 'no se imprime',
                ];

                const slotText = isPrint
                  ? `Entra al sorteo del comprobante (salen ${reglas.cuponesPorComprobante} al azar de ${cuponesImpresosActivos.length})`
                  : 'Código compartido · no se imprime (afiches, volantes, redes)';

                const slotBg = isPrint ? 'rgb(221, 241, 227)' : 'var(--cp-sand)';
                const slotFg = isPrint ? 'rgb(20, 80, 43)' : 'var(--cp-navy)';

                const pctUso = c.topeUsos ? Math.round(((c.usosActuales || 0) / c.topeUsos) * 100) : 0;

                return (
                  <div
                    key={c.id}
                    style={{
                      backgroundColor: 'var(--cp-white)',
                      border: '1px solid var(--cp-line)',
                      borderRadius: '14px',
                      padding: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      opacity: c.activo ? 1 : 0.6,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px', alignItems: 'center' }}>
                      <span
                        style={{
                          fontFamily: 'Montserrat, sans-serif',
                          fontWeight: 800,
                          fontSize: '16px',
                          letterSpacing: '0.04em',
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {c.codigoBase}
                      </span>
                      <span
                        style={{
                          flex: 'none',
                          fontSize: '12px',
                          fontWeight: 700,
                          borderRadius: '9999px',
                          padding: '3px 9px',
                          backgroundColor: 'var(--cp-sand)',
                          color: 'var(--cp-navy)',
                        }}
                      >
                        {c.activo ? 'Activo' : 'Desactivado'}
                      </span>
                    </div>

                    <div style={{ fontSize: '13px', lineHeight: '18px' }}>{c.descripcion}</div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {facts.map((f, i) => (
                        <span
                          key={i}
                          style={{
                            fontSize: '12px',
                            fontWeight: 700,
                            border: '1px solid var(--cp-line)',
                            borderRadius: '9999px',
                            padding: '3px 9px',
                            backgroundColor: 'var(--cp-cream)',
                          }}
                        >
                          {f}
                        </span>
                      ))}
                    </div>

                    <div
                      style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        borderRadius: '8px',
                        padding: '6px 8px',
                        backgroundColor: slotBg,
                        color: slotFg,
                      }}
                    >
                      {slotText}
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                      {isPrint
                        ? `Emitidos con código: ${totalEmitidos} · canjeados: ${totalCanjeados} · vigentes: ${totalVigentes}`
                        : c.topeUsos
                        ? `Usos: ${c.usosActuales || 0} de ${c.topeUsos} · quedan ${Math.max(0, c.topeUsos - (c.usosActuales || 0))}`
                        : `Usos: ${c.usosActuales || 0} (sin límite)`}
                    </div>

                    {!isPrint && (
                      <div
                        style={{
                          height: '8px',
                          borderRadius: '9999px',
                          backgroundColor: 'var(--cp-sand)',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${pctUso}%`,
                            backgroundColor: 'var(--cp-orange)',
                          }}
                        />
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '6px', marginTop: 'auto' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setCuponAEditar(c);
                          setModalCuponAbierto(true);
                        }}
                        style={{
                          flex: 1,
                          minHeight: '44px',
                          border: '1.5px solid var(--cp-navy)',
                          borderRadius: '10px',
                          backgroundColor: 'transparent',
                          color: 'var(--cp-navy)',
                          fontWeight: 700,
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => pedirCambioEstadoCupon(c)}
                        style={{
                          flex: 1,
                          minHeight: '44px',
                          border: '1.5px solid var(--cp-navy)',
                          borderRadius: '10px',
                          backgroundColor: 'transparent',
                          color: 'var(--cp-navy)',
                          fontWeight: 700,
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        {c.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Vista previa del comprobante */}
            <div
              style={{
                flex: '1 1 280px',
                maxWidth: '380px',
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.06em', color: 'var(--cp-soft)' }}>
                ASÍ SALE EL COMPROBANTE
              </div>

              <div
                style={{
                  backgroundColor: 'var(--cp-white)',
                  border: '1.5px solid var(--cp-line)',
                  borderRadius: '12px',
                  padding: '12px',
                  fontFamily: '"Courier New", monospace',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  boxShadow: 'rgba(11, 44, 62, 0.08) 0px 6px 16px',
                }}
              >
                <div style={{ textAlign: 'center', fontWeight: 800, fontSize: '14px' }}>CAPRICHOS</div>
                <div style={{ textAlign: 'center', fontSize: '12px' }}>Comprobante de compra (ejemplo)</div>
                <div style={{ borderTop: '1px dashed var(--cp-soft)' }} />

                {cuponesImpresosActivos.length === 0 ? (
                  <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                    Ningún cupón activo está marcado para imprimirse.
                  </div>
                ) : (
                  cuponesImpresosActivos.slice(0, reglas.cuponesPorComprobante || 2).map((p, i) => (
                    <div
                      key={p.id || i}
                      style={{
                        border: '2px dashed var(--cp-navy)',
                        borderRadius: '8px',
                        padding: '8px 10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                      }}
                    >
                      <span style={{ fontSize: '12px', fontWeight: 700 }}>✂ {p.tituloImpreso || 'En tu siguiente compra'}</span>
                      <span style={{ fontSize: '13px', fontWeight: 800, lineHeight: '16px' }}>{p.descripcion}</span>
                      <span style={{ fontSize: '12px' }}>Válido {p.diasValidezImpreso || 15} días desde la compra</span>
                      <span style={{ fontSize: '12px', fontWeight: 700 }}>
                        Código: {p.codigoBase}-XXXXXX
                      </span>
                    </div>
                  ))
                )}

                <div style={{ textAlign: 'center', fontSize: '11px', lineHeight: '15px', color: 'var(--cp-soft)' }}>
                  {reglas.textoPie || 'Cupón no acumulable con otras promociones. Uno por compra.'}
                </div>
              </div>

              <div style={{ fontSize: '13px', lineHeight: '18px', fontWeight: 700 }}>
                En cada comprobante salen {reglas.cuponesPorComprobante} cupones sorteados al azar entre los{' '}
                {cuponesImpresosActivos.length} de código único activos. Un mismo cupón puede salir en varios comprobantes
                seguidos.
              </div>

              <div
                style={{
                  border: '1.5px dashed var(--cp-gold)',
                  backgroundColor: 'rgb(255, 246, 227)',
                  borderRadius: '10px',
                  padding: '8px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ fontSize: '12px', lineHeight: '17px' }}>
                  Entran al sorteo: {cuponesImpresosActivos.map((c) => c.codigoBase).join(', ') || 'ninguno'}.
                </div>
                <button
                  type="button"
                  onClick={() => setTabActual('reglas')}
                  style={{
                    alignSelf: 'flex-start',
                    minHeight: '44px',
                    padding: '0 12px',
                    border: '1.5px solid var(--cp-navy)',
                    borderRadius: '10px',
                    backgroundColor: 'transparent',
                    color: 'var(--cp-navy)',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Cambiar cuántos salen (Reglas)
                </button>
              </div>

              <div style={{ fontSize: '12px', lineHeight: '17px', color: 'var(--cp-soft)' }}>
                Es un ejemplo: cada comprobante sortea sus cupones y le pone códigos distintos, al azar.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== PESTAÑA: REGLAS ==================== */}
      {tabActual === 'reglas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
              Reglas que valen para todas las promociones, descuentos y cupones.
            </span>
            <span style={{ flex: 1 }} />
            {hayCambiosReglas && (
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  borderRadius: '9999px',
                  padding: '4px 12px',
                  backgroundColor: 'var(--cp-gold)',
                  color: 'var(--cp-navy)',
                }}
              >
                Cambios sin guardar
              </span>
            )}
            <button
              type="button"
              onClick={guardarReglas}
              style={{
                minHeight: '44px',
                padding: '0 18px',
                border: 0,
                borderRadius: '12px',
                backgroundColor: 'var(--cp-orange)',
                color: 'var(--cp-navy)',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Guardar reglas
            </button>
            <button
              type="button"
              onClick={descartarReglas}
              style={{
                minHeight: '44px',
                padding: '0 14px',
                border: '1.5px solid var(--cp-navy)',
                borderRadius: '12px',
                backgroundColor: 'transparent',
                color: 'var(--cp-navy)',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Descartar
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
            {/* Acumulación */}
            <div
              style={{
                backgroundColor: 'var(--cp-white)',
                border: '1px solid var(--cp-line)',
                borderRadius: '14px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '15px' }}>
                ¿Se pueden juntar una promoción, un descuento automático y un cupón?
              </div>
              <div style={{ fontSize: '12px', lineHeight: '16px', color: 'var(--cp-soft)' }}>
                Si dices que no (lo recomendado), entre la promoción, el descuento automático y el cupón se aplica solo el
                de mayor valor, y el cupón no se acepta si ya hay una promoción o un descuento.
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setReglas((r) => ({ ...r, cuponConDescuento: false }))}
                  style={{
                    minHeight: '44px',
                    padding: '0 12px',
                    borderRadius: '9999px',
                    border: '1.5px solid var(--cp-navy)',
                    backgroundColor: !reglas.cuponConDescuento ? 'var(--cp-navy)' : 'transparent',
                    color: !reglas.cuponConDescuento ? 'var(--cp-cream)' : 'var(--cp-navy)',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  No: se aplica solo uno
                </button>
                <button
                  type="button"
                  onClick={() => setReglas((r) => ({ ...r, cuponConDescuento: true }))}
                  style={{
                    minHeight: '44px',
                    padding: '0 12px',
                    borderRadius: '9999px',
                    border: '1.5px solid var(--cp-navy)',
                    backgroundColor: reglas.cuponConDescuento ? 'var(--cp-navy)' : 'transparent',
                    color: reglas.cuponConDescuento ? 'var(--cp-cream)' : 'var(--cp-navy)',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Sí: se pueden juntar
                </button>
              </div>
            </div>

            {/* Cupones por comprobante */}
            <div
              style={{
                backgroundColor: 'var(--cp-white)',
                border: '1px solid var(--cp-line)',
                borderRadius: '14px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '15px' }}>
                Cupones por comprobante
              </div>
              <div style={{ fontSize: '12px', lineHeight: '16px', color: 'var(--cp-soft)' }}>
                Cuántos cupones salen al pie de cada comprobante. Se sortean al azar entre los cupones de código único que
                estén activos.
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[1, 2, 3].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setReglas((r) => ({ ...r, cuponesPorComprobante: num }))}
                    style={{
                      minHeight: '44px',
                      minWidth: '48px',
                      padding: '0 12px',
                      borderRadius: '9999px',
                      border: '1.5px solid var(--cp-navy)',
                      backgroundColor: reglas.cuponesPorComprobante === num ? 'var(--cp-navy)' : 'transparent',
                      color: reglas.cuponesPorComprobante === num ? 'var(--cp-cream)' : 'var(--cp-navy)',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            {/* Días validez */}
            <div
              style={{
                backgroundColor: 'var(--cp-white)',
                border: '1px solid var(--cp-line)',
                borderRadius: '14px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '15px' }}>
                Días de validez de un cupón nuevo
              </div>
              <div style={{ fontSize: '12px', lineHeight: '16px', color: 'var(--cp-soft)' }}>
                Se propone al crear un cupón impreso; cada cupón puede cambiarlo.
              </div>
              <label htmlFor="rg-v" style={{ position: 'absolute', left: '-9999px' }}>
                Días de validez
              </label>
              <input
                id="rg-v"
                type="text"
                value={reglas.diasValidezCupon !== undefined ? String(reglas.diasValidezCupon) : '15'}
                onChange={(e) =>
                  setReglas((r) => ({ ...r, diasValidezCupon: parseInt(e.target.value, 10) || 15 }))
                }
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

            {/* Texto al pie */}
            <div
              style={{
                backgroundColor: 'var(--cp-white)',
                border: '1px solid var(--cp-line)',
                borderRadius: '14px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '15px' }}>
                Texto al pie de los cupones
              </div>
              <div style={{ fontSize: '12px', lineHeight: '16px', color: 'var(--cp-soft)' }}>
                Sale impreso debajo de los cupones en el comprobante.
              </div>
              <label htmlFor="rg-p" style={{ position: 'absolute', left: '-9999px' }}>
                Texto al pie
              </label>
              <input
                id="rg-p"
                type="text"
                value={reglas.textoPie || ''}
                onChange={(e) => setReglas((r) => ({ ...r, textoPie: e.target.value }))}
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

            {/* Descuento del personal */}
            <div
              style={{
                backgroundColor: 'var(--cp-cream)',
                border: '1px dashed var(--cp-soft)',
                borderRadius: '14px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '15px' }}>
                Descuento del personal
              </div>
              <div style={{ fontSize: '12px', lineHeight: '16px', color: 'var(--cp-soft)' }}>
                El porcentaje del crédito del personal se cambia en Configuración del local &gt; Operación; lo consumido
                de cada trabajador se ve en Créditos del personal.
              </div>
              <button
                type="button"
                onClick={() => {
                  window.location.hash = '#/admin/creditos';
                }}
                style={{
                  alignSelf: 'flex-start',
                  minHeight: '44px',
                  border: '1.5px solid var(--cp-navy)',
                  borderRadius: '10px',
                  backgroundColor: 'transparent',
                  color: 'var(--cp-navy)',
                  fontWeight: 700,
                  fontSize: '12px',
                  padding: '0 14px',
                  cursor: 'pointer',
                }}
              >
                Ir a Créditos del personal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modales */}
      <ModalArmarOferta
        abierto={modalArmarOfertaAbierto}
        onCerrar={() => setModalArmarOfertaAbierto(false)}
        onElegirCombo={() => {
          setModalArmarOfertaAbierto(false);
          setComboAEditar(null);
          setModalComboAbierto(true);
        }}
        onElegirPromo={() => {
          setModalArmarOfertaAbierto(false);
          setLlevaPagaAEditar(null);
          setModalLlevaPagaAbierto(true);
        }}
        onElegirDescuento={() => {
          setModalArmarOfertaAbierto(false);
          setDescuentoAEditar(null);
          setTabActual('descuentos');
          setModalDescuentoAbierto(true);
        }}
      />

      <ModalCombo
        abierto={modalComboAbierto}
        comboAEditar={comboAEditar}
        onCerrar={() => {
          setModalComboAbierto(false);
          setComboAEditar(null);
        }}
        onGuardar={guardarOfertaHandler}
        productosDisponibles={productos}
        categorias={categorias}
      />

      <ModalLlevaPaga
        abierto={modalLlevaPagaAbierto}
        ofertaAEditar={llevaPagaAEditar}
        onCerrar={() => {
          setModalLlevaPagaAbierto(false);
          setLlevaPagaAEditar(null);
        }}
        onGuardar={guardarOfertaHandler}
        productosDisponibles={productosConDescuento}
        categorias={categorias}
      />

      <ModalEnvioGratis
        abierto={modalEnvioAbierto}
        ofertaAEditar={envioAEditar}
        onCerrar={() => {
          setModalEnvioAbierto(false);
          setEnvioAEditar(null);
        }}
        onGuardar={guardarOfertaHandler}
      />

      <ModalDescuento
        abierto={modalDescuentoAbierto}
        descuentoAEditar={descuentoAEditar}
        onCerrar={() => {
          setModalDescuentoAbierto(false);
          setDescuentoAEditar(null);
        }}
        onGuardar={guardarOfertaHandler}
        productosDisponibles={productosConDescuento}
        categorias={categorias}
      />

      <ModalCupon
        abierto={modalCuponAbierto}
        cuponAEditar={cuponAEditar}
        validezReglasDefecto={reglas.diasValidezCupon || 15}
        onCerrar={() => {
          setModalCuponAbierto(false);
          setCuponAEditar(null);
        }}
        onGuardar={guardarCuponHandler}
        productosDisponibles={productosConDescuento}
              categorias={categorias}
      />

      <ModalHistorialCupones
        abierto={modalHistorialAbierto}
        onCerrar={() => setModalHistorialAbierto(false)}
        movimientos={movimientosHistorial}
      />

      <ModalPrevisualizacionCarta
        abierto={modalPreviewAbierto}
        oferta={ofertaParaPreview}
        onCerrar={() => {
          setModalPreviewAbierto(false);
          setOfertaParaPreview(null);
        }}
        productosDisponibles={productos}
        categoriasDisponibles={categorias}
      />

      <Confirmar
        abierto={desactivarOferta !== null}
        titulo={`¿Desactivar "${desactivarOferta?.oferta.nombre ?? ''}"?`}
        mensaje="Deja de aplicarse en la carta. No se elimina."
        textoConfirmar="Desactivar"
        alConfirmar={confirmarDesactivarOferta}
        alCancelar={() => setDesactivarOferta(null)}
      >
        <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <legend style={{ fontSize: '14px', fontWeight: 700, marginBottom: '6px' }}>
            ¿Cómo quieres que se vea en la carta mientras esté desactivada?
          </legend>
          {[
            { valor: false, texto: 'Ocultar de la carta (recomendado)' },
            { valor: true, texto: 'Mostrar como No disponible' },
          ].map((op) => (
            <label key={String(op.valor)} style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '14px', fontWeight: 600 }}>
              <input
                type="radio"
                name="desactivar-visible-carta"
                checked={desactivarOferta?.visibleCarta === op.valor}
                onChange={() => setDesactivarOferta((prev) => (prev ? { ...prev, visibleCarta: op.valor } : prev))}
              />
              {op.texto}
            </label>
          ))}
        </fieldset>
      </Confirmar>

      <ModalConfirmacion
        abierto={confirmacion.abierto}
        titulo={confirmacion.titulo}
        mensaje={confirmacion.mensaje}
        onConfirmar={confirmacion.onConfirmar}
        onCancelar={() => setConfirmacion((prev) => ({ ...prev, abierto: false }))}
      />
    </div>
  );
}
