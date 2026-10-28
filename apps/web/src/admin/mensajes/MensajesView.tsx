import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Confirmar } from '../../comun/Confirmar';
import { useEventos } from '../../comun/socket';
import {
  aplicarCambioChat,
  aprobarPagoChat,
  editarNombreContacto,
  enviarMensaje,
  listarConversaciones,
  listarRespuestasRapidas,
  marcarAtendido,
  obtenerDetalleConversacion,
  pausarBot,
  pulirMensaje,
  reabrirConversacionPlantilla,
  rechazarCambioChat,
  rechazarPagoChat,
  reintentarMensaje,
  reanudarBot,
  soltarChat,
  tomarChat,
} from './mensajesApi';
import { ModalEditarNombre, IconoLapiz } from './ModalEditarNombre';
import { useSesion } from '../../comun/sesion';
import { TarjetaLecturaVoucher } from '../vouchers/TarjetaLecturaVoucher';
import { SalientesWhatsApp } from './SalientesWhatsApp';
import { salientesApi } from './salientesApi';
import { FotoAmpliable } from '../vouchers/FotoAmpliable';
import { VoucherResumenChat } from '../vouchers/tipos';
import {
  ChatResumen,
  DetalleConversacion,
  EstadoChat,
  FiltroChat,
  RespuestaRapida,
} from './mensajesTipos';

function esUsuarioWhatsApp(c?: { identificador_tipo?: string; telefono?: string } | null): boolean {
  if (!c) return false;
  return c.identificador_tipo === 'USUARIO_WA' || (Boolean(c.telefono) && c.telefono!.startsWith('wa-user:'));
}

const ESTADOS_BG: Record<EstadoChat, string> = {
  atencion: '#FBE9DF',
  validar: '#FFF1C9',
  bot: 'var(--cp-line)',
  pausado: '#F0F2F5',
  atendido: 'var(--cp-greenbg)',
};

const ESTADOS_LABEL: Record<EstadoChat, string> = {
  atencion: 'Requiere atención',
  validar: 'Validar pago',
  bot: 'El bot atiende',
  pausado: 'Pausado',
  atendido: 'Atendido',
};

const BANNERS_TEXTO: Record<EstadoChat, [string, string]> = {
  atencion: ['Este cliente pidió hablar con una persona. El bot ya no responde: contesta tú.', '#FFF1C9'],
  validar: ['Revisa el comprobante y aprueba o rechaza el pago. El bot espera tu decisión.', '#FFF1C9'],
  bot: ['El bot está atendiendo solo. Entra únicamente si hace falta.', '#E7F5EE'],
  pausado: ['El bot está en pausa en este chat: solo respondes tú.', '#F0F2F5'],
  atendido: ['Chat atendido. Si el cliente escribe de nuevo, vuelve a la lista de pendientes.', '#E7F5EE'],
};

const COLORES_AVATAR = ['#B5651D', '#6B4E9B', '#2E7D32', '#AD4A4A', '#1F7A8C', '#D97706'];

const obtenerColorAvatar = (id: string) => {
  let num = 0;
  for (let i = 0; i < id.length; i++) num += id.charCodeAt(i);
  return COLORES_AVATAR[num % COLORES_AVATAR.length];
};

