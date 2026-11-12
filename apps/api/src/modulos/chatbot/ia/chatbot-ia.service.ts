import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../comun/redis/redis.service';
import { IaHerramientasService } from './ia-herramientas.service';
import { IaConsumoService } from './ia-consumo.service';
import { construirPromptSistema } from './prompt-sistema';
import { ConocimientoBotService } from './conocimiento-bot.service';
import {
  enmascararDatosSensibles,
  extraerPrimerNombre,
  prepararHistorialPrivado,
} from './ia-privacidad.util';
import {
  MensajeOpenAI,
  ParametrosConsultaIa,
  ResultadoConsultaIa,
} from './tipos-ia';
import { TEXTOS_IA } from '../conversacion/textos-ia';

/**
 * Patrones típicos de inyección de prompt para defensa activa en profundidad.
 */
/** Temas delicados: la IA no los resuelve, pasan directo a una persona (también avisa a Caja). */
export const PATRON_DELICADO =
  /\b(reclam\w*|queja|devoluci[oó]n|devuelv\w*|reembols\w*|descuento|rebaja|anul\w+|cancel\w+\s+(?:mi\s+)?pedido|me\s+cobraron\s+(?:de\s+)?m[aá]s|cobro\s+(?:doble|indebido)|pagu[eé]\s+y\s+no|estafa|intoxic\w*|me\s+cay[oó]\s+mal)\b/i;

const PATRONES_INYECCION = [
  /ignora\s+(?:todas\s+las\s+)?instrucciones/i,
  /ignore\s+(?:all\s+)?instructions/i,
  /dime\s+(?:tu\s+)?prompt\s+de\s+sistema/i,
  /repeat\s+(?:your\s+)?initial\s+instructions/i,
  /system\s+override/i,
  /\bDAN\b|\bDo Anything Now\b/i,
  /olvida\s+que\s+eres\s+Capri/i,
  /ya\s+no\s+eres\s+Capri/i,
  /(?:act[uú]a\s+como|eres)\s+(?:un\s+)?(?:m[eé]dico|doctor|especialista|dueño|kevin)/i,
  /(?:curar[aá]|cura)\s+(?:mi\s+)?(?:diabetes|c[aá]ncer|enfermedad)/i,
  /modo\s+desarrollador|jailbreak/i,
];

