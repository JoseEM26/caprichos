import { montoACobrar } from '../../../comun/monto-a-cobrar';
import { ENVIO_GRATIS_MONTO_POR_DEFECTO } from '@caprichos/compartido';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { CatalogoService } from '../../catalogo/catalogo.service';
import { OfertasService } from '../../ofertas/ofertas.service';
import { ofertasFueraDeWhatsapp } from '../utilidades/ofertas-canal.util';
import { LocalService } from '../../local/local.service';
import { ZonasService } from '../../zonas/zonas.service';
import { HerramientaIaDefinicion } from './tipos-ia';
import { normalizarTelefono } from '../utilidades/enmascarar.util';
import { lineasDeCuenta } from '../../pedidos/lineas-combo.util';
import { detalleDatosPago } from '../conversacion/flujos/pago/textos-pago';

/** Reglas reales de pago y entrega (las que aplica el sistema): la IA no puede afirmar otras. */
export const POLITICAS_DE_PAGO = {
  delivery: 'En delivery se puede pagar en efectivo al recibir (el cliente indica con cuánto paga para el vuelto) o con tarjeta en el POS del repartidor. También puede pagar por adelantado con Yape, Plin o transferencia.',
  local: 'En el local se paga al recibir o en Caja: efectivo, tarjeta, Yape, Plin o transferencia.',
  digital: 'Yape, Plin y transferencia requieren enviar la captura (voucher) por el chat; Caja la valida. Sin captura legible no cuenta como pagado.',
  pagoDividido: 'Un pedido puede pagarse dividido (por ejemplo parte por Yape y el resto en efectivo al recibir): eso es el plan de pago del pedido.',
  saldoPendiente: 'Si el pedido tiene saldo por cobrar, se cobra con el medio que quede en el plan (efectivo o tarjeta al recibir). Agregar o corregir el delivery en el total y cambiar el plan de pago lo hace una persona del equipo.',
  limitesDeLaIa: 'La IA no registra pagos, no confirma vouchers, no cambia montos, no promete reembolsos. Todo cambio del pedido es una solicitud que revisa una persona.',
};

/** Medios que se cobran al recibir (sin voucher). */
const MEDIOS_AL_RECIBIR = ['EFECTIVO', 'TARJETA'];

/**
 * Servicio de herramientas de SOLO LECTURA (function calling) para OpenAI.
 * Garantía de arquitectura: NINGUNA función modifica la base de datos ni aprueba pagos/pedidos.
 */
@Injectable()
export class IaHerramientasService {
  private readonly logger = new Logger(IaHerramientasService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly catalogoService?: CatalogoService,
    @Optional() private readonly ofertasService?: OfertasService,
    @Optional() private readonly localService?: LocalService,
    @Optional() private readonly zonasService?: ZonasService,
  ) {}

