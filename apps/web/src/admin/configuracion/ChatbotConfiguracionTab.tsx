import { Component, ReactNode, ErrorInfo, useState, useEffect } from 'react';
import { api, ErrorApi } from '../../comun/api';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { Confirmar } from '../../comun/Confirmar';
import { Insignia } from '../../comun/Insignia';
import { TarjetaProteccionSpam } from './TarjetaProteccionSpam';

export const LIMITE_WHATSAPP_CUERPO = 1024;

export type ClaveTextoBot =
  | 'chatbot_texto_bienvenida'
  | 'chatbot_texto_despedida'
  | 'chatbot_texto_pase_persona'
  | 'chatbot_texto_fuera_horario'
  | 'chatbot_texto_no_entiendo'
  | 'chatbot_texto_no_entiendo_derivacion'
  | 'chatbot_texto_indicacion_pago';

export const CLAVES_TEXTOS_BOT: ClaveTextoBot[] = [
  'chatbot_texto_bienvenida',
  'chatbot_texto_despedida',
  'chatbot_texto_pase_persona',
  'chatbot_texto_fuera_horario',
  'chatbot_texto_no_entiendo',
  'chatbot_texto_no_entiendo_derivacion',
  'chatbot_texto_indicacion_pago',
];

export interface FuncionesBotState {
  pedido: boolean;
  pago: boolean;
  reservas: boolean;
  cambios: boolean;
  ia: boolean;
  promociones: boolean;
}

export type TextosBotState = Record<ClaveTextoBot, string>;

export interface AntiSpamState {
  maxPorMinuto: number;
  maxPorHora: number;
}

export interface PrivacidadState {
  diasRetencion: number;
}

export interface ConsumoIaState {
  periodo: string;
  llamadasTotal: number;
  tokensEntrada?: number;
  tokensSalida?: number;
  tokensTotal: number;
  costoUsdEstimado: number;
  topeMensualUsd: number;
  porcentajeConsumido: number;
  topeAlcanzado: boolean;
  iaActiva: boolean;
}

export interface ConfiguracionBotRespuesta {
  textos: TextosBotState;
  textosDefecto: TextosBotState;
  funciones: FuncionesBotState;
  antiSpam: AntiSpamState;
  privacidad: PrivacidadState;
  // Compatibilidad defensiva
  textosPorDefecto?: TextosBotState;
  retencion?: PrivacidadState;
  consumoIa?: ConsumoIaState | null;
}

export interface ExportacionClienteRespuesta {
  identificadorEnmascarado: string;
  nombreContacto?: string;
  identificadorTipo?: string;
  consentimiento?: {
    acepta?: boolean;
    aceptaComunicaciones?: boolean;
    origen?: string | null;
    actualizadoEn?: string | null;
    fechaRegistro?: string | null;
  };
  conversacion?: {
    id: string;
    estado: string;
    duenio: string;
    ultimaActividad: string;
  } | null;
  totalConversaciones?: number;
  totalMensajes?: number;
  totalPedidos?: number;
  mensajes?: Array<any>;
  pedidos?: Array<any>;
  solicitud?: {
    solicitante?: string;
    fecha?: string;
    motivo?: string;
  };
}

export interface ChatbotConfiguracionTabProps {
  puedeVer?: boolean;
  puedeEditar: boolean;
}

export const META_FUNCIONES: Record<
  keyof FuncionesBotState,
  { titulo: string; descripcion: string }
> = {
  pedido: {
    titulo: 'Recepción de pedidos',
    descripcion: 'Permite a los clientes iniciar pedidos y consultar la carta por WhatsApp.',
  },
  pago: {
    titulo: 'Instrucciones y cobro',
    descripcion: 'Envía información de cobro por Yape, Plin o transferencia bancaria.',
  },
  reservas: {
    titulo: 'Reservas de mesa',
    descripcion: 'Permite la atención y registro de consultas para reservar mesa.',
  },
  cambios: {
    titulo: 'Cambios de pedido',
    descripcion: 'Canaliza solicitudes de los clientes para modificar un pedido activo.',
  },
  ia: {
    titulo: 'Asistente de Inteligencia Artificial',
    descripcion: 'Usa respuestas contextuales asistidas por IA. Si se desactiva, opera con reglas fijas.',
  },
  promociones: {
    titulo: 'Promociones y cupones',
    descripcion: 'Presenta cupones de descuento y promociones activas a los clientes.',
  },
};

export const META_TEXTOS: Record<
  ClaveTextoBot,
  { titulo: string; descripcion: string }
> = {
  chatbot_texto_bienvenida: {
    titulo: 'Mensaje de bienvenida',
    descripcion: 'Saludo inicial del bot con opciones de carta, delivery y atención.',
  },
  chatbot_texto_despedida: {
    titulo: 'Mensaje de despedida',
    descripcion: 'Respuesta cordial cuando el cliente agradece o se despide.',
  },
  chatbot_texto_pase_persona: {
    titulo: 'Pase a asesor humano',
    descripcion: 'Mensaje cuando el cliente solicita comunicarse directamente con una persona.',
  },
  chatbot_texto_fuera_horario: {
    titulo: 'Fuera de horario',
    descripcion: 'Mensaje enviado cuando el cliente escribe fuera del horario de atención.',
  },
  chatbot_texto_no_entiendo: {
    titulo: 'Repregunta al no entender',
    descripcion: 'Primera respuesta cuando el bot no reconoce la intención del mensaje.',
  },
  chatbot_texto_no_entiendo_derivacion: {
    titulo: 'Derivación al no entender',
    descripcion: 'Segunda repregunta consecutiva sin entender, transfiriendo al equipo humano.',
  },
  chatbot_texto_indicacion_pago: {
    titulo: 'Indicación de pago',
    descripcion: 'Instrucciones para envío de comprobantes de pago por Yape, Plin o transferencia.',
  },
};

