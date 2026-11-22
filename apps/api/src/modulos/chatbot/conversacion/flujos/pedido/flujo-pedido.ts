import {
  EntradaNormalizada,
  FlujoConversacion,
  ContextoConversacion,
  ResultadoTransicion,
  AccionMensaje,
  AccionEnviarLista,
  BotonAccion,
  FilaLista,
} from '../../tipos-conversacion';
import { normalizarPropina } from '../../../../propinas/propinas.util';
import { SubFlujoConversacion, RegistroSubFlujos } from '../registro-flujos';
import {
  EstadoPedidoFlujo,
  EstadoCarritoPedido,
  LineaCarritoBot,
  ItemEnConfiguracionBot,
} from './tipos-pedido';
import { avisoStock } from '@caprichos/compartido';
import { lineaAvisoStock, lineasAvisoResumen, umbralesDe } from './aviso-stock-bot.util';
import {
  MAX_COMBOS_CON_ELECCION,
  PlantillasCombo,
  accionesPasoCombo,
  armarPasosCombo,
  comboVendibleBot,
  detalleCombo,
  eleccionesParaServidor,
  iniciarCombo,
  procesarEntradaCombo,
} from './combo-bot';
import { BOTONES_COMBO_CONFIRMAR, TEXTOS_COMBO } from '../../textos-combo';
import { ordenarPorVentas, tarjetaProducto, accionesPaginaCarrusel as accionesPaginaCarruselGenerica } from '../../../servicios/carrusel.util';
import {
  TEXTOS_BOT,
  BOTON_VOLVER_MENU,
  BOTON_HABLAR_PERSONA,
  BOTONES_PEDIDO_MODALIDAD,
  BOTONES_PEDIDO_UBICACION,
  BOTONES_PEDIDO_UBICACION_FALLIDA,
  BOTONES_PEDIDO_ACCION_CARRITO,
  BOTONES_PEDIDO_VER_CARRITO,
  BOTONES_PEDIDO_NOMBRE_CONFIRMAR,
  BOTONES_PEDIDO_COMPROBANTE,
  BOTONES_PEDIDO_CONFIRMAR_FINAL,
  BOTONES_PEDIDO_CONFIRMAR_FINAL_CON_COMPROBANTE,
  BOTONES_PEDIDO_PROPINA,
  BOTONES_PEDIDO_CANCELAR_CONFIRMAR,
  BOTONES_PEDIDO_NOTAS,
  BOTONES_PEDIDO_CANTIDADES,
  BOTONES_PEDIDO_NOMBRES_ENVASE,
  BOTONES_PEDIDO_TELEFONO,
  BOTONES_PEDIDO_PERSONALIZAR,
  BOTONES_PEDIDO_RETOMAR,
} from '../../textos-bot';
import {
  MEDIOS_DIGITALES,
  NOMBRE_MEDIO,
  botonesEfectivo,
  calcularTotales,
  mediosActivos,
  lineasAhorroPorMedio,
  textoMedioNoDisponible,
  medioPrincipal,
  opcionesMedios,
  parsearMonto,
  esPagoExacto,
  textoPago,
} from './pago-bot.util';
import { MedioPagoBot } from './tipos-pedido';
import { PedidoLibre, esPregunta, esSi, interpretarPedidoLibre } from './pedido-libre.util';
import {
  BOTONES_PEDIDO_CAMINO_PAGO,
  FILAS_PROGRAMAR_POR_PAGINA,
  BOTON_PROGRAMAR_PEDIDO,
  TEXTOS_PROGRAMAR,
  tituloFilaDia,
} from '../../textos-programar';
import { nombreParaSaludo } from '../../bienvenida.util';
import { esGrupoBebidaDuplicado } from '../../../../ofertas/combo-grupos.util';
import { celularPuntosEnmascarado } from '../../../utilidades/enmascarar.util';

const PALABRAS_PEDIDO = [
  'pedir',
  'hacer pedido',
  'hacer un pedido',
  'ordenar',
  'comprar',
  'quiero pedir',
  'quisiera pedir',
  'me das',
  'me regalas',
];

const PALABRAS_CANCELAR = [
  'cancelar',
  'cancela',
  'anular',
  'ya no quiero',
  'cancelar pedido',
  'descartar',
];

/**
 * Estados de dirección que ya no existen (conversaciones abiertas antes de quitar las direcciones anteriores
 * y la referencia aparte): siguen por la ubicación, para que nadie quede atascado.
 */
const NUMEROS_PALABRA: Record<string, number> = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10 };
const RE_SOLO_MODALIDAD = /^(delivery|a domicilio|domicilio|para recoger|para llevar|recoger|recojo|llevar|pedir delivery|quiero delivery)$/;
const RE_CAMBIO_CANTIDAD = /(?:mejor|que sean|que seran|cambialo a|cambia a) (?:que sean |que seran )?(\d{1,2})\b|^(?:en vez de \d+,? )(\d{1,2})\b/;
const RE_QUITAR = /\b(quita|quitar|quitame|saca|sacar|elimina|eliminar|borra|borrar|sin el)\b/;
const ESTADOS_CORRECCION = ['PEDIDO_MODALIDAD', 'PEDIDO_UBICACION', 'PEDIDO_CATEGORIAS', 'PEDIDO_PRODUCTOS', 'PEDIDO_ACCION_CARRITO', 'PEDIDO_VER_CARRITO', 'PEDIDO_MEDIO_PAGO', 'PEDIDO_MONTO_EFECTIVO', 'PEDIDO_RESUMEN_CONFIRMAR'];

/** El cliente escribió el nombre de la opción, con o sin el precio que lleva el botón («Grande S/20», «Almendra +S/3»). */
function coincideTitulo(nombre: string, textoNormalizado: string): boolean {
  const n = normalizarTexto(nombre);
  return n.length > 0 && (textoNormalizado === n || textoNormalizado.startsWith(`${n} `) || (n.length >= 4 && ` ${textoNormalizado} `.includes(` ${n} `)));
}

const raizCat = (t: string) => normalizarTexto(t).replace(/s\b/g, '');
/** El texto del cliente nombra esa categoría («frappés», «ver los postres»), sin importar plural o artículos. */
function categoriaCoincide(nombre: string, texto: string): boolean {
  const n = raizCat(nombre);
  return n.length >= 4 && raizCat(texto).includes(n);
}

/** Estados donde un texto libre puede ser un pedido en una frase (no los pasos que esperan nombre, monto, etc.). */
const ESTADOS_FRASE = ['INICIO', 'MENU', 'PEDIDO', 'PEDIDO_MODALIDAD', 'PEDIDO_CATEGORIAS', 'PEDIDO_PRODUCTOS', 'PEDIDO_ACCION_CARRITO', 'PEDIDO_VER_CARRITO', 'PEDIDO_MEDIO_PAGO', 'PEDIDO_RESUMEN_CONFIRMAR'];

const ESTADOS_UBICACION_LEGADOS: string[] = ['PEDIDO_DIRECCION_ELEGIR', 'PEDIDO_DIRECCION_TEXTO', 'PEDIDO_REFERENCIA'];

function normalizarEstadoUbicacion(estado: EstadoPedidoFlujo): EstadoPedidoFlujo {
  return ESTADOS_UBICACION_LEGADOS.includes(estado) ? 'PEDIDO_UBICACION' : estado;
}

/** Sabores que se pueden pedir ahora: disponibles y sin agotar (quedan null = producto sin control de stock, no bloquea). */
function saboresPedibles(prod: any): any[] {
  return (prod?.sabores || []).filter((s: any) => s.disponible === true && s.quedan !== 0);
}

/** Unidades que quedan de un producto que controla stock (null: sin límite). Por sabor, la suma de sus sabores. */
function quedanDeProducto(prod: any): number | null {
  return typeof prod?.quedan === 'number' ? prod.quedan : null;
}

/**
 * Tamaños que caben en lo que queda (1/2 docena = 6, docena = 12). Con stock por sabor, una línea lleva un solo sabor:
 * el tamaño cabe si algún sabor pedible tiene esas unidades. Sin límite, todos.
 */
function tamanosQueCaben(prod: any): any[] {
  const tamanos = prod?.tamanos || [];
  const quedan = quedanDeProducto(prod);
  return tamanos.filter((t: any) => {
    const unidades = unidadesDeTamano(prod, String(t.id));
    if (quedan !== null && unidades > quedan) return false;
    return prod?.saboresConStock !== true || saboresQueCaben(prod, unidades).length > 0;
  });
}

/** Sabores pedibles que tienen las unidades de la línea (el saldo de cada sabor es su tope). */
function saboresQueCaben(prod: any, unidades: number): any[] {
  return saboresPedibles(prod).filter((s: any) => typeof s.quedan !== 'number' || s.quedan >= unidades);
}

/** Botones 1/2/3 sin pasar de `maximo` unidades de cantidad. */
function botonesHasta(maximo: number): BotonAccion[] {
  return BOTONES_PEDIDO_CANTIDADES.filter((b) => Number(b.id.replace('ped_cant_', '')) <= Math.max(1, maximo));
}

/** Botones de cantidad para un producto: con stock, no más de lo que cabe en su tamaño. */
function botonesCantidadDe(prod: any, tamanoId?: string): BotonAccion[] {
  const quedan = quedanDeProducto(prod);
  if (quedan === null) return BOTONES_PEDIDO_CANTIDADES;
  return botonesHasta(Math.floor(quedan / unidadesDeTamano(prod, tamanoId)));
}

/** No se puede pedir: agotado, con stock por sabor sin ningún sabor pedible, o sin tamaño que quepa. */
function productoAgotado(p: any): boolean {
  return (
    p.disponible === false ||
    (p.saboresConStock === true && saboresPedibles(p).length === 0) ||
    ((p.tamanos || []).length > 0 && tamanosQueCaben(p).length === 0)
  );
}

/**
 * Grupos de opciones que el bot pregunta. Con stock por sabor se omiten los obligatorios heredados
 * («Sabor» de empanadas): no se preguntan ni se exigen.
 */
function gruposDePregunta(prod: any, ocultaGruposBebida = false): any[] {
  const grupos = (prod?.grupos || []).filter((g: any) => !(ocultaGruposBebida && esGrupoBebidaDuplicado(String(g.nombre ?? ''))));
  return prod?.saboresConStock === true ? grupos.filter((g: any) => !(g.obligatorio || g.minimo > 0)) : grupos;
}

/** Unidades de un tamaño (Unidad=1, 1/2 docena=6, Docena=12). Sin tamaño o sin dato: 1. */
function unidadesDeTamano(prod: any, tamanoId?: string): number {
  const tamano = (prod?.tamanos || []).find((t: any) => String(t.id) === String(tamanoId));
  return Math.max(1, Number(tamano?.unidades) || 1);
}

function productoDeCarta(categorias: any[], productoId: string): any | null {
  for (const cat of categorias || []) {
    const p = (cat.productos || []).find((x: any) => String(x.id) === String(productoId));
    if (p) return p;
  }
  return null;
}

/** Anfitrión de un combo que el bot no vende hoy (canal sin WhatsApp, agotado o fuera de horario): no se ofrece. */
function ocultoEnBot(p: any, contexto: ContextoConversacion): boolean {
  return (contexto.productosComboNoBot ?? []).includes(String(p?.id));
}

function plantillasCombo(contexto: ContextoConversacion): PlantillasCombo {
  return {
    intro: contexto.textosPersonalizados?.chatbot_texto_combo_intro,
    planB: contexto.textosPersonalizados?.chatbot_texto_combo_plan_b,
  };
}

/** Lista de sabores que se pueden pedir con esas unidades (máx 10 filas; «Quedan N» cuando quedan 5 o menos). */
function listaSaboresStock(prod: any, texto: string, unidades = 1): AccionEnviarLista {
  return {
    tipo: 'enviarLista',
    texto,
    botonTexto: 'Elegir sabor',
    filas: saboresQueCaben(prod, unidades)
      .slice(0, 10)
      .map((s: any) => ({
        id: `ped_sab_${s.id}`,
        titulo: String(s.nombre).slice(0, 24),
        ...(typeof s.quedan === 'number' && s.quedan <= 5 ? { descripcion: `Quedan ${s.quedan}` } : {}),
      })),
  };
}

/** Detalles de una línea en el resumen: con sabor de stock sale «1/2 docena de Fresa». */
function detallesLinea(i: LineaCarritoBot): string[] {
  const opciones = i.opciones.map((o) => o.nombre);
  const saborStock = i.sabores?.[0];
  if (saborStock) {
    return [`${i.tamanoNombre ? `${i.tamanoNombre} de ` : ''}${saborStock.nombre}`, ...opciones];
  }
  return [i.tamanoNombre, ...opciones, i.sabor, ...(i.comboDetalle ?? [])].filter((d): d is string => Boolean(d));
}

/**
 * El servidor rechazó la línea por SABOR_AGOTADO: esa línea sale del carrito (el resto se conserva) y el
 * cliente vuelve a la lista de sabores de ese producto. Null si no hay línea que tocar o no queda ningún sabor
 * (el ejecutor entonces vuelve al carrito como con STOCK_INSUFICIENTE).
 */
export function carritoTrasSaborAgotado(
  carrito: EstadoCarritoPedido,
  err: { productoId: string; saborId: string; saborNombre?: string },
  categorias: any[],
): { pedido: EstadoCarritoPedido; lista: AccionEnviarLista } | null {
  const idx = carrito.items.findIndex(
    (i) => i.productoId === String(err.productoId) && i.sabores?.some((s) => s.saborId === String(err.saborId)),
  );
  const prod = productoDeCarta(categorias, err.productoId);
  if (idx < 0 || !prod?.saboresConStock || saboresPedibles(prod).length === 0) return null;

  const linea = carrito.items[idx];
  const unidadesLinea = unidadesDeTamano(prod, linea.tamanoId) * linea.cantidad;
  if (saboresQueCaben(prod, unidadesLinea).length === 0) return null;
  const extras = linea.opciones.reduce((s, o) => s + o.precioExtra, 0);
  const config: ItemEnConfiguracionBot = {
    productoId: linea.productoId,
    productoNombre: linea.productoNombre,
    categoriaId: linea.categoriaId,
    categoriaNombre: linea.categoriaNombre,
    tamanoId: linea.tamanoId,
    tamanoNombre: linea.tamanoNombre,
    precioBase: Number((linea.precioUnitario - extras).toFixed(2)),
    opciones: linea.opciones,
    grupoIndexActual: (prod.grupos || []).length,
    cantidad: linea.cantidad,
    noSumaBeneficios: linea.noSumaBeneficios,
    nota: linea.nota,
  };
  const nombre = err.saborNombre || linea.sabores?.[0]?.nombre || '';
  return {
    pedido: {
      ...carrito,
      estadoInterno: 'PEDIDO_SABOR',
      items: carrito.items.filter((_, k) => k !== idx),
      itemEnConfiguracion: config,
    },
    lista: listaSaboresStock(prod, TEXTOS_BOT.pedidoSaborAgotado(nombre), unidadesLinea),
  };
}

export const CODIGOS_COMBO_RECHAZADO = ['COMBO_PARTE_NO_DISPONIBLE', 'COMBO_ELECCION_INCOMPLETA', 'COMBO_PARTE_NO_PERMITIDA', 'COMBO_ALTERNATIVA_NO_APLICA'];

/**
 * El servidor rechazó un combo al confirmar (se agotó una parte o el saldo cambió): la línea del combo sale del carrito
 * (el resto se conserva) y el cliente vuelve a elegir sus partes con lo que hay hoy (plan B incluido). Null si no hay
 * un combo que rehacer (el ejecutor entonces vuelve al carrito con el mensaje).
 */