  /**
   * Definiciones de esquemas JSON para OpenAI function calling.
   */
  obtenerDefinicionesHerramientas(): HerramientaIaDefinicion[] {
    return [
      {
        type: 'function',
        function: {
          name: 'buscarEnCarta',
          description:
            'Busca productos en la carta oficial de Caprichos por nombre, palabra clave o categoría. Retorna precios, tamaños, opciones y disponibilidad.',
          parameters: {
            type: 'object',
            properties: {
              texto: {
                type: 'string',
                description: 'Término de búsqueda o nombre de producto (ej: "frappé", "torta", "americano").',
              },
              categoria: {
                type: 'string',
                description: 'Nombre de la categoría (ej: "Bebidas calientes", "Waffles", "Postres").',
              },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'promocionesDeHoy',
          description:
            'Consulta las ofertas y promociones vigentes hoy en Caprichos (descuentos, combos, 2x1).',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'horarioYUbicacion',
          description:
            'Consulta el estado de atención del local (abierto o cerrado), horario de hoy, dirección física y enlace de Google Maps.',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'costoYZonaDeEnvio',
          description:
            'Consulta las zonas de reparto a domicilio (delivery), costo de envío, pedido mínimo y umbral de envío gratis.',
          parameters: {
            type: 'object',
            properties: {
              zona: {
                type: 'string',
                description: 'Nombre de la zona o referencia (opcional).',
              },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'mediosDePago',
          description:
            'Consulta los métodos de pago aceptados por Caprichos (Yape, Plin, Transferencia BCP, Efectivo, Tarjeta POS) y sus condiciones.',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'politicasDePago',
          description:
            'Reglas REALES de pago y entrega de Caprichos (efectivo al recibir en delivery, tarjeta, pago dividido, voucher). Úsala antes de afirmar cualquier regla de pago; no afirmes nada que no esté aquí.',
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'estadoDePedido',
          description:
            'Consulta un pedido del cliente actual: estado, total, delivery (incluido o no), pagado, saldo por cobrar, plan de pago y vouchers. Úsala SIEMPRE ante dudas de pago, saldo o delivery. Con el código (ej: CP-0110) busca ese pedido; sin código devuelve su último pedido. Solo consulta pedidos que pertenezcan estrictamente al número del cliente.',
          parameters: {
            type: 'object',
            properties: {
              codigo: {
                type: 'string',
                description: 'Código del pedido a consultar (ej: "CP-0110").',
              },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'pasarAPersona',
          description:
            'Pasa la conversación a una persona del equipo y avisa a Caja. ÚSALA SIEMPRE ante reclamos, devoluciones, descuentos, anulaciones o cambios de pedido, pagos dudosos, alergias o salud, o cuando el cliente pida hablar con alguien o tú no tengas el dato confirmado.',
          parameters: {
            type: 'object',
            properties: {
              motivo: { type: 'string', description: 'Motivo breve (ej: "reclamo por pedido frío").' },
              solicitud: {
                type: 'string',
                description:
                  'Lo que el cliente pide que una persona haga, con cifras SOLO de las herramientas (ej: "pagar el saldo de S/ 5 en efectivo al recibir; agregar delivery al total"). Tú no lo ejecutas.',
              },
            },
            required: ['motivo'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'recomendarProductos',
          description:
            'Sugiere productos disponibles de la carta real según preferencias del cliente. Nunca inventa ingredientes ni alérgenos; si hay dudas sobre salud o alergias, deriva a una persona.',
          parameters: {
            type: 'object',
            properties: {
              preferencias: {
                type: 'string',
                description: 'Preferencias del cliente (ej: "sin lactosa", "bebida dulce", "chocolate", "café suave").',
              },
              categoria: {
                type: 'string',
                description: 'Categoría opcional para acotar recomendaciones.',
              },
            },
          },
        },
      },
    ];
  }

  /**
   * Ejecuta una herramienta por nombre, garantizando solo lectura y manejo de errores seguro.
   */
  async ejecutarHerramienta(
    nombre: string,
    args: Record<string, any>,
    contextoSeguridad: { telefonoCliente?: string | null; conversacionId?: string | bigint },
  ): Promise<{ resultado: any; necesitaDerivar?: boolean; alertaAlergia?: boolean }> {
    try {
      switch (nombre) {
        case 'buscarEnCarta':
          return { resultado: await this.buscarEnCarta(args.texto, args.categoria) };

        case 'promocionesDeHoy':
          return { resultado: await this.promocionesDeHoy() };

        case 'horarioYUbicacion':
          return { resultado: await this.horarioYUbicacion() };

        case 'costoYZonaDeEnvio':
          return { resultado: await this.costoYZonaDeEnvio(args.zona) };

        case 'mediosDePago':
          return { resultado: await this.mediosDePago() };

        case 'politicasDePago':
          return { resultado: POLITICAS_DE_PAGO };

        case 'estadoDePedido':
          return {
            resultado: await this.estadoDePedido(
              args.codigo,
              contextoSeguridad.telefonoCliente,
            ),
          };

        case 'pasarAPersona':
          return {
            resultado: {
              derivado: true,
              motivo: String(args.motivo || 'Solicitud del cliente').slice(0, 200),
              solicitud: args.solicitud ? String(args.solicitud).slice(0, 300) : undefined,
              instruccion: 'Dile al cliente con calidez que una persona del equipo lo atenderá. No prometas tiempos.',
            },
            necesitaDerivar: true,
          };

        case 'recomendarProductos': {
          const recomendacion = await this.recomendarProductos(
            args.preferencias,
            args.categoria,
          );
          return {
            resultado: recomendacion.resultado,
            necesitaDerivar: recomendacion.necesitaDerivar,
            alertaAlergia: recomendacion.alertaAlergia,
          };
        }

        default:
          return {
            resultado: { error: `Herramienta desconocida: ${nombre}` },
          };
      }
    } catch (err: any) {
      this.logger.error(`Error ejecutando herramienta ${nombre}: ${err.message}`, err.stack);
      return {
        resultado: {
          error: 'No se pudo consultar esa información en este momento. Por favor intenta más tarde.',
        },
      };
    }
  }

  // ---------------------------------------------------------------------------
  // IMPLEMENTACIÓN DE LAS 7 HERRAMIENTAS DE SOLO LECTURA
  // ---------------------------------------------------------------------------

  /**
   * 1. buscarEnCarta: Consulta productos reales en CatalogoService con disponibilidad y precios.
   */
  async buscarEnCarta(texto?: string, categoria?: string) {
    if (!this.catalogoService) {
      return { error: 'Catálogo temporalmente no disponible' };
    }

    const carta = await this.catalogoService.obtenerCarta();
    const normalizar = (s: string) =>
      s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

    const textoBuscado = normalizar(texto || '');
    const catBuscada = normalizar(categoria || '');

    const productosEncontrados: any[] = [];

    for (const cat of carta) {
      const catNorm = normalizar(cat.nombre);
      if (catBuscada && !catNorm.includes(catBuscada)) {
        continue;
      }

      for (const prod of cat.productos || []) {
        const prodNombreNorm = normalizar(prod.nombre);
        const prodDescNorm = normalizar(prod.descripcion || '');

        const coincideNombre = textoBuscado ? prodNombreNorm.includes(textoBuscado) : true;
        const coincideDesc = textoBuscado && prodDescNorm
          ? prodDescNorm.includes(textoBuscado)
          : false;

        if (coincideNombre || coincideDesc || (!textoBuscado && catBuscada)) {
          productosEncontrados.push({
            nombre: prod.nombre,
            categoria: cat.nombre,
            descripcion: prod.descripcion || null,
            precioBase: Number(prod.precio ?? 0),
            disponible: prod.disponible ?? true,
            tamanos: (prod.tamanos || []).map((t: any) => ({
              nombre: t.nombre,
              precio: Number(t.precio),
            })),
            opciones: (prod.grupos || []).flatMap((g: any) =>
              (g.opciones || []).map((o: any) => ({
                grupo: g.nombre,
                nombre: o.nombre,
                precioExtra: Number(o.precioExtra || 0),
                disponible: o.disponible ?? true,
              })),
            ),
          });
        }

        if (productosEncontrados.length >= 8) break; // Máximo 8 productos para no inflar tokens
      }

      if (productosEncontrados.length >= 8) break;
    }

    return {
      total: productosEncontrados.length,
      productos: productosEncontrados,
      nota: 'Todos los productos son de la carta real. No escribas instrucciones de compra ni cierres.',
    };
  }

  /**
   * 2. promocionesDeHoy: Consulta promociones vigentes hoy mediante OfertasService.
   */
  async promocionesDeHoy() {
    if (!this.ofertasService) {
      return { ofertas: [], mensaje: 'No hay ofertas registradas en este momento.' };
    }

    const ofertas = await this.ofertasService.listarOfertas(undefined, true, 'WHATSAPP');
    // Solo las vigentes hoy (antes salían también las de otros días como «vigentes»)
    const resultado = (ofertas || [])
      .filter((o: any) => o.vigenteAhora !== false)
      .map((o: any) => ({
        nombre: o.nombre,
        tipo: o.tipo,
        beneficio: o.descripcion || `Descuento especial en ${o.nombre}`,
        disponibleHoy: true,
      }));
    // Promos que NO valen por WhatsApp: se nombran y se manda a la carta; nunca se ofrecen ni se prometen por el chat
    const fuera = ofertasFueraDeWhatsapp((await this.ofertasService.listarOfertas(undefined, true)) ?? []);
    const soloCartaWeb = fuera.soloWeb.map((o) => ({ nombre: o.nombre, tipo: o.tipo, tambienEnElLocal: o.tambienLocal }));
    const soloEnElLocal = fuera.soloLocal.map((o) => ({ nombre: o.nombre, tipo: o.tipo }));

    return {
      vigentesHoy: resultado,
      total: resultado.length,
      soloCartaWeb,
      soloEnElLocal,
      nota:
        'vigentesHoy se pueden pedir por este chat. soloCartaWeb valen únicamente en la carta web: menciónalas como «solo en la carta web» ' +
        'e invita a verlas allí; NUNCA ofrezcas ni prometas aplicarlas por WhatsApp. soloEnElLocal valen solo en el local.',
      mensaje: resultado.length + soloCartaWeb.length + soloEnElLocal.length > 0
        ? 'Estas son las promociones vigentes hoy.'
        : 'Hoy no tenemos promociones activas, pero puedes revisar nuestra carta con excelentes opciones.',
    };
  }

  /**
   * 3. horarioYUbicacion: Consulta horario de apertura y geolocalización desde LocalService.
   */
  async horarioYUbicacion() {
    if (!this.localService) {
      return {
        abierto: true,
        direccion: 'Campoy, San Juan de Lurigancho, Lima',
        enlaceMapa: 'https://www.google.com/maps?q=-12.0196436,-76.963255',
      };
    }

    const estadoCarta = await this.localService.obtenerEstadoCarta(new Date());
    const datosPublicos =
      typeof (this.localService as any).obtenerDatosPublicosLocal === 'function'
        ? await (this.localService as any).obtenerDatosPublicosLocal()
        : (await (this.localService as any).obtenerDatosLocal?.()) || {};

    const mapaUrl =
      datosPublicos?.lat && datosPublicos?.lng
        ? `https://www.google.com/maps?q=${datosPublicos.lat},${datosPublicos.lng}`
        : 'https://www.google.com/maps?q=-12.0196436,-76.963255';

    return {
      abierto: estadoCarta.abierta,
      horarioHoy: {
        abre: estadoCarta.abre || '14:00',
        cierra: estadoCarta.cierra || '22:00',
        texto: estadoCarta.texto,
      },
      pausaAltaDemanda: estadoCarta.pausaAltaDemanda || false,
      altaDemandaDemoraExtraMinutos: (estadoCarta as any)?.altaDemandaExtra || 0,
      direccion: datosPublicos?.direccion || 'Campoy, San Juan de Lurigancho, Lima',
      referencia: datosPublicos?.referencia || 'Frente al parque principal de Campoy',
      enlaceMapa: mapaUrl,
      telefonoContacto: datosPublicos?.telefono || datosPublicos?.whatsapp || '9XX XXX XXX',
    };
  }

  /**
   * 4. costoYZonaDeEnvio: Consulta zonas activas y costos desde ZonasService y configuración.
   */
  async costoYZonaDeEnvio(zonaFiltro?: string) {
    let zonasActivas: any[] = [];
    try {
      const zonasDb = await this.prisma.zonaReparto.findMany({
        where: { activa: true },
      });
      zonasActivas = zonasDb.map((z: any) => ({
        nombre: z.codigo || 'Zona',
        tarifa: Number(z.tarifa || 0),
        tiempoEstimado: 30,
      }));
    } catch {
      zonasActivas = [{ nombre: 'Campoy', tarifa: 5.0, tiempoEstimado: 30 }];
    }

    // Parámetros de pedido mínimo y envío gratis desde DB
    const paramPedidoMin = await this.prisma.parametro.findUnique({
      where: { clave: 'pedido_minimo' },
    });
    const paramEnvioGratis = await this.prisma.parametro.findUnique({
      where: { clave: 'envio_gratis_monto' },
    });

    const zonasResumen = zonasActivas.map((z: any) => ({
      nombre: z.nombre,
      tarifa: Number(z.tarifa || 0),
      tiempoMinutos: z.tiempoEstimado || 30,
    }));

    if (zonaFiltro) {
      const match = zonasResumen.filter((z) =>
        z.nombre.toLowerCase().includes(zonaFiltro.toLowerCase()),
      );
      if (match.length > 0) {
        return {
          zonas: match,
          pedidoMinimo: Number(paramPedidoMin?.valor) > 0 ? Number(paramPedidoMin?.valor) : null,
          envioGratisDesde: paramEnvioGratis?.valor ?? ENVIO_GRATIS_MONTO_POR_DEFECTO,
          mensaje: 'Tarifa para la zona consultada.',
        };
      }
    }

    return {
      zonas: zonasResumen,
      pedidoMinimo: Number(paramPedidoMin?.valor) > 0 ? Number(paramPedidoMin?.valor) : null,
      envioGratisDesde: paramEnvioGratis?.valor ?? ENVIO_GRATIS_MONTO_POR_DEFECTO,
      mensaje: 'Zonas de cobertura en Campoy y alrededores.',
    };
  }

  /**
   * 5. mediosDePago: Métodos de pago activos configurados en el local.
   */
  async mediosDePago() {
    const paramPagos = await this.prisma.parametro.findUnique({
      where: { clave: 'local_pagos' },
    });

    const configPagos = (paramPagos?.valor as any) || {};

    // Número y titular reales (los mismos que recibe el cliente al pagar un pedido)
    let datosParaPagar: Record<string, string> | undefined;
    try {
      const pub = await (this.localService as any)?.obtenerDatosPublicosLocal?.();
      const vis = pub?.mediosPagoVisibles;
      if (vis) {
        datosParaPagar = {};
        if (vis.yape?.numero) datosParaPagar.yape = detalleDatosPago('YAPE', vis, '0');
        if (vis.plin?.numero) datosParaPagar.plin = detalleDatosPago('PLIN', vis, '0');
        if (vis.transferencia?.cuenta) datosParaPagar.transferencia = detalleDatosPago('TRANSFERENCIA', vis, '0');
      }
    } catch {
      datosParaPagar = undefined;
    }

    return {
      datosParaPagar,
      mediosDisponibles: [
        {
          metodo: 'Yape / Plin',
          instrucciones: 'Pagos mediante código QR o número de teléfono del local.',
          titular: configPagos.yapeTitular || 'Caprichos Pastelería',
        },
        {
          metodo: 'Transferencia BCP',
          instrucciones: 'Aceptamos transferencias BCP y cuentas interbancarias CCI.',
          cuenta: configPagos.bcpCuenta ? '[DISPONIBLE EN PEDIDO]' : 'Disponible al confirmar pedido',
        },
        {
          metodo: 'Efectivo contra entrega',
          instrucciones: 'Puedes pagar en efectivo al recibir tu pedido. Se solicita indicar monto de vuelto.',
        },
        {
          metodo: 'Tarjeta POS',
          instrucciones: 'El repartidor lleva POS para pagos con tarjeta Visa o Mastercard.',
        },
      ],
      nota: 'La IA no aprueba ni procesa pagos; el equipo de Caja valida cada comprobante.',
    };
  }

  /**
   * 6. estadoDePedido: Consulta el pedido SOLO si coincide con el teléfono del cliente.
   * Si el pedido pertenece a otro número, se rechaza para proteger la privacidad.
   */
  async estadoDePedido(codigo: string, telefonoCliente?: string | null) {
    const telBusqueda = normalizarTelefono(telefonoCliente || '');
    if (!codigo && !telBusqueda) {
      return { encontrado: false, mensaje: 'Debes proporcionar un código de pedido válido (ej: CP-0110).' };
    }

    const codigoNorm = (codigo || '').trim().toUpperCase();
    const pedido = codigoNorm
      ? await this.prisma.pedido.findUnique({ where: { codigo: codigoNorm }, include: { lineas: true, planPago: true, cobros: true, zona: true, vouchers: true } })
      : await this.prisma.pedido.findFirst({
          where: { cliente_telefono: { endsWith: telBusqueda.slice(-9) } },
          orderBy: { creado_en: 'desc' },
          include: { lineas: true, planPago: true, cobros: true, zona: true, vouchers: true },
        });

    if (!pedido) {
      return {
        encontrado: false,
        mensaje: codigoNorm
          ? `No encontramos ningún pedido registrado con el código ${codigoNorm}.`
          : 'No encontramos pedidos recientes con este número de WhatsApp.',
      };
    }

    // Validación estricta de titularidad por teléfono
    const telPedido = normalizarTelefono(pedido.cliente_telefono || '');
    const telCliente = normalizarTelefono(telefonoCliente || '');

    if (telPedido && telCliente && telPedido !== telCliente) {
      // Seguridad: rechazar sin filtrar datos de otra persona
      return {
        encontrado: false,
        mensaje: `El pedido ${pedido.codigo} no corresponde al número de WhatsApp que realiza la consulta.`,
      };
    }

    const productos = lineasDeCuenta(pedido.lineas || []).map(
      (linea: any) => `${linea.cantidad}x ${linea.nombre || 'Producto'}`,
    );

    const p: any = pedido;
    const totalCobrable = Math.round((montoACobrar(p) + Number(p.propina ?? 0)) * 100) / 100;
    const cobrado = (p.cobros || []).filter((c: any) => !c.anulado_en).reduce((a: number, c: any) => a + Number(c.total), 0);
    const plan = (p.planPago || []).map((f: any) => ({ medio: f.medio, monto: Number(f.monto) }));
    const vouchers = (p.vouchers || []).filter((v: any) => !v.reemplazado_en && !v.retirado);
    const esDelivery = String(p.modalidad || '').toUpperCase() === 'DELIVERY';
    const envio = p.envio != null ? Number(p.envio) : null;
    const saldo = p.pago_estado === 'PAGADO' ? 0 : Math.max(0, Math.round((totalCobrable - cobrado) * 100) / 100);
    const alRecibir = plan.filter((f: any) => MEDIOS_AL_RECIBIR.includes(f.medio)).reduce((a: number, f: any) => a + f.monto, 0);
    const delivery = esDelivery
      ? {
          envioIncluidoEnTotal: envio != null && envio > 0,
          envioCobrado: envio,
          tarifaDeLaZona: p.zona?.tarifa != null ? Number(p.zona.tarifa) : null,
          nota:
            envio != null && envio > 0
              ? 'El envío ya está sumado al total.'
              : 'El total NO muestra costo de envío (puede faltar sumarlo o ser envío gratis). No afirmes una tarifa que no esté aquí; una persona lo confirma.',
        }
      : undefined;

    return {
      encontrado: true,
      codigo: pedido.codigo,
      estado: pedido.estado,
      modalidad: pedido.modalidad,
      total: Number(pedido.total),
      totalACobrar: totalCobrable,
      pago: {
        estado: p.pago_estado ?? null,
        medioElegido: p.pago_metodo ?? p.pago_preferido ?? null,
        pagaCon: p.paga_con != null ? Number(p.paga_con) : null,
        planDePago: plan,
        pagadoRegistradoPorCaja: cobrado,
        saldoPorCobrar: saldo,
        montoPorCobrarAlRecibirSegunPlan: alRecibir,
        vouchersEnRevision: vouchers.filter((v: any) => !v.revisado_en).length,
        aviso: 'Pagado y saldo salen de lo que Caja registró; un voucher en revisión aún no cuenta como pagado.',
      },
      delivery,
      creado_en: pedido.creado_en.toISOString(),
      productos,
      tiempoEstimadoMin:
        (pedido as any).eta_min != null
          ? { desde: (pedido as any).eta_min, hasta: (pedido as any).eta_max ?? (pedido as any).eta_min }
          : null,
      mensaje: `Pedido ${pedido.codigo} en estado ${pedido.estado}.`,
    };
  }

  /**
   * Resumen de una línea del pedido más reciente del cliente, para la nota interna del asesor. Solo lectura; nunca lanza.
   */
  async resumenPedidoParaAsesor(telefonoCliente?: string | null): Promise<string | null> {
    try {
      const r: any = await this.estadoDePedido('', telefonoCliente);
      if (!r?.encontrado) return null;
      const partes = [`${r.codigo} (${r.estado}, ${r.modalidad})`, `total S/ ${r.totalACobrable ?? r.total}`];
      if (r.pago) partes.push(`pagado por Caja S/ ${r.pago.pagadoRegistradoPorCaja}`, `saldo S/ ${r.pago.saldoPorCobrar}`);
      if (r.pago?.planDePago?.length) partes.push(`plan: ${r.pago.planDePago.map((f: any) => `${f.medio} ${f.monto}`).join(' + ')}`);
      if (r.delivery) partes.push(r.delivery.envioIncluidoEnTotal ? `envío S/ ${r.delivery.envioCobrado} incluido` : 'envío NO sumado al total');
      if (r.pago?.vouchersEnRevision) partes.push(`${r.pago.vouchersEnRevision} voucher(s) sin revisar`);
      return partes.join(' · ');
    } catch {
      return null;
    }
  }

  /**
   * 7. recomendarProductos: Recomienda productos de la carta real.
   * REGLA ESTRICTA: NUNCA inventa alérgenos ni ingredientes.
   * Si hay dudas sobre salud o alérgenos graves no certificados, deriva a una persona.
   */
  async recomendarProductos(preferencias?: string, categoria?: string) {
    const prefLimpia = (preferencias || '').toLowerCase();

    // Palabras de advertencia sobre alergias o salud estricta
    const esConsultaSaludAlergia =
      prefLimpia.includes('alerg') ||
      prefLimpia.includes('celiac') ||
      prefLimpia.includes('celíac') ||
      prefLimpia.includes('gluten') ||
      prefLimpia.includes('mani') ||
      prefLimpia.includes('maní') ||
      prefLimpia.includes('nuez') ||
      prefLimpia.includes('frutos secos');

    if (!this.catalogoService) {
      return {
        resultado: { mensaje: 'Catálogo no disponible.' },
        necesitaDerivar: true,
      };
    }

    const carta = await this.catalogoService.obtenerCarta();
    const productosDisponibles: any[] = [];

    // Inspeccionar leche / lactosa
    const esLactosa = prefLimpia.includes('lactosa') || prefLimpia.includes('leche');

    for (const cat of carta) {
      if (categoria && !cat.nombre.toLowerCase().includes(categoria.toLowerCase())) {
        continue;
      }

      for (const prod of cat.productos || []) {
        if (!prod.disponible) continue; // Solo productos disponibles

        const desc = (prod.descripcion || '').toLowerCase();
        let esBuenaOpcion = false;

        if (esLactosa) {
          // Revisar si tiene opción de leche sin lactosa o bebida vegetal en sus grupos
          const tieneOpcionSinLactosa = (prod.grupos || []).some((g: any) =>
            (g.opciones || []).some((o: any) =>
              /sin lactosa|almendra|soya|vegetal/i.test(o.nombre),
            ),
          );
          if (tieneOpcionSinLactosa || desc.includes('sin lactosa')) {
            esBuenaOpcion = true;
          }
        } else if (preferencias) {
          if (prod.nombre.toLowerCase().includes(prefLimpia) || desc.includes(prefLimpia)) {
            esBuenaOpcion = true;
          }
        } else {
          esBuenaOpcion = true;
        }

        if (esBuenaOpcion) {
          productosDisponibles.push({
            nombre: prod.nombre,
            categoria: cat.nombre,
            precioBase: Number(prod.precio ?? 0),
            descripcion: prod.descripcion || null,
          });
        }

        if (productosDisponibles.length >= 5) break;
      }

      if (productosDisponibles.length >= 5) break;
    }

    if (esConsultaSaludAlergia) {
      return {
        resultado: {
          alertaAlergia: true,
          mensaje:
            'No disponemos de información de alérgenos certificada en la base de datos para garantizar ausencia total de trazas. Por precaución médica para tu salud, te transferimos con un asesor humano.',
          productosSugeridos: productosDisponibles.slice(0, 3),
        },
        necesitaDerivar: true,
        alertaAlergia: true,
      };
    }

    return {
      resultado: {
        recomendaciones: productosDisponibles,
        total: productosDisponibles.length,
        nota: 'Recomendaciones basadas en productos actualmente disponibles en nuestra carta.',
      },
      necesitaDerivar: false,
      alertaAlergia: false,
    };
  }
}