const TEXTOS_DEFECTO_BASE: TextosBotState = {
  chatbot_texto_bienvenida: '',
  chatbot_texto_despedida: '',
  chatbot_texto_pase_persona: '',
  chatbot_texto_fuera_horario: '',
  chatbot_texto_no_entiendo: '',
  chatbot_texto_no_entiendo_derivacion: '',
  chatbot_texto_indicacion_pago: '',
};

type ModalAccion =
  | { tipo: 'toggle_funcion'; funcion: keyof FuncionesBotState; nuevoEstado: boolean }
  | { tipo: 'guardar_texto'; clave: ClaveTextoBot }
  | { tipo: 'restablecer_texto'; clave: ClaveTextoBot }
  | { tipo: 'guardar_antispam' }
  | { tipo: 'guardar_retencion' }
  | { tipo: 'ejecutar_retencion' }
  | { tipo: 'baja_cliente' };

interface LimiteErrorChatbotProps {
  children: ReactNode;
  alReintentar?: () => void;
}

interface LimiteErrorChatbotState {
  tieneError: boolean;
  error: Error | null;
}

export class LimiteErrorChatbot extends Component<
  LimiteErrorChatbotProps,
  LimiteErrorChatbotState
> {
  constructor(props: LimiteErrorChatbotProps) {
    super(props);
    this.state = { tieneError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): LimiteErrorChatbotState {
    return { tieneError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error capturado en LimiteErrorChatbot:', error, errorInfo);
  }

  render() {
    if (this.state.tieneError) {
      return (
        <EstadoError
          titulo="Error al cargar la pantalla del chatbot"
          mensaje={
            this.state.error?.message ||
            'Ocurrió un error inesperado al renderizar la configuración del chatbot.'
          }
          alReintentar={() => {
            this.setState({ tieneError: false, error: null });
            this.props.alReintentar?.();
          }}
        />
      );
    }
    return this.props.children;
  }
}

function ChatbotConfiguracionVista({
  puedeVer = true,
  puedeEditar,
}: ChatbotConfiguracionTabProps) {
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [errorOperacion, setErrorOperacion] = useState<string | null>(null);
  const [accionEnCurso, setAccionEnCurso] = useState(false);

  // Estados de configuración con fallbacks seguros
  const [funciones, setFunciones] = useState<FuncionesBotState>({
    pedido: true,
    pago: true,
    reservas: true,
    cambios: true,
    ia: false,
    promociones: true,
  });
  const [textos, setTextos] = useState<TextosBotState>(TEXTOS_DEFECTO_BASE);
  const [textosDefecto, setTextosDefecto] = useState<TextosBotState>(TEXTOS_DEFECTO_BASE);
  const [antiSpam, setAntiSpam] = useState<AntiSpamState>({
    maxPorMinuto: 10,
    maxPorHora: 60,
  });
  const [privacidad, setPrivacidad] = useState<PrivacidadState>({
    diasRetencion: 90,
  });
  const [consumoIa, setConsumoIa] = useState<ConsumoIaState | null>(null);

  // Privacidad ARCO
  const [identificadorArco, setIdentificadorArco] = useState('');
  const [motivoArco, setMotivoArco] = useState('');
  const [buscandoArco, setBuscandoArco] = useState(false);
  const [resultadoArco, setResultadoArco] = useState<ExportacionClienteRespuesta | null>(null);

  // Modal de confirmación Sí/No
  const [modal, setModal] = useState<ModalAccion | null>(null);

  const cargarConfiguracion = async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const [dataConfigRes, dataIaRes] = await Promise.allSettled([
        api.get<ConfiguracionBotRespuesta>('/admin/chatbot/configuracion'),
        api.get<ConsumoIaState>('/admin/configuracion/ia-consumo'),
      ]);

      if (dataConfigRes.status === 'fulfilled' && dataConfigRes.value) {
        const data = dataConfigRes.value;
        if (data.funciones) {
          setFunciones((prev) => ({ ...prev, ...data.funciones }));
        }
        if (data.textos) {
          setTextos((prev) => ({ ...prev, ...data.textos }));
        }
        const textosPorDefectoOrig = data.textosDefecto || data.textosPorDefecto;
        if (textosPorDefectoOrig) {
          setTextosDefecto((prev) => ({ ...prev, ...textosPorDefectoOrig }));
        }
        if (data.antiSpam) {
          setAntiSpam((prev) => ({
            maxPorMinuto:
              typeof data.antiSpam.maxPorMinuto === 'number'
                ? data.antiSpam.maxPorMinuto
                : typeof (data.antiSpam as any).limiteMinuto === 'number'
                ? (data.antiSpam as any).limiteMinuto
                : prev.maxPorMinuto,
            maxPorHora:
              typeof data.antiSpam.maxPorHora === 'number'
                ? data.antiSpam.maxPorHora
                : typeof (data.antiSpam as any).limiteHora === 'number'
                ? (data.antiSpam as any).limiteHora
                : prev.maxPorHora,
          }));
        }
        const ret = data.privacidad || data.retencion;
        if (ret && typeof ret.diasRetencion === 'number') {
          setPrivacidad({ diasRetencion: ret.diasRetencion });
        }
      } else if (dataConfigRes.status === 'rejected') {
        throw dataConfigRes.reason;
      }

      if (dataIaRes.status === 'fulfilled' && dataIaRes.value) {
        setConsumoIa(dataIaRes.value);
      } else {
        setConsumoIa(null);
      }
    } catch (err: any) {
      const msg =
        err instanceof ErrorApi
          ? err.message
          : err?.message || 'No se pudo cargar la configuración del chatbot';
      setErrorCarga(msg);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarConfiguracion();
  }, [puedeVer]);

  // Manejo de confirmaciones
  const ejecutarAccionModal = async () => {
    if (!modal) return;
    setAccionEnCurso(true);
    setErrorOperacion(null);
    setMensajeExito(null);

    try {
      if (modal.tipo === 'toggle_funcion') {
        const nuevasFunciones = {
          ...funciones,
          [modal.funcion]: modal.nuevoEstado,
        };
        await api.put('/admin/chatbot/configuracion/funciones', nuevasFunciones);
        setFunciones(nuevasFunciones);
        setMensajeExito(
          `Función "${META_FUNCIONES[modal.funcion].titulo}" ${
            modal.nuevoEstado ? 'activada' : 'desactivada'
          } correctamente.`,
        );
      } else if (modal.tipo === 'guardar_texto') {
        const textoActual = (textos[modal.clave] ?? '').trim();
        if (textoActual.length > LIMITE_WHATSAPP_CUERPO) {
          throw new Error(
            `El texto supera el límite de WhatsApp de ${LIMITE_WHATSAPP_CUERPO} caracteres.`,
          );
        }
        await api.put('/admin/chatbot/configuracion/textos', {
          [modal.clave]: textoActual,
        });
        setMensajeExito(
          `Texto "${META_TEXTOS[modal.clave].titulo}" actualizado correctamente.`,
        );
      } else if (modal.tipo === 'restablecer_texto') {
        const res = await api.post<{ clave: string; valor?: string; texto?: string }>(
          '/admin/chatbot/configuracion/textos/restablecer',
          { clave: modal.clave },
        );
        const valorRestablecido =
          res.valor ?? res.texto ?? textosDefecto[modal.clave] ?? '';
        setTextos((prev) => ({
          ...prev,
          [modal.clave]: valorRestablecido,
        }));
        setMensajeExito(
          `Texto "${META_TEXTOS[modal.clave].titulo}" restablecido a su valor por defecto.`,
        );
      } else if (modal.tipo === 'guardar_antispam') {
        await api.put('/admin/chatbot/configuracion/anti-spam', {
          maxPorMinuto: Number(antiSpam.maxPorMinuto),
          maxPorHora: Number(antiSpam.maxPorHora),
        });
        setMensajeExito('Parámetros de control anti-spam actualizados correctamente.');
      } else if (modal.tipo === 'guardar_retencion') {
        await api.put('/admin/chatbot/configuracion/retencion', {
          diasRetencion: Number(privacidad.diasRetencion),
        });
        setMensajeExito('Plazo de retención de mensajes actualizado correctamente.');
      } else if (modal.tipo === 'ejecutar_retencion') {
        const res = await api.post<{
          anonimizados?: number;
          mensajesAnonimizados?: number;
          fechaCorte: string;
          diasRetencion?: number;
          mensaje?: string;
        }>('/admin/chatbot/configuracion/retencion/ejecutar', {});
        const total = res.anonimizados ?? res.mensajesAnonimizados ?? 0;
        setMensajeExito(
          `Anonimización completada: se anonimizaron ${total} mensajes anteriores al ${res.fechaCorte}. Los registros se preservan sin datos personales.`,
        );
      } else if (modal.tipo === 'baja_cliente') {
        const res = await api.post<{
          exito?: boolean;
          mensaje?: string;
          identificador?: string;
          identificadorEnmascarado?: string;
          conversacionesAnonimizadas?: number;
          mensajesAnonimizados?: number;
        }>('/admin/chatbot/configuracion/privacidad/baja', {
          identificador: identificadorArco.trim(),
          motivo: motivoArco.trim() || undefined,
        });
        const idMask =
          res.identificador ?? res.identificadorEnmascarado ?? identificadorArco.trim();
        setMensajeExito(
          `Cliente con identificador ${idMask} dado de baja exitosamente. Sus datos personales han sido anonimizados conforme a la Ley 29733.`,
        );
        setResultadoArco(null);
      }
    } catch (err: any) {
      const msg =
        err instanceof ErrorApi
          ? err.message
          : err?.message || 'Ocurrió un error al procesar la solicitud.';
      setErrorOperacion(msg);
    } finally {
      setAccionEnCurso(false);
      setModal(null);
    }
  };

  const handleBuscarArco = async () => {
    if (!identificadorArco.trim()) return;
    setBuscandoArco(true);
    setErrorOperacion(null);
    try {
      const queryParams = new URLSearchParams();
      queryParams.set('identificador', identificadorArco.trim());
      const data = await api.get<ExportacionClienteRespuesta>(
        `/admin/chatbot/configuracion/privacidad/exportar?${queryParams.toString()}`,
      );
      setResultadoArco(data);
    } catch (err) {
      const msg =
        err instanceof ErrorApi
          ? err.message
          : 'No se encontraron datos o hubo un error al exportar.';
      setErrorOperacion(msg);
      setResultadoArco(null);
    } finally {
      setBuscandoArco(false);
    }
  };

  if (cargando) {
    return <Cargando mensaje="Cargando configuración del chatbot..." />;
  }

  if (errorCarga) {
    return (
      <EstadoError
        titulo="Error al cargar configuración del chatbot"
        mensaje={errorCarga}
        alReintentar={cargarConfiguracion}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Cabecera */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: 'var(--fuente-titulos)',
              fontWeight: 800,
              fontSize: '18px',
              color: 'var(--cp-navy)',
              margin: 0,
            }}
          >
            Configuración y seguridad del bot
          </h2>
          <p
            style={{
              fontSize: '13px',
              color: 'var(--cp-soft)',
              margin: '4px 0 0 0',
            }}
          >
            Gestión de textos de WhatsApp, interruptores por función, control anti-spam y privacidad Ley 29733.
          </p>
        </div>

        <div>
          <Insignia variante={puedeEditar ? 'exito' : 'neutro'}>
            {puedeEditar ? 'Modo edición' : 'Sólo lectura'}
          </Insignia>
        </div>
      </div>

      {/* Avisos de estado */}
      {!puedeEditar && (
        <div
          role="status"
          style={{
            background: 'var(--cp-sand)',
            border: '1px solid var(--cp-line)',
            borderRadius: '10px',
            padding: '10px 14px',
            fontSize: '13px',
            color: 'var(--cp-soft)',
          }}
        >
          Modo sólo lectura. Se requiere el permiso <b>configuracion/editar</b> para realizar modificaciones.
        </div>
      )}

      {mensajeExito && (
        <div
          role="status"
          style={{
            background: '#E8F5E9',
            border: '1px solid #81C784',
            borderRadius: '10px',
            padding: '12px 16px',
            fontSize: '13px',
            color: '#1B5E20',
            fontWeight: 600,
          }}
        >
          {mensajeExito}
        </div>
      )}

      {errorOperacion && (
        <div
          role="alert"
          style={{
            background: '#FBEDE9',
            border: '1px solid var(--cp-rust)',
            borderRadius: '10px',
            padding: '12px 16px',
            fontSize: '13px',
            color: 'var(--cp-rust)',
            fontWeight: 600,
          }}
        >
          {errorOperacion}
        </div>
      )}

      {/* TARJETA 1: Estado y consumo de IA */}
      <div
        data-testid="tarjeta-consumo-ia"
        style={{
          background: 'var(--cp-white)',
          border: '1px solid var(--cp-line)',
          borderRadius: '14px',
          padding: '18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div>
            <div
              style={{
                fontFamily: 'var(--fuente-titulos)',
                fontWeight: 800,
                fontSize: '15px',
                color: 'var(--cp-navy)',
              }}
            >
              Consumo y estado del motor de IA
            </div>
            <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
              Monitoreo del presupuesto mensual de tokens y cuota operativa.
            </div>
          </div>

          {consumoIa && (
            <Insignia
              variante={
                consumoIa.topeAlcanzado
                  ? 'peligro'
                  : consumoIa.iaActiva
                  ? 'exito'
                  : 'neutro'
              }
            >
              {consumoIa.topeAlcanzado
                ? 'Tope alcanzado'
                : consumoIa.iaActiva
                ? 'IA activa'
                : 'IA inactiva'}
            </Insignia>
          )}
        </div>

        {consumoIa ? (
          <div
            style={{
              background: 'var(--cp-sand)',
              borderRadius: '10px',
              padding: '12px 14px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '20px',
              fontSize: '13px',
              color: 'var(--cp-navy)',
            }}
          >
            <div>
              <span style={{ color: 'var(--cp-soft)', fontSize: '11px', display: 'block' }}>
                Periodo actual
              </span>
              <b>{consumoIa.periodo}</b>
            </div>
            <div>
              <span style={{ color: 'var(--cp-soft)', fontSize: '11px', display: 'block' }}>
                Consultas realizadas
              </span>
              <b>{consumoIa.llamadasTotal} consultas</b>
            </div>
            <div>
              <span style={{ color: 'var(--cp-soft)', fontSize: '11px', display: 'block' }}>
                Tokens procesados
              </span>
              <b>{consumoIa.tokensTotal.toLocaleString()} tokens</b>
            </div>
            <div>
              <span style={{ color: 'var(--cp-soft)', fontSize: '11px', display: 'block' }}>
                Costo estimado / Tope
              </span>
              <b>
                ${consumoIa.costoUsdEstimado.toFixed(4)} USD / ${consumoIa.topeMensualUsd.toFixed(2)} USD
              </b>{' '}
              <span style={{ color: 'var(--cp-soft)', fontSize: '12px' }}>
                ({consumoIa.porcentajeConsumido}% consumido)
              </span>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
            No hay registros de consumo de IA para el periodo actual.
          </div>
        )}
      </div>

      {/* TARJETA 2: Interruptores de función */}
      <div
        data-testid="seccion-funciones"
        style={{
          background: 'var(--cp-white)',
          border: '1px solid var(--cp-line)',
          borderRadius: '14px',
          padding: '18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div>
          <h3
            style={{
              fontFamily: 'var(--fuente-titulos)',
              fontWeight: 800,
              fontSize: '15px',
              color: 'var(--cp-navy)',
              margin: 0,
            }}
          >
            Interruptores de función del bot
          </h3>
          <p
            style={{
              fontSize: '12px',
              color: 'var(--cp-soft)',
              margin: '3px 0 0 0',
            }}
          >
            Desactiva módulos específicos del bot cuando sea necesario. El bot responderá un mensaje cordial y pausará la atención de dicha función.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '12px',
          }}
        >
          {(Object.keys(META_FUNCIONES) as Array<keyof FuncionesBotState>).map((key) => {
            const meta = META_FUNCIONES[key];
            const activa = Boolean(funciones[key]);

            return (
              <div
                key={key}
                style={{
                  border: '1px solid var(--cp-line)',
                  borderRadius: '12px',
                  padding: '14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: activa ? 'var(--cp-white)' : 'var(--cp-sand)',
                  gap: '12px',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: '13px',
                      color: 'var(--cp-navy)',
                    }}
                  >
                    {meta.titulo}
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: 'var(--cp-soft)',
                      marginTop: '2px',
                    }}
                  >
                    {meta.descripcion}
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={activa}
                  aria-label={meta.titulo}
                  disabled={!puedeEditar || accionEnCurso}
                  onClick={() => {
                    setModal({
                      tipo: 'toggle_funcion',
                      funcion: key,
                      nuevoEstado: !activa,
                    });
                  }}
                  style={{
                    minHeight: '38px',
                    padding: '0 16px',
                    borderRadius: '9999px',
                    border: '1.5px solid var(--cp-navy)',
                    background: activa ? 'var(--cp-navy)' : 'transparent',
                    color: activa ? 'var(--cp-cream)' : 'var(--cp-navy)',
                    fontWeight: 800,
                    fontSize: '12px',
                    cursor: !puedeEditar ? 'not-allowed' : 'pointer',
                    opacity: !puedeEditar ? 0.6 : 1,
                  }}
                >
                  {activa ? 'Activa' : 'Pausada'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* TARJETA 3: Textos editables del bot */}
      <div
        data-testid="seccion-textos"
        style={{
          background: 'var(--cp-white)',
          border: '1px solid var(--cp-line)',
          borderRadius: '14px',
          padding: '18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div>
          <h3
            style={{
              fontFamily: 'var(--fuente-titulos)',
              fontWeight: 800,
              fontSize: '15px',
              color: 'var(--cp-navy)',
              margin: 0,
            }}
          >
            Textos del bot editables
          </h3>
          <p
            style={{
              fontSize: '12px',
              color: 'var(--cp-soft)',
              margin: '3px 0 0 0',
            }}
          >
            Modifica los mensajes fijos del chatbot respetando el límite máximo de WhatsApp ({LIMITE_WHATSAPP_CUERPO} caracteres). Puedes volver al texto original del mockup en cualquier momento.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {CLAVES_TEXTOS_BOT.map((key) => {
            const meta = META_TEXTOS[key];
            const valorActual = textos[key] ?? '';
            const caracteres = valorActual.length;
            const excedeLimite = caracteres > LIMITE_WHATSAPP_CUERPO;
            const textoOriginal = textosDefecto[key] ?? '';
            const esDiferenteDeDefecto = valorActual !== textoOriginal;

            return (
              <div
                key={key}
                style={{
                  border: '1px solid var(--cp-line)',
                  borderRadius: '12px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  background: 'var(--cp-white)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <div>
                    <label
                      htmlFor={`texto-bot-${key}`}
                      style={{
                        fontWeight: 800,
                        fontSize: '13px',
                        color: 'var(--cp-navy)',
                        display: 'block',
                      }}
                    >
                      {meta.titulo}
                    </label>
                    <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                      {meta.descripcion}
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      color: excedeLimite ? 'var(--cp-rust)' : 'var(--cp-soft)',
                    }}
                  >
                    {caracteres} / {LIMITE_WHATSAPP_CUERPO} caracteres
                  </span>
                </div>

                <textarea
                  id={`texto-bot-${key}`}
                  aria-label={meta.titulo}
                  rows={4}
                  value={valorActual}
                  disabled={!puedeEditar || accionEnCurso}
                  onChange={(e) => {
                    const nuevo = e.target.value;
                    setTextos((prev) => ({
                      ...prev,
                      [key]: nuevo,
                    }));
                  }}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: `1.5px solid ${
                      excedeLimite ? 'var(--cp-rust)' : 'var(--cp-line)'
                    }`,
                    background: !puedeEditar ? 'var(--cp-sand)' : 'var(--cp-white)',
                    fontSize: '13px',
                    fontFamily: 'inherit',
                    color: 'var(--cp-navy)',
                    resize: 'vertical',
                  }}
                />

                {excedeLimite && (
                  <div
                    style={{
                      fontSize: '12px',
                      color: 'var(--cp-rust)',
                      fontWeight: 600,
                    }}
                  >
                    El texto excede el límite de WhatsApp de {LIMITE_WHATSAPP_CUERPO} caracteres. Redúcelo antes de guardar.
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '8px',
                    marginTop: '4px',
                    flexWrap: 'wrap',
                  }}
                >
                  <Boton
                    type="button"
                    variante="secundario"
                    tamano="pequeno"
                    deshabilitado={!puedeEditar || accionEnCurso || !esDiferenteDeDefecto}
                    onClick={() => {
                      setModal({
                        tipo: 'restablecer_texto',
                        clave: key,
                      });
                    }}
                  >
                    Restablecer por defecto
                  </Boton>

                  <Boton
                    type="button"
                    variante="primario"
                    tamano="pequeno"
                    deshabilitado={!puedeEditar || accionEnCurso || excedeLimite}
                    onClick={() => {
                      setModal({
                        tipo: 'guardar_texto',
                        clave: key,
                      });
                    }}
                  >
                    Guardar texto
                  </Boton>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* TARJETA 4: Control anti-spam */}
      <div
        data-testid="seccion-antispam"
        style={{
          background: 'var(--cp-white)',
          border: '1px solid var(--cp-line)',
          borderRadius: '14px',
          padding: '18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div>
          <h3
            style={{
              fontFamily: 'var(--fuente-titulos)',
              fontWeight: 800,
              fontSize: '15px',
              color: 'var(--cp-navy)',
              margin: 0,
            }}
          >
            Control anti-spam (Límites por número de WhatsApp)
          </h3>
          <p
            style={{
              fontSize: '12px',
              color: 'var(--cp-soft)',
              margin: '3px 0 0 0',
            }}
          >
            Limita la cantidad de mensajes por minuto y hora por cada teléfono mediante Redis. Al superar el límite, el bot envía un mensaje cordial pidiendo esperar y luego guarda silencio.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '14px',
          }}
        >
          <div>
            <label
              htmlFor="limite-minuto"
              style={{
                fontWeight: 700,
                fontSize: '12px',
                color: 'var(--cp-navy)',
                display: 'block',
                marginBottom: '4px',
              }}
            >
              Máximo mensajes por minuto
            </label>
            <input
              id="limite-minuto"
              aria-label="Máximo mensajes por minuto"
              type="number"
              min="1"
              max="60"
              value={antiSpam.maxPorMinuto}
              disabled={!puedeEditar || accionEnCurso}
              onChange={(e) =>
                setAntiSpam((prev) => ({
                  ...prev,
                  maxPorMinuto: Number(e.target.value) || 0,
                }))
              }
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1.5px solid var(--cp-line)',
                background: !puedeEditar ? 'var(--cp-sand)' : 'var(--cp-white)',
                fontSize: '13px',
                color: 'var(--cp-navy)',
              }}
            />
          </div>

          <div>
            <label
              htmlFor="limite-hora"
              style={{
                fontWeight: 700,
                fontSize: '12px',
                color: 'var(--cp-navy)',
                display: 'block',
                marginBottom: '4px',
              }}
            >
              Máximo mensajes por hora
            </label>
            <input
              id="limite-hora"
              aria-label="Máximo mensajes por hora"
              type="number"
              min="5"
              max="500"
              value={antiSpam.maxPorHora}
              disabled={!puedeEditar || accionEnCurso}
              onChange={(e) =>
                setAntiSpam((prev) => ({
                  ...prev,
                  maxPorHora: Number(e.target.value) || 0,
                }))
              }
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1.5px solid var(--cp-line)',
                background: !puedeEditar ? 'var(--cp-sand)' : 'var(--cp-white)',
                fontSize: '13px',
                color: 'var(--cp-navy)',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Boton
            type="button"
            variante="primario"
            tamano="pequeno"
            deshabilitado={!puedeEditar || accionEnCurso}
            onClick={() => setModal({ tipo: 'guardar_antispam' })}
          >
            Guardar límites anti-spam
          </Boton>
        </div>
      </div>

      <TarjetaProteccionSpam esAdmin={puedeEditar} />

      {/* TARJETA 5: Privacidad Ley 29733 */}
      <div
        data-testid="seccion-privacidad"
        style={{
          background: 'var(--cp-white)',
          border: '1px solid var(--cp-line)',
          borderRadius: '14px',
          padding: '18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
        }}
      >
        <div>
          <h3
            style={{
              fontFamily: 'var(--fuente-titulos)',
              fontWeight: 800,
              fontSize: '15px',
              color: 'var(--cp-navy)',
              margin: 0,
            }}
          >
            Privacidad y protección de datos personales (Ley 29733)
          </h3>
          <p
            style={{
              fontSize: '12px',
              color: 'var(--cp-soft)',
              margin: '3px 0 0 0',
            }}
          >
            Cumplimiento normativo para la retención, anonimización y ejercicio de derechos ARCO sin exponer teléfonos completos.
          </p>
        </div>

        {/* 5A: Retención periódica */}
        <div
          style={{
            border: '1px solid var(--cp-line)',
            borderRadius: '12px',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div
            style={{
              fontWeight: 800,
              fontSize: '13px',
              color: 'var(--cp-navy)',
            }}
          >
            Política de retención y anonimización de mensajes
          </div>
          <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
            Los mensajes de chat más antiguos que el plazo configurado son anonimizados en su contenido. Los registros de auditoría y métricas se preservan sin información identificable.
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ flex: '1 1 200px' }}>
              <label
                htmlFor="dias-retencion"
                style={{
                  fontWeight: 700,
                  fontSize: '12px',
                  color: 'var(--cp-navy)',
                  display: 'block',
                  marginBottom: '4px',
                }}
              >
                Días de retención de mensajes
              </label>
              <input
                id="dias-retencion"
                aria-label="Días de retención de mensajes"
                type="number"
                min="7"
                max="730"
                value={privacidad.diasRetencion}
                disabled={!puedeEditar || accionEnCurso}
                onChange={(e) =>
                  setPrivacidad({ diasRetencion: Number(e.target.value) || 0 })
                }
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1.5px solid var(--cp-line)',
                  background: !puedeEditar ? 'var(--cp-sand)' : 'var(--cp-white)',
                  fontSize: '13px',
                  color: 'var(--cp-navy)',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <Boton
                type="button"
                variante="secundario"
                tamano="pequeno"
                deshabilitado={!puedeEditar || accionEnCurso}
                onClick={() => setModal({ tipo: 'guardar_retencion' })}
              >
                Guardar plazo
              </Boton>

              <Boton
                type="button"
                variante="peligro"
                tamano="pequeno"
                deshabilitado={!puedeEditar || accionEnCurso}
                onClick={() => setModal({ tipo: 'ejecutar_retencion' })}
              >
                Ejecutar anonimización ahora
              </Boton>
            </div>
          </div>
        </div>

        {/* 5B: Solicitudes ARCO de Clientes */}
        <div
          style={{
            border: '1px solid var(--cp-line)',
            borderRadius: '12px',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div
            style={{
              fontWeight: 800,
              fontSize: '13px',
              color: 'var(--cp-navy)',
            }}
          >
            Gestión ARCO: Exportación y baja de cliente
          </div>
          <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
            Permite consultar los datos recolectados y dar de baja al titular. El teléfono se procesa y exporta siempre enmascarado para resguardo de la confidencialidad.
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '12px',
            }}
          >
            <div>
              <label
                htmlFor="identificador-arco"
                style={{
                  fontWeight: 700,
                  fontSize: '12px',
                  color: 'var(--cp-navy)',
                  display: 'block',
                  marginBottom: '4px',
                }}
              >
                Número de teléfono o identificador
              </label>
              <input
                id="identificador-arco"
                aria-label="Número de teléfono o identificador"
                type="text"
                placeholder="Ejemplo: 987654321"
                value={identificadorArco}
                disabled={accionEnCurso}
                onChange={(e) => setIdentificadorArco(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1.5px solid var(--cp-line)',
                  fontSize: '13px',
                  color: 'var(--cp-navy)',
                }}
              />
            </div>

            <div>
              <label
                htmlFor="motivo-arco"
                style={{
                  fontWeight: 700,
                  fontSize: '12px',
                  color: 'var(--cp-navy)',
                  display: 'block',
                  marginBottom: '4px',
                }}
              >
                Motivo de la solicitud (para auditoría)
              </label>
              <input
                id="motivo-arco"
                aria-label="Motivo de la solicitud (para auditoría)"
                type="text"
                placeholder="Ejemplo: Solicitud ARCO de cancelación por titular"
                value={motivoArco}
                disabled={accionEnCurso}
                onChange={(e) => setMotivoArco(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1.5px solid var(--cp-line)',
                  fontSize: '13px',
                  color: 'var(--cp-navy)',
                }}
              />
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '8px',
              flexWrap: 'wrap',
            }}
          >
            <Boton
              type="button"
              variante="secundario"
              tamano="pequeno"
              deshabilitado={!identificadorArco.trim() || buscandoArco || accionEnCurso}
              onClick={handleBuscarArco}
            >
              {buscandoArco ? 'Consultando...' : 'Consultar y exportar datos'}
            </Boton>

            <Boton
              type="button"
              variante="peligro"
              tamano="pequeno"
              deshabilitado={
                !puedeEditar || !identificadorArco.trim() || accionEnCurso
              }
              onClick={() => setModal({ tipo: 'baja_cliente' })}
            >
              Dar de baja y anonimizar
            </Boton>
          </div>

          {/* Resultado de búsqueda ARCO */}
          {resultadoArco && (
            <div
              data-testid="resultado-arco"
              style={{
                marginTop: '10px',
                background: 'var(--cp-sand)',
                borderRadius: '10px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontSize: '13px',
                color: 'var(--cp-navy)',
              }}
            >
              <div
                style={{
                  fontWeight: 800,
                  fontSize: '14px',
                  color: 'var(--cp-navy)',
                  borderBottom: '1px solid var(--cp-line)',
                  paddingBottom: '6px',
                }}
              >
                Datos personales registrados (Teléfono enmascarado:{' '}
                {resultadoArco.identificadorEnmascarado})
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '10px',
                }}
              >
                <div>
                  <span style={{ color: 'var(--cp-soft)', fontSize: '11px', display: 'block' }}>
                    Consentimiento Ley 29733
                  </span>
                  <b>
                    {(resultadoArco.consentimiento?.aceptaComunicaciones ??
                    resultadoArco.consentimiento?.acepta ??
                    true)
                      ? 'Activo y vigente'
                      : 'Revocado / Inactivo'}
                  </b>{' '}
                  ({resultadoArco.consentimiento?.origen || 'Sin registro'})
                </div>

                <div>
                  <span style={{ color: 'var(--cp-soft)', fontSize: '11px', display: 'block' }}>
                    Conversaciones asociadas
                  </span>
                  <b>
                    {resultadoArco.totalConversaciones ??
                      (resultadoArco.conversacion ? 1 : 0)}{' '}
                    conversaciones
                  </b>
                </div>

                <div>
                  <span style={{ color: 'var(--cp-soft)', fontSize: '11px', display: 'block' }}>
                    Mensajes registrados
                  </span>
                  <b>
                    {resultadoArco.totalMensajes ??
                      resultadoArco.mensajes?.length ??
                      0}{' '}
                    mensajes
                  </b>
                </div>

                <div>
                  <span style={{ color: 'var(--cp-soft)', fontSize: '11px', display: 'block' }}>
                    Pedidos asociados
                  </span>
                  <b>
                    {resultadoArco.totalPedidos ??
                      resultadoArco.pedidos?.length ??
                      0}{' '}
                    pedidos
                  </b>
                </div>
              </div>

              <div style={{ fontSize: '12px', color: 'var(--cp-soft)', marginTop: '4px' }}>
                Todos los datos exportados cumplen con la política de no exposición de teléfonos completos en interfaces administrativas.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Confirmar Sí/No obligatorio */}
      <Confirmar
        abierto={modal !== null}
        cargando={accionEnCurso}
        titulo={
          modal?.tipo === 'toggle_funcion'
            ? 'Confirmar cambio de función'
            : modal?.tipo === 'guardar_texto'
            ? 'Confirmar actualización de texto'
            : modal?.tipo === 'restablecer_texto'
            ? 'Confirmar restablecer texto por defecto'
            : modal?.tipo === 'guardar_antispam'
            ? 'Confirmar límites anti-spam'
            : modal?.tipo === 'guardar_retencion'
            ? 'Confirmar plazo de retención'
            : modal?.tipo === 'ejecutar_retencion'
            ? 'Confirmar anonimización de mensajes'
            : modal?.tipo === 'baja_cliente'
            ? 'Confirmar baja y anonimización de cliente'
            : 'Confirmar acción'
        }
        mensaje={
          modal?.tipo === 'toggle_funcion'
            ? `¿Deseas ${modal.nuevoEstado ? 'activar' : 'pausar'} la función "${
                META_FUNCIONES[modal.funcion].titulo
              }" del chatbot?`
            : modal?.tipo === 'guardar_texto'
            ? `¿Deseas guardar los cambios en el texto "${
                META_TEXTOS[modal.clave].titulo
              }" respetando las normas de WhatsApp?`
            : modal?.tipo === 'restablecer_texto'
            ? `¿Deseas restablecer el texto "${
                META_TEXTOS[modal.clave].titulo
              }" a su valor por defecto original del mockup?`
            : modal?.tipo === 'guardar_antispam'
            ? '¿Deseas actualizar los límites de frecuencia anti-spam en Redis?'
            : modal?.tipo === 'guardar_retencion'
            ? `¿Deseas establecer el plazo de retención en ${privacidad.diasRetencion} días?`
            : modal?.tipo === 'ejecutar_retencion'
            ? `¿Deseas anonimizar todos los mensajes anteriores a ${privacidad.diasRetencion} días? Los registros se preservarán sin datos personales.`
            : modal?.tipo === 'baja_cliente'
            ? `¿Deseas dar de baja al cliente con identificador "${identificadorArco.trim()}"? Se revocará su consentimiento y sus datos sensibles serán anonimizados según la Ley 29733.`
            : '¿Deseas confirmar la acción seleccionada?'
        }
        peligro={
          modal?.tipo === 'ejecutar_retencion' ||
          modal?.tipo === 'baja_cliente' ||
          (modal?.tipo === 'toggle_funcion' && !modal.nuevoEstado)
        }
        textoSi={
          modal?.tipo === 'restablecer_texto'
            ? 'Sí, restablecer'
            : modal?.tipo === 'ejecutar_retencion'
            ? 'Sí, anonimizar'
            : modal?.tipo === 'baja_cliente'
            ? 'Sí, dar de baja'
            : 'Sí, confirmar'
        }
        textoNo="No, cancelar"
        alConfirmar={ejecutarAccionModal}
        alCancelar={() => {
          if (!accionEnCurso) setModal(null);
        }}
      />
    </div>
  );
}

export function ChatbotConfiguracionTab(props: ChatbotConfiguracionTabProps) {
  return (
    <LimiteErrorChatbot>
      <ChatbotConfiguracionVista {...props} />
    </LimiteErrorChatbot>
  );
}
