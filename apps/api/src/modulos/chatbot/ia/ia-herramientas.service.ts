import { montoACobrar } from '../../../comun/monto-a-cobrar';
import { ENVIO_GRATIS_MONTO_POR_DEFECTO, medioActivo } from '@caprichos/compartido';
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
import { condicionPedidosDelChat, extraerCelularTexto, extraerClavePedido, pedidoDelChatPorCodigo, pedidoEsDelChat } from '../servicios/pedidos-del-chat.util';
import { MEDIOS_DIGITALES_VOUCHER } from '../servicios/pedido-esperando-voucher.util';
import { progresoDelPedido } from '../../pedidos/progreso-pedido';
import { leerConfigEta } from '../../repartos/eta-entrega';
import { obtenerFechaHoraLima } from '../../local/local.util';
import { leerConfigProgramados } from '../../pedidos/programado.util';

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

/** Nombres de los sabores agotados (solo si hay): la IA nunca debe ofrecerlos. */
function saboresAgotadosDe(p: any): { saboresAgotados?: string[] } {
  const agotados = (p.sabores || []).filter((s: any) => s.disponible === false).map((s: any) => s.nombre);
  return agotados.length ? { saboresAgotados: agotados } : {};
}

/** Stock al momento de un producto: cuántos quedan, hasta cuándo está agotado y qué sabores hay. */
function datosStock(p: any): Record<string, unknown> {
  const sabores: any[] = p.sabores || [];
  return {
    ...(typeof p.quedan === 'number' ? { quedan: p.quedan } : {}),
    ...(p.agotadoHasta ? { agotadoHasta: p.agotadoHasta } : {}),
    ...(sabores.length
      ? {
          saboresDisponibles: sabores
            .filter((s) => s.disponible)
            .map((s) => (typeof s.quedan === 'number' ? { nombre: s.nombre, quedan: s.quedan } : { nombre: s.nombre })),
          saboresAgotados: sabores.filter((s) => !s.disponible).map((s) => s.nombre),
        }
      : {}),
  };
}

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
            'Busca productos en la carta oficial de Caprichos por nombre, palabra clave o categoría. Retorna precios, tamaños, opciones, disponibilidad, porciones («alcanza para») y alérgenos con su confirmación.',
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
            'Consulta los pedidos de ESTE chat, de cualquier canal (Caja, mozo, carta o WhatsApp): estado, qué lleva, total, modalidad, si está programado, progreso (etapa, porcentaje, minutos aproximados que faltan), pago (pagado, saldo, plan, si FALTA EL VOUCHER) y delivery. Úsala SIEMPRE ante «mi pedido», «ya sale», «cuánto falta», «llegó», dudas de pago, saldo, voucher o delivery. Con el código (ej: CP-0110) busca ese pedido; sin código devuelve su último pedido y un resumen de otros recientes. Solo ve pedidos de este chat. Los minutos que faltan son aproximados: dilos como «aprox.», nunca como promesa.',
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
          name: 'cartaCompleta',
          description:
            'Devuelve TODA la carta real y compacta: categorías, productos con precio, disponibilidad del momento y cuántos quedan si hay stock. Úsala para preguntas abiertas («algo frío», «refresco», «iced», «algo dulce», «qué me recomiendas», «sin azúcar») y razona tú qué productos encajan; recomienda solo lo que está aquí y disponible.',
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'accionDelBot',
          description:
            'Pide al sistema una acción que el cliente acepta o pidió: EMPEZAR_PEDIDO (quiere pedir), AGREGAR_PRODUCTO (quiere un producto concreto; pasa el nombre exacto de la carta), VER_CATEGORIA (quiere ver una categoría). El sistema la ejecuta y añade los botones; tú solo escribe una respuesta corta. No inventes productos: si no existe, la herramienta lo dirá.',
          parameters: {
            type: 'object',
            properties: {
              accion: { type: 'string', enum: ['EMPEZAR_PEDIDO', 'AGREGAR_PRODUCTO', 'VER_CATEGORIA'] },
              producto: { type: 'string', description: 'Nombre del producto (solo AGREGAR_PRODUCTO).' },
              categoria: { type: 'string', description: 'Nombre de la categoría (solo VER_CATEGORIA).' },
            },
            required: ['accion'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'fotoDe',
          description:
            'Manda al cliente la FOTO de un producto, combo, tamaño, sabor, juguete u opción de la carta. Úsala SOLO si el cliente pide ver algo («foto», «imagen», «cómo es», «cómo se ve», «muéstrame») o duda de cómo es. Nunca la uses por defecto. Pasa el nombre tal como está en la carta; el sistema valida que exista y que tenga foto, y envía la imagen. No inventes ni describas fotos; no escribas enlaces.',
          parameters: {
            type: 'object',
            properties: { nombre: { type: 'string', description: 'Nombre de lo que el cliente quiere ver (ej: "Sirena", "Combo Dúo", "Fresa").' } },
            required: ['nombre'],
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
    contextoSeguridad: { telefonoCliente?: string | null; conversacionId?: string | bigint; textoCliente?: string | null },
  ): Promise<{ resultado: any; necesitaDerivar?: boolean; alertaAlergia?: boolean }> {
    try {
      switch (nombre) {
        case 'buscarEnCarta':
          return { resultado: await this.buscarEnCarta(args.texto, args.categoria) };

        case 'promocionesDeHoy':
          return { resultado: await this.promocionesDeHoy() };

        case 'cartaCompleta':
          return { resultado: await this.cartaCompleta() };

        case 'accionDelBot':
          return { resultado: await this.accionDelBot(args.accion, args.producto, args.categoria) };

        case 'fotoDe':
          return { resultado: await this.fotoDe(args.nombre) };

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
              contextoSeguridad.conversacionId,
              contextoSeguridad.textoCliente,
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
            porciones: prod.porciones ?? null,
            alergenos: prod.alergenos ?? [],
            alergenosConfirmados: prod.alergenosConfirmados ?? false,
            precioBase: Number(prod.precio ?? 0),
            disponible: prod.disponible ?? true,
            ...datosStock(prod),
            ...(prod.fotoUrl ? { fotoUrl: prod.fotoUrl } : {}),
            tamanos: (prod.tamanos || []).map((t: any) => ({
              nombre: t.nombre,
              precio: Number(t.precio),
              ...(t.fotoUrl ? { fotoUrl: t.fotoUrl } : {}),
            })),
            opciones: (prod.grupos || []).flatMap((g: any) =>
              (g.opciones || []).map((o: any) => ({
                grupo: g.nombre,
                nombre: o.nombre,
                precioExtra: Number(o.precioExtra || 0),
                disponible: o.disponible ?? true,
                ...(o.fotoUrl ? { fotoUrl: o.fotoUrl } : {}),
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


  /** Toda la carta, compacta (precio, disponibilidad del momento, cuántos quedan): para preguntas abiertas. */
  async cartaCompleta() {
    if (!this.catalogoService) return { error: 'Catálogo temporalmente no disponible' };
    const carta = await this.catalogoService.obtenerCarta();
    return {
      categorias: (carta || []).map((c: any) => ({
        categoria: c.nombre,
        productos: (c.productos || []).slice(0, 40).map((p: any) => ({
          nombre: p.nombre,
          precio: Number(p.precio ?? 0),
          disponible: p.disponible !== false,
          ...(typeof p.quedan === 'number' ? { quedan: p.quedan } : {}),
          ...(p.alergenosConfirmados ? { alergenos: p.alergenos ?? [] } : { alergenosConfirmados: false }),
          ...(p.descripcion ? { descripcion: String(p.descripcion) } : {}),
          ...saboresAgotadosDe(p),
        })),
      })),
      nota: 'Carta real del momento. Solo recomienda productos con disponible=true.',
    };
  }

  /**
   * «Mándame la foto de X»: solo valida contra la carta real y los combos y devuelve las rutas de foto que EXISTEN (máx. 6).
   * No escribe ni envía nada: el motor manda las imágenes. Sin foto o sin coincidencia, dice que no hay (la IA no inventa).
   */
  async fotoDe(nombre?: string) {
    const normalizar = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const q = normalizar(String(nombre ?? ''));
    if (q.length < 3) return { ok: false, error: 'Falta el nombre de lo que quiere ver.' };
    const fotos: { nombre: string; fotoUrl: string }[] = [];
    const ver = (n: string | undefined, fotoUrl: string | null | undefined) => {
      if (n && fotoUrl && normalizar(n).includes(q) && !fotos.some((f) => f.fotoUrl === fotoUrl)) fotos.push({ nombre: n, fotoUrl });
    };
    for (const c of (await this.catalogoService?.obtenerCarta()) ?? []) {
      for (const p of c.productos || []) {
        ver(p.nombre, p.fotoUrl);
        for (const t of p.tamanos || []) ver(`${p.nombre} ${t.nombre}`, t.fotoUrl);
        for (const sb of p.sabores || []) ver(sb.nombre, sb.fotoUrl);
        for (const g of p.grupos || []) for (const o of g.opciones || []) ver(o.nombre, o.fotoUrl);
      }
    }
    for (const o of (await this.ofertasService?.listarOfertas('COMBO', true, 'WHATSAPP')) ?? []) {
      ver(o.nombre, (o as any).imagenUrl);
      for (const t of o.combosPrecio ?? []) ver(`${o.nombre} ${t.tamanoNombre ?? ''}`, t.fotoUrl);
      for (const parte of o.combosParte ?? []) {
        for (const op of parte.opcionesDetalle ?? []) {
          ver(op.nombre, op.fotoUrl);
          for (const sb of op.sabores ?? []) ver(sb.nombre, sb.fotoUrl);
        }
      }
    }
    if (fotos.length === 0) return { ok: false, error: 'No hay foto de eso en la carta. No prometas ni describas una foto.' };
    return { ok: true, fotos: fotos.slice(0, 6), instruccion: 'El sistema enviará la(s) imagen(es). Escribe una frase corta; no pegues enlaces.' };
  }

  /**
   * Acción estructurada para el motor. Solo valida contra la carta real y devuelve el id: NO escribe nada.
   * El motor (ejecutor) la convierte en botones o en el siguiente paso del pedido guiado.
   */
  async accionDelBot(accion?: string, producto?: string, categoria?: string) {
    const a = String(accion || '').toUpperCase();
    if (a === 'EMPEZAR_PEDIDO') return { ok: true, accion: { tipo: 'EMPEZAR_PEDIDO' }, instruccion: 'Escribe una respuesta corta; el sistema añade el inicio del pedido.' };
    if (!this.catalogoService) return { ok: false, error: 'Catálogo no disponible' };
    const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    const carta = await this.catalogoService.obtenerCarta();
    if (a === 'AGREGAR_PRODUCTO') {
      const q = norm(producto || '');
      for (const c of carta || []) {
        for (const p of c.productos || []) {
          if (q && norm(p.nombre) === q && p.disponible !== false) {
            return { ok: true, accion: { tipo: 'AGREGAR_PRODUCTO', productoId: String(p.id), nombre: p.nombre }, instruccion: 'Escribe una respuesta corta; el sistema pregunta lo que falte para agregarlo.' };
          }
        }
      }
      for (const c of carta || []) {
        for (const p of c.productos || []) {
          if (q.length >= 3 && norm(p.nombre).includes(q) && p.disponible !== false) {
            return { ok: true, accion: { tipo: 'AGREGAR_PRODUCTO', productoId: String(p.id), nombre: p.nombre }, instruccion: 'Escribe una respuesta corta; el sistema pregunta lo que falte para agregarlo.' };
          }
        }
      }
      return { ok: false, error: 'Ese producto no está en la carta o está agotado. No lo prometas.' };
    }
    if (a === 'VER_CATEGORIA') {
      const q = norm(categoria || '');
      const cat = (carta || []).find((c: any) => q.length >= 3 && norm(c.nombre).includes(q));
      if (cat) return { ok: true, accion: { tipo: 'VER_CATEGORIA', categoriaId: String(cat.id), nombre: cat.nombre }, instruccion: 'Escribe una respuesta corta; el sistema añade el botón para verla.' };
      return { ok: false, error: 'Esa categoría no existe en la carta.' };
    }
    return { ok: false, error: 'Acción desconocida.' };
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
      return { error: 'Horario y ubicación temporalmente no disponibles. No des horarios ni direcciones; ofrece que una persona del equipo lo confirme.' };
    }

    const ahora = new Date();
    const estadoCarta = await this.localService.obtenerEstadoCarta(ahora);
    const datosPublicos =
      typeof (this.localService as any).obtenerDatosPublicosLocal === 'function'
        ? await (this.localService as any).obtenerDatosPublicosLocal()
        : (await (this.localService as any).obtenerDatosLocal?.()) || {};

    const mapaUrl =
      datosPublicos?.lat && datosPublicos?.lng
        ? `https://www.google.com/maps?q=${datosPublicos.lat},${datosPublicos.lng}`
        : 'https://www.google.com/maps?q=-12.0196436,-76.963255';

    // Semana completa (misma lectura que usa el admin: nombre del día y HH:mm), en orden lunes a domingo
    const filas: any[] = (await (this.localService as any).obtenerHorarioAdmin?.()) || [];
    const semana = filas.map((h) =>
      h.cerrado || !h.abre || !h.cierra ? { dia: h.dia, cerrado: true } : { dia: h.dia, abre: h.abre, cierra: h.cierra },
    );

    // Próxima apertura (solo con hoy cerrado): hoy si aún no abre, si no el siguiente día abierto
    let proximaApertura: { dia: string; abre: string } | null = null;
    if (!estadoCarta.abierta && filas.length) {
      const { diaSemana, horaMinutos } = obtenerFechaHoraLima(ahora);
      for (let i = 0; i <= 7; i++) {
        const dia = ((diaSemana - 1 + i) % 7) + 1;
        const h = filas.find((f) => f.dia_semana === dia);
        if (!h || h.cerrado || !h.abre) continue;
        if (i === 0 && h.abre <= horaMinutos) continue;
        proximaApertura = { dia: i === 0 ? `${h.dia} (hoy)` : h.dia, abre: h.abre };
        break;
      }
    }

    let sePuedeProgramar = false;
    try {
      sePuedeProgramar = (await leerConfigProgramados(this.prisma as any)).fueraHorario;
    } catch {
      sePuedeProgramar = false;
    }

    return {
      abierto: estadoCarta.abierta,
      horarioHoy: {
        abre: estadoCarta.abre || null,
        cierra: estadoCarta.cierra || null,
        texto: estadoCarta.texto,
      },
      semana,
      proximaApertura,
      sePuedeProgramar,
      notaProgramar: 'Si está cerrado y sePuedeProgramar, ofrece programar el pedido para cuando abramos.',
      pausaAltaDemanda: estadoCarta.pausaAltaDemanda || false,
      altaDemandaDemoraExtraMinutos: (estadoCarta as any)?.altaDemandaExtra || 0,
      direccion: datosPublicos?.direccion || 'Campoy, San Juan de Lurigancho, Lima',
      referencia: datosPublicos?.referencia || null,
      enlaceMapa: mapaUrl,
      telefonoContacto: datosPublicos?.telefono || datosPublicos?.whatsapp || null,
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
      return { error: 'No se pudieron leer las zonas de reparto. No des tarifas; ofrece que una persona del equipo las confirme.' };
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
      mensaje: 'Zonas de cobertura activas.',
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
    let canal: any;
    try {
      const pub = await (this.localService as any)?.obtenerDatosPublicosLocal?.();
      canal = pub?.mediosPagoCanal;
      const vis = pub?.mediosPagoVisibles;
      if (vis) {
        datosParaPagar = {};
        if (vis.yape?.numero) datosParaPagar.yape = detalleDatosPago('YAPE', vis, '0');
        if (vis.plin?.numero) datosParaPagar.plin = detalleDatosPago('PLIN', vis, '0');
        if (vis.transferencia?.cuenta || vis.transferencia?.cci) datosParaPagar.transferencia = detalleDatosPago('TRANSFERENCIA', vis, '0');
      }
    } catch {
      datosParaPagar = undefined;
    }

    // Solo lo encendido en el canal BOT; el pago en línea (pasarela) nunca se ofrece por WhatsApp
    const enBot = (m: string) => !canal || medioActivo(canal, m, 'BOT');
    const mediosDisponibles = [
        {
          ids: ['YAPE', 'PLIN'],
          metodo: 'Yape / Plin',
          instrucciones: 'Pagos mediante código QR o número de teléfono del local.',
          titular: configPagos.yapeTitular || 'Caprichos Pastelería',
        },
        {
          ids: ['TRANSFERENCIA'],
          metodo: 'Transferencia BCP',
          instrucciones: 'Aceptamos transferencias BCP y cuentas interbancarias CCI.',
          cuenta: configPagos.bcpCuenta ? '[DISPONIBLE EN PEDIDO]' : 'Disponible al confirmar pedido',
        },
        {
          ids: ['EFECTIVO'],
          metodo: 'Efectivo contra entrega',
          instrucciones: 'Puedes pagar en efectivo al recibir tu pedido. Se solicita indicar monto de vuelto.',
        },
        {
          ids: ['TARJETA'],
          metodo: 'Tarjeta POS',
          instrucciones: 'El repartidor lleva POS para pagos con tarjeta Visa o Mastercard.',
        },
    ]
      .filter((m) => m.ids.some(enBot))
      .map(({ ids, ...resto }) => (ids.length > 1 ? { ...resto, metodo: ids.filter(enBot).map((i) => i[0] + i.slice(1).toLowerCase()).join(' / ') } : resto));

    return {
      datosParaPagar: datosParaPagar && canal ? Object.fromEntries(Object.entries(datosParaPagar).filter(([k]) => enBot(k.toUpperCase()))) : datosParaPagar,
      mediosDisponibles,
      nota: 'La IA no aprueba ni procesa pagos; el equipo de Caja valida cada comprobante.',
    };
  }

  /**
   * 6. estadoDePedido: Consulta el pedido SOLO si coincide con el teléfono del cliente.
   * Si el pedido pertenece a otro número, se rechaza para proteger la privacidad.
   */
  async estadoDePedido(codigo: string, telefonoCliente?: string | null, conversacionId?: string | bigint, textoCliente?: string | null) {
    const telBusqueda = normalizarTelefono(telefonoCliente || '');
    // Llaves del chat (celular, celular vinculado del chat LID, party): pedidos de CUALQUIER canal (Caja, mozo, carta, WhatsApp)
    const chat = await this.chatDe(conversacionId);
    const llaves = chat ? condicionPedidosDelChat(chat) : null;
    const donde: any = llaves ?? (telBusqueda ? { cliente_telefono: { endsWith: telBusqueda.slice(-9) } } : null);
    if (!codigo && !donde) {
      return { encontrado: false, mensaje: 'No encontramos pedidos asociados a este chat. Si tiene el código de su pedido (ej: CP-0110), puede dárnoslo.' };
    }

    const incluir = { lineas: true, planPago: true, cobros: true, zona: true, vouchers: true, comandas: { include: { area: true } } } as const;
    const codigoNorm = (codigo || '').trim().toUpperCase();
    const pedido = codigoNorm
      ? await this.prisma.pedido.findUnique({ where: { codigo: codigoNorm }, include: incluir })
      : await this.prisma.pedido.findFirst({
          where: { ...donde, es_personal: false, estado: { not: 'ANULADO' } },
          orderBy: { creado_en: 'desc' },
          include: incluir,
        });

    if (!pedido) {
      return {
        encontrado: false,
        mensaje: codigoNorm
          ? `No encontramos ningún pedido registrado con el código ${codigoNorm}.`
          : 'No encontramos pedidos recientes con este número de WhatsApp.',
      };
    }

    // Titularidad estricta: con las llaves del chat, el pedido tiene que ser de este chat; sin chat, por celular
    const telPedido = normalizarTelefono(pedido.cliente_telefono || '');
    const telCliente = normalizarTelefono(telefonoCliente || '');
    let ajeno = chat && llaves ? !pedidoEsDelChat(chat, pedido as any) : Boolean(telPedido && telCliente && telPedido !== telCliente);
    // Código + clave de la carta (o + su celular) en el mensaje del cliente: es suyo, aunque sea del equipo o de otro canal
    let sinLlaveConCodigo = Boolean(chat && !llaves && codigoNorm);
    if ((ajeno || sinLlaveConCodigo) && chat && codigoNorm && textoCliente && /^\d+$/.test(String(conversacionId))) {
      const ok = await pedidoDelChatPorCodigo(this.prisma, { ...chat, id: BigInt(conversacionId as any) }, codigoNorm, extraerClavePedido(textoCliente), extraerCelularTexto(textoCliente)).catch(() => null);
      if (ok) {
        ajeno = false;
        sinLlaveConCodigo = false;
      }
    }
    if (ajeno || sinLlaveConCodigo) {
      // Seguridad: rechazar sin filtrar datos de otra persona
      return {
        encontrado: false,
        mensaje: `El pedido ${pedido.codigo} no corresponde al número de WhatsApp que realiza la consulta.`,
      };
    }

    const detalle = await this.detalleDePedido(pedido);
    // Otros pedidos recientes del mismo chat (breve): «¿cuál de mis pedidos?»
    let otrosPedidos: any[] | undefined;
    if (!codigoNorm && donde) {
      try {
        const otros = await (this.prisma.pedido as any).findMany?.({
          where: { ...donde, es_personal: false, estado: { not: 'ANULADO' }, id: { not: pedido.id }, creado_en: { gte: new Date(Date.now() - 3 * 24 * 3600 * 1000) } },
          orderBy: { creado_en: 'desc' },
          take: 3,
          select: { codigo: true, estado: true, modalidad: true, total: true, canal: true, programado_para: true },
        });
        if (Array.isArray(otros) && otros.length) {
          otrosPedidos = otros.map((o: any) => ({ codigo: o.codigo, estado: o.estado, modalidad: o.modalidad, canal: o.canal, total: Number(o.total), ...(o.programado_para ? { programadoPara: this.horaLima(o.programado_para) } : {}) }));
        }
      } catch {
        otrosPedidos = undefined;
      }
    }
    return { ...detalle, ...(otrosPedidos ? { otrosPedidos } : {}) };
  }

  /** Llaves del chat (teléfono, celular vinculado, party). null si no hay conversación o falla la consulta. */
  private async chatDe(conversacionId?: string | bigint): Promise<{ telefono: string | null; celular_vinculado: string | null; party_id: bigint | null } | null> {
    if (conversacionId === undefined || conversacionId === null || !/^\d+$/.test(String(conversacionId))) return null;
    try {
      const c: any = await (this.prisma as any).conversacion?.findUnique?.({
        where: { id: BigInt(conversacionId) },
        select: { telefono: true, celular_vinculado: true, party_id: true },
      });
      return c ? { telefono: c.telefono ?? null, celular_vinculado: c.celular_vinculado ?? null, party_id: c.party_id ?? null } : null;
    } catch {
      return null;
    }
  }

  private horaLima(fecha: Date): string {
    const f = obtenerFechaHoraLima(fecha);
    return `${f.fechaIso} ${f.horaMinutos}`;
  }

  /** Datos del pedido para la IA: sin DNI, dirección ni teléfono. Progreso, tiempos, pago y voucher con las mismas reglas del sistema. */
  private async detalleDePedido(pedido: any) {
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

    // ¿Debe un voucher? Medio digital elegido, sin pagar y sin voucher vigente
    const medioDigital = [p.pago_metodo, p.pago_preferido, ...plan.map((f: any) => f.medio)].some((m: any) => MEDIOS_DIGITALES_VOUCHER.includes(String(m ?? '').toUpperCase()));
    const faltaVoucher = medioDigital && p.pago_estado !== 'PAGADO' && vouchers.length === 0 && !['ANULADO', 'ENTREGADO'].includes(p.estado);

    // Progreso (misma fuente que la carta y el mozo) y tiempo que falta; nunca lanza
    let progreso: any;
    try {
      const cfg = p.estado === 'EN_CAMINO' ? await leerConfigEta(this.prisma as any).catch(() => undefined) : undefined;
      const pr = progresoDelPedido(p, { ahora: new Date(), ...(cfg ? { cfg } : {}) });
      progreso = {
        etapa: pr.etapa,
        etiqueta: pr.etiqueta,
        porcentaje: pr.porcentaje,
        ...(pr.estimadoMin !== undefined ? { listoEnMinAprox: pr.estimadoMin } : {}),
        ...(pr.etaMin !== undefined ? { llegaEnMin: { desde: pr.etaMin, hasta: pr.etaMax } } : {}),
      };
    } catch {
      progreso = undefined;
    }

    return {
      encontrado: true,
      codigo: pedido.codigo,
      estado: pedido.estado,
      modalidad: pedido.modalidad,
      canal: p.canal ?? null,
      ...(p.programado_para ? { programadoPara: this.horaLima(p.programado_para), nota_programado: 'Pedido programado: no entra a cocina hasta cerca de esa hora.' } : {}),
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
        faltaVoucher,
        aviso: 'Pagado y saldo salen de lo que Caja registró; un voucher en revisión aún no cuenta como pagado.',
      },
      delivery,
      ...(progreso ? { progreso } : {}),
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
  async resumenPedidoParaAsesor(telefonoCliente?: string | null, conversacionId?: string | bigint): Promise<string | null> {
    try {
      const r: any = await this.estadoDePedido('', telefonoCliente, conversacionId);
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
        if (!prod.disponible || prod.quedan === 0) continue; // Solo productos disponibles y con stock

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
            porciones: prod.porciones ?? null,
            alergenos: prod.alergenos ?? [],
            alergenosConfirmados: prod.alergenosConfirmados ?? false,
            ...datosStock(prod),
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