@Injectable()
export class ChatbotIaService {
  private readonly logger = new Logger(ChatbotIaService.name);
  private readonly apiKey: string;
  private readonly modelo: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly herramientasService: IaHerramientasService,
    private readonly consumoService: IaConsumoService,
    private readonly redisService: RedisService,
    @Optional() private readonly conocimiento?: ConocimientoBotService,
  ) {
    this.apiKey = this.configService.get<string>('OPENAI_API_KEY', '').trim();
    this.modelo = this.configService.get<string>('OPENAI_MODEL', 'gpt-4o-mini').trim();
  }

  /**
   * Indica si la IA está disponible por configuración y credenciales.
   */
  async estaDisponible(): Promise<boolean> {
    const estado = await this.consumoService.puedeUsarIa();
    return estado.permitido;
  }

  /** Conversación libre: activa por defecto cuando la IA está encendida; 'chatbot_modo_libre' = no la apaga. */
  private async estaModoLibre(): Promise<boolean> {
    try {
      return (await this.consumoService.estaModoLibre?.()) ?? false;
    } catch {
      return false;
    }
  }

  /** Resumen de una línea del pedido más reciente del cliente (para la nota del asesor); solo lectura. */
  resumenPedidoParaAsesor(telefono?: string | null): Promise<string | null> {
    return this.herramientasService.resumenPedidoParaAsesor?.(telefono) ?? Promise.resolve(null);
  }

  /**
   * Indica si la clave de API de OpenAI está configurada.
   */
  tieneApiKey(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  /**
   * Obtiene el modelo de OpenAI configurado.
   */
  obtenerModelo(): string {
    return this.modelo;
  }

  /**
   * Procesa una consulta de usuario mediante OpenAI Chat Completions con function calling de solo lectura.
   */
  async procesarConsulta(parametros: ParametrosConsultaIa): Promise<ResultadoConsultaIa> {
    const {
      textoUsuario,
      conversacionId,
      telefonoCliente,
      primerNombre,
      historialReciente,
      waMessageId,
    } = parametros;

    // 1. Idempotencia por waMessageId para evitar duplicar consumo de tokens ante reintentos de Meta
    if (waMessageId) {
      const respuestaCacheada = await this.obtenerRespuestaCacheada(waMessageId);
      if (respuestaCacheada) {
        this.logger.log(`Mensaje ${waMessageId} ya atendido por la IA. Retornando respuesta idempotente.`);
        return respuestaCacheada;
      }
    }

    // 2. Verificar estado de la IA (clave de OpenAI, parámetro activo, tope mensual)
    const estadoIa = await this.consumoService.puedeUsarIa();
    if (!estadoIa.permitido) {
      this.logger.warn(`IA no disponible: ${estadoIa.motivo}`);
      return {
        exito: false,
        respuestaTexto: TEXTOS_IA.iaApagadaODerivada(),
        confianza: 0,
        necesitaDerivar: true,
        quierePedir: false,
        herramientasUsadas: [],
        tokensEntrada: 0,
        tokensSalida: 0,
        costoUsdEstimado: 0,
        resultadoRegistro: estadoIa.motivo?.includes('tope') ? 'TOPE_EXCEDIDO' : 'DERIVADO_PERSONA',
        motivoDerivacion: estadoIa.motivo,
      };
    }

    // 3. Rate limit por hora y teléfono
    const rateLimitHoraOk = await this.consumoService.verificarRateLimitHora(telefonoCliente);
    if (!rateLimitHoraOk) {
      this.logger.warn(`Límite horario de consultas a la IA excedido para teléfono.`);
      return {
        exito: false,
        respuestaTexto: TEXTOS_IA.limiteHoraAlcanzado(),
        confianza: 0,
        necesitaDerivar: true,
        quierePedir: false,
        herramientasUsadas: [],
        tokensEntrada: 0,
        tokensSalida: 0,
        costoUsdEstimado: 0,
        resultadoRegistro: 'DERIVADO_PERSONA',
        motivoDerivacion: 'LIMITE_HORA_EXCEDIDO',
      };
    }

    // 4. Detección preventiva de inyección de prompt
    const esInyeccion = PATRONES_INYECCION.some((regex) => regex.test(textoUsuario));
    if (esInyeccion) {
      this.logger.warn(`Intento de inyección de prompt detectado en mensaje: "${textoUsuario.slice(0, 50)}..."`);
      await this.consumoService.registrarConsumo({
        conversacionId,
        modelo: this.modelo,
        tokensEntrada: 50,
        tokensSalida: 50,
        herramientasUsadas: [],
        resultado: 'INYECCION_BLOQUEADA',
      });

      const respuestaDefensa = TEXTOS_IA.defensaInyeccion();
      return {
        exito: true,
        respuestaTexto: respuestaDefensa,
        confianza: 1,
        necesitaDerivar: false,
        quierePedir: false,
        herramientasUsadas: [],
        tokensEntrada: 50,
        tokensSalida: 50,
        costoUsdEstimado: 0.0001,
        resultadoRegistro: 'INYECCION_BLOQUEADA',
      };
    }

    // 5. Preparar prompt de sistema y mensajes con enmascaramiento estricto de privacidad
    const nombreLimpio = extraerPrimerNombre(primerNombre);
    const modoLibre = await this.estaModoLibre();

    // 4.b Modo libre: lo delicado va directo a una persona, sin gastar tokens
    if (modoLibre && PATRON_DELICADO.test(textoUsuario)) {
      await this.consumoService.registrarConsumo({
        conversacionId,
        modelo: this.modelo,
        tokensEntrada: 0,
        tokensSalida: 0,
        herramientasUsadas: ['pasarAPersona'],
        resultado: 'DERIVADO_PERSONA',
      });
      return {
        exito: true,
        respuestaTexto: TEXTOS_IA.temaDelicadoPersona(),
        confianza: 1,
        necesitaDerivar: true,
        quierePedir: false,
        herramientasUsadas: ['pasarAPersona'],
        tokensEntrada: 0,
        tokensSalida: 0,
        costoUsdEstimado: 0,
        resultadoRegistro: 'DERIVADO_PERSONA',
        motivoDerivacion: 'TEMA_DELICADO',
      };
    }

    const promptSistema = construirPromptSistema(nombreLimpio, modoLibre, (await this.conocimiento?.seccionPrompt()) ?? '');
    const textoUsuarioEnmascarado = enmascararDatosSensibles(textoUsuario);
    const historialEnmascarado = prepararHistorialPrivado(historialReciente || [], modoLibre ? 15 : 6);

    const mensajes: MensajeOpenAI[] = [
      { role: 'system', content: promptSistema },
      ...historialEnmascarado,
      { role: 'user', content: textoUsuarioEnmascarado },
    ];

    const herramientasDefiniciones = this.herramientasService.obtenerDefinicionesHerramientas();
    const herramientasUsadas: string[] = [];
    const productosObtenidos: any[] = [];
    let tokensEntradaTotal = 0;
    let tokensSalidaTotal = 0;
    let necesitaDerivar = false;
    let quierePedir = false;

    // 6. Bucle de ejecución con OpenAI (máximo 3 llamadas a herramientas)
    let vueltasHerramientas = 0;
    const MAX_VUELTAS_HERRAMIENTAS = modoLibre ? 4 : 3;
    const MAX_HERRAMIENTAS_POR_TURNO = modoLibre ? 5 : 3;
    let motivoPasarAPersona: string | undefined;

    try {
      while (vueltasHerramientas < MAX_VUELTAS_HERRAMIENTAS) {
        const respuestaOpenAI = await this.llamarOpenAIConTimeout(
          mensajes,
          herramientasDefiniciones,
        );

        tokensEntradaTotal += respuestaOpenAI.usage?.prompt_tokens || 0;
        tokensSalidaTotal += respuestaOpenAI.usage?.completion_tokens || 0;

        const eleccion = respuestaOpenAI.choices?.[0];
        const mensajeAsistente = eleccion?.message;

        if (!mensajeAsistente) {
          throw new Error('Respuesta vacía de la API de OpenAI');
        }

        // Si OpenAI decide invocar herramientas
        if (mensajeAsistente.tool_calls && mensajeAsistente.tool_calls.length > 0) {
          mensajes.push(mensajeAsistente);
          vueltasHerramientas++;

          for (const llamada of mensajeAsistente.tool_calls.slice(0, MAX_HERRAMIENTAS_POR_TURNO)) {
            const nombreFuncion = llamada.function.name;
            herramientasUsadas.push(nombreFuncion);

            let argsParsed: Record<string, any> = {};
            try {
              argsParsed = JSON.parse(llamada.function.arguments || '{}');
            } catch {
              argsParsed = {};
            }

            const resultadoHerramienta = await this.herramientasService.ejecutarHerramienta(
              nombreFuncion,
              argsParsed,
              {
                telefonoCliente,
                conversacionId,
              },
            );

            if (resultadoHerramienta.necesitaDerivar || resultadoHerramienta.alertaAlergia) {
              necesitaDerivar = true;
            }
            if (nombreFuncion === 'pasarAPersona') {
              const r = resultadoHerramienta.resultado;
              motivoPasarAPersona = String(r?.motivo || 'IA_PASA_A_PERSONA') + (r?.solicitud ? ` | Solicitud: ${r.solicitud}` : '');
            }

            const prods =
              resultadoHerramienta.resultado?.productos ||
              resultadoHerramienta.resultado?.recomendaciones ||
              resultadoHerramienta.resultado?.productosSugeridos;
            if (Array.isArray(prods)) {
              productosObtenidos.push(...prods);
            }

            mensajes.push({
              role: 'tool',
              tool_call_id: llamada.id,
              name: nombreFuncion,
              content: JSON.stringify(resultadoHerramienta.resultado),
            });
          }

          if (vueltasHerramientas >= MAX_VUELTAS_HERRAMIENTAS) {
            break; // Límite máximo de herramientas alcanzado
          }
          continue;
        }

        // Si es respuesta de texto final
        let textoFinal = (mensajeAsistente.content || '').trim();

        // Enforce max 600 caracteres y máx 3 párrafos
        textoFinal = modoLibre ? this.recortarRespuesta(textoFinal, 900, 4) : this.recortarRespuesta(textoFinal, 600, 3);

        // Detectar si el usuario quiere pedir
        if (
          /quiero pedir|hacer pedido|deseo ordenar|me das|lo compro|agregar al carrito/i.test(
            textoUsuario,
          ) ||
          /pedido por botones|hacer un pedido/i.test(textoFinal)
        ) {
          quierePedir = true;
        }

        // Detectar si la respuesta sugiere derivación o incertidumbre
        if (
          /no tengo ese dato confirmado|te paso con una persona|te voy a transferir|un asesor.*te atenderá/i.test(
            textoFinal,
          )
        ) {
          necesitaDerivar = true;
        }

        // Evaluar confianza de la respuesta
        const confianza = necesitaDerivar ? 0.4 : 0.95;

        // Registrar consumo en base de datos
        const costoUsd = await this.consumoService.registrarConsumo({
          conversacionId,
          modelo: this.modelo,
          tokensEntrada: tokensEntradaTotal,
          tokensSalida: tokensSalidaTotal,
          herramientasUsadas,
          resultado: necesitaDerivar ? 'DERIVADO_PERSONA' : 'EXITO',
        });

        const productoConcreto =
          productosObtenidos.length === 1 ? productosObtenidos[0] : undefined;
        const productosConsultados =
          productosObtenidos.length > 1 ? productosObtenidos : undefined;

        const resultadoFinal: ResultadoConsultaIa = {
          exito: true,
          respuestaTexto: textoFinal || TEXTOS_IA.errorConsulta(),
          confianza,
          necesitaDerivar,
          quierePedir,
          herramientasUsadas,
          tokensEntrada: tokensEntradaTotal,
          tokensSalida: tokensSalidaTotal,
          costoUsdEstimado: costoUsd,
          resultadoRegistro: necesitaDerivar ? 'DERIVADO_PERSONA' : 'EXITO',
          motivoDerivacion: motivoPasarAPersona,
          productoConcreto,
          productosConsultados,
        };

        // Cachear respuesta para idempotencia si waMessageId está presente
        if (waMessageId) {
          await this.guardarRespuestaEnCache(waMessageId, resultadoFinal);
        }

        return resultadoFinal;
      }

      // Si se superó el número máximo de vueltas de herramientas
      necesitaDerivar = true;
      const costoUsd = await this.consumoService.registrarConsumo({
        conversacionId,
        modelo: this.modelo,
        tokensEntrada: tokensEntradaTotal,
        tokensSalida: tokensSalidaTotal,
        herramientasUsadas,
        resultado: 'DERIVADO_PERSONA',
      });

      return {
        exito: true,
        respuestaTexto: TEXTOS_IA.dudaComplejaDerivacion(),
        confianza: 0.5,
        necesitaDerivar: true,
        quierePedir,
        herramientasUsadas,
        tokensEntrada: tokensEntradaTotal,
        tokensSalida: tokensSalidaTotal,
        costoUsdEstimado: costoUsd,
        resultadoRegistro: 'DERIVADO_PERSONA',
      };
    } catch (err: any) {
      this.logger.error(`Error en llamada a OpenAI: ${err.message}`, err.stack);

      // Falla cerrada: registrar error y devolver mensaje de contingencia
      await this.consumoService.registrarConsumo({
        conversacionId,
        modelo: this.modelo,
        tokensEntrada: tokensEntradaTotal || 10,
        tokensSalida: tokensSalidaTotal || 10,
        herramientasUsadas,
        resultado: 'ERROR',
      });

      return {
        exito: false,
        respuestaTexto: TEXTOS_IA.errorConsulta(),
        confianza: 0,
        necesitaDerivar: true,
        quierePedir: false,
        herramientasUsadas,
        tokensEntrada: tokensEntradaTotal,
        tokensSalida: tokensSalidaTotal,
        costoUsdEstimado: 0,
        resultadoRegistro: 'ERROR',
        motivoDerivacion: err.message,
      };
    }
  }

  /**
   * Llamada nativa a la API de OpenAI Chat Completions con timeout estricto de 10 segundos.
   * Sin dependencias externas: usa fetch nativo.
   */
  async llamarOpenAIConTimeout(
    mensajes: MensajeOpenAI[],
    herramientas?: any[],
    opciones?: { maxTokens?: number; temperature?: number },
  ): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos

    const cuerpo: Record<string, any> = {
      model: this.modelo,
      messages: mensajes,
      temperature: opciones?.temperature ?? 0.2, // Baja temperatura para precisión en carta y precios
      max_tokens: opciones?.maxTokens ?? 700, // Máximo 700 tokens de salida según directiva
    };

    if (herramientas && herramientas.length > 0) {
      cuerpo.tools = herramientas;
      cuerpo.tool_choice = 'auto';
    }

    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(cuerpo),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`OpenAI API error [${res.status}]: ${errorText}`);
      }

      return await res.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Pide a OpenAI una respuesta JSON (mismo modelo y clave que la IA de dudas). Para trabajos internos como el
   * aprendizaje nocturno: no usa herramientas ni toca el consumo del chat. Devuelve el texto y los tokens reales.
   */
  async completarJson(
    mensajes: MensajeOpenAI[],
    maxTokens = 1500,
  ): Promise<{ texto: string; tokensEntrada: number; tokensSalida: number }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model: this.modelo,
          messages: mensajes,
          temperature: 0.2,
          max_tokens: maxTokens,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`OpenAI API error [${res.status}]`);
      const j: any = await res.json();
      return {
        texto: String(j.choices?.[0]?.message?.content ?? ''),
        tokensEntrada: Number(j.usage?.prompt_tokens) || 0,
        tokensSalida: Number(j.usage?.completion_tokens) || 0,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Recorta una respuesta para que no exceda el máximo de caracteres ni el número de párrafos.
   */
  private recortarRespuesta(texto: string, maxCaracteres = 600, maxParrafos = 3): string {
    if (!texto) return '';

    // Dividir en párrafos
    const parrafos = texto
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);

    const parrafosFiltrados = parrafos.slice(0, maxParrafos);
    let unido = parrafosFiltrados.join('\n\n');

    if (unido.length > maxCaracteres) {
      unido = unido.slice(0, maxCaracteres - 3) + '...';
    }

    return unido;
  }

  /**
   * Obtiene la respuesta guardada para garantizar idempotencia por waMessageId.
   */
  private async obtenerRespuestaCacheada(
    waMessageId: string,
  ): Promise<ResultadoConsultaIa | null> {
    try {
      const redis = this.redisService.obtenerCliente();
      const raw = await redis.get(`chatbot:ia:resp:${waMessageId}`);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {
      // Si falla Redis, omitir cache
    }
    return null;
  }

  /**
   * Guarda la respuesta generada en Redis para idempotencia de 24 horas.
   */
  private async guardarRespuestaEnCache(
    waMessageId: string,
    resultado: ResultadoConsultaIa,
  ): Promise<void> {
    try {
      const redis = this.redisService.obtenerCliente();
      await redis.set(
        `chatbot:ia:resp:${waMessageId}`,
        JSON.stringify(resultado),
        'EX',
        86400, // 24 horas
      );
    } catch {
      // Fallo no bloqueante de Redis
    }
  }
}