export function carritoTrasComboRechazado(
  carrito: EstadoCarritoPedido,
  err: { codigo?: string; mensaje?: string; productoId?: string | number },
  categorias: any[],
  ofertas: any[],
  textos?: Record<string, string>,
): { pedido: EstadoCarritoPedido; acciones: AccionMensaje[] } | null {
  const porCodigo = CODIGOS_COMBO_RECHAZADO.includes(String(err.codigo));
  const idx = carrito.items.findIndex(
    (i) => i.ofertaId && (porCodigo || i.comboElecciones?.some((e) => e.productoId === String(err.productoId))),
  );
  if (idx < 0) return null;
  const linea = carrito.items[idx];
  const oferta = comboVendibleBot(ofertas, linea.productoId);
  if (!oferta) return null;
  const combo = iniciarCombo(oferta);
  if (!armarPasosCombo(combo, oferta, linea.cantidad, categorias) || combo.pasos.length === 0) return null;
  const prod = productoDeCarta(categorias, linea.productoId);
  const extras = linea.opciones.reduce((s, o) => s + o.precioExtra, 0);
  const config: ItemEnConfiguracionBot = {
    productoId: linea.productoId,
    productoNombre: linea.productoNombre,
    categoriaId: linea.categoriaId,
    categoriaNombre: linea.categoriaNombre,
    tamanoId: linea.tamanoId,
    tamanoNombre: linea.tamanoNombre,
    precioBase: Number((linea.precioUnitario - extras).toFixed(2)),
    opciones: linea.opciones,
    grupoIndexActual: (prod?.grupos || []).length,
    cantidad: linea.cantidad,
    noSumaBeneficios: linea.noSumaBeneficios,
    nota: linea.nota,
    nombresEnvase: linea.personas,
    combo,
  };
  return {
    pedido: { ...carrito, estadoInterno: 'PEDIDO_COMBO_PARTE', items: carrito.items.filter((_, k) => k !== idx), itemEnConfiguracion: config },
    acciones: [
      { tipo: 'enviarTexto', texto: TEXTOS_COMBO.seAgoto(err.mensaje || 'Se agotó algo de tu combo') },
      ...accionesPasoCombo(combo, { intro: textos?.chatbot_texto_combo_intro, planB: textos?.chatbot_texto_combo_plan_b }),
    ],
  };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export class FlujoPedidoSubFlujo implements SubFlujoConversacion {
  readonly nombre = 'pedido';

  puedeManejar(
    flujo: FlujoConversacion,
    entrada: EntradaNormalizada,
    _contexto: ContextoConversacion,
  ): boolean {
    const estadoStr = String(flujo.estado || '');
    if (estadoStr === 'PEDIDO' || estadoStr.startsWith('PEDIDO_')) {
      return true;
    }

    // Pedido dicho en una frase («2 frappé moka grande para llevar»)
    if (!entrada.id && this.fraseDePedido(flujo, entrada, _contexto)) return true;
    if (!entrada.id && ['INICIO', 'MENU'].includes(estadoStr) && RE_SOLO_MODALIDAD.test(entrada.texto)) return true;

    // Botones directos del flujo de pedido
    if (entrada.id?.startsWith('ped_')) {
      return true;
    }

    // Si viene de otra opción del menú, FAQ o mi pedido, no interceptar
    if (
      entrada.id === 'mi_pedido' ||
      entrada.id?.startsWith('ord_') ||
      entrada.id?.startsWith('faq_') ||
      entrada.id === 'btn_promociones' ||
      entrada.id === 'btn_carta' ||
      entrada.id === 'btn_preguntas' ||
      entrada.id === 'btn_reserva' ||
      entrada.id === 'btn_persona'
    ) {
      return false;
    }

    // No interceptar si el texto es claramente para consultar "mi pedido" o "cuánto falta"
    if (
      entrada.texto?.includes('mi pedido') ||
      entrada.texto?.includes('cuanto falta') ||
      entrada.texto?.includes('estado de mi pedido') ||
      entrada.texto?.includes('donde esta mi pedido') ||
      entrada.texto?.includes('rastreo') ||
      entrada.texto?.includes('seguimiento')
    ) {
      return false;
    }

    if (
      entrada.id === 'pedir' ||
      entrada.id === 'btn_pedido' ||
      coincideAlgunaPalabra(entrada.texto, PALABRAS_PEDIDO)
    ) {
      return true;
    }

    return false;
  }

  transicionar(
    flujoPrevio: FlujoConversacion,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion | null {
    const flujo: FlujoConversacion = {
      ...flujoPrevio,
    };

    // 1. Manejo de cancelación en cualquier punto del flujo
    const esComandoCancelar =
      entrada.id === 'ped_cancelar' ||
      entrada.id === 'btn_cancelar' ||
      coincideAlgunaPalabra(entrada.texto, PALABRAS_CANCELAR);

    if (esComandoCancelar && flujo.estado !== 'PEDIDO_CANCELAR_CONFIRMAR') {
      const estadoActual = (flujo.pedido?.estadoInterno || flujo.estado) as EstadoPedidoFlujo;
      const nuevoPedido: EstadoCarritoPedido = {
        ...(flujo.pedido || { estadoInterno: 'PEDIDO_MODALIDAD', items: [] }),
        estadoInterno: 'PEDIDO_CANCELAR_CONFIRMAR',
        estadoPrevioCancelacion: estadoActual,
      };

      return {
        nuevoEstado: 'PEDIDO_CANCELAR_CONFIRMAR',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: TEXTOS_BOT.pedidoConfirmarCancelar(),
            botones: BOTONES_PEDIDO_CANCELAR_CONFIRMAR,
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'PEDIDO_CANCELAR_CONFIRMAR',
          pedido: nuevoPedido,
        },
      };
    }

    if (flujo.estado === 'PEDIDO_CANCELAR_CONFIRMAR') {
      if (entrada.id === 'ped_cancelar_si' || entrada.texto.includes('si')) {
        return {
          nuevoEstado: 'MENU',
          acciones: [
            {
              tipo: 'enviarBotones',
              texto: TEXTOS_BOT.pedidoCancelado(),
              botones: [BOTON_VOLVER_MENU],
            },
          ],
          nuevoFlujo: {
            ...flujo,
            estado: 'MENU',
            pedido: null,
          },
        };
      }

      // No cancelar -> restaurar estado previo
      const estadoRestaurar = flujo.pedido?.estadoPrevioCancelacion || 'PEDIDO_ACCION_CARRITO';
      const pedidoRestaurado: EstadoCarritoPedido = {
        ...(flujo.pedido as EstadoCarritoPedido),
        estadoInterno: estadoRestaurar,
      };

      return this.renderizarEstado(estadoRestaurar, flujo, pedidoRestaurado, contexto);
    }

    // 2. Si el cliente pulsa "Volver al menú"
    if (entrada.id === 'btn_menu' || entrada.texto === 'menu' || entrada.texto === 'volver al menu') {
      return {
        nuevoEstado: 'MENU',
        acciones: [
          {
            tipo: 'enviarTexto',
            texto: 'Regresamos al menú principal. Tu carrito de compras se mantiene guardado.',
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'MENU',
        },
      };
    }

    // «Seguir con mi pedido» tras una pregunta suelta (horario, pagos…): vuelve al paso donde iba
    if (entrada.id === 'ped_seguir' && flujo.pedido) {
      return this.renderizarEstado(flujo.pedido.estadoInterno || 'PEDIDO_CATEGORIAS', flujo, { ...flujo.pedido }, contexto);
    }

    // «delivery» o «para llevar» como primer mensaje: ya dijo cómo lo quiere; se sigue desde ahí
    if (!entrada.id && ['INICIO', 'MENU'].includes(String(flujo.estado)) && RE_SOLO_MODALIDAD.test(entrada.texto) && !(contexto.soloProgramar && contexto.datosLocal && !contexto.datosLocal.abierta)) {
      const bloqueo = this.bloqueoDeApertura(flujo, contexto);
      if (bloqueo) return bloqueo;
      const base: EstadoCarritoPedido = flujo.pedido?.items?.length ? flujo.pedido : { estadoInterno: 'PEDIDO_MODALIDAD', items: [], idempotenciaPaso: `step_${Date.now()}`, timestampUltimaAccion: Date.now() };
      return this.pasoModalidad({ ...flujo, estado: 'PEDIDO_MODALIDAD' }, base, entrada, contexto);
    }

    // 2.c Corregir a última hora («mejor que sean 3», «quita el cheesecake») aunque ya esté en el pago o el resumen
    if (!entrada.id && flujo.pedido?.items?.length && ESTADOS_CORRECCION.includes(String(flujo.estado)) && (RE_CAMBIO_CANTIDAD.test(entrada.texto) || RE_QUITAR.test(entrada.texto))) {
      return this.pasoVerCarrito(flujo, { ...flujo.pedido, estadoInterno: 'PEDIDO_VER_CARRITO' }, entrada, contexto);
    }

    // 2.b Pedido dicho en una frase: se arma el carrito de una vez y solo se pregunta lo que falta
    const libre = !entrada.id ? this.fraseDePedido(flujo, entrada, contexto) : null;
    if (libre) {
      const bloqueo = this.bloqueoDeApertura(flujo, contexto);
      if (bloqueo) return bloqueo;
      return this.aplicarFrase(flujo, libre, contexto);
    }

    // 3. Inicio del flujo ("Hacer un pedido")
    const esInicioPedido =
      !entrada.id?.startsWith('ped_prod_') &&
      (flujo.estado === 'INICIO' ||
        flujo.estado === 'MENU' ||
        flujo.estado === 'PEDIDO' ||
        entrada.id === 'pedir' ||
        entrada.id === 'btn_pedido');

    // Tiene un carrito guardado (salió al menú a medio pedido o volvió después): se retoma, no se empieza de cero
    if (esInicioPedido && !flujo.estado.startsWith('PEDIDO_') && flujo.pedido?.items?.length) {
      if (entrada.id === 'ped_nuevo') {
        return this.renderizarEstado('PEDIDO_MODALIDAD', { ...flujo, pedido: null }, { estadoInterno: 'PEDIDO_MODALIDAD', items: [], idempotenciaPaso: `step_${Date.now()}` }, contexto);
      }
      return this.retomarCarrito(flujo, flujo.pedido, contexto);
    }

    if (esInicioPedido && !flujo.estado.startsWith('PEDIDO_')) {
      // 3.1. Validar local cerrado o pausado
      if (contexto.datosLocal?.pausaAltaDemanda) {
        const extraMin = contexto.datosLocal.altaDemandaMinutosExtra || 20;
        const motivo = contexto.datosLocal.motivoPausa || 'Muchos pedidos';
        return {
          nuevoEstado: 'MENU',
          acciones: [
            {
              tipo: 'enviarBotones',
              texto: `Por ahora pausamos los pedidos por alta demanda (${motivo}). La entrega tardará unos ${extraMin} min adicionales. Puedes volver al menú o consultar con un asesor.`,
              botones: [BOTON_HABLAR_PERSONA, BOTON_VOLVER_MENU],
            },
          ],
          nuevoFlujo: {
            ...flujo,
            estado: 'MENU',
          },
        };
      }

      if (contexto.datosLocal && !contexto.datosLocal.abierta && !contexto.soloProgramar) {
        const horarioTexto = contexto.datosLocal.textoEstado || 'de 14:00 a 22:00';
        return {
          nuevoEstado: 'MENU',
          acciones: [
            {
              tipo: 'enviarBotones',
              texto: `Ahora estamos cerrados. Nuestro horario: ${horarioTexto}. No tomamos pedidos fuera de horario; escríbenos cuando abramos.`,
              botones: [BOTON_VOLVER_MENU],
            },
          ],
          nuevoFlujo: {
            ...flujo,
            estado: 'MENU',
          },
        };
      }

      // 3.2. Iniciar carrito limpio y pedir modalidad
      const pedidoInicial: EstadoCarritoPedido = {
        estadoInterno: 'PEDIDO_MODALIDAD',
        items: [],
        idempotenciaPaso: `step_${Date.now()}`,
        timestampUltimaAccion: Date.now(),
      };

      // Local cerrado con «programar fuera de horario»: primero se elige el día y la hora; luego el pedido sigue igual
      if (contexto.soloProgramar && contexto.datosLocal && !contexto.datosLocal.abierta) {
        return this.mostrarDiasProgramar(flujo, { ...pedidoInicial, estadoInterno: 'PEDIDO_PROG_DIA' }, contexto, 0);
      }

      return {
        nuevoEstado: 'PEDIDO_MODALIDAD',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: TEXTOS_BOT.pedidoModalidad(),
            botones: BOTONES_PEDIDO_MODALIDAD,
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'PEDIDO_MODALIDAD',
          pedido: pedidoInicial,
        },
      };
    }

    // 3.b Pedido directo de un producto concreto (CTA comercial / Pedir este producto). Con el pedido ya en marcha es una
    // elección más de la lista: no se vuelve a revisar el horario (y no se pierde el carrito).
    if (entrada.id?.startsWith('ped_prod_')) {
      const enMarcha = String(flujo.estado).startsWith('PEDIDO_');
      if (!enMarcha && contexto.datosLocal?.pausaAltaDemanda) {
        const extraMin = contexto.datosLocal.altaDemandaMinutosExtra || 20;
        const motivo = contexto.datosLocal.motivoPausa || 'Muchos pedidos';
        return {
          nuevoEstado: 'MENU',
          acciones: [
            {
              tipo: 'enviarBotones',
              texto: `Por ahora pausamos los pedidos por alta demanda (${motivo}). La entrega tardará unos ${extraMin} min adicionales. Puedes volver al menú o consultar con un asesor.`,
              botones: [BOTON_HABLAR_PERSONA, BOTON_VOLVER_MENU],
            },
          ],
          nuevoFlujo: {
            ...flujo,
            estado: 'MENU',
          },
        };
      }

      // Cerrado con «programar fuera de horario»: no se pierde al cliente; se le ofrece programar el pedido completo
      if (!enMarcha && contexto.soloProgramar && contexto.datosLocal && !contexto.datosLocal.abierta) {
        return {
          nuevoEstado: 'MENU',
          acciones: [{ tipo: 'enviarBotones', texto: TEXTOS_PROGRAMAR.bienvenida(), botones: [BOTON_PROGRAMAR_PEDIDO] }],
          nuevoFlujo: { ...flujo, estado: 'MENU' },
        };
      }

      if (!enMarcha && contexto.datosLocal && !contexto.datosLocal.abierta) {
        const horarioTexto = contexto.datosLocal.textoEstado || 'de 14:00 a 22:00';
        return {
          nuevoEstado: 'MENU',
          acciones: [
            {
              tipo: 'enviarBotones',
              texto: `Ahora estamos cerrados. Nuestro horario: ${horarioTexto}. No tomamos pedidos fuera de horario; escríbenos cuando abramos.`,
              botones: [BOTON_VOLVER_MENU],
            },
          ],
          nuevoFlujo: {
            ...flujo,
            estado: 'MENU',
          },
        };
      }

      const pedidoBase: EstadoCarritoPedido = flujo.pedido || {
        estadoInterno: 'PEDIDO_PRODUCTOS',
        items: [],
        // «Ver más» / «Ver lista completa» desde la carta: la categoría viene del flujo
        categoriaSeleccionadaId: flujo.categoriaSeleccionadaId,
        idempotenciaPaso: `step_${Date.now()}`,
        timestampUltimaAccion: Date.now(),
      };

      return this.pasoProductos(flujo, pedidoBase, entrada, contexto);
    }

    // 4. Procesamiento según el estado interno del pedido
    const pedidoActual = flujo.pedido || {
      estadoInterno: (flujo.estado as EstadoPedidoFlujo) || 'PEDIDO_MODALIDAD',
      items: [],
    };
    pedidoActual.timestampUltimaAccion = Date.now();

    return this.despacharPaso(pedidoActual.estadoInterno, flujo, pedidoActual, entrada, contexto);
  }

  // -------------------------------------------------------------------------
  // PEDIDO EN UNA FRASE: «2 frappé moka grande para llevar». El carrito se arma de una vez; solo se pregunta lo que falta.
  // -------------------------------------------------------------------------
  /** Interpreta el texto como pedido si el cliente está en un punto donde eso tiene sentido (menú o armando el carrito). */
  private fraseDePedido(flujo: FlujoConversacion, entrada: EntradaNormalizada, contexto: ContextoConversacion): PedidoLibre | null {
    const estado = String(flujo.estado || '');
    if (entrada.id || !ESTADOS_FRASE.includes(estado) || !entrada.texto) return null;
    // Local cerrado con programación: primero se elige el día y la hora (flujo propio)
    if (contexto.soloProgramar && contexto.datosLocal && !contexto.datosLocal.abierta) return null;
    if (esPregunta(entrada.texto, entrada.textoOriginal)) return null;
    // Con el pedido en un paso de texto simple («delivery», «recoger») se atiende ese paso, no una frase
    if (estado === 'PEDIDO_MODALIDAD' && /^(delivery|recoger|para recoger|para llevar|llevar|domicilio|a domicilio)$/.test(entrada.texto)) return null;
    const vendible = (p: any) => !productoAgotado(p) && !ocultoEnBot(p, contexto) && !comboVendibleBot(contexto.ofertas, String(p.id));
    const libre = interpretarPedidoLibre(entrada.textoOriginal || entrada.texto, contexto.categoriasCarta || [], vendible);
    if (!libre || (!libre.lineas.length && !libre.ambiguos.length && !libre.agotados.length)) return null;
    // «frappés», «los postres»: nombra una categoría, no un producto; se muestra la categoría
    if (!libre.lineas.length && libre.ambiguos.length && (contexto.categoriasCarta || []).some((c: any) => categoriaCoincide(c.nombre, entrada.texto))) return null;
    return libre;
  }

  /** Pausa por alta demanda o local cerrado sin programación: no se arma el pedido. */
  private bloqueoDeApertura(flujo: FlujoConversacion, contexto: ContextoConversacion): ResultadoTransicion | null {
    if (String(flujo.estado).startsWith('PEDIDO_')) return null;
    if (contexto.datosLocal?.pausaAltaDemanda) {
      const extraMin = contexto.datosLocal.altaDemandaMinutosExtra || 20;
      const motivo = contexto.datosLocal.motivoPausa || 'Muchos pedidos';
      return {
        nuevoEstado: 'MENU',
        acciones: [{ tipo: 'enviarBotones', texto: `Por ahora pausamos los pedidos por alta demanda (${motivo}). La entrega tardará unos ${extraMin} min adicionales. Puedes volver al menú o consultar con un asesor.`, botones: [BOTON_HABLAR_PERSONA, BOTON_VOLVER_MENU] }],
        nuevoFlujo: { ...flujo, estado: 'MENU' },
      };
    }
    if (contexto.datosLocal && !contexto.datosLocal.abierta) {
      const horarioTexto = contexto.datosLocal.textoEstado || 'de 14:00 a 22:00';
      return {
        nuevoEstado: 'MENU',
        acciones: [{ tipo: 'enviarBotones', texto: `Ahora estamos cerrados. Nuestro horario: ${horarioTexto}. No tomamos pedidos fuera de horario; escríbenos cuando abramos.`, botones: [BOTON_VOLVER_MENU] }],
        nuevoFlujo: { ...flujo, estado: 'MENU' },
      };
    }
    return null;
  }

  private aplicarFrase(flujo: FlujoConversacion, libre: PedidoLibre, contexto: ContextoConversacion): ResultadoTransicion {
    // Lo ya elegido (carrito, modalidad, ubicación) se conserva: la frase solo suma
    const previo = flujo.pedido && (flujo.pedido.items?.length || String(flujo.estado).startsWith('PEDIDO_')) ? flujo.pedido : null;
    const pedido: EstadoCarritoPedido = {
      ...(previo || { estadoInterno: 'PEDIDO_MODALIDAD' as EstadoPedidoFlujo, items: [], idempotenciaPaso: `step_${Date.now()}` }),
      timestampUltimaAccion: Date.now(),
      desdeFrase: true,
      itemEnConfiguracion: undefined,
    };
    if (libre.modalidad === 'RECOGER') {
      pedido.modalidad = 'RECOGER';
      pedido.entrega = { modalidad: 'RECOGER', tarifaEnvio: 0 };
    } else if (libre.modalidad === 'DELIVERY' && pedido.modalidad !== 'DELIVERY') {
      pedido.modalidad = 'DELIVERY';
      pedido.entrega = undefined;
    }
    if (libre.medio && this.mediosDelPedido(pedido, contexto).includes(libre.medio)) {
      pedido.pago = { metodo: libre.medio, ...(libre.medio === 'EFECTIVO' && libre.pagaCon ? { pagaCon: libre.pagaCon } : {}) };
    }
    pedido.colaFrase = libre.lineas.map((l) => ({
      productoId: String(l.producto.id),
      tamanoId: l.tamano ? String(l.tamano.id) : undefined,
      opcionIds: l.opciones.map((o) => String(o.opcion.id)),
      cantidad: l.cantidad,
    }));
    pedido.avisosFrase = libre.agotados.map((n) => `${n} está agotado por ahora.`);
    pedido.ambiguosFrase = libre.ambiguos.map((a) => ({ texto: a.texto, ids: a.candidatos.map((c) => String(c.producto.id)).slice(0, 9) }));
    return this.siguienteDeCola(flujo, pedido, contexto);
  }

  /** Configura el siguiente producto de la frase; cuando no queda ninguno, cierra con un solo mensaje. */
  private siguienteDeCola(flujo: FlujoConversacion, pedido: EstadoCarritoPedido, contexto: ContextoConversacion): ResultadoTransicion {
    const categorias = contexto.categoriasCarta || [];
    while (pedido.colaFrase && pedido.colaFrase.length > 0) {
      const l = pedido.colaFrase.shift()!;
      const cat = categorias.find((c) => (c.productos || []).some((p: any) => String(p.id) === l.productoId));
      const prod = cat ? (cat.productos || []).find((p: any) => String(p.id) === l.productoId) : null;
      if (!cat || !prod) continue;
      const config: ItemEnConfiguracionBot = {
        productoId: String(prod.id),
        productoNombre: prod.nombre,
        categoriaId: String(cat.id),
        categoriaNombre: cat.nombre,
        precioBase: Number(prod.precio),
        opciones: [],
        grupoIndexActual: 0,
        cantidad: l.cantidad,
        noSumaBeneficios: Boolean(prod.noSumaBeneficios),
        cantidadFija: true,
      };
      const caben = tamanosQueCaben(prod);
      const tam = caben.find((t: any) => String(t.id) === l.tamanoId) ?? (caben.length === 1 ? caben[0] : null);
      if (tam) {
        config.tamanoId = String(tam.id);
        config.tamanoNombre = tam.nombre;
        config.precioBase = Number(tam.precio);
      }
      for (const g of gruposDePregunta(prod)) {
        for (const o of g.opciones || []) {
          if (l.opcionIds.includes(String(o.id))) {
            config.opciones.push({ opcionId: String(o.id), nombre: o.nombre, precioExtra: Number(o.precioExtra || 0), grupoId: String(g.id), grupoNombre: g.nombre });
          }
        }
      }
      pedido.itemEnConfiguracion = config;
      if (!tam && caben.length > 1) {
        return this.preguntarTamano(flujo, pedido, prod, `${config.cantidad > 1 ? `${config.cantidad} ` : ''}${TEXTOS_BOT.pedidoPreguntarTamano(prod.nombre)}`);
      }
      return this.avanzarConfiguracionProducto(flujo, pedido, prod, contexto);
    }
    return this.cerrarFrase(flujo, pedido, contexto);
  }

  /** Todo el pedido de la frase ya está en el carrito: se pregunta lo que falta (cuál, modalidad, ubicación) o se sigue al pago. */
  private cerrarFrase(flujo: FlujoConversacion, pedido: EstadoCarritoPedido, contexto: ContextoConversacion): ResultadoTransicion {
    const avisos = (pedido.avisosFrase ?? []).join('\n');
    const nuevo: EstadoCarritoPedido = { ...pedido, colaFrase: undefined, avisosFrase: undefined, itemEnConfiguracion: undefined, desdeFrase: undefined };
    const antes = (t: string) => (avisos ? `${avisos}\n\n${t}` : t);
    const anotado = nuevo.items.length ? `Anotado:\n${this.lineasResumen(nuevo, contexto)}\n\n` : '';

    // Un trozo con varios productos posibles: se pregunta cuál
    const amb = nuevo.ambiguosFrase?.[0];
    if (amb) {
      const filas: FilaLista[] = amb.ids.map((id) => {
        const p = productoDeCarta(contexto.categoriasCarta || [], id);
        return { id: `ped_prod_${id}`, titulo: String(p?.nombre ?? id).slice(0, 24), descripcion: `S/ ${Number(p?.precio ?? 0).toFixed(2)}` };
      });
      nuevo.ambiguosFrase = nuevo.ambiguosFrase!.slice(1);
      nuevo.estadoInterno = 'PEDIDO_PRODUCTOS';
      return {
        nuevoEstado: 'PEDIDO_PRODUCTOS',
        acciones: [{ tipo: 'enviarLista', texto: antes(`${anotado}¿Cuál de estos quieres?`), botonTexto: 'Elegir', filas }],
        nuevoFlujo: { ...flujo, estado: 'PEDIDO_PRODUCTOS', pedido: nuevo },
      };
    }
    if (!nuevo.items.length) {
      // Nada se pudo poner (agotado): categorías para que elija otra cosa
      return this.mostrarCategorias(flujo, { ...nuevo, estadoInterno: 'PEDIDO_CATEGORIAS' }, contexto, avisos ? `${avisos} Elige otra cosa:` : undefined);
    }
    if (!nuevo.modalidad) {
      nuevo.estadoInterno = 'PEDIDO_MODALIDAD';
      return {
        nuevoEstado: 'PEDIDO_MODALIDAD',
        acciones: [{ tipo: 'enviarBotones', texto: antes(`${anotado}¿Cómo lo quieres?`), botones: BOTONES_PEDIDO_MODALIDAD }],
        nuevoFlujo: { ...flujo, estado: 'PEDIDO_MODALIDAD', pedido: nuevo },
      };
    }
    if (nuevo.modalidad === 'DELIVERY' && !nuevo.entrega?.lat) {
      nuevo.estadoInterno = 'PEDIDO_UBICACION';
      return {
        nuevoEstado: 'PEDIDO_UBICACION',
        acciones: [{ tipo: 'enviarBotones', texto: antes(`${anotado}${TEXTOS_BOT.pedidoPedirUbicacion()}`), botones: BOTONES_PEDIDO_UBICACION }],
        nuevoFlujo: { ...flujo, estado: 'PEDIDO_UBICACION', pedido: nuevo },
      };
    }
    const r = this.avanzarHaciaCheckout(flujo, nuevo, contexto);
    if (avisos) r.acciones = [{ tipo: 'enviarTexto', texto: avisos }, ...r.acciones];
    return r;
  }

  private despacharPaso(
    estado: EstadoPedidoFlujo,
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion | null {
    estado = normalizarEstadoUbicacion(estado);
    switch (estado) {
      case 'PEDIDO_PROG_DIA':
        return this.pasoProgDia(flujo, pedido, entrada, contexto);

      case 'PEDIDO_PROG_HORA':
        return this.pasoProgHora(flujo, pedido, entrada, contexto);

      case 'PEDIDO_PAGO_CAMINO':
        return this.pasoPagoCamino(flujo, pedido, entrada, contexto);

      case 'PEDIDO_MODALIDAD':
        return this.pasoModalidad(flujo, pedido, entrada, contexto);

      case 'PEDIDO_UBICACION':
        return this.pasoUbicacion(flujo, pedido, entrada, contexto);

      case 'PEDIDO_CATEGORIAS':
        return this.pasoCategorias(flujo, pedido, entrada, contexto);

      case 'PEDIDO_PRODUCTOS':
        return this.pasoProductos(flujo, pedido, entrada, contexto);

      case 'PEDIDO_TAMANO':
        return this.pasoTamano(flujo, pedido, entrada, contexto);

      case 'PEDIDO_GRUPO_OPCION':
        return this.pasoGrupoOpcion(flujo, pedido, entrada, contexto);

      case 'PEDIDO_SABOR':
        return this.pasoSabor(flujo, pedido, entrada, contexto);

      case 'PEDIDO_NOTA':
        return this.pasoNota(flujo, pedido, entrada, contexto);

      case 'PEDIDO_CANTIDAD':
        return this.pasoCantidad(flujo, pedido, entrada, contexto);

      case 'PEDIDO_COMBO_PARTE':
        return this.pasoComboParte(flujo, pedido, entrada, contexto);

      case 'PEDIDO_COMBO_CONFIRMAR':
        return this.pasoComboConfirmar(flujo, pedido, entrada, contexto);

      case 'PEDIDO_NOMBRES_ENVASE':
        return this.pasoNombresEnvase(flujo, pedido, entrada, contexto);

      case 'PEDIDO_NOMBRES_CONFIRMAR':
        return this.pasoNombresConfirmar(flujo, pedido, entrada, contexto);

      case 'PEDIDO_ACCION_CARRITO':
      case 'PEDIDO_VER_CARRITO':
        return this.pasoVerCarrito(flujo, pedido, entrada, contexto);

      case 'PEDIDO_QUITAR_ITEM':
        return this.pasoQuitarItem(flujo, pedido, entrada, contexto);

      case 'PEDIDO_CONFIRMAR_NOMBRE':
        return this.pasoConfirmarNombre(flujo, pedido, entrada, contexto);

      case 'PEDIDO_INGRESAR_NOMBRE':
        return this.pasoIngresarNombre(flujo, pedido, entrada, contexto);

      case 'PEDIDO_INGRESAR_TELEFONO':
        return this.pasoIngresarTelefono(flujo, pedido, entrada, contexto);

      case 'PEDIDO_MEDIO_PAGO':
        return this.pasoMedioPago(flujo, pedido, entrada, contexto);

      case 'PEDIDO_MONTO_EFECTIVO':
        return this.pasoMontoEfectivo(flujo, pedido, entrada, contexto);

      case 'PEDIDO_PAGO_DIV_MEDIO1':
      case 'PEDIDO_PAGO_DIV_MEDIO2':
      case 'PEDIDO_PAGO_DIV_MEDIO3':
        return this.pasoDivMedio(estado, flujo, pedido, entrada, contexto);

      case 'PEDIDO_PAGO_DIV_MONTO':
        return this.pasoDivMonto(flujo, pedido, entrada, contexto);

      case 'PEDIDO_COMPROBANTE_TIPO':
        return this.pasoComprobanteTipo(flujo, pedido, entrada, contexto);

      case 'PEDIDO_COMPROBANTE_DNI':
        return this.pasoComprobanteDni(flujo, pedido, entrada, contexto);

      case 'PEDIDO_COMPROBANTE_RUC':
        return this.pasoComprobanteRuc(flujo, pedido, entrada, contexto);

      case 'PEDIDO_COMPROBANTE_RAZON':
        return this.pasoComprobanteRazon(flujo, pedido, entrada, contexto);

      case 'PEDIDO_RESUMEN_CONFIRMAR':
        return this.pasoResumenConfirmar(flujo, pedido, entrada, contexto);

      case 'PEDIDO_PROPINA':
        return this.pasoPropina(flujo, pedido, entrada, contexto, false);

      case 'PEDIDO_PROPINA_MONTO':
        return this.pasoPropina(flujo, pedido, entrada, contexto, true);

      default:
        return this.renderizarEstado('PEDIDO_CATEGORIAS', flujo, pedido, contexto);
    }
  }

  // -------------------------------------------------------------------------
  // PASO 0 (solo local cerrado con «programar fuera de horario»): ¿para qué día y hora?
  // -------------------------------------------------------------------------
  private mostrarDiasProgramar(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    contexto: ContextoConversacion,
    pagina: number,
  ): ResultadoTransicion {
    const dias = contexto.programacion?.dias ?? [];
    if (dias.length === 0) {
      return {
        nuevoEstado: 'MENU',
        acciones: [{ tipo: 'enviarBotones', texto: TEXTOS_PROGRAMAR.sinHorarios(), botones: [BOTON_VOLVER_MENU] }],
        nuevoFlujo: { ...flujo, estado: 'MENU', pedido: null },
      };
    }
    // Un solo día disponible: no se pregunta, se pasa directo a la hora
    if (dias.length === 1 && dias[0].horas.length > 0) {
      return this.mostrarHorasProgramar(flujo, { ...pedido, programadoFecha: dias[0].fecha, estadoInterno: 'PEDIDO_PROG_HORA' }, contexto, 0);
    }
    const inicio = pagina * FILAS_PROGRAMAR_POR_PAGINA;
    const filas: FilaLista[] = dias.slice(inicio, inicio + FILAS_PROGRAMAR_POR_PAGINA).map((d) => ({ id: `ped_prog_dia_${d.fecha}`, titulo: tituloFilaDia(d.fecha), descripcion: `${d.horas.length} horarios disponibles` }));
    if (dias.length > inicio + FILAS_PROGRAMAR_POR_PAGINA) filas.push({ id: 'ped_prog_dia_mas', titulo: 'Ver más días', descripcion: 'Ver los días siguientes' });
    return {
      nuevoEstado: 'PEDIDO_PROG_DIA',
      acciones: [{ tipo: 'enviarLista', texto: TEXTOS_PROGRAMAR.preguntaDia(), botonTexto: 'Elegir día', filas }],
      nuevoFlujo: { ...flujo, estado: 'PEDIDO_PROG_DIA', pedido: { ...pedido, estadoInterno: 'PEDIDO_PROG_DIA', paginaProg: pagina } },
    };
  }

  private pasoProgDia(flujo: FlujoConversacion, pedido: EstadoCarritoPedido, entrada: EntradaNormalizada, contexto: ContextoConversacion): ResultadoTransicion {
    const dias = contexto.programacion?.dias ?? [];
    const id = entrada.id ?? '';
    if (id === 'ped_prog_dia_mas') return this.mostrarDiasProgramar(flujo, pedido, contexto, (pedido.paginaProg ?? 0) + 1);
    const elegido = id.startsWith('ped_prog_dia_') ? dias.find((d) => d.fecha === id.slice('ped_prog_dia_'.length)) : undefined;
    if (!elegido) {
      const r = this.mostrarDiasProgramar(flujo, pedido, contexto, pedido.paginaProg ?? 0);
      r.acciones = [{ tipo: 'enviarTexto', texto: TEXTOS_PROGRAMAR.diaNoValido() }, ...r.acciones];
      return r;
    }
    return this.mostrarHorasProgramar(flujo, { ...pedido, programadoFecha: elegido.fecha, estadoInterno: 'PEDIDO_PROG_HORA' }, contexto, 0);
  }

  private mostrarHorasProgramar(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    contexto: ContextoConversacion,
    pagina: number,
  ): ResultadoTransicion {
    const fecha = pedido.programadoFecha!;
    const horas = contexto.programacion?.dias.find((d) => d.fecha === fecha)?.horas ?? [];
    if (horas.length === 0) return this.mostrarDiasProgramar(flujo, { ...pedido, programadoFecha: undefined, estadoInterno: 'PEDIDO_PROG_DIA' }, contexto, 0);
    const inicio = pagina * FILAS_PROGRAMAR_POR_PAGINA;
    const filas: FilaLista[] = horas.slice(inicio, inicio + FILAS_PROGRAMAR_POR_PAGINA).map((h) => ({ id: `ped_prog_hora_${h.hora}`, titulo: h.hora }));
    if (horas.length > inicio + FILAS_PROGRAMAR_POR_PAGINA) filas.push({ id: 'ped_prog_hora_mas', titulo: 'Ver más horas' });
    if ((contexto.programacion?.dias.length ?? 0) > 1) filas.push({ id: 'ped_prog_otro_dia', titulo: 'Elegir otro día' });
    return {
      nuevoEstado: 'PEDIDO_PROG_HORA',
      acciones: [{ tipo: 'enviarLista', texto: TEXTOS_PROGRAMAR.preguntaHora(fecha), botonTexto: 'Elegir hora', filas }],
      nuevoFlujo: { ...flujo, estado: 'PEDIDO_PROG_HORA', pedido: { ...pedido, estadoInterno: 'PEDIDO_PROG_HORA', paginaProg: pagina } },
    };
  }

  private pasoProgHora(flujo: FlujoConversacion, pedido: EstadoCarritoPedido, entrada: EntradaNormalizada, contexto: ContextoConversacion): ResultadoTransicion {
    const id = entrada.id ?? '';
    if (id === 'ped_prog_otro_dia') return this.mostrarDiasProgramar(flujo, { ...pedido, programadoFecha: undefined, estadoInterno: 'PEDIDO_PROG_DIA' }, contexto, 0);
    if (id === 'ped_prog_hora_mas') return this.mostrarHorasProgramar(flujo, pedido, contexto, (pedido.paginaProg ?? 0) + 1);
    const horas = contexto.programacion?.dias.find((d) => d.fecha === pedido.programadoFecha)?.horas ?? [];
    const elegida = id.startsWith('ped_prog_hora_') ? horas.find((h) => h.hora === id.slice('ped_prog_hora_'.length)) : undefined;
    if (!elegida) {
      const r = this.mostrarHorasProgramar(flujo, pedido, contexto, pedido.paginaProg ?? 0);
      r.acciones = [{ tipo: 'enviarTexto', texto: TEXTOS_PROGRAMAR.horaNoValida() }, ...r.acciones];
      return r;
    }
    const nuevoPedido: EstadoCarritoPedido = { ...pedido, programadoPara: elegida.iso, programadoFecha: undefined, paginaProg: undefined, estadoInterno: 'PEDIDO_MODALIDAD' };
    return {
      nuevoEstado: 'PEDIDO_MODALIDAD',
      // Un solo mensaje: lo programado y la pregunta que sigue
      acciones: [{ tipo: 'enviarBotones', texto: `${TEXTOS_PROGRAMAR.programadoOk(elegida.iso)}\n\n${TEXTOS_BOT.pedidoModalidad()}`, botones: BOTONES_PEDIDO_MODALIDAD }],
      nuevoFlujo: { ...flujo, estado: 'PEDIDO_MODALIDAD', pedido: nuevoPedido },
    };
  }

  /** Pedido programado: «Pagar al recibir» o «Dejarlo pagado» (Yape, Plin o transferencia con captura). */
  private preguntarCaminoPago(flujo: FlujoConversacion, pedido: EstadoCarritoPedido): ResultadoTransicion {
    return {
      nuevoEstado: 'PEDIDO_PAGO_CAMINO',
      acciones: [{ tipo: 'enviarBotones', texto: TEXTOS_PROGRAMAR.preguntaCaminoPago(), botones: BOTONES_PEDIDO_CAMINO_PAGO }],
      nuevoFlujo: { ...flujo, estado: 'PEDIDO_PAGO_CAMINO', pedido: { ...pedido, estadoInterno: 'PEDIDO_PAGO_CAMINO' } },
    };
  }

  private pasoPagoCamino(flujo: FlujoConversacion, pedido: EstadoCarritoPedido, entrada: EntradaNormalizada, contexto: ContextoConversacion): ResultadoTransicion {
    const t = entrada.texto || '';
    const pagado = entrada.id === 'ped_camino_pagado' || t.includes('pagado');
    const recibir = entrada.id === 'ped_camino_recibir' || t.includes('recibir');
    if (!pagado && !recibir) return this.preguntarCaminoPago(flujo, pedido);
    if (pagado && this.mediosDelPedido({ ...pedido, pagoCamino: 'DEJAR_PAGADO' }, contexto).length === 0) {
      const r = this.mostrarOpcionesPago(flujo, { ...pedido, pagoCamino: 'AL_RECIBIR' }, contexto);
      r.acciones = [{ tipo: 'enviarTexto', texto: TEXTOS_PROGRAMAR.sinMediosDigitales() }, ...r.acciones];
      return r;
    }
    return this.mostrarOpcionesPago(flujo, { ...pedido, pagoCamino: pagado ? 'DEJAR_PAGADO' : 'AL_RECIBIR' }, contexto);
  }

  /** Medios que puede elegir: los del bot; en un pedido programado que se deja pagado, solo Yape, Plin y transferencia. */
  private mediosDelPedido(pedido: EstadoCarritoPedido, contexto: ContextoConversacion): MedioPagoBot[] {
    const activos = mediosActivos(contexto.datosLocalPublicos);
    return pedido.programadoPara && pedido.pagoCamino === 'DEJAR_PAGADO' ? activos.filter((m) => MEDIOS_DIGITALES.includes(m)) : activos;
  }

  // -------------------------------------------------------------------------
  // PASO 1: Modalidad (Delivery vs Para recoger)
  // -------------------------------------------------------------------------
  private pasoModalidad(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const esDelivery =
      entrada.id === 'ped_mod_delivery' ||
      entrada.texto.includes('delivery') ||
      entrada.texto.includes('domicilio') ||
      entrada.textoOriginal.toLowerCase().includes('delivery');

    const esRecoger =
      entrada.id === 'ped_mod_recojer' ||
      entrada.id === 'ped_mod_llevar' ||
      entrada.texto.includes('recoger') ||
      entrada.texto.includes('llevar') ||
      entrada.texto.includes('retiro');

    if (esDelivery) {
      return this.pedirUbicacion(flujo, { ...pedido, modalidad: 'DELIVERY' });
    }

    if (esRecoger) {
      const nuevoPedido: EstadoCarritoPedido = {
        ...pedido,
        modalidad: 'RECOGER',
        entrega: { modalidad: 'RECOGER', tarifaEnvio: 0 },
        estadoInterno: 'PEDIDO_CATEGORIAS',
      };
      return this.seguirTrasModalidad(flujo, nuevoPedido, contexto, TEXTOS_BOT.pedidoRecojoConfirmado());
    }

    // Entrada no reconocida en modalidad
    return {
      nuevoEstado: 'PEDIDO_MODALIDAD',
      acciones: [
        {
          tipo: 'enviarBotones',
          texto: `${PREFIJO_NO_ENTENDI} ¿Lo quieres con delivery o para recoger?`,
          botones: BOTONES_PEDIDO_MODALIDAD,
        },
      ],
      nuevoFlujo: flujo,
    };
  }

  // -------------------------------------------------------------------------
  // PASO 2: Ubicación (delivery): solo la ubicación actual que manda WhatsApp
  // -------------------------------------------------------------------------
  /** Pide la ubicación en un solo mensaje, con la instrucción del clip (sin otras opciones). */
  private pedirUbicacion(flujo: FlujoConversacion, pedido: EstadoCarritoPedido): ResultadoTransicion {
    return {
      nuevoEstado: 'PEDIDO_UBICACION',
      acciones: [{ tipo: 'enviarBotones', texto: TEXTOS_BOT.pedidoPedirUbicacion(), botones: BOTONES_PEDIDO_UBICACION }],
      nuevoFlujo: {
        ...flujo,
        estado: 'PEDIDO_UBICACION',
        pedido: { ...pedido, estadoInterno: 'PEDIDO_UBICACION' },
      },
    };
  }

  private pasoUbicacion(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    if (entrada.id === 'ped_mod_recojer' || (!entrada.id && /\b(recoger|recojo|retiro|retirar|llevar|paso por|voy a)\b/.test(entrada.texto) && !entrada.ubicacion)) {
      const nuevoPedido: EstadoCarritoPedido = {
        ...pedido,
        modalidad: 'RECOGER',
        entrega: { modalidad: 'RECOGER', tarifaEnvio: 0 },
        estadoInterno: 'PEDIDO_CATEGORIAS',
      };
      return this.seguirTrasModalidad(flujo, nuevoPedido, contexto, TEXTOS_BOT.pedidoRecojoConfirmado());
    }

    const ubicacion = entrada.ubicacion;
    // Una dirección escrita no se puede ubicar en el mapa: se explica cómo mandar la ubicación (o recoger) sin repetir lo mismo
    if (!ubicacion || !Number.isFinite(ubicacion.latitud) || !Number.isFinite(ubicacion.longitud)) {
      if (!entrada.id && entrada.textoOriginal.length >= 6 && !pedido.ubicacionReintento) {
        const nuevo: EstadoCarritoPedido = { ...pedido, ubicacionReintento: true, estadoInterno: 'PEDIDO_UBICACION' };
        return {
          nuevoEstado: 'PEDIDO_UBICACION',
          acciones: [{ tipo: 'enviarBotones', texto: TEXTOS_BOT.pedidoUbicacionEscrita(), botones: BOTONES_PEDIDO_UBICACION_FALLIDA }],
          nuevoFlujo: { ...flujo, estado: 'PEDIDO_UBICACION', pedido: nuevo },
        };
      }
      return this.pedirUbicacion(flujo, pedido);
    }

    // El servidor ya consultó la zona de ese punto (ejecutor): fuera de cobertura se avisa y se ofrece recoger
    if (contexto.resultadoEnvio && !contexto.resultadoEnvio.cubierto) {
      return {
        nuevoEstado: 'PEDIDO_UBICACION',
        acciones: [{ tipo: 'enviarBotones', texto: TEXTOS_BOT.pedidoFueraDeCobertura(), botones: BOTONES_PEDIDO_UBICACION_FALLIDA }],
        nuevoFlujo: { ...flujo, estado: 'PEDIDO_UBICACION', pedido: { ...pedido, estadoInterno: 'PEDIDO_UBICACION' } },
      };
    }

    // Ubicación recibida: zona, tarifa y coordenadas en el pedido; categorías en el mismo mensaje
    const { entrega, envio, esGratis } = this.entregaDesdePunto(pedido, contexto, {
      lat: ubicacion.latitud,
      lng: ubicacion.longitud,
      direccion: ubicacion.direccion || ubicacion.nombre,
    });
    const nuevoPedido: EstadoCarritoPedido = { ...pedido, modalidad: 'DELIVERY', entrega, estadoInterno: 'PEDIDO_CATEGORIAS' };
    return this.seguirTrasModalidad(flujo, nuevoPedido, contexto, TEXTOS_BOT.pedidoUbicacionExitosa(envio, esGratis));
  }

  /** Carrito guardado: se muestra lo que lleva y se pregunta cómo seguir (un solo mensaje). */
  private retomarCarrito(flujo: FlujoConversacion, pedido: EstadoCarritoPedido, contexto: ContextoConversacion): ResultadoTransicion {
    const nuevo: EstadoCarritoPedido = { ...pedido, itemEnConfiguracion: undefined, colaFrase: undefined, estadoInterno: 'PEDIDO_ACCION_CARRITO' };
    const subtotal = Number(nuevo.items.reduce((acc, i) => acc + i.subtotal, 0).toFixed(2));
    return {
      nuevoEstado: 'PEDIDO_ACCION_CARRITO',
      acciones: [
        {
          tipo: 'enviarBotones',
          texto: `Tienes un pedido a medias 🛒
${this.lineasResumen(nuevo, contexto)}
*Subtotal:* S/ ${subtotal.toFixed(2)}

¿Seguimos con él?`,
          botones: BOTONES_PEDIDO_RETOMAR,
        },
      ],
      nuevoFlujo: { ...flujo, estado: 'PEDIDO_ACCION_CARRITO', pedido: nuevo },
    };
  }

  /** Con modalidad (y ubicación) ya resueltas: si el carrito ya tiene productos se sigue al pago; si no, a elegirlos. */
  private seguirTrasModalidad(flujo: FlujoConversacion, pedido: EstadoCarritoPedido, contexto: ContextoConversacion, textoCategorias: string): ResultadoTransicion {
    if (pedido.items.length > 0) return this.avanzarHaciaCheckout(flujo, { ...pedido, estadoInterno: 'PEDIDO_ACCION_CARRITO' }, contexto);
    return this.mostrarCategorias(flujo, pedido, contexto, textoCategorias);
  }

  /** Entrega DELIVERY con zona, tarifa y envío gratis según la cobertura resuelta para el punto. */
  private entregaDesdePunto(
    pedido: EstadoCarritoPedido,
    contexto: ContextoConversacion,
    punto: { lat: number; lng: number; direccion?: string },
  ): { entrega: NonNullable<EstadoCarritoPedido['entrega']>; envio: number | null; esGratis: boolean } {
    const resEnvio = contexto.resultadoEnvio;
    // Envío con las reglas del servidor (zona + promo de envío gratis por horario con casilla BOT). Sin tarifa, por calcular.
    const tarifaZona = resEnvio?.tarifa ?? null;
    const envio = contexto.vistaPreviaPedido?.envio ?? null;
    const esGratis = envio === 0;

    const entrega: NonNullable<EstadoCarritoPedido['entrega']> = {
      modalidad: 'DELIVERY',
      lat: punto.lat,
      lng: punto.lng,
      origen: 'WHATSAPP',
      zonaId: resEnvio?.zona?.id ? String(resEnvio.zona.id) : undefined,
      zonaNombre: resEnvio?.zona?.nombre,
      tarifaEnvio: envio,
      tarifaZona,
      direccion: punto.direccion,
    };
    return { entrega, envio, esGratis };
  }

  // -------------------------------------------------------------------------
  // PASO 3: Categorías
  // -------------------------------------------------------------------------
  private pasoCategorias(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const categorias = contexto.categoriasCarta || [];

    // Paginación de categorías
    if (entrada.id?.startsWith('ped_cat_pag_')) {
      const nuevaPagina = parseInt(entrada.id.replace('ped_cat_pag_', ''), 10) || 1;
      const nuevoPedido = { ...pedido, paginaCategorias: nuevaPagina };
      return this.mostrarCategorias(flujo, nuevoPedido, contexto);
    }

    // Selección de categoría
    const catIdMatch = entrada.id?.startsWith('ped_cat_')
      ? entrada.id.replace('ped_cat_', '')
      : null;

    let categoria = categorias.find((c) => String(c.id) === catIdMatch);
    if (!categoria) {
      categoria = categorias.find((c) => normalizarTexto(c.nombre) === entrada.texto) ?? categorias.find((c) => categoriaCoincide(c.nombre, entrada.texto));
    }

    if (!categoria) {
      return this.mostrarCategorias(flujo, pedido, contexto, `${PREFIJO_NO_ENTENDI} ¿Qué categoría te provoca?`);
    }

    const nuevoPedido: EstadoCarritoPedido = {
      ...pedido,
      categoriaSeleccionadaId: String(categoria.id),
      paginaProductos: 1,
      estadoInterno: 'PEDIDO_PRODUCTOS',
    };

    return this.mostrarProductosDeCategoria(flujo, nuevoPedido, categoria, contexto);
  }

  // -------------------------------------------------------------------------
  // PASO 4: Productos de la Categoría
  // -------------------------------------------------------------------------
  private pasoProductos(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const categorias = contexto.categoriasCarta || [];
    const prodIdMatch = entrada.id?.startsWith('ped_prod_')
      ? entrada.id.replace('ped_prod_', '')
      : null;

    const catId = pedido.categoriaSeleccionadaId;
    let categoria = categorias.find((c) => String(c.id) === String(catId));

    if (!categoria && prodIdMatch) {
      categoria = categorias.find((c) =>
        (c.productos || []).some((p: any) => String(p.id) === prodIdMatch),
      );
      if (categoria) {
        pedido.categoriaSeleccionadaId = String(categoria.id);
      }
    }

    if (!categoria) {
      return this.mostrarCategorias(flujo, pedido, contexto);
    }

    // Volver a categorías
    if (entrada.id === 'btn_categorias' || entrada.texto.includes('categoria')) {
      return this.mostrarCategorias(flujo, pedido, contexto);
    }

    // Paginación de productos (lista) y «Ver lista completa» del carrusel
    if (entrada.id?.startsWith('ped_prod_pag_')) {
      const nuevaPagina = parseInt(entrada.id.replace('ped_prod_pag_', ''), 10) || 1;
      const nuevoPedido = { ...pedido, paginaProductos: nuevaPagina };
      return this.mostrarProductosDeCategoria(flujo, nuevoPedido, categoria, contexto, undefined, true);
    }
    if (entrada.id?.startsWith('ped_prod_mas_')) {
      const n = Math.max(2, parseInt(entrada.id.replace('ped_prod_mas_', ''), 10) || 2);
      const productos = ordenarPorVentas(
        (categoria.productos || []).filter((p: any) => !productoAgotado(p) && !ocultoEnBot(p, contexto)),
        contexto.ventasProductos,
      );
      if ((n - 1) * 10 >= productos.length) {
        return this.mostrarProductosDeCategoria(flujo, { ...pedido, paginaProductos: 1 }, categoria, contexto, undefined, true);
      }
      return {
        nuevoEstado: 'PEDIDO_PRODUCTOS',
        acciones: this.accionesPaginaCarrusel(productos, n, categoria, contexto, {} as AccionMensaje),
        nuevoFlujo: { ...flujo, estado: 'PEDIDO_PRODUCTOS', pedido: { ...pedido, estadoInterno: 'PEDIDO_PRODUCTOS' } },
      };
    }
    if (entrada.id === 'ped_prod_lista') {
      return this.mostrarProductosDeCategoria(flujo, { ...pedido, paginaProductos: 1 }, categoria, contexto, undefined, true);
    }

    // Selección de producto
    let producto = (categoria.productos || []).find((p: any) => String(p.id) === prodIdMatch);
    if (!producto) {
      producto = (categoria.productos || []).find(
        (p: any) => normalizarTexto(p.nombre) === entrada.texto,
      );
    }

    if (!producto) {
      return this.mostrarProductosDeCategoria(
        flujo,
        pedido,
        categoria,
        contexto,
        PREFIJO_NO_ENTENDI,
        true,
      );
    }

    // Validar disponibilidad / agotado (Mockup: no sigue el flujo del agotado y ofrece alternativas)
    if (productoAgotado(producto) || ocultoEnBot(producto, contexto)) {
      const alternativas = (categoria.productos || [])
        .filter((p: any) => p.id !== producto.id && !productoAgotado(p) && !ocultoEnBot(p, contexto))
        .map((p: any) => p.nombre)
        .slice(0, 2);

      return {
        nuevoEstado: 'PEDIDO_PRODUCTOS',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: TEXTOS_BOT.pedidoProductoAgotado(producto.nombre, alternativas),
            botones: [
              { id: `ped_cat_${categoria.id}`, titulo: 'Ver productos' },
              { id: 'btn_categorias', titulo: 'Ver categorías' },
              BOTON_VOLVER_MENU,
            ],
          },
        ],
        nuevoFlujo: flujo,
      };
    }

    // Iniciar configuración del producto
    const configInicial: ItemEnConfiguracionBot = {
      productoId: String(producto.id),
      productoNombre: producto.nombre,
      categoriaId: String(categoria.id),
      categoriaNombre: categoria.nombre,
      precioBase: Number(producto.precio),
      opciones: [],
      grupoIndexActual: 0,
      cantidad: 1,
      noSumaBeneficios: Boolean(producto.noSumaBeneficios),
    };

    // Combo que el bot vende: sus partes se eligen tras la cantidad; aquí solo se presenta
    const comboOferta = comboVendibleBot(contexto.ofertas, String(producto.id));
    let introCombo: AccionMensaje[] = [];
    if (comboOferta) {
      configInicial.combo = iniciarCombo(comboOferta);
      introCombo = [
        {
          tipo: 'enviarTexto',
          texto: TEXTOS_COMBO.intro(comboOferta.nombre, configInicial.combo.fijas.map((f) => f.nombre), plantillasCombo(contexto).intro),
        },
      ];
    }

    const nuevoPedido: EstadoCarritoPedido = {
      ...pedido,
      productoSeleccionadoId: String(producto.id),
      itemEnConfiguracion: configInicial,
    };

    const conIntro = (r: ResultadoTransicion): ResultadoTransicion => ({ ...r, acciones: [...introCombo, ...r.acciones] });

    // A. ¿Tiene tamaños / variantes? Solo se ofrecen los que caben en lo que queda (docena no cabe en 3)
    const tamanosOfrecidos = tamanosQueCaben(producto);
    if (tamanosOfrecidos.length > 1) {
      return conIntro(this.preguntarTamano(flujo, nuevoPedido, producto, TEXTOS_BOT.pedidoPreguntarTamano(producto.nombre)));
    }

    // Si solo cabe un tamaño, asignar su precio base
    if (tamanosOfrecidos.length === 1) {
      configInicial.tamanoId = String(tamanosOfrecidos[0].id);
      configInicial.tamanoNombre = tamanosOfrecidos[0].nombre;
      configInicial.precioBase = Number(tamanosOfrecidos[0].precio);
    }

    // B. Pasar a grupos de opciones o cantidad
    return conIntro(this.avanzarConfiguracionProducto(flujo, nuevoPedido, producto, contexto));
  }

  // -------------------------------------------------------------------------
  // PASO 4.1: Tamaño
  // -------------------------------------------------------------------------
  private pasoTamano(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const config = pedido.itemEnConfiguracion;
    if (!config) return this.mostrarCategorias(flujo, pedido, contexto);

    const categorias = contexto.categoriasCarta || [];
    const cat = categorias.find((c) => String(c.id) === config.categoriaId);
    const prod = (cat?.productos || []).find((p: any) => String(p.id) === config.productoId);

    const tamIdMatch = entrada.id?.startsWith('ped_tam_')
      ? entrada.id.replace('ped_tam_', '')
      : null;

    const caben = tamanosQueCaben(prod);
    let tamano = (prod?.tamanos || []).find((t: any) => String(t.id) === tamIdMatch);
    if (!tamano) {
      tamano = (prod?.tamanos || []).find((t: any) => normalizarTexto(t.nombre) === entrada.texto) ?? (prod?.tamanos || []).find((t: any) => coincideTitulo(t.nombre, entrada.texto));
    }

    // Tamaño que ya no cabe (el stock bajó desde que se mostró la lista): se vuelve a preguntar
    if (tamano && !caben.includes(tamano)) {
      return this.preguntarTamano(flujo, pedido, prod, `Solo quedan ${quedanDeProducto(prod)} de ${prod.nombre} 😅 Elige otro tamaño:`);
    }
    if (!tamano && caben.length > 1) {
      // Ni botón ni nombre de tamaño: se vuelve a preguntar (nunca se elige uno por el cliente)
      return this.preguntarTamano(flujo, pedido, prod, `${PREFIJO_NO_ENTENDI} ${TEXTOS_BOT.pedidoPreguntarTamano(prod.nombre)}`);
    }
    if (!tamano && caben.length === 1) tamano = caben[0];

    if (tamano) {
      config.tamanoId = String(tamano.id);
      config.tamanoNombre = tamano.nombre;
      config.precioBase = Number(tamano.precio);
    }

    return this.avanzarConfiguracionProducto(flujo, pedido, prod, contexto);
  }

  /** Pregunta el tamaño con los que caben en lo que queda (la docena puede no caber aunque la media quepa). */
  private preguntarTamano(flujo: FlujoConversacion, pedido: EstadoCarritoPedido, prod: any, texto: string): ResultadoTransicion {
    pedido.estadoInterno = 'PEDIDO_TAMANO';
    const botones: BotonAccion[] = tamanosQueCaben(prod)
      .slice(0, 3)
      .map((t: any) => ({ id: `ped_tam_${t.id}`, titulo: `${t.nombre} S/${Number(t.precio).toFixed(0)}`.slice(0, 20) }));
    return {
      nuevoEstado: 'PEDIDO_TAMANO',
      acciones: [{ tipo: 'enviarBotones', texto, botones }],
      nuevoFlujo: { ...flujo, estado: 'PEDIDO_TAMANO', pedido },
    };
  }

  // -------------------------------------------------------------------------
  // PASO 4.2: Grupos de Opciones (Leche, Endulzante, Toppings, etc.)
  // -------------------------------------------------------------------------
  private pasoGrupoOpcion(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const config = pedido.itemEnConfiguracion;
    if (!config) return this.mostrarCategorias(flujo, pedido, contexto);

    const categorias = contexto.categoriasCarta || [];
    const cat = categorias.find((c) => String(c.id) === config.categoriaId);
    const prod = (cat?.productos || []).find((p: any) => String(p.id) === config.productoId);
    const grupos = gruposDePregunta(prod, config.combo?.ocultaGruposBebida);
    const grupoActual = grupos[config.grupoIndexActual];

    if (!grupoActual) {
      return this.avanzarConfiguracionProducto(flujo, pedido, prod, contexto);
    }

    if (entrada.id === 'ped_per_no' || (!(grupoActual.obligatorio || grupoActual.minimo > 0) && (entrada.texto === 'no' || /asi esta bien|asi nomas|sin nada|nada mas/.test(entrada.texto)))) {
      // Todo lo que queda es opcional: se omite
      config.grupoIndexActual = grupos.length;
      return this.avanzarConfiguracionProducto(flujo, pedido, prod, contexto);
    }
    if (entrada.id === 'ped_per_si' || (!config.personalizar && esSi(entrada.texto))) {
      config.personalizar = true;
      return this.avanzarConfiguracionProducto(flujo, pedido, prod, contexto);
    }
    const esObligatorio = grupoActual.obligatorio || grupoActual.minimo > 0;
    const esNinguno = entrada.id === 'ped_op_ninguno' || entrada.texto === 'ninguno';

    if (esNinguno) {
      if (esObligatorio) {
        return {
          nuevoEstado: 'PEDIDO_GRUPO_OPCION',
          acciones: [
            {
              tipo: 'enviarTexto',
              texto: TEXTOS_BOT.pedidoOpcionObligatoriaFaltante(grupoActual.nombre),
            },
            ...this.construirAccionGrupo(grupoActual),
          ],
          nuevoFlujo: flujo,
        };
      }
      // Opcional y eligió ninguno: avanzar al siguiente grupo
      config.grupoIndexActual++;
      return this.avanzarConfiguracionProducto(flujo, pedido, prod, contexto);
    }

    // Buscar la opción elegida
    const opIdMatch = entrada.id?.startsWith('ped_op_')
      ? entrada.id.replace('ped_op_', '')
      : null;

    // Solo las opciones que se pueden pedir ahora (agotadas o sin stock no se aceptan)
    const pedibles = (grupoActual.opciones || []).filter((o: any) => o.disponible !== false);
    let opcion = pedibles.find((o: any) => String(o.id) === opIdMatch);
    if (!opcion) {
      opcion = pedibles.find(
        (o: any) => normalizarTexto(o.nombre) === entrada.texto,
      ) ?? pedibles.find((o: any) => coincideTitulo(o.nombre, entrada.texto));
    }

    if (!opcion && esObligatorio) {
      return {
        nuevoEstado: 'PEDIDO_GRUPO_OPCION',
        acciones: [
          {
            tipo: 'enviarTexto',
            texto: TEXTOS_BOT.pedidoOpcionObligatoriaFaltante(grupoActual.nombre),
          },
          ...this.construirAccionGrupo(grupoActual),
        ],
        nuevoFlujo: flujo,
      };
    }

    if (opcion) {
      config.opciones.push({
        opcionId: String(opcion.id),
        nombre: opcion.nombre,
        precioExtra: Number(opcion.precioExtra || 0),
        grupoId: String(grupoActual.id),
        grupoNombre: grupoActual.nombre,
      });
    }

    config.grupoIndexActual++;
    return this.avanzarConfiguracionProducto(flujo, pedido, prod, contexto);
  }

  // -------------------------------------------------------------------------
  // PASO 4.3: Sabor
  // -------------------------------------------------------------------------
  private pasoSabor(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const config = pedido.itemEnConfiguracion;
    if (!config) return this.mostrarCategorias(flujo, pedido, contexto);

    const prodStock = productoDeCarta(contexto.categoriasCarta || [], config.productoId);
    if (prodStock?.saboresConStock) return this.pasoSaborStock(flujo, pedido, entrada, contexto, prodStock);

    if (entrada.id?.startsWith('ped_sab_')) {
      config.sabor = entrada.textoOriginal;
    } else if (entrada.textoOriginal.length > 0 && entrada.textoOriginal !== 'omitir') {
      config.sabor = entrada.textoOriginal;
    }

    return this.preguntarCantidad(flujo, pedido, config, contexto);
  }

  /** Stock por sabor: un solo sabor por línea; las unidades que consume son tamaño × cantidad. */
  private pasoSaborStock(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
    prod: any,
  ): ResultadoTransicion {
    const config = pedido.itemEnConfiguracion as ItemEnConfiguracionBot;
    const pedibles = saboresPedibles(prod);
    const saborId = entrada.id?.startsWith('ped_sab_') ? entrada.id.replace('ped_sab_', '') : null;
    const elegido =
      pedibles.find((s: any) => String(s.id) === saborId) ||
      pedibles.find((s: any) => normalizarTexto(s.nombre) === entrada.texto);
    if (!elegido) {
      return this.preguntarSaborStock(flujo, pedido, prod, 'Elige un sabor de la lista:');
    }

    const unidades = unidadesDeTamano(prod, config.tamanoId) * config.cantidad;
    if (typeof elegido.quedan === 'number' && unidades > elegido.quedan) {
      return this.preguntarSaborStock(flujo, pedido, prod, TEXTOS_BOT.pedidoSoloQuedanSabor(elegido.quedan, elegido.nombre));
    }

    config.sabores = [{ saborId: String(elegido.id), nombre: elegido.nombre, cantidad: unidades }];
    return this.agregarLineaConfigurada(flujo, pedido, contexto);
  }

  /** Lista de sabores disponibles (un mensaje). Sin ninguno, el producto queda agotado. */
  private preguntarSaborStock(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    prod: any,
    texto: string,
  ): ResultadoTransicion {
    const config = pedido.itemEnConfiguracion;
    const unidadesTam = unidadesDeTamano(prod, config?.tamanoId);
    const unidades = unidadesTam * (config?.cantidad ?? 1);
    const pedibles = saboresPedibles(prod);
    // Lo que cabe de un solo sabor: el saldo de cada sabor es su tope (no se mezcla en la línea)
    const maxPorSabor = Math.floor(Math.max(0, ...pedibles.map((s: any) => (typeof s.quedan === 'number' ? s.quedan : Infinity))) / unidadesTam);
    if (pedibles.length === 0 || maxPorSabor < 1) {
      return {
        nuevoEstado: 'PEDIDO_CATEGORIAS',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: TEXTOS_BOT.pedidoProductoAgotado(prod.nombre),
            botones: [{ id: 'btn_categorias', titulo: 'Ver categorías' }, BOTON_VOLVER_MENU],
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'PEDIDO_CATEGORIAS',
          pedido: { ...pedido, estadoInterno: 'PEDIDO_CATEGORIAS', itemEnConfiguracion: undefined },
        },
      };
    }
    // Ningún sabor tiene las unidades de esta cantidad: se pide menos, sin ofrecer sabores que no alcanzan
    if (saboresQueCaben(prod, unidades).length === 0) {
      pedido.estadoInterno = 'PEDIDO_CANTIDAD';
      return {
        nuevoEstado: 'PEDIDO_CANTIDAD',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: `Ningún sabor de ${prod.nombre} tiene ${unidades} unidades. ¿Cuántas quieres?`,
            botones: botonesHasta(maxPorSabor),
          },
        ],
        nuevoFlujo: { ...flujo, estado: 'PEDIDO_CANTIDAD', pedido },
      };
    }
    pedido.estadoInterno = 'PEDIDO_SABOR';
    return {
      nuevoEstado: 'PEDIDO_SABOR',
      acciones: [listaSaboresStock(prod, texto, unidades)],
      nuevoFlujo: { ...flujo, estado: 'PEDIDO_SABOR', pedido },
    };
  }

  // -------------------------------------------------------------------------
  // PASO 4.4: Notas
  // -------------------------------------------------------------------------
  private pasoNota(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const config = pedido.itemEnConfiguracion;
    if (!config) return this.mostrarCategorias(flujo, pedido, contexto);

    if (
      entrada.id !== 'ped_nota_sin' &&
      entrada.id !== 'ped_continuar' &&
      entrada.texto !== 'sin notas' &&
      entrada.textoOriginal.length > 0
    ) {
      config.nota = entrada.textoOriginal.slice(0, 150);
    }

    return this.preguntarCantidad(flujo, pedido, config, contexto);
  }

  /**
   * Cantidad de la línea: NO se pregunta, se asume 1 (o la que dijo en su frase); el resumen la muestra y «mejor que sean 3» la corrige.
   * Solo la piden los productos con sabor por stock (la lista de sabores depende de las unidades) y los combos con elecciones.
   */
  private preguntarCantidad(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    config: ItemEnConfiguracionBot,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const prod = productoDeCarta(contexto.categoriasCarta || [], config.productoId);
    // (los combos con elecciones también la piden: cada combo multiplica las elecciones y su cantidad no se corrige después)
    if (!prod?.saboresConStock && !config.combo) return this.continuarTrasCantidad(flujo, pedido, config, contexto);
    pedido.estadoInterno = 'PEDIDO_CANTIDAD';
    return {
      nuevoEstado: 'PEDIDO_CANTIDAD',
      acciones: [
        {
          tipo: 'enviarBotones',
          texto: TEXTOS_BOT.pedidoPreguntarCantidad(config.productoNombre, lineaAvisoStock(prod, contexto)),
          botones: this.botonesCantidad(config.productoId, contexto, config.tamanoId),
        },
      ],
      nuevoFlujo: { ...flujo, estado: 'PEDIDO_CANTIDAD', pedido },
    };
  }

  // -------------------------------------------------------------------------
  // PASO 4.5: Cantidad y Agregar al Carrito
  // -------------------------------------------------------------------------
  private pasoCantidad(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const config = pedido.itemEnConfiguracion;
    if (!config) return this.mostrarCategorias(flujo, pedido, contexto);

    let cantidad = 1;
    if (entrada.id === 'ped_cant_1') cantidad = 1;
    else if (entrada.id === 'ped_cant_2') cantidad = 2;
    else if (entrada.id === 'ped_cant_3') cantidad = 3;
    else {
      // «3», «tres», «quiero 2», «1 unidad»; si no hay ningún número se vuelve a preguntar (antes se asumía 1 sin avisar)
      const palabra = entrada.texto.split(' ').map((w) => NUMEROS_PALABRA[w]).find((n) => n);
      const num = /\d/.test(entrada.textoOriginal) ? parseInt(entrada.textoOriginal.replace(/\D/g, ''), 10) : (palabra ?? NaN);
      if (isNaN(num) || num <= 0) {
        return {
          nuevoEstado: 'PEDIDO_CANTIDAD',
          acciones: [
            {
              tipo: 'enviarBotones',
              texto: `${PREFIJO_NO_ENTENDI} ${TEXTOS_BOT.pedidoPreguntarCantidad(config.productoNombre, lineaAvisoStock(productoDeCarta(contexto.categoriasCarta || [], config.productoId), contexto))}`,
              botones: this.botonesCantidad(config.productoId, contexto, config.tamanoId),
            },
          ],
          nuevoFlujo: { ...flujo, estado: 'PEDIDO_CANTIDAD', pedido },
        };
      }
      cantidad = Math.min(9999, num); // Sin tope de negocio; 9999 solo evita desbordes por un error de tecleo
    }

    // Productos que controlan stock: no se acepta más que lo que queda (cantidad × unidades del tamaño)
    const quedan = this.quedanProducto(config.productoId, contexto);
    const prodCarta = productoDeCarta(contexto.categoriasCarta || [], config.productoId);
    if (quedan !== null && cantidad * unidadesDeTamano(prodCarta, config.tamanoId) > quedan) {
      return {
        nuevoEstado: 'PEDIDO_CANTIDAD',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: `Solo quedan ${quedan} de ${config.productoNombre} 😅 ¿Cuántas quieres?`,
            botones: this.botonesCantidad(config.productoId, contexto, config.tamanoId),
          },
        ],
        nuevoFlujo: { ...flujo, estado: 'PEDIDO_CANTIDAD', pedido },
      };
    }

    config.cantidad = cantidad;

    // Stock por sabor: después de la cantidad se elige el sabor (una lista, un solo sabor por línea)
    const prodStock = productoDeCarta(contexto.categoriasCarta || [], config.productoId);
    if (prodStock?.saboresConStock) {
      return this.preguntarSaborStock(flujo, pedido, prodStock, TEXTOS_BOT.pedidoPreguntarSabor());
    }

    return this.continuarTrasCantidad(flujo, pedido, config, contexto);
  }

  /**
   * Tras la cantidad: partes del combo (alternativas y listas), nombres de envase y, al final, el resumen/línea.
   * Se vuelve a llamar al terminar las partes: `partesListas` evita repetir el paso.
   */
  private continuarTrasCantidad(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    config: ItemEnConfiguracionBot,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    if (config.combo && !config.combo.partesListas) {
      const oferta = comboVendibleBot(contexto.ofertas, config.productoId);
      if (!oferta || !armarPasosCombo(config.combo, oferta, config.cantidad, contexto.categoriasCarta || [])) {
        return this.mostrarCategorias(flujo, { ...pedido, itemEnConfiguracion: undefined }, contexto, TEXTOS_COMBO.noDisponible(config.combo.nombre));
      }
      if (config.combo.pasos.length > 0) {
        if (config.cantidad > MAX_COMBOS_CON_ELECCION) {
          pedido.estadoInterno = 'PEDIDO_CANTIDAD';
          return {
            nuevoEstado: 'PEDIDO_CANTIDAD',
            acciones: [
              {
                tipo: 'enviarBotones',
                texto: TEXTOS_COMBO.maximo(config.combo.nombre, MAX_COMBOS_CON_ELECCION),
                botones: this.botonesCantidad(config.productoId, contexto, config.tamanoId),
              },
            ],
            nuevoFlujo: { ...flujo, estado: 'PEDIDO_CANTIDAD', pedido },
          };
        }
        pedido.estadoInterno = 'PEDIDO_COMBO_PARTE';
        return {
          nuevoEstado: 'PEDIDO_COMBO_PARTE',
          acciones: accionesPasoCombo(config.combo, plantillasCombo(contexto)),
          nuevoFlujo: { ...flujo, estado: 'PEDIDO_COMBO_PARTE', pedido },
        };
      }
      config.combo.partesListas = true;
    }

    // Bebidas: cada envase lleva un nombre distinto en su etiqueta; se piden uno por uno
    if (this.esBebidaConNombres(config.categoriaNombre) || this.bebidasDeCombo(config).length > 0) {
      // Combo que volvió a elegir una parte: los nombres ya escritos se conservan si siguen completos
      if (config.nombresEnvase?.length === this.totalEnvases(config)) return this.agregarLineaConfigurada(flujo, pedido, contexto);
      config.nombresEnvase = [];
      // Un solo envase y se conoce su nombre: va a nombre de quien escribe, sin preguntar (en el resumen se ve y se puede cambiar)
      const primero = this.primerNombre(flujo, contexto);
      if (this.totalEnvases(config) === 1 && primero) {
        config.nombresEnvase = [primero];
        return this.agregarLineaConfigurada(flujo, pedido, contexto);
      }
      return this.preguntarNombreEnvase(flujo, pedido, config, contexto);
    }

    return this.agregarLineaConfigurada(flujo, pedido, contexto);
  }

  private pasoComboParte(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const config = pedido.itemEnConfiguracion;
    if (!config?.combo) return this.mostrarCategorias(flujo, pedido, contexto);
    const r = procesarEntradaCombo(config.combo, entrada, plantillasCombo(contexto));
    if (r.estado === 'reiniciar') return this.reiniciarCombo(flujo, pedido, config, entrada, contexto);
    if (r.estado === 'listo') {
      config.combo.partesListas = true;
      return this.continuarTrasCantidad(flujo, pedido, config, contexto);
    }
    pedido.estadoInterno = 'PEDIDO_COMBO_PARTE';
    return { nuevoEstado: 'PEDIDO_COMBO_PARTE', acciones: r.acciones, nuevoFlujo: { ...flujo, estado: 'PEDIDO_COMBO_PARTE', pedido } };
  }

  /** Vuelve a elegir el combo desde cero (tamaño, opciones y partes). */
  private reiniciarCombo(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    config: ItemEnConfiguracionBot,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const r = this.pasoProductos(
      flujo,
      { ...pedido, categoriaSeleccionadaId: config.categoriaId, itemEnConfiguracion: undefined },
      { ...entrada, id: `ped_prod_${config.productoId}`, texto: '' },
      contexto,
    );
    return { ...r, acciones: [{ tipo: 'enviarTexto', texto: TEXTOS_COMBO.nuevamente() }, ...r.acciones] };
  }

  /** Resumen del combo armado y confirmación antes de agregarlo. */
  private confirmarCombo(flujo: FlujoConversacion, pedido: EstadoCarritoPedido, config: ItemEnConfiguracionBot): ResultadoTransicion {
    const combo = config.combo!;
    const extras = config.opciones.reduce((s, o) => s + o.precioExtra, 0);
    const detalles = [...config.opciones.map((o) => o.nombre), ...detalleCombo(combo)];
    pedido.estadoInterno = 'PEDIDO_COMBO_CONFIRMAR';
    return {
      nuevoEstado: 'PEDIDO_COMBO_CONFIRMAR',
      acciones: [
        {
          tipo: 'enviarBotones',
          texto: TEXTOS_COMBO.resumen(combo.nombre, config.tamanoNombre, detalles, config.cantidad, (config.precioBase + extras) * config.cantidad),
          botones: BOTONES_COMBO_CONFIRMAR,
        },
      ],
      nuevoFlujo: { ...flujo, estado: 'PEDIDO_COMBO_CONFIRMAR', pedido },
    };
  }

  private pasoComboConfirmar(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const config = pedido.itemEnConfiguracion;
    if (!config?.combo) return this.mostrarCategorias(flujo, pedido, contexto);
    if (entrada.id === 'ped_combo_ok' || ['si', 'ok', 'listo', 'agregar'].includes(entrada.texto)) {
      config.combo.confirmado = true;
      return this.agregarLineaConfigurada(flujo, pedido, contexto);
    }
    if (entrada.id === 'ped_combo_cambiar' || ['no', 'cambiar', 'atras'].includes(entrada.texto)) {
      return this.reiniciarCombo(flujo, pedido, config, entrada, contexto);
    }
    return this.confirmarCombo(flujo, pedido, config);
  }

  /** Unidades que quedan de un producto que controla stock (null si no lo controla). */
  private quedanProducto(productoId: string, contexto: ContextoConversacion): number | null {
    for (const cat of contexto.categoriasCarta || []) {
      const p = (cat.productos || []).find((x: any) => String(x.id) === String(productoId));
      if (p) return typeof p.quedan === 'number' ? p.quedan : null;
    }
    return null;
  }

  /** Botones 1/2/3 cantidades, sin ofrecer más de lo que cabe (unidades del tamaño × cantidad <= lo que queda). */
  private botonesCantidad(productoId: string, contexto: ContextoConversacion, tamanoId?: string): BotonAccion[] {
    return botonesCantidadDe(productoDeCarta(contexto.categoriasCarta || [], productoId), tamanoId);
  }

  private esBebidaConNombres(categoriaNombre: string): boolean {
    const n = normalizarTexto(categoriaNombre || '').toUpperCase();
    return ['FRAPPES', 'ICED', 'FROZEN', 'CALIENTES'].includes(n);
  }

  /** Bebidas elegidas de un combo (grupos «Bebida 1 · Bebida»): cada una lleva su propio envase. */
  private bebidasDeCombo(config: ItemEnConfiguracionBot) {
    return config.opciones.filter((o) => {
      const g = o.grupoNombre || '';
      return g.includes(' · ') && /^bebida/i.test(g.split(' · ')[1].trim());
    });
  }

  private nombreEnvase(config: ItemEnConfiguracionBot, indice: number): string {
    const bebidas = this.bebidasDeCombo(config);
    return bebidas.length > 0 ? bebidas[indice % bebidas.length].nombre : config.productoNombre;
  }

  private totalEnvases(config: ItemEnConfiguracionBot): number {
    return config.cantidad * (this.bebidasDeCombo(config).length || 1);
  }

  /** Primer nombre real del cliente (el del perfil de WhatsApp o de su cuenta); '' si no hay uno confiable. */
  private primerNombre(flujo: FlujoConversacion, contexto: ContextoConversacion): string {
    const n = nombreParaSaludo(flujo.nombre_perfil_wa || contexto.nombreCliente).split(/\s+/)[0] ?? '';
    return /^\p{L}{2,14}$/u.test(n) ? n : '';
  }

  private preguntarNombreEnvase(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    config: ItemEnConfiguracionBot,
    contexto?: ContextoConversacion,
  ): ResultadoTransicion {
    const hechos = config.nombresEnvase?.length || 0;
    pedido.estadoInterno = 'PEDIDO_NOMBRES_ENVASE';
    const texto = TEXTOS_BOT.pedidoPedirNombreEnvase(this.nombreEnvase(config, hechos), hechos + 1, this.totalEnvases(config));
    const primero = contexto ? this.primerNombre(flujo, contexto) : '';
    const acciones: AccionMensaje[] = [
      primero && this.totalEnvases(config) > 1 && hechos === 0
        ? { tipo: 'enviarBotones', texto, botones: [{ id: 'ped_nom_todos', titulo: `Todos: ${primero}`.slice(0, 20) }] }
        : { tipo: 'enviarTexto', texto },
    ];
    return {
      nuevoEstado: 'PEDIDO_NOMBRES_ENVASE',
      acciones,
      nuevoFlujo: { ...flujo, estado: 'PEDIDO_NOMBRES_ENVASE', pedido, nombre_perfil_wa: flujo.nombre_perfil_wa },
    };
  }

  private confirmarNombresEnvase(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    config: ItemEnConfiguracionBot,
  ): ResultadoTransicion {
    pedido.estadoInterno = 'PEDIDO_NOMBRES_CONFIRMAR';
    return {
      nuevoEstado: 'PEDIDO_NOMBRES_CONFIRMAR',
      acciones: [
        {
          tipo: 'enviarBotones',
          texto: TEXTOS_BOT.pedidoConfirmarNombresEnvases(config.productoNombre, config.nombresEnvase || []),
          botones: BOTONES_PEDIDO_NOMBRES_ENVASE,
        },
      ],
      nuevoFlujo: { ...flujo, estado: 'PEDIDO_NOMBRES_CONFIRMAR', pedido },
    };
  }

  private pasoNombresEnvase(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const config = pedido.itemEnConfiguracion;
    if (!config) return this.mostrarCategorias(flujo, pedido, contexto);

    const total = this.totalEnvases(config);
    if (entrada.id === 'ped_nom_todos') {
      config.nombresEnvase = Array.from({ length: total }, () => this.primerNombre(flujo, contexto) || 'Cliente');
      return this.agregarLineaConfigurada(flujo, pedido, contexto);
    }
    const texto = entrada.textoOriginal.trim();
    if (!texto || entrada.id) {
      return this.preguntarNombreEnvase(flujo, pedido, config, contexto);
    }

    const nombres = config.nombresEnvase || [];
    // «Ana, Luis, Rosa» o «Ana y Luis»: todos los nombres juntos
    const separados = texto.split(/\s*(?:,|;|\s+y\s+)\s*/).map((n) => n.trim()).filter(Boolean);
    if (nombres.length === 0 && total > 1 && separados.length === total) {
      config.nombresEnvase = separados.map((n) => n.slice(0, 30));
    } else {
      config.nombresEnvase = [...nombres, texto.slice(0, 30)];
    }

    if ((config.nombresEnvase?.length || 0) < total) {
      return this.preguntarNombreEnvase(flujo, pedido, config, contexto);
    }
    // Lo escrito es la confirmación: sin «¿está correcto?»
    return this.agregarLineaConfigurada(flujo, pedido, contexto);
  }

  private pasoNombresConfirmar(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const config = pedido.itemEnConfiguracion;
    if (!config) return this.mostrarCategorias(flujo, pedido, contexto);

    if (entrada.id === 'ped_nom_si' || esSi(entrada.texto)) {
      return this.agregarLineaConfigurada(flujo, pedido, contexto);
    }
    if (entrada.id === 'ped_nom_no' || entrada.texto === 'no') {
      config.nombresEnvase = [];
      return this.preguntarNombreEnvase(flujo, pedido, config);
    }
    return this.confirmarNombresEnvase(flujo, pedido, config);
  }

  private agregarLineaConfigurada(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const config = pedido.itemEnConfiguracion;
    if (!config) return this.mostrarCategorias(flujo, pedido, contexto);
    if (config.combo && !config.combo.confirmado) return this.confirmarCombo(flujo, pedido, config);
    const cantidad = config.cantidad;

    // Calcular precio unitario y subtotal de la línea
    const extrasTotal = config.opciones.reduce((s, o) => s + o.precioExtra, 0);
    const precioUnitario = Number((config.precioBase + extrasTotal).toFixed(2));
    const subtotalLinea = Number((precioUnitario * cantidad).toFixed(2));

    // Límite de seguridad: máximo 30 líneas por pedido
    if (pedido.items.length >= 30) {
      return {
        nuevoEstado: 'PEDIDO_VER_CARRITO',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: 'Has alcanzado el límite máximo de 30 productos en tu pedido.',
            botones: BOTONES_PEDIDO_VER_CARRITO,
          },
        ],
        nuevoFlujo: flujo,
      };
    }

    const nuevaLinea: LineaCarritoBot = {
      lineaId: `lin_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      productoId: config.productoId,
      productoNombre: config.productoNombre,
      categoriaId: config.categoriaId,
      categoriaNombre: config.categoriaNombre,
      tamanoId: config.tamanoId,
      tamanoNombre: config.tamanoNombre,
      cantidad,
      precioUnitario,
      subtotal: subtotalLinea,
      opciones: config.opciones,
      sabor: config.sabor,
      ...(config.sabores ? { sabores: [...config.sabores] } : {}),
      nota: config.nota,
      noSumaBeneficios: config.noSumaBeneficios,
      personas: config.nombresEnvase && config.nombresEnvase.length > 0 ? [...config.nombresEnvase] : undefined,
      // Combo con elecciones: mismo contrato que la carta (el servidor crea las líneas hijas y descuenta el stock)
      ...(config.combo && eleccionesParaServidor(config.combo).length > 0
        ? {
            ofertaId: config.combo.ofertaId,
            comboElecciones: eleccionesParaServidor(config.combo),
            comboDetalle: detalleCombo(config.combo),
          }
        : {}),
    };

    const nuevosItems = [...pedido.items, nuevaLinea];

    const nuevoPedido: EstadoCarritoPedido = {
      ...pedido,
      items: nuevosItems,
      itemEnConfiguracion: undefined,
      estadoInterno: 'PEDIDO_ACCION_CARRITO',
    };

    // Pedido dicho en una frase: sin «Agregué… ¿algo más?» por cada producto; sigue el siguiente o se cierra de una vez
    if (nuevoPedido.desdeFrase) return this.siguienteDeCola(flujo, nuevoPedido, contexto);

    return {
      nuevoEstado: 'PEDIDO_ACCION_CARRITO',
      acciones: [
        {
          tipo: 'enviarBotones',
          texto: TEXTOS_BOT.pedidoProductoAgregado(config.productoNombre, subtotalLinea, config.cantidad, lineaAvisoStock(productoDeCarta(contexto.categoriasCarta || [], config.productoId), contexto)),
          botones: BOTONES_PEDIDO_ACCION_CARRITO,
        },
      ],
      nuevoFlujo: {
        ...flujo,
        estado: 'PEDIDO_ACCION_CARRITO',
        pedido: nuevoPedido,
      },
    };
  }

  // -------------------------------------------------------------------------
  // PASO 5: Ver Carrito y Acciones (Continuar, Agregar otro, Quitar)
  // -------------------------------------------------------------------------
  private pasoVerCarrito(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    if (entrada.id === 'ped_nuevo') {
      return this.renderizarEstado('PEDIDO_MODALIDAD', { ...flujo, pedido: null }, { estadoInterno: 'PEDIDO_MODALIDAD', items: [], idempotenciaPaso: `step_${Date.now()}` }, contexto);
    }

    // «mejor que sean 3», «en vez de 2, 3»: cambia la cantidad de lo último que pidió
    const cambioCantidad = !entrada.id ? RE_CAMBIO_CANTIDAD.exec(entrada.texto) : null;
    if (cambioCantidad && pedido.items.length > 0) {
      const n = Number(cambioCantidad[1] ?? cambioCantidad[2]);
      const ultimo = pedido.items[pedido.items.length - 1];
      if (n >= 1 && n <= 99 && !ultimo.ofertaId && !ultimo.sabores) {
        // La cantidad ya no se pregunta: al corregirla se respeta lo que queda en stock
        const quedan = this.quedanProducto(String(ultimo.productoId), contexto);
        const prodCorr = productoDeCarta(contexto.categoriasCarta || [], String(ultimo.productoId));
        if (quedan !== null && n * unidadesDeTamano(prodCorr, (ultimo as any).tamanoId) > quedan) {
          return {
            nuevoEstado: flujo.estado,
            acciones: [{ tipo: 'enviarBotones', texto: `Solo quedan ${quedan} de ${ultimo.productoNombre} 😅 Dime otra cantidad (por ejemplo «mejor que sean ${Math.max(1, quedan)}»).`, botones: BOTONES_PEDIDO_ACCION_CARRITO }],
            nuevoFlujo: flujo,
          };
        }
        const items = pedido.items.map((i) => (i === ultimo ? { ...i, cantidad: n, subtotal: Number((i.precioUnitario * n).toFixed(2)), personas: i.personas ? Array.from({ length: n }, (_, k) => i.personas![k % i.personas!.length]) : undefined } : i));
        return this.pasoVerCarrito(flujo, { ...pedido, items, estadoInterno: 'PEDIDO_VER_CARRITO' }, { ...entrada, id: 'ped_ver_carrito', texto: 'carrito' }, contexto);
      }
    }

    // «quitar el cheesecake»: lo quita sin pasar por la lista
    if (!entrada.id && RE_QUITAR.test(entrada.texto)) {
      const linea = pedido.items.find((i) => {
        const k = normalizarTexto(i.productoNombre).split(' ').filter((w) => w.length > 3);
        return k.length > 0 && k.some((w) => entrada.texto.includes(w.replace(/s$/, '')));
      });
      if (linea) return this.pasoQuitarItem(flujo, { ...pedido, estadoInterno: 'PEDIDO_QUITAR_ITEM' }, { ...entrada, id: `ped_del_${linea.lineaId}` }, contexto);
    }

    if (entrada.id === 'ped_otro' || entrada.texto.includes('agregar') || /\b(otro|otra|algo mas|quiero mas)\b/.test(entrada.texto)) {
      const nuevoPedido: EstadoCarritoPedido = {
        ...pedido,
        estadoInterno: 'PEDIDO_CATEGORIAS',
      };
      return this.mostrarCategorias(flujo, nuevoPedido, contexto);
    }

    if (entrada.id === 'ped_quitar' || entrada.texto.includes('quitar')) {
      const nuevoPedido: EstadoCarritoPedido = {
        ...pedido,
        estadoInterno: 'PEDIDO_QUITAR_ITEM',
      };
      const filasQuitar: FilaLista[] = pedido.items.slice(0, 10).map((item, idx) => ({
        id: `ped_del_${item.lineaId}`,
        titulo: `${idx + 1}. ${item.productoNombre}`.slice(0, 24),
        descripcion: `${item.cantidad}x · S/ ${item.subtotal.toFixed(2)}`.slice(0, 72),
      }));

      return {
        nuevoEstado: 'PEDIDO_QUITAR_ITEM',
        acciones: [
          {
            tipo: 'enviarLista',
            texto: 'Elige el producto que deseas quitar de tu pedido:',
            botonTexto: 'Quitar producto',
            filas: filasQuitar,
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'PEDIDO_QUITAR_ITEM',
          pedido: nuevoPedido,
        },
      };
    }

    if (entrada.id === 'ped_ver_carrito' || entrada.texto.includes('resumen') || entrada.texto.includes('carrito')) {
      const subtotal = Number(pedido.items.reduce((s, i) => s + i.subtotal, 0).toFixed(2));
      const lineasTexto = pedido.items
        .map((i) => {
          const detalles = detallesLinea(i);
          const detTxt = detalles.length > 0 ? ` (${detalles.join(' · ')})` : '';
          return `• ${i.cantidad}x ${i.productoNombre}${detTxt} — S/ ${i.subtotal.toFixed(2)}`;
        })
        .join('\n');

      return {
        nuevoEstado: 'PEDIDO_VER_CARRITO',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: TEXTOS_BOT.pedidoVerCarrito(lineasTexto, subtotal),
            botones: BOTONES_PEDIDO_VER_CARRITO,
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'PEDIDO_VER_CARRITO',
          pedido,
        },
      };
    }

    // Continuar hacia el checkout: botón, «sí / ok / dale», «eso es todo»; otro texto vuelve a mostrar el carrito (no avanza solo)
    if (entrada.id?.includes('continuar') || esSi(entrada.texto) || /\b(continuar|continua|seguir|siguiente|nada mas|eso es todo|seria todo|es todo|ya esta|pagar|pago)\b/.test(entrada.texto)) {
      return this.avanzarHaciaCheckout(flujo, pedido, contexto);
    }
    return this.pasoVerCarrito(flujo, pedido, { ...entrada, id: 'ped_ver_carrito', texto: 'carrito' }, contexto);
  }

  // -------------------------------------------------------------------------
  // PASO 5.1: Quitar Producto del Carrito
  // -------------------------------------------------------------------------
  private pasoQuitarItem(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const lineaId = entrada.id?.startsWith('ped_del_')
      ? entrada.id.replace('ped_del_', '')
      : null;

    const itemEliminar = pedido.items.find((i) => i.lineaId === lineaId);
    const nuevosItems = pedido.items.filter((i) => i.lineaId !== lineaId);

    if (nuevosItems.length === 0) {
      const nuevoPedido: EstadoCarritoPedido = {
        ...pedido,
        items: [],
        estadoInterno: 'PEDIDO_CATEGORIAS',
      };
      return this.mostrarCategorias(flujo, nuevoPedido, contexto, TEXTOS_BOT.pedidoCarritoVacio());
    }

    const nuevoPedido: EstadoCarritoPedido = {
      ...pedido,
      items: nuevosItems,
      estadoInterno: 'PEDIDO_VER_CARRITO',
    };

    const nombreEliminado = itemEliminar?.productoNombre || 'el producto';
    const subtotal = Number(nuevosItems.reduce((s, i) => s + i.subtotal, 0).toFixed(2));
    const lineasTexto = nuevosItems
      .map((i) => `• ${i.cantidad}x ${i.productoNombre} — S/ ${i.subtotal.toFixed(2)}`)
      .join('\n');

    return {
      nuevoEstado: 'PEDIDO_VER_CARRITO',
      acciones: [
        {
          tipo: 'enviarTexto',
          texto: TEXTOS_BOT.pedidoProductoEliminado(nombreEliminado),
        },
        {
          tipo: 'enviarBotones',
          texto: TEXTOS_BOT.pedidoVerCarrito(lineasTexto, subtotal),
          botones: BOTONES_PEDIDO_VER_CARRITO,
        },
      ],
      nuevoFlujo: {
        ...flujo,
        estado: 'PEDIDO_VER_CARRITO',
        pedido: nuevoPedido,
      },
    };
  }

  // -------------------------------------------------------------------------
  // PASO 8: Datos del Cliente (Nombre y Teléfono)
  // -------------------------------------------------------------------------
  private pasoConfirmarNombre(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    if (entrada.id === 'ped_nombre_ok' || entrada.texto.includes('si')) {
      const nombreFinal =
        flujo.nombre_perfil_wa || contexto.nombreCliente || 'Cliente WhatsApp';
      const nuevoPedido: EstadoCarritoPedido = {
        ...pedido,
        cliente: {
          ...(pedido.cliente || {}),
          nombre: nombreFinal,
        },
      };
      return this.avanzarHaciaCheckout(flujo, nuevoPedido, contexto);
    }

    if (entrada.id === 'ped_nombre_otro' || entrada.texto.includes('otro')) {
      const nuevoPedido: EstadoCarritoPedido = {
        ...pedido,
        estadoInterno: 'PEDIDO_INGRESAR_NOMBRE',
      };
      return {
        nuevoEstado: 'PEDIDO_INGRESAR_NOMBRE',
        acciones: [
          {
            tipo: 'enviarTexto',
            texto: TEXTOS_BOT.pedidoIngresarNombre(),
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'PEDIDO_INGRESAR_NOMBRE',
          pedido: nuevoPedido,
        },
      };
    }

    // Si escribió su nombre directamente
    if (entrada.textoOriginal.length >= 2) {
      const nuevoPedido: EstadoCarritoPedido = {
        ...pedido,
        cliente: {
          ...(pedido.cliente || {}),
          nombre: entrada.textoOriginal.slice(0, 80),
        },
      };
      return this.avanzarHaciaCheckout(flujo, nuevoPedido, contexto);
    }

    return this.avanzarHaciaCheckout(flujo, pedido, contexto);
  }

  private pasoIngresarNombre(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const nombre = entrada.textoOriginal.trim();
    if (nombre.length < 2) {
      return {
        nuevoEstado: 'PEDIDO_INGRESAR_NOMBRE',
        acciones: [
          {
            tipo: 'enviarTexto',
            texto: 'Por favor escribe tu nombre y apellido (al menos 2 caracteres):',
          },
        ],
        nuevoFlujo: flujo,
      };
    }

    const nuevoPedido: EstadoCarritoPedido = {
      ...pedido,
      cliente: {
        ...(pedido.cliente || {}),
        nombre: nombre.slice(0, 80),
      },
    };

    return this.avanzarHaciaCheckout(flujo, nuevoPedido, contexto);
  }

  private pasoIngresarTelefono(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    if (entrada.id === 'ped_tel_mismo' && pedido.telefonoSugerido) {
      return this.avanzarHaciaCheckout(
        flujo,
        { ...pedido, cliente: { ...(pedido.cliente || {}), telefono: pedido.telefonoSugerido } },
        contexto,
      );
    }
    if (entrada.id === 'ped_tel_otro') {
      return {
        nuevoEstado: 'PEDIDO_INGRESAR_TELEFONO',
        acciones: [{ tipo: 'enviarTexto', texto: TEXTOS_BOT.pedidoIngresarTelefono() }],
        nuevoFlujo: { ...flujo, estado: 'PEDIDO_INGRESAR_TELEFONO', pedido: { ...pedido, telefonoSugerido: undefined } },
      };
    }

    const rawTel = entrada.textoOriginal.replace(/\D/g, '').replace(/^51(?=9\d{8}$)/, '');
    const esValido = /^9\d{8}$/.test(rawTel) && rawTel !== '999999999';

    if (!esValido) {
      return {
        nuevoEstado: 'PEDIDO_INGRESAR_TELEFONO',
        acciones: [
          {
            tipo: 'enviarTexto',
            texto: TEXTOS_BOT.pedidoTelefonoInvalido(),
          },
        ],
        nuevoFlujo: flujo,
      };
    }

    const nuevoPedido: EstadoCarritoPedido = {
      ...pedido,
      cliente: {
        ...(pedido.cliente || {}),
        telefono: rawTel,
      },
    };

    return this.avanzarHaciaCheckout(flujo, nuevoPedido, contexto);
  }

  // -------------------------------------------------------------------------
  // PASO 9: Medio de Pago
  // -------------------------------------------------------------------------
  /** Medio elegido por id o por texto; null si no reconoce nada. */
  private medioDesdeEntrada(entrada: EntradaNormalizada): MedioPagoBot | null {
    const id = entrada.id || '';
    const txt = entrada.texto;
    if (id === 'ped_pago_efectivo' || txt.includes('efectivo')) return 'EFECTIVO';
    if (id === 'ped_pago_yape' || txt.includes('yape')) return 'YAPE';
    if (id === 'ped_pago_plin' || txt.includes('plin')) return 'PLIN';
    if (id === 'ped_pago_tarjeta' || txt.includes('tarjeta') || txt.includes('pos')) return 'TARJETA';
    if (id === 'ped_pago_transf' || txt.includes('transferencia')) return 'TRANSFERENCIA';
    return null;
  }

  private pasoMedioPago(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    // Un pedido programado no divide el pago (se elige uno de los dos caminos y un solo medio)
    if (!pedido.programadoPara && (entrada.id === 'ped_pago_dividir' || entrada.texto.includes('2 medios') || entrada.texto.includes('dividir'))) {
      return this.mostrarMediosDivididos('PEDIDO_PAGO_DIV_MEDIO1', flujo, { ...pedido, pago: undefined }, contexto);
    }
    const metodo = this.medioDesdeEntrada(entrada);
    if (!metodo) {
      return this.mostrarOpcionesPago(flujo, pedido, contexto, false);
    }
    const activos = this.mediosDelPedido(pedido, contexto);
    if (!activos.includes(metodo)) {
      // Medio apagado en el bot: no se acepta; se responde amable y se vuelven a mostrar los disponibles
      const res = this.mostrarOpcionesPago(flujo, pedido, contexto, false);
      res.acciones = [{ tipo: 'enviarTexto', texto: textoMedioNoDisponible(metodo, activos) }, ...res.acciones];
      return res;
    }
    return this.aplicarMedioUnico(flujo, pedido, metodo, contexto);
  }

  /** Un solo medio para todo el total. */
  private aplicarMedioUnico(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    metodo: MedioPagoBot,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    if (metodo === 'EFECTIVO') {
      return this.pedirMontoEfectivo(flujo, { ...pedido, pago: { metodo: 'EFECTIVO' } }, calcularTotales(pedido, contexto.vistaPreviaPedido).aCobrar);
    }
    const nuevoPedido: EstadoCarritoPedido = { ...pedido, pago: { metodo } };
    const res = this.avanzarHaciaCheckout(flujo, nuevoPedido, contexto);
    if (metodo === 'TARJETA') {
      const aviso =
        pedido.modalidad === 'DELIVERY'
          ? 'Pagas con tarjeta al recibir; el repartidor lleva el POS. No necesitas enviar voucher ni vuelto.'
          : 'Pagas con tarjeta en caja al recoger. No necesitas enviar voucher ni vuelto.';
      res.acciones = [{ tipo: 'enviarTexto', texto: aviso }, ...res.acciones];
    }
    return res;
  }

  /** «¿Con cuánto pagas?» para `parte` soles en efectivo (el total, o la parte en efectivo del pago dividido). */
  private pedirMontoEfectivo(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    parte: number,
    textoAntes?: string,
  ): ResultadoTransicion {
    const nuevoPedido: EstadoCarritoPedido = { ...pedido, estadoInterno: 'PEDIDO_MONTO_EFECTIVO' };
    return {
      nuevoEstado: 'PEDIDO_MONTO_EFECTIVO',
      acciones: [
        {
          tipo: 'enviarBotones',
          texto: `${textoAntes ? textoAntes + '\n\n' : ''}${TEXTOS_BOT.pedidoMontoEfectivo()}`,
          botones: botonesEfectivo(parte),
        },
      ],
      nuevoFlujo: { ...flujo, estado: 'PEDIDO_MONTO_EFECTIVO', pedido: nuevoPedido },
    };
  }

  private pasoMontoEfectivo(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const totalPedido = calcularTotales(pedido, contexto.vistaPreviaPedido).aCobrar;
    const plan = pedido.pago?.plan;
    // Con pago dividido el efectivo cubre solo su parte
    const parte = plan?.find((f) => f.medio === 'EFECTIVO')?.monto ?? totalPedido;

    let monto: number | null;
    const m = /^ped_paga_(\d+)$/.exec(entrada.id || '');
    if (entrada.id === 'ped_paga_exacto' || esPagoExacto(entrada.textoOriginal)) monto = parte;
    else if (m) monto = Number(m[1]);
    else monto = parsearMonto(entrada.textoOriginal);

    if (monto === null || monto < parte) {
      return {
        nuevoEstado: 'PEDIDO_MONTO_EFECTIVO',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: monto === null ? TEXTOS_BOT.pedidoPagaConSinMonto(parte) : TEXTOS_BOT.pedidoPagaConMenorQueTotal(parte),
            botones: botonesEfectivo(parte),
          },
        ],
        nuevoFlujo: flujo,
      };
    }

    const nuevoPedido: EstadoCarritoPedido = {
      ...pedido,
      pago: {
        ...(plan ? { metodo: pedido.pago!.metodo, plan } : { metodo: 'EFECTIVO' as const }),
        pagaCon: Number(monto.toFixed(2)),
      },
    };

    return this.avanzarHaciaCheckout(flujo, nuevoPedido, contexto);
  }

  // -------------------------------------------------------------------------
  // Pago dividido (2 o 3 medios): mismo plan que carta y mozo (pago.plan)
  // -------------------------------------------------------------------------
  private mostrarMediosDivididos(
    estado: 'PEDIDO_PAGO_DIV_MEDIO1' | 'PEDIDO_PAGO_DIV_MEDIO2' | 'PEDIDO_PAGO_DIV_MEDIO3',
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const d = pedido.pagoDiv;
    const usados = [d?.medio1, estado === 'PEDIDO_PAGO_DIV_MEDIO3' ? d?.medio2 : undefined];
    const { aCobrar: total } = calcularTotales(pedido, contexto.vistaPreviaPedido);
    const resto = Number((total - (d?.monto1 ?? 0) - (estado === 'PEDIDO_PAGO_DIV_MEDIO3' ? (d?.monto2 ?? 0) : 0)).toFixed(2));
    const activos = mediosActivos(contexto.datosLocalPublicos);
    const medios = activos
      .filter((m) => !usados.includes(m))
      .map((m) => ({ id: m === 'TRANSFERENCIA' ? 'ped_pago_transf' : `ped_pago_${m.toLowerCase()}`, titulo: NOMBRE_MEDIO[m] }));
    // La segunda parte puede ser la última (2 medios) o dejar un resto para un tercero (3 medios)
    if (estado === 'PEDIDO_PAGO_DIV_MEDIO2' && !d?.tres && activos.length >= 3) medios.push({ id: 'ped_div_tres', titulo: 'Usar 3 medios' });
    const texto =
      estado === 'PEDIDO_PAGO_DIV_MEDIO1'
        ? `Vas a pagar con 2 o 3 medios. El total es S/ ${total.toFixed(2)}. ¿Con qué medio pagas la primera parte?`
        : estado === 'PEDIDO_PAGO_DIV_MEDIO2'
          ? d?.tres
            ? `Te quedan S/ ${resto.toFixed(2)}. ¿Con qué medio pagas la segunda parte?`
            : `Te quedan S/ ${resto.toFixed(2)} por pagar. ¿Con qué medio pagas el resto?`
          : `Te quedan S/ ${resto.toFixed(2)} por pagar. ¿Con qué medio pagas el resto (tercera parte)?`;
    const op = opcionesMedios(medios);
    const nuevoPedido: EstadoCarritoPedido = { ...pedido, estadoInterno: estado };
    return {
      nuevoEstado: estado,
      acciones: [
        op.filas
          ? { tipo: 'enviarLista', texto, botonTexto: 'Elegir medio de pago', filas: op.filas }
          : { tipo: 'enviarBotones', texto, botones: op.botones! },
      ],
      nuevoFlujo: { ...flujo, estado, pedido: nuevoPedido },
    };
  }

  private pasoDivMedio(
    estado: 'PEDIDO_PAGO_DIV_MEDIO1' | 'PEDIDO_PAGO_DIV_MEDIO2' | 'PEDIDO_PAGO_DIV_MEDIO3',
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const d = pedido.pagoDiv;
    if (estado === 'PEDIDO_PAGO_DIV_MEDIO2' && !d?.tres && (entrada.id === 'ped_div_tres' || entrada.texto.includes('3 medios'))) {
      return this.mostrarMediosDivididos(estado, flujo, { ...pedido, pagoDiv: { ...d, tres: true } }, contexto);
    }
    const medio = this.medioDesdeEntrada(entrada);
    const activos = mediosActivos(contexto.datosLocalPublicos);
    const repetido = (estado !== 'PEDIDO_PAGO_DIV_MEDIO1' && medio === d?.medio1) || (estado === 'PEDIDO_PAGO_DIV_MEDIO3' && medio === d?.medio2);
    if (!medio || !activos.includes(medio) || repetido) {
      return this.mostrarMediosDivididos(estado, flujo, pedido, contexto);
    }
    const { aCobrar: total } = calcularTotales(pedido, contexto.vistaPreviaPedido);

    if (estado === 'PEDIDO_PAGO_DIV_MEDIO1') {
      const nuevoPedido: EstadoCarritoPedido = {
        ...pedido,
        estadoInterno: 'PEDIDO_PAGO_DIV_MONTO',
        pagoDiv: { medio1: medio },
      };
      return {
        nuevoEstado: 'PEDIDO_PAGO_DIV_MONTO',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: `¿Cuánto pagas con ${NOMBRE_MEDIO[medio]}? Escribe un monto menor a S/ ${total.toFixed(2)}.`,
            botones: [{ id: 'ped_div_mitad', titulo: `Mitad (S/ ${(Math.floor((total / 2) * 100) / 100).toFixed(2)})` }],
          },
        ],
        nuevoFlujo: { ...flujo, estado: 'PEDIDO_PAGO_DIV_MONTO', pedido: nuevoPedido },
      };
    }

    // 3 medios: la segunda parte lleva su propio monto y el tercero se queda con el resto
    if (estado === 'PEDIDO_PAGO_DIV_MEDIO2' && d?.tres) {
      const resto = Number((total - (d.monto1 ?? 0)).toFixed(2));
      const nuevoPedido: EstadoCarritoPedido = {
        ...pedido,
        estadoInterno: 'PEDIDO_PAGO_DIV_MONTO',
        pagoDiv: { ...d, medio2: medio },
      };
      return {
        nuevoEstado: 'PEDIDO_PAGO_DIV_MONTO',
        acciones: [{ tipo: 'enviarTexto', texto: `¿Cuánto pagas con ${NOMBRE_MEDIO[medio]}? Escribe un monto menor a S/ ${resto.toFixed(2)}.` }],
        nuevoFlujo: { ...flujo, estado: 'PEDIDO_PAGO_DIV_MONTO', pedido: nuevoPedido },
      };
    }

    // Último medio: el resto se calcula solo
    const monto1 = d!.monto1!;
    const plan: Array<{ medio: MedioPagoBot; monto: number }> =
      estado === 'PEDIDO_PAGO_DIV_MEDIO3'
        ? [
            { medio: d!.medio1!, monto: monto1 },
            { medio: d!.medio2!, monto: d!.monto2! },
            { medio, monto: Number((total - monto1 - d!.monto2!).toFixed(2)) },
          ]
        : [
            { medio: d!.medio1!, monto: monto1 },
            { medio, monto: Number((total - monto1).toFixed(2)) },
          ];
    const nuevoPedido: EstadoCarritoPedido = {
      ...pedido,
      pagoDiv: undefined,
      pago: { metodo: medioPrincipal(plan), plan },
    };
    const ef = plan.find((f) => f.medio === 'EFECTIVO');
    if (ef) {
      return this.pedirMontoEfectivo(flujo, nuevoPedido, ef.monto, `Parte en efectivo: S/ ${ef.monto.toFixed(2)}.`);
    }
    const res = this.avanzarHaciaCheckout(flujo, nuevoPedido, contexto);
    if (plan.some((f) => f.medio === 'TARJETA')) {
      const aviso =
        pedido.modalidad === 'DELIVERY'
          ? 'La parte con tarjeta la pagas al recibir; el repartidor lleva el POS.'
          : 'La parte con tarjeta la pagas en caja al recoger.';
      res.acciones = [{ tipo: 'enviarTexto', texto: aviso }, ...res.acciones];
    }
    return res;
  }

  private pasoDivMonto(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const { aCobrar: total } = calcularTotales(pedido, contexto.vistaPreviaPedido);
    const medio1 = pedido.pagoDiv?.medio1;
    if (!medio1) return this.mostrarMediosDivididos('PEDIDO_PAGO_DIV_MEDIO1', flujo, pedido, contexto);
    // Tercer medio: este monto es el de la segunda parte (debe dejar algo para la tercera)
    const medio2 = pedido.pagoDiv?.medio2;
    if (medio2) {
      const tope = Number((total - (pedido.pagoDiv?.monto1 ?? 0)).toFixed(2));
      const monto2 = parsearMonto(entrada.textoOriginal);
      if (monto2 === null || monto2 <= 0 || monto2 >= tope) {
        return {
          nuevoEstado: 'PEDIDO_PAGO_DIV_MONTO',
          acciones: [
            {
              tipo: 'enviarTexto',
              texto: `El monto con ${NOMBRE_MEDIO[medio2]} debe ser mayor a 0 y menor a S/ ${tope.toFixed(2)}. ¿Cuánto pagas con ${NOMBRE_MEDIO[medio2]}?`,
            },
          ],
          nuevoFlujo: flujo,
        };
      }
      return this.mostrarMediosDivididos(
        'PEDIDO_PAGO_DIV_MEDIO3',
        flujo,
        { ...pedido, pagoDiv: { ...pedido.pagoDiv, monto2: Number(monto2.toFixed(2)) } },
        contexto,
      );
    }
    const monto =
      entrada.id === 'ped_div_mitad' ? Math.floor((total / 2) * 100) / 100 : parsearMonto(entrada.textoOriginal);
    if (monto === null || monto <= 0 || monto >= total) {
      return {
        nuevoEstado: 'PEDIDO_PAGO_DIV_MONTO',
        acciones: [
          {
            tipo: 'enviarTexto',
            texto: `El monto con ${NOMBRE_MEDIO[medio1]} debe ser mayor a 0 y menor a S/ ${total.toFixed(2)}. ¿Cuánto pagas con ${NOMBRE_MEDIO[medio1]}?`,
          },
        ],
        nuevoFlujo: flujo,
      };
    }
    return this.mostrarMediosDivididos(
      'PEDIDO_PAGO_DIV_MEDIO2',
      flujo,
      { ...pedido, pagoDiv: { medio1, monto1: Number(monto.toFixed(2)) } },
      contexto,
    );
  }

  // -------------------------------------------------------------------------
  // PASO 10: Comprobante
  // -------------------------------------------------------------------------
  private pasoComprobanteTipo(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    if (entrada.id === 'ped_comp_simple' || entrada.texto.includes('simple')) {
      // Ticket interno: no pide ningún dato ni va a SUNAT
      return this.avanzarHaciaCheckout(flujo, { ...pedido, comprobante: { tipo: 'SIMPLE' } }, contexto);
    }

    if (entrada.id === 'ped_comp_boleta' || entrada.texto.includes('boleta')) {
      const nuevoPedido: EstadoCarritoPedido = {
        ...pedido,
        comprobante: { tipo: 'BOLETA' },
        estadoInterno: 'PEDIDO_COMPROBANTE_DNI',
      };
      return {
        nuevoEstado: 'PEDIDO_COMPROBANTE_DNI',
        acciones: [
          {
            tipo: 'enviarTexto',
            texto: TEXTOS_BOT.pedidoComprobanteDni(),
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'PEDIDO_COMPROBANTE_DNI',
          pedido: nuevoPedido,
        },
      };
    }

    if (entrada.id === 'ped_comp_factura' || entrada.texto.includes('factura')) {
      const nuevoPedido: EstadoCarritoPedido = {
        ...pedido,
        comprobante: { tipo: 'FACTURA' },
        estadoInterno: 'PEDIDO_COMPROBANTE_RUC',
      };
      return {
        nuevoEstado: 'PEDIDO_COMPROBANTE_RUC',
        acciones: [
          {
            tipo: 'enviarTexto',
            texto: this.textoPedirRuc(contexto),
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'PEDIDO_COMPROBANTE_RUC',
          pedido: nuevoPedido,
        },
      };
    }

    // Otro texto: se vuelve a preguntar el comprobante
    return {
      nuevoEstado: 'PEDIDO_COMPROBANTE_TIPO',
      acciones: [{ tipo: 'enviarBotones', texto: TEXTOS_BOT.pedidoComprobanteTipo(), botones: BOTONES_PEDIDO_COMPROBANTE }],
      nuevoFlujo: { ...flujo, estado: 'PEDIDO_COMPROBANTE_TIPO', pedido: { ...pedido, estadoInterno: 'PEDIDO_COMPROBANTE_TIPO' } },
    };
  }

  private pasoComprobanteDni(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const texto = entrada.textoOriginal.trim();
    const omitir = ['omitir', 'no', 'sin dni'].includes(texto.toLowerCase());
    // Boleta de más de S/ 700: el DNI es obligatorio (SUNAT); el servidor y Caja lo vuelven a exigir
    const { aCobrar, propina } = calcularTotales(pedido, contexto.vistaPreviaPedido);
    const exigeDni = aCobrar - (propina ?? 0) > 700;
    if (omitir ? exigeDni : !/^\d{8}$/.test(texto)) {
      return {
        nuevoEstado: 'PEDIDO_COMPROBANTE_DNI',
        acciones: [
          { tipo: 'enviarTexto', texto: exigeDni ? TEXTOS_BOT.pedidoComprobanteDniObligatorio() : TEXTOS_BOT.pedidoComprobanteDniInvalido() },
        ],
        nuevoFlujo: flujo,
      };
    }

    const nuevoPedido: EstadoCarritoPedido = {
      ...pedido,
      comprobante: {
        tipo: 'BOLETA',
        ...(omitir ? {} : { dni: texto }),
      },
    };

    return this.avanzarHaciaCheckout(flujo, nuevoPedido, contexto);
  }

  private textoPedirRuc(contexto: ContextoConversacion): string {
    const g = contexto.facturaGuardada;
    return g ? TEXTOS_BOT.pedidoComprobanteRucGuardado(`${g.ruc.slice(0, 2)}${'*'.repeat(7)}${g.ruc.slice(-2)}`, g.razonSocial) : TEXTOS_BOT.pedidoComprobanteRuc();
  }

  private pasoComprobanteRuc(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const ruc = entrada.textoOriginal.trim();
    // RUC guardado en la cuenta: «SI» lo usa (con su razón social) y no vuelve a pedir nada
    const guardada = contexto.facturaGuardada;
    if (guardada && /^s[ií]$/i.test(ruc)) {
      return this.avanzarHaciaCheckout(
        flujo,
        { ...pedido, comprobante: { tipo: 'FACTURA', ruc: guardada.ruc, ...(guardada.razonSocial ? { razonSocial: guardada.razonSocial } : {}) } },
        contexto,
      );
    }
    if (!/^(10|15|17|20)\d{9}$/.test(ruc)) {
      return {
        nuevoEstado: 'PEDIDO_COMPROBANTE_RUC',
        acciones: [
          {
            tipo: 'enviarTexto',
            texto: TEXTOS_BOT.pedidoComprobanteRucInvalido(),
          },
        ],
        nuevoFlujo: flujo,
      };
    }

    const nuevoPedido: EstadoCarritoPedido = {
      ...pedido,
      comprobante: {
        tipo: 'FACTURA',
        ruc,
      },
      estadoInterno: 'PEDIDO_COMPROBANTE_RAZON',
    };

    return {
      nuevoEstado: 'PEDIDO_COMPROBANTE_RAZON',
      acciones: [
        {
          tipo: 'enviarTexto',
          texto: TEXTOS_BOT.pedidoComprobanteRazon(),
        },
      ],
      nuevoFlujo: {
        ...flujo,
        estado: 'PEDIDO_COMPROBANTE_RAZON',
        pedido: nuevoPedido,
      },
    };
  }

  private pasoComprobanteRazon(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const razonSocial = entrada.textoOriginal.trim();
    if (razonSocial.length < 3) {
      return {
        nuevoEstado: 'PEDIDO_COMPROBANTE_RAZON',
        acciones: [{ tipo: 'enviarTexto', texto: TEXTOS_BOT.pedidoComprobanteRazonVacia() }],
        nuevoFlujo: flujo,
      };
    }
    const nuevoPedido: EstadoCarritoPedido = {
      ...pedido,
      comprobante: {
        ...(pedido.comprobante || { tipo: 'FACTURA' }),
        tipo: 'FACTURA',
        razonSocial: razonSocial.slice(0, 100),
      },
    };

    return this.avanzarHaciaCheckout(flujo, nuevoPedido, contexto);
  }

  // -------------------------------------------------------------------------
  // PASO 11: Resumen Final y Confirmación
  // -------------------------------------------------------------------------
  private pasoResumenConfirmar(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    if (entrada.id === 'ped_cambiar' || entrada.texto.includes('cambiar')) {
      const nuevoPedido: EstadoCarritoPedido = {
        ...pedido,
        estadoInterno: 'PEDIDO_VER_CARRITO',
      };
      return this.renderizarEstado('PEDIDO_VER_CARRITO', flujo, nuevoPedido, contexto);
    }

    // Boleta o factura (por defecto va el comprobante simple)
    if (entrada.id === 'ped_comp_pedir' || (!entrada.id && /\b(boleta|factura)\b/.test(entrada.texto))) {
      return {
        nuevoEstado: 'PEDIDO_COMPROBANTE_TIPO',
        acciones: [{ tipo: 'enviarBotones', texto: TEXTOS_BOT.pedidoComprobanteTipo(), botones: BOTONES_PEDIDO_COMPROBANTE }],
        nuevoFlujo: { ...flujo, estado: 'PEDIDO_COMPROBANTE_TIPO', pedido: { ...pedido, estadoInterno: 'PEDIDO_COMPROBANTE_TIPO' } },
      };
    }

    // Confirma con el botón o con cualquier «sí / ok / dale / confirmo»; otra cosa repite el resumen UNA vez y luego ayuda
    if (entrada.id !== 'ped_confirmar' && !entrada.texto.includes('confirmar') && !esSi(entrada.texto)) {
      return this.mostrarResumenFinal(flujo, pedido, contexto);
    }

    // 11.1. Seguridad: Límite diario de 10 pedidos por teléfono
    const pedidosHoy = contexto.pedidosHoyTelefono ?? 0;
    if (pedidosHoy >= 10) {
      return {
        nuevoEstado: 'ATENCION_PERSONA',
        acciones: [
          {
            tipo: 'pasarAPersona',
            motivo: 'LIMITE_PEDIDOS_DIARIOS_EXCEDIDO',
            mensajeCliente: entrada.textoOriginal,
          },
          {
            tipo: 'enviarBotones',
            texto: TEXTOS_BOT.pedidoLimiteDiarioAlcanzado(),
            botones: [BOTON_VOLVER_MENU],
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'ATENCION_PERSONA',
        },
      };
    }

    // 11.2. Construir DTO de PedidosService.crear
    const { aCobrar: total } = calcularTotales(pedido, contexto.vistaPreviaPedido);

    // Efectivo: «con cuánto pagas» es obligatorio. Red de seguridad: si por cualquier camino llegó sin monto
    // (o menor a lo que se cobra en efectivo), se vuelve a preguntar en vez de crear el pedido.
    const planEf = pedido.pago?.plan;
    const parteEf = planEf?.length
      ? (planEf.find((f) => f.medio === 'EFECTIVO')?.monto ?? 0)
      : (pedido.pago?.metodo ?? 'EFECTIVO') === 'EFECTIVO'
        ? total
        : 0;
    if (parteEf > 0 && !(typeof pedido.pago?.pagaCon === 'number' && pedido.pago.pagaCon >= parteEf)) {
      return this.pedirMontoEfectivo(flujo, { ...pedido, pago: pedido.pago ?? { metodo: 'EFECTIVO' } }, parteEf);
    }

    const clienteNombre =
      pedido.cliente?.nombre ||
      flujo.nombre_perfil_wa ||
      contexto.nombreCliente ||
      'Cliente WhatsApp';

    // Celular real de 9 dígitos (el del chat llega como 51XXXXXXXXX); si no hay (p. ej. usuario sin número), el pedido va sin celular
    const telCrudo = String(pedido.cliente?.telefono || contexto.telefonoCliente || '')
      .replace(/\D/g, '')
      .replace(/^51(?=9\d{8}$)/, '');
    const clienteTelefono = /^9\d{8}$/.test(telCrudo) && telCrudo !== '999999999' ? telCrudo : '';

    const dto: any = {
      cliente: {
        nombre: clienteNombre,
        telefono: clienteTelefono,
      },
      modalidad: pedido.modalidad || 'RECOGER',
      ...(pedido.propina ? { propina: pedido.propina } : {}),
      // Local cerrado: el pedido nace PROGRAMADO para el día y la hora elegidos (el servidor lo valida contra el horario)
      ...(pedido.programadoPara ? { programadoPara: pedido.programadoPara } : {}),
      entrega:
        pedido.modalidad === 'DELIVERY'
          ? {
              direccion: pedido.entrega?.direccion,
              referencia: pedido.entrega?.referencia,
              lat: pedido.entrega?.lat,
              lng: pedido.entrega?.lng,
              origen: pedido.entrega?.origen || 'WHATSAPP',
            }
          : undefined,
      lineas: pedido.items.map((i) => ({
        productoId: i.productoId,
        tamanoId: i.tamanoId,
        cantidad: i.cantidad,
        opciones: i.opciones.map((o) => o.opcionId),
        nota: i.nota,
        personas: i.personas,
        ...(i.ofertaId ? { ofertaId: i.ofertaId, comboElecciones: i.comboElecciones ?? [] } : {}),
        // Stock por sabor: unidades por sabor (tamaño × cantidad); el servidor valida suma y stock
        ...(i.sabores ? { sabores: i.sabores.map((s) => ({ saborId: s.saborId, cantidad: s.cantidad })) } : {}),
      })),
      pago: {
        metodo: pedido.pago?.metodo || 'EFECTIVO',
        pagaCon: pedido.pago?.pagaCon,
        // Pago dividido: mismo formato que la carta y el mozo (pago.plan = [{ medio, monto }])
        ...(pedido.pago?.plan?.length ? { plan: pedido.pago.plan.map((f) => ({ medio: f.medio, monto: f.monto })) } : {}),
      },
      comprobante:
        pedido.comprobante?.tipo && pedido.comprobante.tipo !== 'NINGUNO'
          ? {
              tipo: pedido.comprobante.tipo,
              dni: pedido.comprobante.dni,
              ruc: pedido.comprobante.ruc,
              razonSocial: pedido.comprobante.razonSocial,
            }
          : undefined,
    };

    // Clave estable de idempotencia para evitar duplicados ante reenvíos de Meta
    const claveIdempotencia = `wa_pedido_${flujo.id || 'conv'}_${pedido.idempotenciaPaso || 'step'}`;

    const tBase = Number(contexto.datosLocalPublicos?.tiempo_base || 25);
    const tMax = Number(contexto.datosLocalPublicos?.tiempo_maximo || 35);
    const minExtra = Number(contexto.datosLocal?.altaDemandaMinutosExtra || 0);

    const tiempoMin = tBase + minExtra;
    const tiempoMax = tMax + minExtra;

    const planPago = pedido.pago?.plan;
    const esPagoDigital = planPago?.length
      ? planPago.some((f) => ['YAPE', 'PLIN', 'TRANSFERENCIA'].includes(f.medio))
      : ['YAPE', 'PLIN', 'TRANSFERENCIA'].includes(pedido.pago?.metodo || '');

    // Pago dividido: solo se pide yapear la parte digital; el resto se paga al recibir
    const montoDigital = planPago?.length
      ? r2(planPago.filter((f) => MEDIOS_DIGITALES.includes(f.medio)).reduce((a, f) => a + f.monto, 0))
      : total;

    // Despachar acción transaccional para PedidosService
    return {
      nuevoEstado: 'MENU',
      acciones: [
        {
          tipo: 'crearPedido',
          dto,
          carrito: pedido,
          claveIdempotencia,
          tiempoEstimadoMin: tiempoMin,
          tiempoEstimadoMax: tiempoMax,
          esPagoDigital,
          ...(pedido.programadoPara ? { programadoPara: pedido.programadoPara } : {}),
          datosPagoTexto: this.formatearDatosPago((contexto.datosLocalPublicos?.mediosPagoVisibles ?? contexto.datosLocalPublicos?.mediosPago), montoDigital, r2(total - montoDigital)),
        },
      ],
      nuevoFlujo: {
        ...flujo,
        estado: 'MENU',
        pedido: null, // Carrito terminado y limpiado
      },
    };
  }

  // -------------------------------------------------------------------------
  // PASO 3.5: Propina opcional. Va aparte de la venta; «Sin propina» o 0 = no dejar.
  // -------------------------------------------------------------------------
  private pedirPropina(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const tope = Number(contexto.datosLocalPublicos?.propina?.tope || 200);
    const nuevoPedido: EstadoCarritoPedido = { ...pedido, estadoInterno: 'PEDIDO_PROPINA' };
    return {
      nuevoEstado: 'PEDIDO_PROPINA',
      acciones: [
        {
          tipo: 'enviarBotones',
          texto: TEXTOS_BOT.pedidoPropinaPregunta(tope),
          botones: BOTONES_PEDIDO_PROPINA,
        },
      ],
      nuevoFlujo: { ...flujo, estado: 'PEDIDO_PROPINA', pedido: nuevoPedido },
    };
  }

  private pasoPropina(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
    esperandoMonto: boolean,
  ): ResultadoTransicion {
    const tope = Number(contexto.datosLocalPublicos?.propina?.tope || 200);
    const fijar = (monto: number): ResultadoTransicion => {
      const nuevo: EstadoCarritoPedido = { ...pedido, propina: monto };
      return this.avanzarHaciaCheckout({ ...flujo, pedido: nuevo }, nuevo, contexto);
    };

    if (!esperandoMonto && entrada.id === 'ped_propina_si') {
      const nuevoPedido: EstadoCarritoPedido = { ...pedido, estadoInterno: 'PEDIDO_PROPINA_MONTO' };
      return {
        nuevoEstado: 'PEDIDO_PROPINA_MONTO',
        acciones: [{ tipo: 'enviarTexto', texto: TEXTOS_BOT.pedidoPropinaMonto(tope) }],
        nuevoFlujo: { ...flujo, estado: 'PEDIDO_PROPINA_MONTO', pedido: nuevoPedido },
      };
    }
    if (entrada.id === 'ped_propina_no' || /sin propina|^no$/i.test(entrada.texto.trim())) {
      return fijar(0);
    }
    const r = normalizarPropina(entrada.textoOriginal, tope);
    if (r.valido) return fijar(r.monto);

    // Monto no válido: se vuelve a pedir en el mismo paso
    const texto = TEXTOS_BOT.pedidoPropinaInvalida(tope);
    const acciones: ResultadoTransicion['acciones'] = esperandoMonto
      ? [{ tipo: 'enviarTexto', texto }]
      : [{ tipo: 'enviarBotones', texto, botones: BOTONES_PEDIDO_PROPINA }];
    const estado = esperandoMonto ? 'PEDIDO_PROPINA_MONTO' : 'PEDIDO_PROPINA';
    return {
      nuevoEstado: estado,
      acciones,
      nuevoFlujo: { ...flujo, estado, pedido },
    };
  }

  // -------------------------------------------------------------------------
  // Helper: Avanzar de paso hacia el Checkout
  // -------------------------------------------------------------------------
  private avanzarHaciaCheckout(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    // Carrito armado sin decir cómo lo quiere (frase sin «para llevar» ni «delivery»): primero eso
    if (pedido.items.length > 0 && !pedido.modalidad) {
      return {
        nuevoEstado: 'PEDIDO_MODALIDAD',
        acciones: [{ tipo: 'enviarBotones', texto: TEXTOS_BOT.pedidoModalidad(), botones: BOTONES_PEDIDO_MODALIDAD }],
        nuevoFlujo: { ...flujo, estado: 'PEDIDO_MODALIDAD', pedido: { ...pedido, estadoInterno: 'PEDIDO_MODALIDAD' } },
      };
    }
    if (pedido.items.length > 0 && pedido.modalidad === 'DELIVERY' && !pedido.entrega) return this.pedirUbicacion(flujo, pedido);

    const subtotal = Number(pedido.items.reduce((s, i) => s + i.subtotal, 0).toFixed(2));
    // Sin `pedido_minimo` configurado (0 o null) no hay mínimo
    const pedidoMin = Number(contexto.datosLocalPublicos?.pedidoMinimo || 0);

    // 1. Pedido mínimo solo para delivery
    if (pedido.modalidad === 'DELIVERY' && pedidoMin > 0 && subtotal < pedidoMin) {
      const faltante = Number((pedidoMin - subtotal).toFixed(2));
      return {
        nuevoEstado: 'PEDIDO_ACCION_CARRITO',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: TEXTOS_BOT.pedidoMinimoNoAlcanzado(pedidoMin, faltante),
            botones: [
              { id: 'ped_otro', titulo: 'Agregar producto' },
              { id: 'ped_mod_recojer', titulo: 'Para recoger' },
              BOTON_VOLVER_MENU,
            ],
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'PEDIDO_ACCION_CARRITO',
          pedido,
        },
      };
    }

    // 2. Nombre del cliente: el del perfil de WhatsApp, sin preguntarlo (se ve en el resumen y se cambia con «Cambiar algo»)
    if (!pedido.cliente?.nombre) {
      const nombreSugerido = nombreParaSaludo(flujo.nombre_perfil_wa || contexto.nombreCliente);
      if (nombreSugerido) {
        return this.avanzarHaciaCheckout(flujo, { ...pedido, cliente: { ...(pedido.cliente || {}), nombre: nombreSugerido } }, contexto);
      }

      const nuevoPedido: EstadoCarritoPedido = {
        ...pedido,
        estadoInterno: 'PEDIDO_INGRESAR_NOMBRE',
      };
      return {
        nuevoEstado: 'PEDIDO_INGRESAR_NOMBRE',
        acciones: [
          {
            tipo: 'enviarTexto',
            texto: TEXTOS_BOT.pedidoIngresarNombre(),
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'PEDIDO_INGRESAR_NOMBRE',
          pedido: nuevoPedido,
        },
      };
    }

    // 3. Teléfono del cliente: el número del chat llega como 51XXXXXXXXX; se ofrece usarlo o escribir otro
    const telDigitos = String(contexto.telefonoCliente || '').replace(/\D/g, '');
    const telExistente = /^51(9\d{8})$/.test(telDigitos)
      ? telDigitos.slice(2)
      : /^9\d{8}$/.test(telDigitos)
        ? telDigitos
        : '';

    // Solo delivery pide el celular (el repartidor llama); en otras modalidades se usa el del chat si es real, o ninguno
    if (pedido.modalidad === 'DELIVERY' && !pedido.cliente?.telefono && telExistente) {
      // El número del chat sirve para coordinar la entrega: no se pregunta (sale en el resumen)
      return this.avanzarHaciaCheckout(flujo, { ...pedido, cliente: { ...(pedido.cliente || {}), telefono: telExistente } }, contexto);
    }
    if (pedido.modalidad === 'DELIVERY' && !pedido.cliente?.telefono) {
      const nuevoPedido: EstadoCarritoPedido = {
        ...pedido,
        telefonoSugerido: telExistente || undefined,
        estadoInterno: 'PEDIDO_INGRESAR_TELEFONO',
      };
      return {
        nuevoEstado: 'PEDIDO_INGRESAR_TELEFONO',
        acciones: [
          telExistente
            ? {
                tipo: 'enviarBotones',
                texto: TEXTOS_BOT.pedidoConfirmarTelefono(telExistente),
                botones: BOTONES_PEDIDO_TELEFONO,
              }
            : {
                tipo: 'enviarTexto',
                texto: TEXTOS_BOT.pedidoIngresarTelefono(),
              },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'PEDIDO_INGRESAR_TELEFONO',
          pedido: nuevoPedido,
        },
      };
    }

    // 3.5. Propina opcional (interruptor del bot): antes del pago, para que los montos ya la incluyan
    if (pedido.propina === undefined && contexto.datosLocalPublicos?.propina?.bot === true) {
      return this.pedirPropina(flujo, pedido, contexto);
    }

    // 4. Medio de pago
    if (!pedido.pago?.metodo) {
      return this.mostrarOpcionesPago(flujo, pedido, contexto);
    }

    // 5. Comprobante: ticket simple por defecto; boleta o factura se piden desde el resumen («Boleta o factura»)
    if (!pedido.comprobante) {
      return this.avanzarHaciaCheckout(flujo, { ...pedido, comprobante: { tipo: 'SIMPLE' } }, contexto);
    }

    // 6. Resumen final completo
    return this.mostrarResumenFinal(flujo, pedido, contexto);
  }

  // -------------------------------------------------------------------------
  // Helper: Mostrar Resumen Final
  // -------------------------------------------------------------------------
  private mostrarResumenFinal(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const { envio, descuento, descuentoNombre, propina, aCobrar, envioPromoNombre, envioGratisFalta } = calcularTotales(pedido, contexto.vistaPreviaPedido);

    const lineasTexto = this.lineasResumen(pedido, contexto);


    const descuentoTexto = descuento > 0 ? TEXTOS_BOT.lineaDescuentoBot(descuentoNombre, descuento) : undefined;

    let envioTexto = 'gratis';
    if (pedido.modalidad === 'DELIVERY') {
      if (envio === null) {
        envioTexto = 'lo confirma un asesor al ubicarte';
      } else if (envio > 0) {
        envioTexto = `S/ ${envio.toFixed(2)}`;
      } else {
        envioTexto = 'gratis';
      }
    } else {
      envioTexto = 'no aplica (recojo en local)';
    }

    let direccionTexto: string | undefined;
    if (pedido.modalidad === 'DELIVERY') {
      const dir = pedido.entrega?.direccion || 'Ubicación compartida';
      const ref = pedido.entrega?.referencia ? ` (Ref: ${pedido.entrega.referencia})` : '';
      direccionTexto = `Dirección: ${dir}${ref}`;
    }

    const pagoTexto = textoPago(pedido.pago);

    const tBase = Number(contexto.datosLocalPublicos?.tiempo_base || 25);
    const tMax = Number(contexto.datosLocalPublicos?.tiempo_maximo || 35);
    const extraDemanda = Number(contexto.datosLocal?.altaDemandaMinutosExtra || 0);

    const tiempoMin = tBase + extraDemanda;
    const tiempoMax = tMax + extraDemanda;

    const avisoDemanda = extraDemanda > 0
      ? `Hoy tenemos alta demanda: la entrega puede tardar unos ${tiempoMin} a ${tiempoMax} minutos.`
      : undefined;

    const nuevoPedido: EstadoCarritoPedido = {
      ...pedido,
      estadoInterno: 'PEDIDO_RESUMEN_CONFIRMAR',
    };

    return {
      nuevoEstado: 'PEDIDO_RESUMEN_CONFIRMAR',
      acciones: [
        {
          tipo: 'enviarBotones',
          texto: TEXTOS_BOT.pedidoResumenFinal({
            lineasTexto,
            descuentoTexto,
            envioTexto,
            envioLinea:
              pedido.modalidad === 'DELIVERY' && envioPromoNombre
                ? TEXTOS_BOT.lineaEnvioGratisBot(envioPromoNombre, contexto.textosPersonalizados?.chatbot_texto_envio_gratis)
                : undefined,
            faltaEnvioTexto:
              pedido.modalidad === 'DELIVERY' && envioGratisFalta && envioGratisFalta > 0
                ? TEXTOS_BOT.lineaFaltaEnvioGratisBot(envioGratisFalta)
                : undefined,
            total: aCobrar,
            propina,
            modalidad: pedido.modalidad === 'DELIVERY' ? 'Delivery' : 'Para recoger',
            direccionTexto,
            pagoTexto,
            tiempoMin,
            tiempoMax,
            avisoDemanda,
            programadoTexto: pedido.programadoPara ? TEXTOS_PROGRAMAR.lineaResumen(pedido.programadoPara) : undefined,
            clienteTexto: pedido.cliente?.nombre
              ? `${pedido.cliente.nombre}${pedido.modalidad === 'DELIVERY' && pedido.cliente.telefono ? ` · cel. ${pedido.cliente.telefono}` : ''}`
              : undefined,
            comprobanteTexto: pedido.comprobante && pedido.comprobante.tipo !== 'SIMPLE' ? ({ BOLETA: 'Boleta', FACTURA: 'Factura' } as Record<string, string>)[pedido.comprobante.tipo] : undefined,
          }),
          botones: !pedido.comprobante || pedido.comprobante.tipo === 'SIMPLE' ? BOTONES_PEDIDO_CONFIRMAR_FINAL_CON_COMPROBANTE : BOTONES_PEDIDO_CONFIRMAR_FINAL,
        },
      ],
      nuevoFlujo: {
        ...flujo,
        estado: 'PEDIDO_RESUMEN_CONFIRMAR',
        pedido: nuevoPedido,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Helper: Mostrar Opciones de Pago Activas
  // -------------------------------------------------------------------------
  private mostrarOpcionesPago(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    contexto: ContextoConversacion,
    conResumen = true,
  ): ResultadoTransicion {
    // Pedido programado: primero el camino (pagar al recibir o dejarlo pagado)
    if (pedido.programadoPara && !pedido.pagoCamino) return this.preguntarCaminoPago(flujo, pedido);
    const activos = this.mediosDelPedido(pedido, contexto);
    if (activos.length === 0) {
      // Ningún medio encendido en el bot: lo atiende una persona
      return {
        nuevoEstado: 'ATENCION_PERSONA',
        acciones: [
          { tipo: 'pasarAPersona', motivo: 'SIN_MEDIOS_DE_PAGO_BOT', mensajeCliente: 'Pedido sin medios de pago disponibles en el bot' },
          { tipo: 'enviarBotones', texto: 'Por ahora no puedo cobrar pedidos por aquí. Una persona del equipo te ayuda enseguida.', botones: [BOTON_VOLVER_MENU] },
        ],
        nuevoFlujo: { ...flujo, estado: 'ATENCION_PERSONA' },
      };
    }
    if (activos.length === 1) {
      // Un solo medio: no se pregunta, se aplica y se avisa
      const res = this.aplicarMedioUnico(flujo, pedido, activos[0], contexto);
      res.acciones = [{ tipo: 'enviarTexto', texto: `Por ahora pagas con ${NOMBRE_MEDIO[activos[0]]}.` }, ...res.acciones];
      return res;
    }
    const opciones = activos.map((m) => ({
      id: m === 'TRANSFERENCIA' ? 'ped_pago_transf' : `ped_pago_${m.toLowerCase()}`,
      titulo: m === 'TARJETA' ? 'Tarjeta (POS)' : NOMBRE_MEDIO[m],
    }));
    if (opciones.length >= 2 && !pedido.programadoPara) opciones.push({ id: 'ped_pago_dividir', titulo: 'Dividir el pago' });

    const op = opcionesMedios(opciones);
    const nuevoPedido: EstadoCarritoPedido = {
      ...pedido,
      estadoInterno: 'PEDIDO_MEDIO_PAGO',
    };
    const pregunta = TEXTOS_BOT.pedidoMedioPago();
    // Un solo mensaje (resumen + pregunta) mientras cabe en el cuerpo de WhatsApp (1024 caracteres)
    const resumen = conResumen ? this.resumenAntesDePagar(pedido, contexto) : '';
    const unido = resumen ? `${resumen}\n\n${pregunta}` : pregunta;
    const cabe = unido.length <= 1000;
    const texto = cabe ? unido : pregunta;
    const acciones: AccionMensaje[] = [];
    if (resumen && !cabe) acciones.push({ tipo: 'enviarTexto', texto: resumen });
    acciones.push(
      op.filas
        ? { tipo: 'enviarLista', texto, botonTexto: 'Elegir medio de pago', filas: op.filas }
        : { tipo: 'enviarBotones', texto, botones: op.botones! },
    );

    return {
      nuevoEstado: 'PEDIDO_MEDIO_PAGO',
      acciones,
      nuevoFlujo: {
        ...flujo,
        estado: 'PEDIDO_MEDIO_PAGO',
        pedido: nuevoPedido,
      },
    };
  }

  /** Resumen con total justo antes de «¿Cómo pagarás?». Usa las mismas líneas y totales que el resumen final. */
  private resumenAntesDePagar(pedido: EstadoCarritoPedido, contexto: ContextoConversacion): string {
    const { subtotal, envio, aCobrar: total, propina, descuento, descuentoNombre, envioPromoNombre, envioGratisFalta, ahorrosPorMedio } = calcularTotales(pedido, contexto.vistaPreviaPedido);
    const lineas = this.lineasResumen(pedido, contexto);
    const descuentoTxt = descuento > 0 ? `${TEXTOS_BOT.lineaDescuentoBot(descuentoNombre, descuento)}\n` : '';
    const envioTxt =
      pedido.modalidad !== 'DELIVERY'
        ? 'Recojo en tienda'
        : envioPromoNombre
          ? TEXTOS_BOT.lineaEnvioGratisBot(envioPromoNombre, contexto.textosPersonalizados?.chatbot_texto_envio_gratis)
          : envio === null
          ? 'Delivery: lo confirma un asesor al ubicarte'
          : envio > 0
            ? `Delivery: S/ ${envio.toFixed(2)}`
            : 'Delivery gratis';
    // Solo el total (lo que importa para elegir cómo pagar): el detalle completo sale en el resumen final
    return (
      descuentoTxt +
      `${envioTxt}
` +
      (pedido.modalidad === 'DELIVERY' && envioGratisFalta && envioGratisFalta > 0 ? `${TEXTOS_BOT.lineaFaltaEnvioGratisBot(envioGratisFalta)}
` : '') +
      (propina > 0 ? `Propina: S/ ${propina.toFixed(2)}
` : '') +
      `*TOTAL: S/ ${total.toFixed(2)}*` +
      (ahorrosPorMedio.length ? `
${lineasAhorroPorMedio(ahorrosPorMedio).trimEnd()}` : '')
    );
  }

  /** Líneas del carrito: cantidad, tamaño/opciones y precio (compartido por el resumen previo y el final). */
  private lineasResumen(pedido: EstadoCarritoPedido, contexto: ContextoConversacion): string {
    const avisos = lineasAvisoResumen(pedido.items, (id) => productoDeCarta(contexto.categoriasCarta || [], id), unidadesDeTamano, contexto);
    const lineas = pedido.items
      .map((i) => {
        const detalles = detallesLinea(i);
        const detTxt = detalles.length > 0 ? ` · ${detalles.join(' · ')}` : '';
        const cant = i.cantidad > 1 ? `${i.cantidad}× ` : '';
        return `• ${cant}${i.productoNombre}${detTxt} — S/ ${i.subtotal.toFixed(2)}`;
      })
      .join('\n');
    return avisos.length ? `${lineas}\n${avisos.join('\n')}` : lineas;
  }

  // -------------------------------------------------------------------------
  // Helper: Avanzar Configuración de un Producto
  // -------------------------------------------------------------------------
  private avanzarConfiguracionProducto(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    prod: any,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const config = pedido.itemEnConfiguracion;
    if (!config) return this.mostrarCategorias(flujo, pedido, contexto);

    const grupos = gruposDePregunta(prod, config.combo?.ocultaGruposBebida);
    // Los grupos que el cliente ya contestó (p. ej. «leche de almendra» dicho en su frase) no se vuelven a preguntar
    while (config.grupoIndexActual < grupos.length && config.opciones.some((o) => o.grupoId === String(grupos[config.grupoIndexActual].id))) config.grupoIndexActual++;

    // Si aún quedan grupos de opciones por responder
    if (config.grupoIndexActual < grupos.length) {
      const g = grupos[config.grupoIndexActual];
      pedido.estadoInterno = 'PEDIDO_GRUPO_OPCION';

      // Dos o más grupos opcionales seguidos: una sola pregunta («¿lo quieres personalizar?») en vez de una por grupo
      const restantes = grupos.slice(config.grupoIndexActual);
      if (!config.personalizar && restantes.length >= 2 && restantes.every((x: any) => !(x.obligatorio || x.minimo > 0))) {
        return {
          nuevoEstado: 'PEDIDO_GRUPO_OPCION',
          acciones: [{ tipo: 'enviarBotones', texto: TEXTOS_BOT.pedidoPersonalizar(config.productoNombre, restantes.map((x: any) => String(x.nombre))), botones: BOTONES_PEDIDO_PERSONALIZAR }],
          nuevoFlujo: { ...flujo, estado: 'PEDIDO_GRUPO_OPCION', pedido },
        };
      }

      const esObligatorio = g.obligatorio || g.minimo > 0;
      const accionesGrupo = this.construirAccionGrupo(g);

      return {
        nuevoEstado: 'PEDIDO_GRUPO_OPCION',
        acciones: [
          {
            tipo: 'enviarTexto',
            texto: TEXTOS_BOT.pedidoPreguntarGrupo(g.nombre, esObligatorio),
          },
          ...accionesGrupo,
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'PEDIDO_GRUPO_OPCION',
          pedido,
        },
      };
    }

    // Sabores (si tiene sabores disponibles)
    if (prod?.sabores && prod.sabores.length > 0 && !prod.saboresConStock && !config.sabor) {
      pedido.estadoInterno = 'PEDIDO_SABOR';
      const botonesSabor: BotonAccion[] = prod.sabores
        .filter((s: any) => s.disponible !== false)
        .slice(0, 3)
        .map((s: any) => ({
          id: `ped_sab_${s.id}`,
          titulo: s.nombre.slice(0, 20),
        }));

      return {
        nuevoEstado: 'PEDIDO_SABOR',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: TEXTOS_BOT.pedidoPreguntarSabor(),
            botones: botonesSabor.length > 0 ? botonesSabor : [{ id: 'ped_sab_normal', titulo: 'Original' }],
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'PEDIDO_SABOR',
          pedido,
        },
      };
    }

    // Cantidad: se asume 1 (el cliente la corrige con «mejor que sean 3»); solo se pregunta si el sabor se elige por stock
    return this.preguntarCantidad(flujo, pedido, config, contexto);
  }

  /** Paso de combo con opciones agotadas por stock: primero una línea de aviso (plan B), luego lo que se puede elegir. */
  private construirAccionGrupo(g: any): AccionMensaje[] {
    const avisoStock: AccionMensaje[] = g.aviso ? [{ tipo: 'enviarTexto', texto: g.aviso } as AccionMensaje] : [];
    return [...avisoStock, ...this.construirAccionGrupoBase(g)];
  }

  private construirAccionGrupoBase(g: any): AccionMensaje[] {
    const esObligatorio = g.obligatorio || g.minimo > 0;
    const opciones = (g.opciones || []).filter((o: any) => o.disponible !== false);

    if (opciones.length <= 3 && esObligatorio) {
      const botones: BotonAccion[] = opciones.slice(0, 3).map((o: any) => {
        const extraTxt = o.precioExtra ? ` +S/${Number(o.precioExtra).toFixed(0)}` : '';
        return {
          id: `ped_op_${o.id}`,
          titulo: `${o.nombre}${extraTxt}`.slice(0, 20),
        };
      });
      return [{ tipo: 'enviarBotones', texto: 'Elige una opción:', botones }];
    }

    // Más de 3 opciones o es opcional -> lista interactiva
    const filas: FilaLista[] = opciones.slice(0, 9).map((o: any) => {
      const extraTxt = o.precioExtra ? ` (+S/ ${Number(o.precioExtra).toFixed(2)})` : ' (Sin costo extra)';
      return {
        id: `ped_op_${o.id}`,
        titulo: o.nombre.slice(0, 24),
        descripcion: `Opción para ${g.nombre}${extraTxt}`.slice(0, 72),
      };
    });

    if (!esObligatorio) {
      filas.push({
        id: 'ped_op_ninguno',
        titulo: 'Ninguno',
        descripcion: 'Continuar sin adicionales en este grupo',
      });
    }

    return [
      {
        tipo: 'enviarLista',
        texto: `Selecciona una opción para ${g.nombre}:`,
        botonTexto: 'Ver opciones',
        filas: filas.slice(0, 10),
      },
    ];
  }

  // -------------------------------------------------------------------------
  // Helper: Mostrar Lista de Categorías
  // -------------------------------------------------------------------------
  private mostrarCategorias(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    contexto: ContextoConversacion,
    mensajeEncabezado?: string,
  ): ResultadoTransicion {
    const categorias = contexto.categoriasCarta || [];
    const pagina = pedido.paginaCategorias || 1;
    const POR_PAGINA = 9;

    const totalPaginas = Math.ceil(categorias.length / POR_PAGINA) || 1;
    const inicio = (pagina - 1) * POR_PAGINA;
    const visibles = categorias.slice(inicio, inicio + POR_PAGINA);

    const filas: FilaLista[] = visibles.map((cat: any) => ({
      id: `ped_cat_${cat.id}`,
      titulo: cat.nombre.slice(0, 24),
      descripcion: `Ver productos de ${cat.nombre}`.slice(0, 72),
    }));

    if (pagina < totalPaginas) {
      filas.push({
        id: `ped_cat_pag_${pagina + 1}`,
        titulo: '➡️ Ver más categorías',
        descripcion: `Página ${pagina + 1} de ${totalPaginas}`,
      });
    }

    // El encabezado va como cuerpo de la lista: un solo mensaje en vez de texto + lista
    const acciones: AccionMensaje[] = [
      {
        tipo: 'enviarLista',
        texto: mensajeEncabezado ?? TEXTOS_BOT.pedidoCategoriasPrompt(),
        botonTexto: 'Ver categorías',
        filas: filas.slice(0, 10),
      },
    ];

    return {
      nuevoEstado: 'PEDIDO_CATEGORIAS',
      acciones,
      nuevoFlujo: {
        ...flujo,
        estado: 'PEDIDO_CATEGORIAS',
        pedido: {
          ...pedido,
          estadoInterno: 'PEDIDO_CATEGORIAS',
        },
      },
    };
  }

  // -------------------------------------------------------------------------
  // Helper: Mostrar Lista de Productos de una Categoría
  // -------------------------------------------------------------------------
  private mostrarProductosDeCategoria(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    categoria: any,
    contexto: ContextoConversacion,
    mensajeEncabezado?: string,
    forzarLista = false,
  ): ResultadoTransicion {
    // Más vendidos primero (los sin ventas siguen el orden de la carta)
    const productos = ordenarPorVentas(
      (categoria.productos || []).filter((p: any) => !productoAgotado(p) && !ocultoEnBot(p, contexto)),
      contexto.ventasProductos,
    );

    if (productos.length === 0) {
      return {
        nuevoEstado: 'PEDIDO_CATEGORIAS',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: TEXTOS_BOT.pedidoCategoriaVacia(),
            botones: [
              { id: 'btn_categorias', titulo: 'Ver categorías' },
              BOTON_VOLVER_MENU,
            ],
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'PEDIDO_CATEGORIAS',
          pedido: { ...pedido, estadoInterno: 'PEDIDO_CATEGORIAS' },
        },
      };
    }

    const pagina = pedido.paginaProductos || 1;
    const POR_PAGINA = 9;
    const totalPaginas = Math.ceil(productos.length / POR_PAGINA) || 1;
    const inicio = (pagina - 1) * POR_PAGINA;
    const visibles = productos.slice(inicio, inicio + POR_PAGINA);

    const filas: FilaLista[] = visibles.map((p: any) => {
      const precio = Number(p.precio || 0);
      const desc = p.descripcion ? ` · ${p.descripcion}` : '';
      const aviso = avisoStock({ controlaStock: true, quedan: p.quedan, nombre: p.nombre }, umbralesDe(contexto));
      return {
        id: `ped_prod_${p.id}`,
        titulo: p.nombre.slice(0, 24),
        descripcion: recortarEnPalabra(`S/ ${precio.toFixed(2)}${aviso ? ` · ${aviso.texto}` : desc}`, 72),
      };
    });

    if (pagina < totalPaginas) {
      filas.push({
        id: `ped_prod_pag_${pagina + 1}`,
        titulo: '➡️ Ver más productos',
        descripcion: `Página ${pagina + 1} de ${totalPaginas}`,
      });
    }

    const acciones: AccionMensaje[] = [];
    // El encabezado («no te entendí») va en el mismo mensaje de la lista: un solo mensaje, sin repetir
    const lista: AccionMensaje = {
      tipo: 'enviarLista',
      texto: `${mensajeEncabezado ? `${mensajeEncabezado} ` : ''}${TEXTOS_BOT.pedidoCategoriaSeleccionada(categoria.nombre)}`,
      botonTexto: 'Ver productos',
      filas: filas.slice(0, 10),
    };

    // Carrusel con foto: solo una página de 10 por envío (más vendidos primero); «Ver más» trae la siguiente
    if (!forzarLista && productos.length >= 2) {
      acciones.push(...this.accionesPaginaCarrusel(productos, 1, categoria, contexto, lista));
    } else {
      acciones.push(lista);
    }

    return {
      nuevoEstado: 'PEDIDO_PRODUCTOS',
      acciones,
      nuevoFlujo: {
        ...flujo,
        estado: 'PEDIDO_PRODUCTOS',
        pedido: {
          ...pedido,
          estadoInterno: 'PEDIDO_PRODUCTOS',
        },
      },
    };
  }

  /**
   * Una página (1 = favoritos) de hasta 10 productos como carrusel; si queda 1 solo va como lista.
   * Si hay más, un mensaje de botones aparte (Meta no admite botón extra dentro del carrusel) con «Ver más».
   */
  private accionesPaginaCarrusel(
    productos: any[],
    pagina: number,
    categoria: any,
    contexto: ContextoConversacion,
    listaBase: AccionMensaje,
  ): AccionMensaje[] {
    const lista: any = listaBase;
    return accionesPaginaCarruselGenerica({
      tarjetas: productos.map((p) => tarjetaProducto(p, contexto.cartaUrlPublica, lineaAvisoStock(p, contexto))),
      pagina,
      cuerpoPrimera: TEXTOS_BOT.carruselFavoritos(categoria.nombre, productos.length),
      cuerpoSiguientes: TEXTOS_BOT.carruselMasOpciones(),
      respaldoPrimera: lista?.filas ? { texto: lista.texto, botonTexto: lista.botonTexto, filas: lista.filas } : undefined,
      idVerMas: (n) => `ped_prod_mas_${n}`,
      botonTarjeta: { id: 'btn_categorias', titulo: 'Otra categoría' },
      textoVerMas: TEXTOS_BOT.carruselVerMas,
      botonesExtra: [{ id: 'ped_prod_lista', titulo: 'Ver lista completa' }, { id: 'btn_categorias', titulo: 'Ver categorías' }],
      textoLista: TEXTOS_BOT.carruselMasOpciones(),
    }) as AccionMensaje[];
  }

  // -------------------------------------------------------------------------
  // Helper: Formatear Datos de Pago Digital (Yape / Plin / Cuentas)
  // -------------------------------------------------------------------------
  private formatearDatosPago(pagosCfg: any = {}, total: number, restoAlRecibir = 0): string {
    const cfg = pagosCfg ?? {};
    const lineas: string[] = [];
    // Solo los medios activos y con dato real: nunca números de relleno
    if (cfg.yape?.numero) lineas.push(`• Yape: ${cfg.yape.numero}${cfg.yape.titular ? ` (${cfg.yape.titular})` : ''}`);
    if (cfg.plin?.numero) lineas.push(`• Plin: ${cfg.plin.numero}${cfg.plin.titular ? ` (${cfg.plin.titular})` : ''}`);
    if (cfg.transferencia?.cuenta || cfg.transferencia?.cci) {
      const t = cfg.transferencia;
      lineas.push('• Transferencia bancaria:');
      if (t.banco) lineas.push(`   Banco: ${t.banco}`);
      if (t.titular) lineas.push(`   Titular: ${t.titular}`);
      if (t.cuenta) lineas.push(`   Cuenta: ${t.cuenta}`);
      if (t.cci) lineas.push(`   CCI: ${t.cci}`);
    }
    return (
      `📱 *Datos para realizar tu pago:*\n` +
      (lineas.length ? `${lineas.join('\n')}\n` : '') +
      `Monto a pagar: *S/ ${total.toFixed(2)}*` +
      (restoAlRecibir > 0 ? `\nLos S/ ${restoAlRecibir.toFixed(2)} restantes los pagas al recibir tu pedido.` : '')
    );
  }

  // -------------------------------------------------------------------------
  // Helper: Renderizar un Estado Específico
  // -------------------------------------------------------------------------
  private renderizarEstado(
    estado: EstadoPedidoFlujo,
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    estado = normalizarEstadoUbicacion(estado);
    pedido.estadoInterno = estado;
    switch (estado) {
      case 'PEDIDO_PROG_DIA':
        return this.mostrarDiasProgramar(flujo, pedido, contexto, pedido.paginaProg ?? 0);
      case 'PEDIDO_PROG_HORA':
        return pedido.programadoFecha
          ? this.mostrarHorasProgramar(flujo, pedido, contexto, pedido.paginaProg ?? 0)
          : this.mostrarDiasProgramar(flujo, pedido, contexto, 0);
      case 'PEDIDO_PAGO_CAMINO':
        return this.preguntarCaminoPago(flujo, pedido);
      case 'PEDIDO_MODALIDAD':
        return {
          nuevoEstado: 'PEDIDO_MODALIDAD',
          acciones: [
            {
              tipo: 'enviarBotones',
              texto: TEXTOS_BOT.pedidoModalidad(),
              botones: BOTONES_PEDIDO_MODALIDAD,
            },
          ],
          nuevoFlujo: { ...flujo, estado: 'PEDIDO_MODALIDAD', pedido },
        };
      case 'PEDIDO_UBICACION':
        return this.pedirUbicacion(flujo, pedido);
      case 'PEDIDO_CATEGORIAS':
        return this.mostrarCategorias(flujo, pedido, contexto);
      case 'PEDIDO_COMBO_PARTE':
        if (pedido.itemEnConfiguracion?.combo) {
          return {
            nuevoEstado: 'PEDIDO_COMBO_PARTE',
            acciones: accionesPasoCombo(pedido.itemEnConfiguracion.combo, plantillasCombo(contexto)),
            nuevoFlujo: { ...flujo, estado: 'PEDIDO_COMBO_PARTE', pedido },
          };
        }
        return this.mostrarCategorias(flujo, pedido, contexto);
      case 'PEDIDO_COMBO_CONFIRMAR':
        return pedido.itemEnConfiguracion?.combo
          ? this.confirmarCombo(flujo, pedido, pedido.itemEnConfiguracion)
          : this.mostrarCategorias(flujo, pedido, contexto);
      case 'PEDIDO_VER_CARRITO':
      case 'PEDIDO_ACCION_CARRITO': {
        const subtotal = Number(pedido.items.reduce((s, i) => s + i.subtotal, 0).toFixed(2));
        const lineasTexto = pedido.items
          .map((i) => `• ${i.cantidad}x ${i.productoNombre} — S/ ${i.subtotal.toFixed(2)}`)
          .join('\n');
        return {
          nuevoEstado: 'PEDIDO_VER_CARRITO',
          acciones: [
            {
              tipo: 'enviarBotones',
              texto: TEXTOS_BOT.pedidoVerCarrito(lineasTexto, subtotal),
              botones: BOTONES_PEDIDO_VER_CARRITO,
            },
          ],
          nuevoFlujo: { ...flujo, estado: 'PEDIDO_VER_CARRITO', pedido },
        };
      }
      case 'PEDIDO_COMPROBANTE_TIPO':
        return {
          nuevoEstado: estado,
          acciones: [{ tipo: 'enviarBotones', texto: TEXTOS_BOT.pedidoComprobanteTipo(), botones: BOTONES_PEDIDO_COMPROBANTE }],
          nuevoFlujo: { ...flujo, estado, pedido },
        };
      case 'PEDIDO_COMPROBANTE_DNI':
      case 'PEDIDO_COMPROBANTE_RUC':
      case 'PEDIDO_COMPROBANTE_RAZON': {
        // «No cancelar» vuelve a pedir el mismo dato (no al inicio del pedido)
        const texto =
          estado === 'PEDIDO_COMPROBANTE_DNI'
            ? TEXTOS_BOT.pedidoComprobanteDni()
            : estado === 'PEDIDO_COMPROBANTE_RUC'
              ? this.textoPedirRuc(contexto)
              : TEXTOS_BOT.pedidoComprobanteRazon();
        return {
          nuevoEstado: estado,
          acciones: [{ tipo: 'enviarTexto', texto }],
          nuevoFlujo: { ...flujo, estado, pedido },
        };
      }
      case 'PEDIDO_MEDIO_PAGO':
        return this.mostrarOpcionesPago(flujo, pedido, contexto);
      case 'PEDIDO_MONTO_EFECTIVO':
        return this.pedirMontoEfectivo(flujo, pedido, calcularTotales(pedido, contexto.vistaPreviaPedido).aCobrar);
      case 'PEDIDO_RESUMEN_CONFIRMAR':
        return this.mostrarResumenFinal(flujo, pedido, contexto);
      case 'PEDIDO_PRODUCTOS': {
        const cat = (contexto.categoriasCarta || []).find((c: any) => String(c.id) === String(pedido.categoriaSeleccionadaId));
        return cat ? this.mostrarProductosDeCategoria(flujo, pedido, cat, contexto) : this.mostrarCategorias(flujo, pedido, contexto);
      }
      case 'PEDIDO_TAMANO':
      case 'PEDIDO_GRUPO_OPCION':
      case 'PEDIDO_SABOR':
      case 'PEDIDO_CANTIDAD':
      case 'PEDIDO_NOMBRES_ENVASE':
      case 'PEDIDO_NOMBRES_CONFIRMAR': {
        const config = pedido.itemEnConfiguracion;
        const prod = config ? productoDeCarta(contexto.categoriasCarta || [], config.productoId) : null;
        if (!config || !prod) return this.mostrarCategorias(flujo, pedido, contexto);
        if (estado === 'PEDIDO_TAMANO') return this.preguntarTamano(flujo, pedido, prod, TEXTOS_BOT.pedidoPreguntarTamano(prod.nombre));
        if (estado === 'PEDIDO_NOMBRES_ENVASE') return this.preguntarNombreEnvase(flujo, pedido, config, contexto);
        if (estado === 'PEDIDO_NOMBRES_CONFIRMAR') return this.confirmarNombresEnvase(flujo, pedido, config);
        return this.avanzarConfiguracionProducto(flujo, pedido, prod, contexto);
      }
      case 'PEDIDO_INGRESAR_NOMBRE':
        return { nuevoEstado: estado, acciones: [{ tipo: 'enviarTexto', texto: TEXTOS_BOT.pedidoIngresarNombre() }], nuevoFlujo: { ...flujo, estado, pedido } };
      case 'PEDIDO_INGRESAR_TELEFONO':
        return { nuevoEstado: estado, acciones: [{ tipo: 'enviarTexto', texto: TEXTOS_BOT.pedidoIngresarTelefono() }], nuevoFlujo: { ...flujo, estado, pedido } };
      case 'PEDIDO_PROPINA':
        return this.pedirPropina(flujo, pedido, contexto);
      default:
        return this.mostrarCategorias(flujo, pedido, contexto);
    }
  }
}

// Función auxiliar para coincidencia de palabras
/** Inicio de la repregunta de un paso del pedido; la máquina lo cambia por algo amable cuando no fue un error. */
export const PREFIJO_NO_ENTENDI = 'Uy, no te entendí 🙈';

/** Recorta al límite de WhatsApp sin cortar una palabra a la mitad («…» al final). */
export function recortarEnPalabra(texto: string, max: number): string {
  if (texto.length <= max) return texto;
  const corte = texto.slice(0, max - 1);
  const espacio = corte.lastIndexOf(' ');
  return `${(espacio > max / 2 ? corte.slice(0, espacio) : corte).replace(/[\s·,.;:(-]+$/, '')}…`;
}

function coincideAlgunaPalabra(textoNormalizado: string, listaPalabras: string[]): boolean {
  if (!textoNormalizado) return false;
  return listaPalabras.some((palabra) => {
    const norm = normalizarTexto(palabra);
    return textoNormalizado === norm || textoNormalizado.includes(norm);
  });
}

function normalizarTexto(texto?: string | null): string {
  if (!texto) return '';
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Instancia única y registro automático
export const flujoPedido = new FlujoPedidoSubFlujo();
RegistroSubFlujos.registrar(flujoPedido);
