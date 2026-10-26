import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../comun/redis/redis.service';
import { IaHerramientasService } from './ia-herramientas.service';
import { IaConsumoService } from './ia-consumo.service';
import { construirPromptSistema } from './prompt-sistema';
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
    const promptSistema = construirPromptSistema(nombreLimpio);
    const textoUsuarioEnmascarado = enmascararDatosSensibles(textoUsuario);
    const historialEnmascarado = prepararHistorialPrivado(historialReciente || [], 6);

    const mensajes: MensajeOpenAI[] = [
      { role: 'system', content: promptSistema },
      ...historialEnmascarado,
      { role: 'user', content: textoUsuarioEnmascarado },
    ];

    const herramientasDefiniciones = this.herramientasService.obtenerDefinicionesHerramientas();
    const herramientasUsadas: string[] = [];
    let tokensEntradaTotal = 0;
    let tokensSalidaTotal = 0;
    let necesitaDerivar = false;
    let quierePedir = false;

    // 6. Bucle de ejecución con OpenAI (máximo 3 llamadas a herramientas)
    let vueltasHerramientas = 0;
    const MAX_VUELTAS_HERRAMIENTAS = 3;

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

          for (const llamada of mensajeAsistente.tool_calls.slice(0, 3)) {
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
        textoFinal = this.recortarRespuesta(textoFinal, 600, 3);

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
  private async llamarOpenAIConTimeout(
    mensajes: MensajeOpenAI[],
    herramientas?: any[],
  ): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos

    const cuerpo: Record<string, any> = {
      model: this.modelo,
      messages: mensajes,
      temperature: 0.2, // Baja temperatura para precisión en carta y precios
      max_tokens: 700,  // Máximo 700 tokens de salida según directiva
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