const obtenerIniciales = (nombre: string) => {
  const partes = (nombre || '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return 'WA';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
};

/** Foto del chat (voucher): privada, con miniatura y pantalla completa */
function FotoMensaje({
  archivoId,
  voucher,
  puedeVer = true,
}: {
  archivoId?: string | null;
  voucher?: VoucherResumenChat | null;
  puedeVer?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <FotoAmpliable archivoId={archivoId} alt="Foto enviada por el cliente" />
      {voucher && puedeVer && <TarjetaLecturaVoucher voucher={voucher} puedeVer={puedeVer} />}
    </div>
  );
}

export function obtenerEstiloEspera(minutos: number) {
  if (minutos > 15) {
    return {
      fondo: '#FBEDE9',
      borde: '1px solid var(--cp-rust, #B2500F)',
      color: 'var(--cp-rust, #B2500F)',
      label: `${minutos} min`,
    };
  }
  if (minutos > 5) {
    return {
      fondo: '#FEF9EE',
      borde: '1px solid var(--cp-gold, #D99E39)',
      color: 'var(--cp-gold, #D99E39)',
      label: `${minutos} min`,
    };
  }
  return {
    fondo: '#F0F2F5',
    borde: '1px solid var(--cp-line, #E3D6C6)',
    color: 'var(--cp-soft, #2C4C5D)',
    label: `${minutos} min`,
  };
}

function MensajesChats() {
  let tieneVouchersVer = true;
  try {
    const sesion = useSesion();
    tieneVouchersVer =
      Boolean(sesion?.tiene?.('vouchers/ver')) ||
      sesion?.usuario?.rol === 'ADMIN' ||
      sesion?.usuario?.rol === 'CAJERO';
  } catch {
    tieneVouchersVer = true;
  }

  const [cargando, setCargando] = useState(true);
  const [chats, setChats] = useState<ChatResumen[]>([]);
  const [conteos, setConteos] = useState({ todos: 0, atender: 0, bot: 0, atendidos: 0 });
  const [filtro, setFiltro] = useState<FiltroChat>('todos');

  const chatsOrdenados = useMemo(() => {
    if (filtro === 'atender') {
      return [...chats].sort((a, b) => {
        const esperaA = typeof a.esperaMin === 'number' ? a.esperaMin : -1;
        const esperaB = typeof b.esperaMin === 'number' ? b.esperaMin : -1;
        return esperaB - esperaA;
      });
    }
    return chats;
  }, [chats, filtro]);
  const [busqueda, setBusqueda] = useState('');
  const [chatSeleccionadoId, setChatSeleccionadoId] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<DetalleConversacion | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [respuestasRapidas, setRespuestasRapidas] = useState<RespuestaRapida[]>([]);

  // Vista móvil: chat abierto
  const [chatAbiertoMovil, setChatAbiertoMovil] = useState(false);

  // Pantalla completa y zoom
  const [pantallaCompleta, setPantallaCompleta] = useState(false);
  const [zoom, setZoom] = useState(85);

  // Redacción de mensaje
  const [textoMensaje, setTextoMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [textoPulido, setTextoPulido] = useState<string | null>(null);
  const [pulirError, setPulirError] = useState<string | null>(null);
  const [mensajeCopiado, setMensajeCopiado] = useState<string | null>(null);

  // Diálogos de confirmación
  const [confirmarAccion, setConfirmarAccion] = useState<{
    titulo: string;
    mensaje: string;
    textoSi?: string;
    peligro?: boolean;
    accion: () => Promise<void>;
  } | null>(null);

  // Modal para editar nombre de contacto
  const [modalEditarAbierto, setModalEditarAbierto] = useState(false);

  // Modal para rechazar cambio de pedido
  const [modalRechazoCambio, setModalRechazoCambio] = useState<{
    abierto: boolean;
    motivo: string;
    enviando: boolean;
    error: string | null;
  }>({
    abierto: false,
    motivo: '',
    enviando: false,
    error: null,
  });

  const handleGuardarNombre = async (nuevoNombre: string) => {
    if (!detalle) return;
    const res = await editarNombreContacto(detalle.id, { nombre: nuevoNombre });
    setDetalle((prev) =>
      prev
        ? {
            ...prev,
            nombre: res.nombre,
            nombre_contacto: res.nombre_contacto,
            nombre_editado: res.nombre_editado,
          }
        : null,
    );
    setChats((prev) =>
      prev.map((c) =>
        c.id === detalle.id
          ? {
              ...c,
              nombre: res.nombre,
              nombre_contacto: res.nombre_contacto,
              nombre_editado: res.nombre_editado,
            }
          : c,
      ),
    );
    setMensajeCopiado(`Nombre actualizado a: ${res.nombre}`);
  };

  const handleRevertirNombre = async () => {
    if (!detalle) return;
    const res = await editarNombreContacto(detalle.id, { revertir: true });
    setDetalle((prev) =>
      prev
        ? {
            ...prev,
            nombre: res.nombre,
            nombre_contacto: res.nombre_contacto,
            nombre_editado: res.nombre_editado,
          }
        : null,
    );
    setChats((prev) =>
      prev.map((c) =>
        c.id === detalle.id
          ? {
              ...c,
              nombre: res.nombre,
              nombre_contacto: res.nombre_contacto,
              nombre_editado: res.nombre_editado,
            }
          : c,
      ),
    );
    setMensajeCopiado(`Nombre restablecido a: ${res.nombre}`);
  };

  // Cargar lista de conversaciones
  const cargarLista = useCallback(async (mantenerSeleccion = true) => {
    try {
      const res = await listarConversaciones(filtro, busqueda);
      setChats(res.chats);
      setConteos(res.conteos);

      if (res.chats.length > 0) {
        setChatSeleccionadoId((prev) => {
          if (mantenerSeleccion && prev && res.chats.some((c) => c.id === prev)) {
            return prev;
          }
          return res.chats[0].id;
        });
      } else {
        setChatSeleccionadoId(null);
        setDetalle(null);
      }
    } catch {
      // Ignorar error transitorio de red
    } finally {
      setCargando(false);
    }
  }, [filtro, busqueda]);

  // Cargar respuestas rápidas una vez
  useEffect(() => {
    listarRespuestasRapidas()
      .then((rr) => setRespuestasRapidas(rr))
      .catch(() => {});
  }, []);

  // Cargar chats al cambiar filtro o búsqueda
  useEffect(() => {
    cargarLista(false);
  }, [cargarLista]);

  // Cargar detalle del chat seleccionado
  const cargarDetalle = useCallback(async (id: string) => {
    setCargandoDetalle(true);
    setTextoPulido(null);
    setPulirError(null);
    setMensajeCopiado(null);
    try {
      const d = await obtenerDetalleConversacion(id);
      setDetalle(d);
    } catch {
      setDetalle(null);
    } finally {
      setCargandoDetalle(false);
    }
  }, []);

  useEffect(() => {
    if (chatSeleccionadoId) {
      cargarDetalle(chatSeleccionadoId);
    }
  }, [chatSeleccionadoId, cargarDetalle]);

  // Respaldo por si el canal en vivo se cae: refresca la lista cada 20 s
  useEffect(() => {
    const cada = setInterval(() => {
      cargarLista(true);
      if (chatSeleccionadoId) cargarDetalle(chatSeleccionadoId);
    }, 20000);
    return () => clearInterval(cada);
  }, [cargarLista, cargarDetalle, chatSeleccionadoId]);

  // Escuchar eventos en vivo
  useEventos('mensajes:actualizado', () => {
    cargarLista(true);
    if (chatSeleccionadoId) {
      cargarDetalle(chatSeleccionadoId);
    }
  });

  // Acciones sobre el chat
  const handleReabrirPlantilla = () => {
    if (!detalle || !chatSeleccionadoId) return;
    setConfirmarAccion({
      titulo: '¿Reabrir conversación con plantilla?',
      mensaje:
        'Pasaron mas de 24 horas desde el ultimo mensaje del cliente. ¿Deseas enviar la plantilla aprobada para retomar el contacto?',
      textoSi: 'Sí, reabrir',
      accion: async () => {
        try {
          await reabrirConversacionPlantilla(chatSeleccionadoId);
          setTextoMensaje('');
          setTextoPulido(null);
          setPulirError(null);
          await cargarDetalle(chatSeleccionadoId);
          await cargarLista(true);
        } catch (e: any) {
          setPulirError(e?.message || 'Error al enviar la plantilla');
        }
      },
    });
  };

  const handleReintentarMensaje = (mensajeId: string) => {
    if (!detalle || !chatSeleccionadoId) return;
    setConfirmarAccion({
      titulo: '¿Reintentar envío de mensaje?',
      mensaje: '¿Deseas intentar enviar nuevamente este mensaje al cliente?',
      textoSi: 'Sí, reintentar',
      accion: async () => {
        try {
          await reintentarMensaje(chatSeleccionadoId, mensajeId);
          setPulirError(null);
          await cargarDetalle(chatSeleccionadoId);
          await cargarLista(true);
        } catch (err: any) {
          setPulirError(err?.message || 'Error al reintentar mensaje');
          await cargarDetalle(chatSeleccionadoId);
        }
      },
    });
  };

  const handleEnviarMensaje = async (textoAEnviar?: string) => {
    const txt = (textoAEnviar !== undefined ? textoAEnviar : textoMensaje).trim();
    if (!txt || !chatSeleccionadoId || enviando) return;
    setEnviando(true);
    try {
      await enviarMensaje(chatSeleccionadoId, txt);
      setTextoMensaje('');
      setTextoPulido(null);
      setPulirError(null);
      await cargarDetalle(chatSeleccionadoId);
      await cargarLista(true);
    } catch (err: any) {
      setPulirError(err?.message || 'Error al enviar mensaje');
      await cargarDetalle(chatSeleccionadoId);
      if (err?.codigo === 'VENTANA_CERRADA' || err?.message?.includes('24 horas')) {
        setConfirmarAccion({
          titulo: '¿Reabrir conversación con plantilla?',
          mensaje:
            'Pasaron mas de 24 horas desde el ultimo mensaje del cliente. Solo se puede escribir con una plantilla aprobada. ¿Deseas enviar la plantilla de reapertura?',
          textoSi: 'Sí, reabrir',
          accion: async () => {
            try {
              await reabrirConversacionPlantilla(chatSeleccionadoId);
              setTextoMensaje('');
              setTextoPulido(null);
              setPulirError(null);
              await cargarDetalle(chatSeleccionadoId);
              await cargarLista(true);
            } catch (e: any) {
              setPulirError(e?.message || 'Error al enviar la plantilla');
            }
          },
        });
      }
    } finally {
      setEnviando(false);
    }
  };

  const handlePulir = async () => {
    const raw = textoMensaje.trim();
    if (!raw) {
      setPulirError('Escribe primero tu mensaje y luego toca Pulir.');
      setTextoPulido(null);
      return;
    }
    if (!chatSeleccionadoId) return;
    try {
      const res = await pulirMensaje(chatSeleccionadoId, raw);
      setTextoPulido(res.texto);
      setPulirError(null);
    } catch (err: any) {
      setPulirError(err?.message || 'No se pudo pulir el mensaje');
    }
  };

  const handleTomarChat = async (forzar = false) => {
    if (!chatSeleccionadoId) return;
    try {
      await tomarChat(chatSeleccionadoId, forzar);
      await cargarDetalle(chatSeleccionadoId);
      await cargarLista(true);
    } catch (err: any) {
      if (err?.codigo === 'CHAT_TOMADO') {
        setConfirmarAccion({
          titulo: '¿Tomar este chat?',
          mensaje: err.message || 'Este chat lo atiende otra persona. ¿Deseas tomarlo tú?',
          textoSi: 'Sí, tomarlo',
          accion: async () => {
            await tomarChat(chatSeleccionadoId, true);
            await cargarDetalle(chatSeleccionadoId);
            await cargarLista(true);
          },
        });
      }
    }
  };

  const handleSoltarChat = async () => {
    if (!chatSeleccionadoId) return;
    try {
      await soltarChat(chatSeleccionadoId);
      await cargarDetalle(chatSeleccionadoId);
      await cargarLista(true);
    } catch {}
  };

  const handleTogglePausaBot = () => {
    if (!detalle || !chatSeleccionadoId) return;
    const pausado = detalle.estado === 'pausado';
    setConfirmarAccion({
      titulo: pausado ? '¿Reanudar el bot en este chat?' : '¿Pausar el bot en este chat?',
      mensaje: pausado
        ? 'El bot vuelve a responder solo a este cliente.'
        : `El bot deja de responder a ${detalle.nombre} hasta que lo reanudes.`,
      textoSi: pausado ? 'Sí, reanudar bot' : 'Sí, pausar bot',
      accion: async () => {
        if (pausado) await reanudarBot(chatSeleccionadoId);
        else await pausarBot(chatSeleccionadoId);
        await cargarDetalle(chatSeleccionadoId);
        await cargarLista(true);
      },
    });
  };

  const handleMarcarAtendido = () => {
    if (!detalle || !chatSeleccionadoId) return;
    setConfirmarAccion({
      titulo: `¿Marcar el chat de ${detalle.nombre} como atendido?`,
      mensaje: 'Sale de la lista de pendientes y el bot puede volver a responder.',
      textoSi: 'Sí, marcar atendido',
      accion: async () => {
        await marcarAtendido(chatSeleccionadoId);
        await cargarDetalle(chatSeleccionadoId);
        await cargarLista(true);
      },
    });
  };

  const handleAprobarPago = () => {
    if (!detalle || !chatSeleccionadoId) return;
    const tiempoMin = detalle.tiempoPrometidoMin || 25;
    setConfirmarAccion({
      titulo: `¿Aprobar el pago de ${detalle.nombre}?`,
      mensaje: `Se le avisa al cliente que el pago fue verificado y que su pedido demora unos ${tiempoMin} minutos.${detalle.altaDemanda ? ' (Alta demanda activa)' : ''}`,
      textoSi: 'Sí, aprobar pago',
      accion: async () => {
        await aprobarPagoChat(chatSeleccionadoId);
        await cargarDetalle(chatSeleccionadoId);
        await cargarLista(true);
      },
    });
  };

  const handleRechazarPago = () => {
    if (!detalle || !chatSeleccionadoId) return;
    setConfirmarAccion({
      titulo: `¿Rechazar el pago de ${detalle.nombre}?`,
      mensaje: 'Se le pide al cliente que vuelva a enviar el comprobante.',
      textoSi: 'Sí, rechazar',
      peligro: true,
      accion: async () => {
        await rechazarPagoChat(chatSeleccionadoId);
        await cargarDetalle(chatSeleccionadoId);
        await cargarLista(true);
      },
    });
  };

  const handleAplicarCambio = () => {
    if (!detalle || !chatSeleccionadoId || !detalle.solicitud) return;
    const sol = detalle.solicitud;
    const desc =
      sol.tipo === 'DIRECCION'
        ? `Se actualizará la dirección del pedido ${sol.pedido} a: ${sol.nuevaDireccion || sol.detalle}${sol.nuevaZonaNombre ? ` (${sol.nuevaZonaNombre})` : ''}${sol.recargoEnvio && sol.recargoEnvio > 0 ? ` con recargo de s/ ${sol.recargoEnvio.toFixed(2)}` : ''}. Se enviará confirmación por WhatsApp.`
        : sol.tipo === 'CANCELAR'
        ? `Se cancelará el pedido ${sol.pedido} y se notificará al cliente por WhatsApp.`
        : `Se aplicará el cambio en el pedido ${sol.pedido} y se notificará por WhatsApp.`;

    setConfirmarAccion({
      titulo: `¿Aplicar cambio en el pedido ${sol.pedido}?`,
      mensaje: desc,
      textoSi: 'Sí, aplicar cambio',
      accion: async () => {
        try {
          await aplicarCambioChat(chatSeleccionadoId);
          await cargarDetalle(chatSeleccionadoId);
          await cargarLista(true);
        } catch (err: any) {
          setPulirError(err?.message || 'Error al aplicar el cambio');
        }
      },
    });
  };

  const handleAbrirRechazarCambio = () => {
    if (!detalle?.solicitud) return;
    setModalRechazoCambio({
      abierto: true,
      motivo: '',
      enviando: false,
      error: null,
    });
  };

  const handleConfirmarRechazoCambio = async () => {
    if (!chatSeleccionadoId || !modalRechazoCambio.motivo.trim()) return;
    setModalRechazoCambio((prev) => ({ ...prev, enviando: true, error: null }));
    try {
      await rechazarCambioChat(chatSeleccionadoId, modalRechazoCambio.motivo.trim());
      setModalRechazoCambio({ abierto: false, motivo: '', enviando: false, error: null });
      await cargarDetalle(chatSeleccionadoId);
      await cargarLista(true);
    } catch (err: any) {
      setModalRechazoCambio((prev) => ({
        ...prev,
        enviando: false,
        error: err?.message || 'Error al rechazar el cambio',
      }));
    }
  };

  const handleCopiarProductos = () => {
    if (!detalle?.pedido) {
      setMensajeCopiado('Este chat no tiene un pedido armado.');
      return;
    }
    const txt = detalle.pedido.lineas.join('\n');
    try {
      navigator.clipboard.writeText(txt);
      setMensajeCopiado('Productos copiados:\n' + txt);
    } catch {
      setMensajeCopiado(txt);
    }
  };

  const handleCopiarCelular = () => {
    if (!detalle?.telefono || esUsuarioWhatsApp(detalle)) return;
    const num = detalle.telefono.replace(/\D/g, '');
    try {
      navigator.clipboard.writeText(num);
      setMensajeCopiado(`Celular copiado: ${num}`);
    } catch {
      setMensajeCopiado(`Celular: ${num}`);
    }
  };

  const toggleFullscreen = () => {
    setPantallaCompleta((prev) => !prev);
  };

  const bannerInfo = useMemo(() => {
    if (!detalle) return null;
    return BANNERS_TEXTO[detalle.estado] || BANNERS_TEXTO.bot;
  }, [detalle]);

  return (
    <div className="cv-root" data-fs={pantallaCompleta ? '1' : '0'}>
      <style>{`
        .cv-wrap{display:grid;grid-template-columns:minmax(270px,350px) 1fr;height:calc((100vh - 200px) / var(--cvz,1));min-height:340px;border:1px solid #D1D7DB;border-radius:14px;overflow:hidden;background:#fff;color:#111B21}
        .cv-list{display:flex;flex-direction:column;min-width:0;min-height:0;border-right:1px solid #E9EDEF;background:#fff}
        .cv-lhead{display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:8px 12px 2px;background:#fff}
        .cv-root[data-fs="1"]{position:fixed;inset:0;z-index:100;background:var(--cp-cream);padding:8px;box-sizing:border-box;display:flex;flex-direction:column}
        .cv-root[data-fs="1"] .cv-wrap{height:calc((100vh - 70px) / var(--cvz,1)) !important}
        .cv-title{font-family:Montserrat,sans-serif;font-weight:800;font-size:17px}
        .cv-sub{font-size:12px;color:#667781}
        .cv-search{padding:6px 12px}
        .cv-search input{width:100%;box-sizing:border-box;min-height:44px;border-radius:10px;border:0;background:#F0F2F5;padding:0 14px;font-size:14px;color:#111B21}
        .cv-tabs{display:flex;gap:6px;padding:4px 12px 8px;overflow-x:auto}
        .cv-tab{flex:none;min-height:44px;padding:0 12px;border:0;border-radius:9999px;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap}
        .cv-rows{flex:1;min-height:0;overflow-y:auto}
        .cv-row{display:flex;gap:10px;width:100%;text-align:left;border:0;border-bottom:1px solid #F0F2F5;padding:6px 12px;cursor:pointer;font-family:inherit;color:#111B21;min-height:56px}
        .cv-av{flex:none;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:14px}
        .cv-rb{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
        .cv-r1,.cv-r2{display:flex;justify-content:space-between;align-items:center;gap:8px}
        .cv-rn{font-size:15px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .cv-rt{flex:none;font-size:12px}
        .cv-last{font-size:13px;color:#667781;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .cv-badge{flex:none;min-width:20px;height:20px;border-radius:10px;background:#25D366;color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 6px;box-sizing:border-box}
        .cv-pill{align-self:flex-start;padding:1px 10px;border-radius:9999px;font-size:12px;font-weight:700;color:#111B21;white-space:nowrap}
        .cv-empty{padding:24px 16px;text-align:center;font-size:13px;color:#667781}
        .cv-chat{display:flex;flex-direction:column;min-width:0;min-height:0;background:#EFEAE2}
        .cv-chead{display:flex;align-items:center;gap:8px;padding:5px 12px;background:#F0F2F5;border-bottom:1px solid #D1D7DB}
        .cv-hb{flex:1;min-width:0;display:flex;flex-direction:column}
        .cv-hn{font-size:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .cv-hs{font-size:12px;color:#667781}
        .cv-back{display:none;flex:none;min-width:44px;min-height:44px;border:0;background:transparent;font-size:22px;color:#54656F;cursor:pointer;align-items:center;justify-content:center}
        .cv-banner{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;padding:4px 12px;font-size:12px;color:#111B21;border-bottom:1px solid #E9EDEF}
        .cv-bbtn{min-height:44px;padding:0 14px;border:1.5px solid #00A884;border-radius:9999px;background:#fff;color:#008069;font-weight:700;font-size:13px;cursor:pointer}
        .cv-owner{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;padding:4px 12px;font-size:12px;font-weight:700;border-bottom:1px solid #E9EDEF}
        .cv-owner button{min-height:44px;padding:0 14px;border:1.5px solid #54656F;border-radius:9999px;background:#fff;color:#111B21;font-weight:700;font-size:12px;cursor:pointer}
        .cv-msgs{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column-reverse;gap:3px;padding:8px 4%}
        .cv-bub{max-width:78%;border-radius:8px;padding:6px 9px 4px;box-shadow:0 1px 0.5px rgba(11,20,26,.13);font-size:14px;line-height:19px;color:#111B21}
        .cv-who{font-size:12px;font-weight:700;margin-bottom:1px}
        .cv-txt{white-space:pre-wrap;word-break:break-word}
        .cv-meta{display:flex;justify-content:flex-end;align-items:center;gap:3px;font-size:11px;color:#667781;margin-top:1px}
        .cv-ck{color:#53BDEB;font-size:12px;letter-spacing:-3px}
        .cv-img{height:84px;border-radius:6px;background:#CFD8DC;display:flex;align-items:center;justify-content:center;color:#546E7A;font-size:13px;font-weight:700;margin-bottom:4px}
        .cv-day{align-self:center;margin:6px 0}
        .cv-day span{background:#fff;border-radius:8px;padding:3px 12px;font-size:12px;color:#54656F;box-shadow:0 1px 0.5px rgba(11,20,26,.13)}
        .cv-order{margin:0 12px 6px;background:#fff;border-left:4px solid #25D366;border-radius:8px;padding:8px 12px;font-size:13px}
        .cv-total{font-weight:800;margin-top:2px}
        .cv-pay{margin:0 12px 6px;display:flex;flex-direction:column;gap:6px}
        .cv-paynote{font-size:12px;font-weight:700;color:#54656F}
        .cv-payb{display:flex;gap:8px;flex-wrap:wrap}
        .cv-ok{flex:1 1 150px;min-height:48px;border:0;border-radius:24px;background:#00A884;color:#fff;font-weight:800;font-size:14px;cursor:pointer}
        .cv-no{flex:1 1 150px;min-height:48px;border:1.5px solid #C0392B;border-radius:24px;background:#fff;color:#C0392B;font-weight:800;font-size:14px;cursor:pointer}
        .cv-quick{display:flex;gap:6px;padding:4px 12px;overflow-x:auto}
        .cv-qb{flex:none;min-height:44px;padding:0 14px;border:1px solid #D1D7DB;border-radius:9999px;background:#fff;color:#111B21;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap}
        .cv-comp{display:flex;gap:8px;align-items:center;padding:6px 12px 8px;background:#F0F2F5}
        .cv-comp input{flex:1;min-width:0;box-sizing:border-box;min-height:46px;border-radius:24px;border:0;background:#fff;padding:0 16px;font-size:15px;color:#111B21}
        .cv-polbtn{flex:none;min-height:46px;padding:0 14px;border:1.5px solid #00A884;border-radius:24px;background:#fff;color:#008069;font-weight:700;font-size:13px;cursor:pointer}
        .cv-send{flex:none;width:46px;height:46px;border:0;border-radius:50%;background:#00A884;display:flex;align-items:center;justify-content:center;cursor:pointer}
        .cv-more{background:#F0F2F5;border-top:1px solid #E9EDEF;font-size:13px}
        .cv-more summary{min-height:44px;display:flex;align-items:center;padding:0 14px;cursor:pointer;color:#54656F;font-weight:600}
        .cv-moreb{display:flex;gap:6px;flex-wrap:wrap;padding:0 12px 8px}
        .cv-moreb button,.cv-moreb a{min-height:44px;padding:0 14px;border:1px solid #D1D7DB;border-radius:10px;background:#fff;color:#111B21;font-weight:600;font-size:13px;display:flex;align-items:center;text-decoration:none;cursor:pointer;box-sizing:border-box}
        .cv-pol{margin:0 12px 6px;background:#fff;border-left:4px solid #00A884;border-radius:8px;padding:8px 12px;font-size:13px;display:flex;flex-direction:column;gap:6px}
        .cv-pollbl{font-size:12px;font-weight:700;color:#54656F}
        .cv-polx{white-space:pre-wrap;line-height:19px}
        .cv-polb{display:flex;gap:8px;flex-wrap:wrap}
        .cv-zb{min-width:44px;min-height:44px;border:1.5px solid var(--cp-navy);border-radius:10px;background:var(--cp-white);color:var(--cp-navy);font-weight:800;font-size:15px;cursor:pointer}
        @media (max-width:760px){
          .cv-wrap{grid-template-columns:1fr;height:calc((100vh - 230px) / var(--cvz,1))}
          .cv-wrap[data-open="0"] .cv-chat{display:none}
          .cv-wrap[data-open="1"] .cv-list{display:none}
          .cv-back{display:flex}
          .cv-msgs{padding:12px 3%}
          .cv-bub{max-width:88%}
        }
      `}</style>

      {/* Controles de Vista: Zoom y Pantalla completa */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '8px',
          flexWrap: 'wrap',
          marginBottom: '6px',
        }}
      >
        <button
          className="cv-zb"
          aria-pressed={pantallaCompleta}
          style={{ padding: '0 12px', fontSize: '13px' }}
          onClick={toggleFullscreen}
        >
          {pantallaCompleta ? 'Salir de pantalla completa' : 'Pantalla completa'}
        </button>
        <div role="group" aria-label="Tamaño de la vista" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-soft)' }}>Zoom</span>
          <button className="cv-zb" aria-label="Alejar" onClick={() => setZoom((z) => Math.max(60, z - 10))}>
            −
          </button>
          <button
            className="cv-zb"
            aria-label="Restablecer el tamaño"
            style={{ minWidth: '60px' }}
            onClick={() => setZoom(85)}
          >
            {zoom}%
          </button>
          <button className="cv-zb" aria-label="Acercar" onClick={() => setZoom((z) => Math.min(120, z + 10))}>
            +
          </button>
        </div>
      </div>

      {/* Contenedor Principal */}
      <div
        className="cv-wrap"
        data-open={chatAbiertoMovil ? '1' : '0'}
        style={{ '--cvz': zoom / 100, zoom: zoom / 100 } as React.CSSProperties}
      >
        {/* Columna Izquierda: Lista de Chats */}
        <div className="cv-list">
          <div className="cv-lhead">
            <span className="cv-title">Chats</span>
            <span className="cv-sub">
              {conteos.atender === 0 ? 'Todo al día' : `${conteos.atender} por atender`}
            </span>
          </div>

          <div className="cv-search">
            <input
              type="text"
              placeholder="Buscar un chat o un celular"
              aria-label="Buscar un chat"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          <div className="cv-tabs">
            {[
              { id: 'todos', label: 'Todos', count: conteos.todos },
              { id: 'atender', label: 'Por atender', count: conteos.atender },
              { id: 'bot', label: 'Con el bot', count: conteos.bot },
              { id: 'atendidos', label: 'Atendidos', count: conteos.atendidos },
            ].map((tab) => (
              <button
                key={tab.id}
                className="cv-tab"
                style={{
                  background: filtro === tab.id ? '#D9FDD3' : '#F0F2F5',
                  color: filtro === tab.id ? '#005C4B' : '#54656F',
                }}
                onClick={() => setFiltro(tab.id as FiltroChat)}
              >
                {tab.label} <b>{tab.count}</b>
              </button>
            ))}
          </div>

          <div className="cv-rows">
            {cargando ? (
              <div className="cv-empty">Cargando conversaciones...</div>
            ) : chatsOrdenados.length === 0 ? (
              <div className="cv-empty">No hay conversaciones en esta pestaña.</div>
            ) : (
              chatsOrdenados.map((c) => {
                const seleccionado = c.id === chatSeleccionadoId;
                const tieneSinLeer = c.sinLeer > 0;
                return (
                  <button
                    key={c.id}
                    className="cv-row"
                    style={{
                      background: seleccionado ? '#F0F2F5' : '#FFFFFF',
                    }}
                    onClick={() => {
                      setChatSeleccionadoId(c.id);
                      setChatAbiertoMovil(true);
                    }}
                  >
                    <span className="cv-av" style={{ background: obtenerColorAvatar(c.id) }}>
                      {obtenerIniciales(c.nombre)}
                    </span>
                    <span className="cv-rb">
                      <span className="cv-r1">
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                          <b className="cv-rn">{c.nombre}</b>
                          {esUsuarioWhatsApp(c) && (
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: '10px',
                                background: '#E0F2FE',
                                color: '#0369A1',
                                border: '1px solid #BAE6FD',
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                              }}
                            >
                              Usuario de WhatsApp
                            </span>
                          )}
                        </span>
                        <span
                          className="cv-rt"
                          style={{ color: tieneSinLeer ? '#00A884' : '#667781' }}
                        >
                          {c.hora}
                        </span>
                      </span>
                      <span className="cv-r2">
                        <span className="cv-last">{c.ultimo}</span>
                        {tieneSinLeer && <span className="cv-badge">{c.sinLeer}</span>}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span
                          className="cv-pill"
                          style={{
                            background: c.urgente ? '#F8C9C9' : ESTADOS_BG[c.estado] || '#F0F2F5',
                          }}
                        >
                          {c.urgente ? `URGENTE · ${ESTADOS_LABEL[c.estado]}` : ESTADOS_LABEL[c.estado]}
                        </span>
                        {c.esperaMin !== undefined && c.esperaMin !== null && (
                          <span
                            data-testid={`espera-badge-${c.id}`}
                            className="cv-espera-badge"
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '10px',
                              background: obtenerEstiloEspera(c.esperaMin).fondo,
                              border: obtenerEstiloEspera(c.esperaMin).borde,
                              color: obtenerEstiloEspera(c.esperaMin).color,
                              display: 'inline-flex',
                              alignItems: 'center',
                              whiteSpace: 'nowrap',
                            }}
                            title={`Tiempo de espera: ${c.esperaMin} minutos`}
                          >
                            Espera: {c.esperaMin} min
                          </span>
                        )}
                      </div>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Columna Derecha: Conversación */}
        <div className="cv-chat">
          {!chatSeleccionadoId || (!detalle && cargandoDetalle) ? (
            <div className="cv-empty" style={{ margin: 'auto' }}>
              {cargandoDetalle ? 'Cargando conversación...' : 'Selecciona un chat para ver la conversación'}
            </div>
          ) : !detalle ? (
            <div className="cv-empty" style={{ margin: 'auto' }}>
              No se pudo cargar la conversación.
            </div>
          ) : (
            <>
              {/* Cabecera del Chat */}
              <div className="cv-chead">
                <button
                  className="cv-back"
                  aria-label="Volver a la lista de chats"
                  onClick={() => setChatAbiertoMovil(false)}
                >
                  ←
                </button>
                <span className="cv-av" style={{ background: obtenerColorAvatar(detalle.id) }}>
                  {obtenerIniciales(detalle.nombre)}
                </span>
                <span className="cv-hb">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <b className="cv-hn">{detalle.nombre}</b>
                    {esUsuarioWhatsApp(detalle) && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: '#E0F2FE',
                          color: '#0369A1',
                          border: '1px solid #BAE6FD',
                        }}
                      >
                        Usuario de WhatsApp
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setModalEditarAbierto(true)}
                      title="Editar nombre"
                      aria-label="Editar nombre"
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid var(--cp-line, #CBD5E1)',
                        borderRadius: '6px',
                        padding: '2px 8px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--cp-navy, #0B2C3E)',
                      }}
                    >
                      <IconoLapiz tamano={13} />
                      <span>Editar nombre</span>
                    </button>
                  </span>
                  <span className="cv-hs">
                    {esUsuarioWhatsApp(detalle) ? 'Usuario de WhatsApp' : detalle.telefono}
                    {detalle.modalidad ? ` · ${detalle.modalidad}` : ''}
                  </span>
                </span>
                <span
                  className="cv-pill"
                  style={{
                    background: detalle.urgente ? '#F8C9C9' : ESTADOS_BG[detalle.estado] || '#F0F2F5',
                  }}
                >
                  {detalle.urgente ? `URGENTE · ${ESTADOS_LABEL[detalle.estado]}` : ESTADOS_LABEL[detalle.estado]}
                </span>
              </div>

              {/* Modo Simulado Banner */}
              {detalle.simulado && (
                <div
                  role="status"
                  className="cv-banner"
                  style={{ background: '#FFF7ED', color: '#9A3412', borderBottom: '1px solid #FED7AA' }}
                >
                  <span>Modo simulado: no se envia a WhatsApp</span>
                </div>
              )}

              {/* Ventana de 24 horas cerrada Banner */}
              {detalle.ventanaAbierta === false && (
                <div
                  role="status"
                  className="cv-banner"
                  style={{ background: '#FEF3C7', color: '#92400E', borderBottom: '1px solid #FDE68A' }}
                >
                  <span>
                    Pasaron mas de 24 horas desde el ultimo mensaje del cliente. Solo se puede escribir con una plantilla aprobada.
                  </span>
                  <button
                    type="button"
                    className="cv-bbtn"
                    style={{ borderColor: '#B45309', color: '#B45309' }}
                    onClick={handleReabrirPlantilla}
                  >
                    Reabrir con plantilla
                  </button>
                </div>
              )}

              {/* Motivo de derivación si existe */}
              {detalle.motivoDerivacion && (
                <div
                  role="status"
                  className="cv-banner"
                  style={{ background: '#FFF1C9', color: '#8A5800', borderBottom: '1px solid #FFE29A', fontWeight: 600 }}
                  data-testid="banner-motivo-derivacion"
                >
                  <span>⚠️ Derivado a asesor: {detalle.motivoDerivacion}</span>
                </div>
              )}

              {/* Banner Informativo */}
              {bannerInfo && (
                <div className="cv-banner" style={{ background: bannerInfo[1] }}>
                  <span>{bannerInfo[0]}</span>
                  <button className="cv-bbtn" onClick={handleTogglePausaBot}>
                    {detalle.estado === 'pausado' ? 'Reanudar el bot' : 'Pausar el bot'}
                  </button>
                </div>
              )}

              {/* Control de Dueño / Tomar Chat */}
              <div className="cv-owner">
                <span>
                  {detalle.dueno
                    ? detalle.esMio
                      ? 'Lo atiendes tú: el bot no responde en este chat.'
                      : `Lo atiende ${detalle.dueno}: el bot no responde y tú no puedes escribir.`
                    : 'Chat libre: el bot atiende automáticamente.'}
                </span>
                <button onClick={() => (detalle.esMio ? handleSoltarChat() : handleTomarChat(false))}>
                  {detalle.esMio ? 'Soltar el chat' : 'Tomar el chat'}
                </button>
              </div>

              {/* Mensajes del Chat */}
              <div className="cv-msgs">
                {detalle.mensajes
                  .slice()
                  .reverse()
                  .map((m) => {
                    const esCliente = m.autor === 'CLIENTE';
                    const esBot = m.autor === 'BOT';
                    const bg = esCliente ? '#FFFFFF' : esBot ? '#E1F3FB' : '#D9FDD3';
                    const alineacion = esCliente ? 'flex-start' : 'flex-end';
                    return (
                      <div
                        key={m.id}
                        className="cv-bub"
                        style={{ alignSelf: alineacion, background: bg }}
                      >
                        {!esCliente && (
                          <div
                            className="cv-who"
                            style={{ color: esBot ? '#1F7A8C' : '#008069' }}
                          >
                            {esBot ? 'Capri (bot)' : 'Equipo'}
                          </div>
                        )}
                        {m.imagen && (
                          <FotoMensaje
                            archivoId={m.imagenId}
                            voucher={
                              m.imagenId &&
                              detalle?.voucher?.archivoId &&
                              String(m.imagenId) === String(detalle.voucher.archivoId)
                                ? detalle.voucher
                                : undefined
                            }
                            puedeVer={tieneVouchersVer}
                          />
                        )}
                        <div className="cv-txt">{m.texto}</div>
                        <div className="cv-meta" style={{ flexWrap: 'wrap', gap: '6px' }}>
                          <span>{m.hora}</span>
                          {!esCliente && (
                            <>
                              {m.estado === 'FALLIDO' ? (
                                <span
                                  style={{
                                    color: '#C0392B',
                                    fontWeight: 700,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                  }}
                                >
                                  <span>
                                    {m.motivoFallo
                                      ? `No se pudo enviar: ${m.motivoFallo}`
                                      : 'No se pudo enviar'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleReintentarMensaje(m.id)}
                                    style={{
                                      border: '1px solid #C0392B',
                                      background: '#FFFFFF',
                                      color: '#C0392B',
                                      borderRadius: '4px',
                                      padding: '1px 6px',
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Reintentar
                                  </button>
                                </span>
                              ) : m.estado === 'SIMULADO' ? (
                                <span style={{ color: '#667781' }}>
                                  Modo simulado: no se envia a WhatsApp
                                </span>
                              ) : m.estado === 'LEIDO' ? (
                                <span style={{ color: '#0284C7', fontWeight: 600 }}>Leido</span>
                              ) : m.estado === 'ENTREGADO' ? (
                                <span style={{ color: '#667781' }}>Entregado</span>
                              ) : (
                                <span style={{ color: '#667781' }}>Enviado</span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                <div className="cv-day">
                  <span>HOY</span>
                </div>
              </div>

              {/* Solicitud de cambio si existe */}
              {detalle.solicitud && (
                <div className="cv-order" style={{ borderLeftColor: '#E67929' }} data-testid="seccion-solicitud-cambio">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <b style={{ color: '#C05621' }}>
                      Solicitud de {detalle.solicitud.tipo === 'DIRECCION' ? 'cambio de dirección' : detalle.solicitud.tipo === 'CANCELAR' ? 'cancelación' : 'cambio de pedido'}
                    </b>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '10px',
                        background: detalle.solicitud.estadoSolicitud === 'APLICADA' ? '#D1FAE5' : detalle.solicitud.estadoSolicitud === 'RECHAZADA' ? '#FEE2E2' : '#FEF3C7',
                        color: detalle.solicitud.estadoSolicitud === 'APLICADA' ? '#065F46' : detalle.solicitud.estadoSolicitud === 'RECHAZADA' ? '#991B1B' : '#92400E',
                      }}
                    >
                      {detalle.solicitud.estadoSolicitud || 'PENDIENTE'}
                    </span>
                  </div>
                  <div><b>Detalle:</b> {detalle.solicitud.detalle}</div>
                  {detalle.solicitud.nuevaDireccion && (
                    <div style={{ marginTop: '2px' }}>
                      <b>Nueva dirección:</b> {detalle.solicitud.nuevaDireccion}
                    </div>
                  )}
                  {detalle.solicitud.nuevaReferencia && (
                    <div style={{ color: '#54656F', fontSize: '13px' }}>
                      Ref: {detalle.solicitud.nuevaReferencia}
                    </div>
                  )}
                  {detalle.solicitud.nuevaZonaNombre && (
                    <div style={{ marginTop: '2px', fontSize: '13px', color: '#1E293B' }}>
                      <b>Zona:</b> {detalle.solicitud.nuevaZonaNombre}
                      {detalle.solicitud.recargoEnvio !== undefined && detalle.solicitud.recargoEnvio !== null && detalle.solicitud.recargoEnvio > 0 ? (
                        <span style={{ color: '#C05621', fontWeight: 600 }}>
                          {' '}(Recargo: +s/ {Number(detalle.solicitud.recargoEnvio).toFixed(2)} · Envío nuevo: s/ {Number(detalle.solicitud.nuevoEnvio || 0).toFixed(2)})
                        </span>
                      ) : null}
                    </div>
                  )}
                  <div style={{ color: '#54656F', fontSize: '12px', marginTop: '4px' }}>
                    Pedido {detalle.solicitud.pedido} · Estado pedido: {detalle.solicitud.estadoPedido} · Solicitado a las {detalle.solicitud.hora}
                  </div>
                  {(!detalle.solicitud.estadoSolicitud || detalle.solicitud.estadoSolicitud === 'PENDIENTE') && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                      <button
                        className="cv-ok"
                        style={{ padding: '6px 12px', fontSize: '13px' }}
                        onClick={handleAplicarCambio}
                      >
                        Aplicar cambio
                      </button>
                      <button
                        className="cv-no"
                        style={{ padding: '6px 12px', fontSize: '13px' }}
                        onClick={handleAbrirRechazarCambio}
                      >
                        Rechazar cambio
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Solicitud de reserva si existe */}
              {detalle.solicitudReserva && (
                <div className="cv-order" style={{ borderLeftColor: '#E67929' }}>
                  <b>Solicitud de reserva pendiente</b>
                  <div>
                    {detalle.solicitudReserva.personas} personas · {detalle.solicitudReserva.fecha} a las {detalle.solicitudReserva.hora}
                  </div>
                  {detalle.solicitudReserva.nota && (
                    <div style={{ fontSize: '13px', color: '#54656F' }}>
                      Nota: {detalle.solicitudReserva.nota}
                    </div>
                  )}
                  <div style={{ marginTop: '6px' }}>
                    <a
                      href="/admin/reservas"
                      style={{
                        color: 'var(--cp-navy)',
                        fontWeight: 700,
                        textDecoration: 'underline',
                        fontSize: '13px',
                      }}
                    >
                      Ver y gestionar en Reservas
                    </a>
                  </div>
                </div>
              )}

              {/* Pedido armado si existe */}
              {detalle.pedido && (
                <div className="cv-order">
                  <b>Pedido armado</b>
                  {detalle.pedido.lineas.map((linea, idx) => (
                    <div key={idx}>{linea}</div>
                  ))}
                  <div className="cv-total">Total s/ {detalle.pedido.total}</div>
                </div>
              )}

              {/* Acciones de Validar Pago */}
              {detalle.estado === 'validar' && detalle.pedido && (
                <div className="cv-pay">
                  <div className="cv-paynote">
                    {detalle.altaDemanda
                      ? `Alta demanda activa: el tiempo prometido es de ${detalle.tiempoPrometidoMin || 25} minutos.`
                      : `Tiempo prometido: ${detalle.tiempoPrometidoMin || 25} minutos.`}
                  </div>

                  {/* Lectura del voucher con IA si existe voucher en la conversación */}
                  {detalle.voucher?.archivoId && tieneVouchersVer && (
                    <FotoAmpliable archivoId={detalle.voucher.archivoId} alt="Comprobante de pago" alturaMaxima={220} />
                  )}
                  {detalle.voucher && (
                    <TarjetaLecturaVoucher
                      voucher={detalle.voucher}
                      pedido={detalle.pedido}
                      puedeVer={tieneVouchersVer}
                    />
                  )}

                  <div className="cv-payb">
                    <button className="cv-ok" onClick={handleAprobarPago}>
                      Aprobar el pago
                    </button>
                    <button className="cv-no" onClick={handleRechazarPago}>
                      Rechazar
                    </button>
                  </div>
                </div>
              )}

              {/* Respuestas rápidas */}
              <div className="cv-quick">
                {respuestasRapidas.map((q) => (
                  <button
                    key={q.id}
                    className="cv-qb"
                    onClick={() => setTextoMensaje(q.texto)}
                  >
                    {q.titulo}
                  </button>
                ))}
              </div>

              {/* Vista previa de Pulir Mensaje */}
              {textoPulido && (
                <div className="cv-pol" role="status">
                  <div className="cv-pollbl">Así quedaría tu mensaje, más amable y bien escrito:</div>
                  <div className="cv-polx">{textoPulido}</div>
                  <div className="cv-polb">
                    <button
                      className="cv-ok"
                      style={{ minHeight: '44px' }}
                      onClick={() => {
                        setTextoMensaje(textoPulido);
                        setTextoPulido(null);
                        setPulirError(null);
                      }}
                    >
                      Usar este texto
                    </button>
                    <button
                      className="cv-no"
                      style={{ minHeight: '44px', borderColor: '#54656F', color: '#54656F' }}
                      onClick={() => setTextoPulido(null)}
                    >
                      Dejar el mío
                    </button>
                  </div>
                </div>
              )}

              {pulirError && (
                <div role="status" style={{ padding: '0 14px 4px', fontSize: '12px', fontWeight: 700, color: '#C0392B' }}>
                  {pulirError}
                </div>
              )}

              {/* Compositor de mensaje */}
              {!detalle.telefono || !detalle.telefono.trim() ? (
                <div
                  role="alert"
                  style={{
                    padding: '12px 16px',
                    margin: '8px 14px',
                    borderRadius: '10px',
                    background: 'var(--cp-sand, #F8FAFC)',
                    color: 'var(--cp-navy, #0B2C3E)',
                    fontSize: '13px',
                    fontWeight: 600,
                    border: '1px solid var(--cp-line, #CBD5E1)',
                  }}
                >
                  Este contacto no tiene ningun identificador: no se puede responder
                </div>
              ) : (
                <div className="cv-comp">
                  <input
                    type="text"
                    placeholder="Escribe un mensaje"
                    aria-label="Escribe un mensaje"
                    value={textoMensaje}
                    disabled={detalle.ocupado}
                    onChange={(e) => setTextoMensaje(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleEnviarMensaje();
                    }}
                  />
                  <button
                    className="cv-polbtn"
                    aria-label="Pulir el mensaje para que sea más amable"
                    disabled={detalle.ocupado}
                    onClick={handlePulir}
                  >
                    Pulir
                  </button>
                  <button
                    className="cv-send"
                    aria-label="Enviar mensaje"
                    disabled={detalle.ocupado || enviando}
                    onClick={() => handleEnviarMensaje()}
                  >
                    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                      <path d="M3 20l18-8L3 4v6l11 2-11 2z" fill="#fff" />
                    </svg>
                  </button>
                </div>
              )}

              {/* Menú Más Acciones */}
              <details className="cv-more">
                <summary>Más acciones</summary>
                <div className="cv-moreb">
                  {detalle.estado !== 'atendido' && (
                    <button onClick={handleMarcarAtendido}>Marcar atendido</button>
                  )}
                  <button onClick={handleCopiarProductos}>Copiar solo productos</button>
                  {!esUsuarioWhatsApp(detalle) && (
                    <>
                      <button onClick={handleCopiarCelular}>Copiar celular</button>
                      <a
                        href={`https://wa.me/51${detalle.telefono.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Abrir en WhatsApp
                      </a>
                    </>
                  )}
                </div>
                {mensajeCopiado && (
                  <div
                    role="status"
                    style={{
                      whiteSpace: 'pre-line',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: 'var(--cp-green)',
                      padding: '0 10px 8px',
                    }}
                  >
                    {mensajeCopiado}
                  </div>
                )}
              </details>
            </>
          )}
        </div>
      </div>

      {/* Modal Confirmar Acción */}
      {confirmarAccion && (
        <Confirmar
          abierto={true}
          titulo={confirmarAccion.titulo}
          mensaje={confirmarAccion.mensaje}
          textoSi={confirmarAccion.textoSi}
          peligro={confirmarAccion.peligro}
          alConfirmar={async () => {
            const acc = confirmarAccion.accion;
            setConfirmarAccion(null);
            await acc();
          }}
          alCancelar={() => setConfirmarAccion(null)}
        />
      )}

      {/* Modal Editar Nombre */}
      {detalle && (
        <ModalEditarNombre
          abierto={modalEditarAbierto}
          conversacionId={detalle.id}
          nombreActual={detalle.nombre}
          nombreEditado={Boolean(detalle.nombre_editado)}
          nombrePerfilWa={detalle.nombre_contacto}
          alCerrar={() => setModalEditarAbierto(false)}
          alGuardar={handleGuardarNombre}
          alRevertir={handleRevertirNombre}
        />
      )}

      {/* Modal Rechazar Solicitud de Cambio */}
      {modalRechazoCambio.abierto && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '440px',
              width: '90%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 700, color: 'var(--cp-navy, #0B2C3E)' }}>
              ¿Rechazar solicitud de cambio?
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#64748B' }}>
              Ingresa el motivo del rechazo. Este motivo se enviará al cliente por WhatsApp con honestidad y empatía.
            </p>
            <textarea
              rows={3}
              value={modalRechazoCambio.motivo}
              onChange={(e) => setModalRechazoCambio((prev) => ({ ...prev, motivo: e.target.value }))}
              placeholder="Ej. El pedido ya está empacado y en la puerta para salir..."
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '14px',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                resize: 'vertical',
              }}
            />
            {modalRechazoCambio.error && (
              <div style={{ color: '#DC2626', fontSize: '13px', marginTop: '6px' }}>
                {modalRechazoCambio.error}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button
                type="button"
                onClick={() => setModalRechazoCambio({ abierto: false, motivo: '', enviando: false, error: null })}
                style={{
                  background: 'transparent',
                  border: '1px solid #CBD5E1',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: '#475569',
                }}
              >
                No, cancelar
              </button>
              <button
                type="button"
                disabled={!modalRechazoCambio.motivo.trim() || modalRechazoCambio.enviando}
                onClick={handleConfirmarRechazoCambio}
                style={{
                  background: '#DC2626',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: modalRechazoCambio.motivo.trim() && !modalRechazoCambio.enviando ? 'pointer' : 'not-allowed',
                  opacity: modalRechazoCambio.motivo.trim() && !modalRechazoCambio.enviando ? 1 : 0.6,
                }}
              >
                {modalRechazoCambio.enviando ? 'Rechazando...' : 'Sí, rechazar cambio'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Mensajes: pestaña Chats (conversaciones con el cliente) y pestaña Salientes (cola de WhatsApp que sale
 * sola, con los fallidos para reenviar o descartar). La pestaña solo aparece con el permiso de ver salientes.
 */
export function MensajesView() {
  let puedeSalientes = false;
  try {
    const sesion = useSesion();
    puedeSalientes =
      Boolean(sesion?.tiene?.('whatsapp_salientes/ver')) ||
      sesion?.usuario?.rol === 'ADMIN' ||
      sesion?.usuario?.rol === 'CAJERO';
  } catch {
    puedeSalientes = false;
  }

  const [vista, setVista] = useState<'chats' | 'salientes'>(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('vista') === 'salientes'
      ? 'salientes'
      : 'chats',
  );
  const [fallidos, setFallidos] = useState(0);

  useEffect(() => {
    if (!puedeSalientes) return;
    let activo = true;
    const cargar = () =>
      salientesApi
        .resumen()
        .then((r) => {
          if (activo) setFallidos(r.fallidos);
        })
        .catch(() => {});
    void cargar();
    const cada = setInterval(() => void cargar(), 20000);
    return () => {
      activo = false;
      clearInterval(cada);
    };
  }, [puedeSalientes]);

  if (!puedeSalientes) return <MensajesChats />;

  const estiloTab = (activa: boolean) => ({
    minHeight: 36,
    padding: '0 12px',
    borderRadius: 10,
    border: 'none',
    background: activa ? '#D9FDD3' : '#F0F2F5',
    color: activa ? '#005C4B' : '#54656F',
    fontWeight: 700,
    cursor: 'pointer',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div role="tablist" aria-label="Vista de Mensajes" style={{ display: 'flex', gap: 6, padding: '6px 8px' }}>
        <button role="tab" aria-selected={vista === 'chats'} style={estiloTab(vista === 'chats')} onClick={() => setVista('chats')}>
          Chats
        </button>
        <button
          role="tab"
          aria-selected={vista === 'salientes'}
          style={estiloTab(vista === 'salientes')}
          onClick={() => setVista('salientes')}
        >
          Salientes {fallidos > 0 && <b>({fallidos} fallido{fallidos === 1 ? '' : 's'})</b>}
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>{vista === 'chats' ? <MensajesChats /> : <SalientesWhatsApp />}</div>
    </div>
  );
}
