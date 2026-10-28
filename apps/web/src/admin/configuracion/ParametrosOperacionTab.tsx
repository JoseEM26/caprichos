import { useState, useEffect } from 'react';
import { api, ErrorApi } from '../../comun/api';
import { Boton } from '../../comun/Boton';
import { Campo } from '../../comun/Campo';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { Confirmar } from '../../comun/Confirmar';
import { Insignia } from '../../comun/Insignia';
import { TarjetaUmbralesAlertasEspera } from './TarjetaUmbralesAlertasEspera';

export interface ParametroItem {
  clave: string;
  valor: any;
}

interface MetaParametro {
  nombre: string;
  descripcion: string;
  tipo: 'numero' | 'texto' | 'sino' | 'solo_lectura' | 'objeto';
  sufijo?: string;
}

const META_PARAMETROS: Record<string, MetaParametro> = {
  tiempo_prometido_min: {
    nombre: 'Tiempo prometido de entrega (base)',
    descripcion: 'Minutos base de entrega que se anuncian al cliente en la carta y chatbot.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  tiempo_max_min: {
    nombre: 'Tiempo máximo de entrega',
    descripcion: 'Límite superior del tiempo estimado de entrega para el cliente.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  envio_gratis_monto: {
    nombre: 'Monto de envío gratis',
    descripcion: 'Monto total de productos requerido para que el despacho a domicilio no tenga costo.',
    tipo: 'numero',
    sufijo: 'S/',
  },
  envio_gratis_modo: {
    nombre: 'Modo de envío gratis',
    descripcion: 'Aplica desde el monto exacto ("desde") o solo si supera el monto ("mas_de").',
    tipo: 'texto',
  },
  pedido_minimo: {
    nombre: 'Pedido mínimo para delivery',
    descripcion: 'Monto mínimo en compras requerido para poder solicitar envío a domicilio.',
    tipo: 'numero',
    sufijo: 'S/',
  },
  tolerancia_reserva_min: {
    nombre: 'Tolerancia de reserva',
    descripcion: 'Minutos de espera de cortesía antes de liberar una mesa reservada.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  reserva_tolerancia_min: {
    nombre: 'Tolerancia de reserva',
    descripcion: 'Minutos de espera de cortesía antes de liberar una mesa reservada.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  puntos_porcentaje: {
    nombre: 'Porcentaje de puntos',
    descripcion: 'Porcentaje del monto consumido que el cliente acumula en puntos fidelidad.',
    tipo: 'numero',
    sufijo: '%',
  },
  descuento_personal_pct: {
    nombre: 'Descuento para el personal',
    descripcion: 'Porcentaje de descuento para consumos de los colaboradores a crédito.',
    tipo: 'numero',
    sufijo: '%',
  },
  rep_naranja_min: {
    nombre: 'Alerta naranja de reparto (retraso)',
    descripcion: 'Minutos transcurridos para marcar pedidos en alerta naranja en el mapa y en cocina.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  rep_rojo_min: {
    nombre: 'Alerta roja de reparto (crítico)',
    descripcion: 'Minutos transcurridos para marcar pedidos en estado crítico (rojo) en el mapa y en cocina.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  rep_max_pedidos: {
    nombre: 'Máximo de pedidos por repartidor',
    descripcion: 'Cantidad límite de órdenes simultáneas que puede trasladar un repartidor.',
    tipo: 'numero',
    sufijo: 'pedidos',
  },
  reparto_retrasado_min: {
    nombre: 'Alerta Retrasado de reparto (amarillo)',
    descripcion: 'Minutos para marcar pedidos en alerta amarilla (Retrasado) en el mapa de reparto.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  reparto_tarde_min: {
    nombre: 'Alerta Tarde de reparto (naranja)',
    descripcion: 'Minutos para marcar pedidos en alerta naranja (Tarde) en el mapa de reparto.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  reparto_muy_tarde_min: {
    nombre: 'Alerta Muy tarde de reparto (rojo palpitando)',
    descripcion: 'Minutos para marcar pedidos en estado crítico (rojo palpitando) en el mapa de reparto.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  reparto_velocidad_kmh: {
    nombre: 'Velocidad media de reparto',
    descripcion: 'Velocidad promedio estimada en moto (km/h) para cálculo de distancias y tiempos de entrega.',
    tipo: 'numero',
    sufijo: 'km/h',
  },
  reparto_max_pedidos: {
    nombre: 'Máximo de pedidos por repartidor (reparto)',
    descripcion: 'Cantidad límite de órdenes simultáneas por repartidor en el módulo de reparto.',
    tipo: 'numero',
    sufijo: 'pedidos',
  },
  pausa_alta_demanda: {
    nombre: 'Pausa por alta demanda',
    descripcion: 'Detiene temporalmente el ingreso de nuevos pedidos. Solo lectura: la gestiona cocina.',
    tipo: 'solo_lectura',
  },
  alta_demanda_min_base: {
    nombre: 'Minutos base por alta demanda',
    descripcion: 'Tiempo adicional que se suma a las órdenes cuando alta demanda está encendida.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  carta_aviso_entrada: {
    nombre: 'Aviso de promociones al entrar',
    descripcion: 'Muestra una ventana modal con la mejor promoción del día al ingresar a la carta virtual (máximo una vez al día por dispositivo).',
    tipo: 'sino',
  },
  reparto_insistencia_min: {
    nombre: 'Tiempo para insistencia en la puerta',
    descripcion: 'Minutos de espera tras la llegada del repartidor antes de enviar el aviso 3 de insistencia al cliente.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  reparto_espera_max_min: {
    nombre: 'Tiempo máximo de espera en la puerta',
    descripcion: 'Minutos de tolerancia máxima en la puerta antes de considerar la entrega como fallida y ofrecer reprogramación.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  reparto_recargo_reprogramacion: {
    nombre: 'Recargo por reprogramación de delivery',
    descripcion: 'Monto en soles a cobrar como recargo por segundo intento de envío tras espera agotada en la puerta.',
    tipo: 'numero',
    sufijo: 'S/',
  },
  encuesta_espera_min: {
    nombre: 'Espera para encuesta posventa',
    descripcion: 'Minutos transcurridos tras la entrega del pedido antes de enviar automáticamente la encuesta de satisfacción por WhatsApp.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  encuesta_puntaje_queja: {
    nombre: 'Umbral de queja en encuesta',
    descripcion: 'Puntajes iguales o menores a este valor (1 a 5) son derivados automáticamente como quejas al módulo de Reclamos.',
    tipo: 'numero',
  },
  chatbot_activo: {
    nombre: 'Chatbot de WhatsApp activo',
    descripcion: 'Habilita el motor conversacional automático en WhatsApp para responder saludos, menú, horarios y derivaciones a personas.',
    tipo: 'sino',
  },
  whatsapp_aviso_salida_activo: {
    nombre: 'Aviso WhatsApp: Delivery en camino',
    descripcion: 'Envía aviso automático al cliente con tiempo estimado cuando el repartidor sale con el pedido.',
    tipo: 'sino',
  },
  whatsapp_aviso_llegada_activo: {
    nombre: 'Aviso WhatsApp: Repartidor en la puerta',
    descripcion: 'Envía aviso automático al cliente indicando que el repartidor llegó a su dirección y la insistencia posterior.',
    tipo: 'sino',
  },
  whatsapp_aviso_espera_activo: {
    nombre: 'Aviso WhatsApp: Espera agotada y reprogramación',
    descripcion: 'Notifica al cliente el retiro del repartidor por tiempo agotado y ofrece botones para reprogramar el envío.',
    tipo: 'sino',
  },
  whatsapp_aviso_recojo_activo: {
    nombre: 'Aviso WhatsApp: Pedido listo para recoger',
    descripcion: 'Envía aviso automático al cliente cuando su pedido para llevar o recojo pasa a estado listo.',
    tipo: 'sino',
  },
  whatsapp_aviso_pago_confirmado_activo: {
    nombre: 'Aviso WhatsApp: Pago confirmado',
    descripcion: 'Notifica al cliente que Caja confirmó su comprobante de pago y que el pedido está en preparación.',
    tipo: 'sino',
  },
  whatsapp_aviso_listo_activo: {
    nombre: 'Aviso WhatsApp: Pedido delivery listo',
    descripcion: 'Avisa al cliente cuando cocina termina su pedido delivery y queda listo para salir con el repartidor.',
    tipo: 'sino',
  },
  whatsapp_aviso_recibido_activo: {
    nombre: 'Aviso WhatsApp: Pedido recibido desde la carta',
    descripcion: 'Avisa al cliente que recibimos su pedido de la carta virtual. Con Yape, Plin o transferencia, avisa que un asesor gestiona el voucher por este chat.',
    tipo: 'sino',
  },
  whatsapp_aviso_entregado_activo: {
    nombre: 'Aviso WhatsApp: Pedido delivery entregado',
    descripcion: 'Envía al cliente un agradecimiento cuando su pedido delivery queda entregado.',
    tipo: 'sino',
  },
  whatsapp_aviso_encuesta_activo: {
    nombre: 'Aviso WhatsApp: Encuesta de satisfacción posventa',
    descripcion: 'Envía encuesta interactiva de calificación del 1 al 5 al cliente tras la entrega de su pedido.',
    tipo: 'sino',
  },
  chatbot_pago_recordatorio_activo: {
    nombre: 'Recordatorio WhatsApp: Comprobante de pago pendiente',
    descripcion: 'Envía un recordatorio automático cordial al cliente si pasan los minutos configurados sin enviar la captura del pago digital.',
    tipo: 'sino',
  },
  chatbot_pago_recordatorio_min: {
    nombre: 'Minutos para recordatorio de pago digital',
    descripcion: 'Tiempo de espera antes de enviar el recordatorio cordial al cliente solicitando su captura de pago.',
    tipo: 'numero',
    sufijo: 'min',
  },
  chatbot_pago_expira_min: {
    nombre: 'Minutos para alerta de pago por expirar a Caja',
    descripcion: 'Tiempo de espera antes de emitir alerta a la consola de Caja para decidir si contactar o anular (0 para apagar).',
    tipo: 'numero',
    sufijo: 'min',
  },
  chatbot_ia_activo: {
    nombre: 'Chatbot: Inteligencia Artificial para dudas (OpenAI)',
    descripcion: 'Habilita la IA (OpenAI) para resolver dudas de la carta, promociones, horarios y recomendaciones en WhatsApp con solo lectura.',
    tipo: 'sino',
  },
  chatbot_ia_tope_mensual_usd: {
    nombre: 'Chatbot: Tope mensual de gasto en IA (USD)',
    descripcion: 'Límite máximo en dólares por mes calendario para consumo de OpenAI. Al alcanzarse, la IA se apaga y alerta a Caja.',
    tipo: 'numero',
    sufijo: 'USD',
  },
  chatbot_ia_max_por_hora_telefono: {
    nombre: 'Chatbot: Límite de consultas a la IA por hora y teléfono',
    descripcion: 'Máximo número de preguntas a la IA que un mismo teléfono puede realizar en el lapso de una hora (anti-abuso).',
    tipo: 'numero',
    sufijo: 'consultas/h',
  },
  ayuda_ia_activo: {
    nombre: 'Asistente de ayuda con IA (Capri)',
    descripcion: 'Habilita al asistente virtual Capri con IA para orientar a los usuarios en el panel de administración.',
    tipo: 'sino',
  },
  alerta_voucher_min_1: {
    nombre: 'Primer aviso de voucher sin revisar',
    descripcion: 'Minutos de espera tras recibir una captura de pago antes de enviar el primer aviso a los administradores.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  alerta_voucher_min_2: {
    nombre: 'Segundo aviso de voucher sin revisar (urgente)',
    descripcion: 'Minutos de espera antes del segundo aviso a los administradores y marcar el chat como urgente.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  espera_cliente_aviso_min: {
    nombre: 'Aviso de espera al cliente por validación de pago',
    descripcion: 'Minutos transcurridos antes de enviar al cliente el mensaje interactivo de tranquilidad.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  chat_tomado_liberar_min: {
    nombre: 'Liberación de chat tomado y abandonado',
    descripcion: 'Minutos de inactividad de la persona antes de liberar el chat de vuelta al bot (excepto VALIDAR_PAGO).',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  alerta_pedido_sin_confirmar_min: {
    nombre: 'Alerta de pedido nuevo sin confirmar en Caja',
    descripcion: 'Minutos sin confirmación en Caja antes de alertar a los administradores por WhatsApp.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  asistido_espera_min: {
    nombre: 'Espera antes de modo asistido',
    descripcion: 'Minutos sin respuesta de asesor antes de activar el bot asistido en chats en espera.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
};

interface ParametrosOperacionTabProps {
  puedeVer: boolean;
  puedeEditar: boolean;
}

export function ParametrosOperacionTab({
  puedeVer,
  puedeEditar,
}: ParametrosOperacionTabProps) {
  const [parametros, setParametros] = useState<ParametroItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  // Parámetro en edición modal
  const [parametroEditando, setParametroEditando] = useState<ParametroItem | null>(null);
  const [nuevoValorInput, setNuevoValorInput] = useState<string>('');
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);

  // Confirmación Sí/No antes de guardar
  const [confirmarAbierto, setConfirmarAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [mensajeGuardado, setMensajeGuardado] = useState<string | null>(null);

  // Estado del conector de WhatsApp (solo lectura, sin secretos)
  const [estadoWhatsApp, setEstadoWhatsApp] = useState<{
    conectado: boolean;
    modo: 'meta' | 'simulado';
  } | null>(null);

  // Estado del consumo de IA del mes actual (solo lectura, Ola 3 Agente G)
  const [consumoIa, setConsumoIa] = useState<{
    periodo: string;
    llamadasTotal: number;
    tokensEntrada: number;
    tokensSalida: number;
    tokensTotal: number;
    costoUsdEstimado: number;
    topeMensualUsd: number;
    porcentajeConsumido: number;
    topeAlcanzado: boolean;
    iaActiva: boolean;
  } | null>(null);

  const cargarParametros = async () => {
    if (!puedeVer) {
      setCargando(false);
      return;
    }
    setCargando(true);
    setErrorCarga(null);
    try {
      const res = await api.get<ParametroItem[]>('/admin/configuracion');
      // Filtramos datos del local y pagos que tienen su propia pestaña dedicada
      const filtrados = res.filter(
        (p) => p.clave !== 'local_datos' && p.clave !== 'local_pagos',
      );
      setParametros(filtrados);

      try {
        const infoWa = await api.get<{ conectado: boolean; modo: 'meta' | 'simulado' }>(
          '/admin/reclamos/whatsapp/estado-conexion',
        );
        setEstadoWhatsApp(infoWa);
      } catch {
        setEstadoWhatsApp({ conectado: false, modo: 'simulado' });
      }

      try {
        const infoIa = await api.get<{
          periodo: string;
          llamadasTotal: number;
          tokensEntrada: number;
          tokensSalida: number;
          tokensTotal: number;
          costoUsdEstimado: number;
          topeMensualUsd: number;
          porcentajeConsumido: number;
          topeAlcanzado: boolean;
          iaActiva: boolean;
        }>('/admin/configuracion/ia-consumo');
        if (infoIa && typeof (infoIa as any).tokensTotal === 'number') {
          setConsumoIa(infoIa);
        } else {
          setConsumoIa(null);
        }
      } catch {
        setConsumoIa(null);
      }
    } catch (err) {
      const msg =
        err instanceof ErrorApi
          ? err.message
          : 'No se pudieron cargar los parámetros de operación';
      setErrorCarga(msg);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarParametros();
  }, [puedeVer]);

  if (!puedeVer) {
    return (
      <div
        role="status"
        style={{
          background: 'var(--cp-sand)',
          border: '1px solid var(--cp-line)',
          borderRadius: '12px',
          padding: '24px',
          textAlign: 'center',
          color: 'var(--cp-soft)',
        }}
      >
        <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: '16px', color: 'var(--cp-navy)', marginBottom: '6px' }}>
          Sin permiso de acceso
        </div>
        <div>No tienes el permiso <b>configuracion/ver</b> para consultar los parámetros de operación.</div>
      </div>
    );
  }

  if (cargando) {
    return <Cargando mensaje="Cargando parámetros de operación..." />;
  }

  if (errorCarga) {
    return (
      <EstadoError
        titulo="Error al cargar parámetros"
        mensaje={errorCarga}
        alReintentar={cargarParametros}
      />
    );
  }

  const iniciarEdicion = (item: ParametroItem) => {
    setParametroEditando(item);
    setErrorValidacion(null);
    setErrorServidor(null);
    if (typeof item.valor === 'boolean') {
      setNuevoValorInput(item.valor ? 'true' : 'false');
    } else if (typeof item.valor === 'string' && (item.valor.toLowerCase() === 'si' || item.valor.toLowerCase() === 'no')) {
      setNuevoValorInput(item.valor.toLowerCase() === 'si' ? 'true' : 'false');
    } else if (typeof item.valor === 'number') {
      setNuevoValorInput(String(item.valor));
    } else if (typeof item.valor === 'string') {
      setNuevoValorInput(item.valor);
    } else {
      setNuevoValorInput(JSON.stringify(item.valor));
    }
  };

  const prepararGuardado = () => {
    if (!parametroEditando) return;
    const meta = META_PARAMETROS[parametroEditando.clave];
    const tipo = meta?.tipo || (typeof parametroEditando.valor === 'number' ? 'numero' : 'texto');

    if (tipo === 'numero') {
      const num = Number(nuevoValorInput.trim());
      if (isNaN(num) || num < 0) {
        setErrorValidacion('El valor debe ser un número mayor o igual a 0');
        return;
      }
    } else if (tipo === 'texto') {
      if (!nuevoValorInput.trim()) {
        setErrorValidacion('El texto no puede estar vacío');
        return;
      }
    }

    setErrorValidacion(null);
    setConfirmarAbierto(true);
  };

  const handleGuardarParametro = async () => {
    if (!parametroEditando || !puedeEditar) return;
    const clave = parametroEditando.clave;
    const meta = META_PARAMETROS[clave];
    const tipo = meta?.tipo || (typeof parametroEditando.valor === 'number' ? 'numero' : 'texto');

    let valorFinal: any = nuevoValorInput.trim();
    if (tipo === 'numero') {
      valorFinal = Number(nuevoValorInput.trim());
    } else if (tipo === 'sino') {
      valorFinal = nuevoValorInput === 'true' || nuevoValorInput === 'si' ? 'si' : 'no';
    }

    setGuardando(true);
    setErrorServidor(null);
    try {
      const res = await api.put<ParametroItem>(`/admin/configuracion/${clave}`, {
        valor: valorFinal,
      });

      setParametros((prev) =>
        prev.map((p) => (p.clave === clave ? { ...p, valor: res.valor } : p)),
      );

      const ahora = new Date();
      const horaStr = ahora.toLocaleTimeString('es-PE', { hour12: false });
      setMensajeGuardado(`Guardado a las ${horaStr}`);
      setConfirmarAbierto(false);
      setParametroEditando(null);
    } catch (err) {
      const msg =
        err instanceof ErrorApi
          ? err.message
          : 'Error al actualizar el parámetro en el servidor';
      setErrorServidor(msg);
      setConfirmarAbierto(false);
    } finally {
      setGuardando(false);
    }
  };

  const formatearValorVisual = (clave: string, valor: any) => {
    if (clave === 'pausa_alta_demanda') {
      const activa = typeof valor === 'boolean' ? valor : Boolean(valor?.activa);
      return activa ? 'Activa (cocina pausada)' : 'Desactivada (operando)';
    }
    if (typeof valor === 'boolean') {
      return valor ? 'Sí' : 'No';
    }
    if (typeof valor === 'string' && (valor.toLowerCase() === 'si' || valor.toLowerCase() === 'no')) {
      return valor.toLowerCase() === 'si' ? 'Sí' : 'No';
    }
    if (typeof valor === 'object' && valor !== null) {
      return JSON.stringify(valor);
    }
    const meta = META_PARAMETROS[clave];
    if (meta?.sufijo) {
      return `${valor} ${meta.sufijo}`;
    }
    return String(valor ?? '');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: 'var(--fuente-titulos)',
              fontWeight: 800,
              fontSize: '18px',
              color: 'var(--cp-navy)',
            }}
          >
            Parámetros de operación
          </h2>
          <p
            style={{
              fontSize: '13px',
              color: 'var(--cp-soft)',
              margin: '4px 0 0 0',
            }}
          >
            Tiempos de entrega, umbrales de reparto, tolerancias y beneficios de clientes.
          </p>
        </div>

        {mensajeGuardado && (
          <span
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--cp-green)',
            }}
          >
            {mensajeGuardado}
          </span>
        )}
      </div>

      {/* Indicador solo-lectura de estado de conexión con WhatsApp (sin exponer secretos) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '14px 18px',
          background:
            estadoWhatsApp?.modo === 'meta' && estadoWhatsApp?.conectado
              ? '#EBF7EE'
              : 'var(--cp-sand)',
          border: '1px solid var(--cp-line)',
          borderRadius: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background:
                estadoWhatsApp?.modo === 'meta' && estadoWhatsApp?.conectado
                  ? 'var(--cp-green)'
                  : 'var(--cp-soft)',
            }}
          />
          <div>
            <div
              style={{
                fontFamily: 'var(--fuente-titulos)',
                fontWeight: 800,
                fontSize: '14px',
                color: 'var(--cp-navy)',
              }}
            >
              WhatsApp:{' '}
              {estadoWhatsApp?.modo === 'meta' && estadoWhatsApp?.conectado
                ? 'conectado con Meta'
                : 'modo simulado (no se envia nada)'}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
              {estadoWhatsApp?.modo === 'meta' && estadoWhatsApp?.conectado
                ? 'Conexión activa con WhatsApp Cloud API de Meta. Los mensajes saldrán a teléfonos reales.'
                : 'Modo seguro por defecto sin credenciales externas. Los mensajes se guardan en la base de datos con estado SIMULADO.'}
            </div>
          </div>
        </div>

        <Insignia
          variante={
            estadoWhatsApp?.modo === 'meta' && estadoWhatsApp?.conectado ? 'exito' : 'neutro'
          }
        >
          {estadoWhatsApp?.modo === 'meta' && estadoWhatsApp?.conectado ? 'Meta' : 'Simulado'}
        </Insignia>
      </div>

      {consumoIa && typeof (consumoIa as any).tokensTotal === 'number' && (
        <div
          data-testid="tarjeta-consumo-ia"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            padding: '14px 18px',
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: '14px',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>🤖</span>
            <div>
              <div
                style={{
                  fontFamily: 'var(--fuente-titulos)',
                  fontWeight: 800,
                  fontSize: '14px',
                  color: 'var(--cp-navy)',
                }}
              >
                Consumo de la IA este mes ({consumoIa.periodo})
              </div>
              <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                {consumoIa.llamadasTotal} consultas · {consumoIa.tokensTotal.toLocaleString()} tokens · Costo estimado: ${consumoIa.costoUsdEstimado.toFixed(4)} USD / Tope: ${consumoIa.topeMensualUsd.toFixed(2)} USD ({consumoIa.porcentajeConsumido}% consumido)
              </div>
            </div>
          </div>

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
        </div>
      )}

      {/* Tarjeta pequeña de umbrales de alertas y espera (solo ADMIN) */}
      <TarjetaUmbralesAlertasEspera esAdmin={puedeEditar} alGuardar={cargarParametros} />

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
          Modo sólo lectura. No tienes el permiso <b>configuracion/editar</b> para modificar parámetros.
        </div>
      )}

      {!parametroEditando && errorServidor && (
        <div
          role="alert"
          style={{
            background: '#FBEDE9',
            border: '1px solid var(--cp-rust)',
            borderRadius: '10px',
            padding: '10px 14px',
            fontSize: '13px',
            color: 'var(--cp-rust)',
            fontWeight: 600,
          }}
        >
          {errorServidor}
        </div>
      )}

      {parametros.length === 0 ? (
        <EstadoVacio
          titulo="Sin parámetros de operación"
          descripcion="No se encontraron parámetros registrados en la base de datos."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {parametros.map((p) => {
            const meta = META_PARAMETROS[p.clave] || {
              nombre: p.clave.replace(/_/g, ' '),
              descripcion: `Parámetro de configuración del sistema (${p.clave}).`,
              tipo: typeof p.valor === 'number' ? 'numero' : typeof p.valor === 'boolean' ? 'sino' : 'texto',
            };
            const esSoloLectura = meta.tipo === 'solo_lectura' || p.clave === 'pausa_alta_demanda';

            return (
              <div
                key={p.clave}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  padding: '14px 18px',
                  background: 'var(--cp-white)',
                  border: '1px solid var(--cp-line)',
                  borderRadius: '14px',
                  gap: '12px',
                }}
              >
                <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        fontFamily: 'var(--fuente-titulos)',
                        fontWeight: 800,
                        fontSize: '15px',
                        color: 'var(--cp-navy)',
                      }}
                    >
                      {meta.nombre}
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: '6px',
                        background: 'var(--cp-sand)',
                        color: 'var(--cp-soft)',
                      }}
                    >
                      {p.clave}
                    </span>
                    {esSoloLectura && (
                      <Insignia variante="aviso">Solo lectura (Cocina)</Insignia>
                    )}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--cp-soft)', lineHeight: '18px' }}>
                    {meta.descripcion}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div
                    style={{
                      fontFamily: 'var(--fuente-titulos)',
                      fontWeight: 800,
                      fontSize: '16px',
                      color: 'var(--cp-navy)',
                      background: 'var(--cp-sand)',
                      padding: '6px 14px',
                      borderRadius: '10px',
                      minWidth: '80px',
                      textAlign: 'center',
                    }}
                  >
                    {formatearValorVisual(p.clave, p.valor)}
                  </div>

                  {!esSoloLectura && puedeEditar && (
                    <Boton
                      type="button"
                      variante="secundario"
                      tamano="pequeno"
                      onClick={() => iniciarEdicion(p)}
                    >
                      Editar
                    </Boton>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal / Diálogo de edición de parámetro */}
      {parametroEditando && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 90,
            background: 'rgba(11, 44, 62, 0.65)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => !guardando && setParametroEditando(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="editar-parametro-titulo"
            style={{
              width: '100%',
              maxWidth: '440px',
              background: 'var(--cp-white)',
              border: '1px solid var(--cp-line)',
              borderRadius: '20px',
              padding: '24px',
              boxShadow: '0 12px 36px rgba(11, 44, 62, 0.22)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3
                id="editar-parametro-titulo"
                style={{
                  fontFamily: 'var(--fuente-titulos)',
                  fontWeight: 800,
                  fontSize: '17px',
                  color: 'var(--cp-navy)',
                }}
              >
                {META_PARAMETROS[parametroEditando.clave]?.nombre || parametroEditando.clave}
              </h3>
              <p
                style={{
                  fontSize: '13px',
                  color: 'var(--cp-soft)',
                  margin: '4px 0 0 0',
                }}
              >
                {META_PARAMETROS[parametroEditando.clave]?.descripcion}
              </p>
            </div>

            {errorValidacion && (
              <div
                role="alert"
                style={{
                  background: '#FBEDE9',
                  border: '1px solid var(--cp-rust)',
                  borderRadius: '10px',
                  padding: '8px 12px',
                  fontSize: '13px',
                  color: 'var(--cp-rust)',
                  fontWeight: 600,
                }}
              >
                {errorValidacion}
              </div>
            )}

            {errorServidor && (
              <div
                role="alert"
                style={{
                  background: '#FBEDE9',
                  border: '1px solid var(--cp-rust)',
                  borderRadius: '10px',
                  padding: '8px 12px',
                  fontSize: '13px',
                  color: 'var(--cp-rust)',
                  fontWeight: 600,
                }}
              >
                {errorServidor}
              </div>
            )}

            {(() => {
              const meta = META_PARAMETROS[parametroEditando.clave];
              const tipo = meta?.tipo || (typeof parametroEditando.valor === 'number' ? 'numero' : 'texto');

              if (tipo === 'sino') {
                const esTrue = nuevoValorInput === 'true';
                return (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setNuevoValorInput('true')}
                      style={{
                        flex: 1,
                        minHeight: '44px',
                        borderRadius: '10px',
                        border: '1.5px solid var(--cp-navy)',
                        background: esTrue ? 'var(--cp-navy)' : 'transparent',
                        color: esTrue ? 'var(--cp-cream)' : 'var(--cp-navy)',
                        fontWeight: 800,
                      }}
                    >
                      Sí / Activo
                    </button>
                    <button
                      type="button"
                      onClick={() => setNuevoValorInput('false')}
                      style={{
                        flex: 1,
                        minHeight: '44px',
                        borderRadius: '10px',
                        border: '1.5px solid var(--cp-navy)',
                        background: !esTrue ? 'var(--cp-navy)' : 'transparent',
                        color: !esTrue ? 'var(--cp-cream)' : 'var(--cp-navy)',
                        fontWeight: 800,
                      }}
                    >
                      No / Inactivo
                    </button>
                  </div>
                );
              }

              return (
                <Campo
                  etiqueta={`Nuevo valor ${meta?.sufijo ? `(${meta.sufijo})` : ''}`}
                  type={tipo === 'numero' ? 'number' : 'text'}
                  value={nuevoValorInput}
                  onChange={(e) => {
                    setNuevoValorInput(e.target.value);
                    setErrorValidacion(null);
                    setErrorServidor(null);
                  }}
                  autoFocus
                />
              );
            })()}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
              <Boton
                type="button"
                variante="secundario"
                disabled={guardando}
                onClick={() => setParametroEditando(null)}
              >
                Cancelar
              </Boton>
              <Boton
                type="button"
                variante="primario"
                disabled={guardando}
                onClick={prepararGuardado}
              >
                Continuar
              </Boton>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Sí/No obligatorio antes de guardar un parámetro */}
      <Confirmar
        abierto={confirmarAbierto}
        titulo="¿Guardar parámetro de operación?"
        mensaje={`¿Confirmas cambiar el valor de "${
          parametroEditando ? META_PARAMETROS[parametroEditando.clave]?.nombre || parametroEditando.clave : ''
        }" a "${nuevoValorInput}"? El cambio afectará los cálculos operativos del sistema.`}
        textoSi="Sí, guardar"
        textoNo="No, cancelar"
        cargando={guardando}
        alConfirmar={handleGuardarParametro}
        alCancelar={() => setConfirmarAbierto(false)}
      />
    </div>
  );
}
