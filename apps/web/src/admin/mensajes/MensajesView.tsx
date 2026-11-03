import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Confirmar } from '../../comun/Confirmar';
import { useEventos } from '../../comun/socket';
import {
  aplicarCambioChat,
  aprobarPagoChat,
  desbloquearSpam,
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
import { ModalEditarNombre } from './ModalEditarNombre';
import { useSesion } from '../../comun/sesion';
import { ModalDesbloquearSpam } from './BloqueoSpam';
import { salientesApi } from './salientesApi';
import { SalientesWhatsApp } from './SalientesWhatsApp';
import { ChatResumen, DetalleConversacion, FiltroChat, RespuestaRapida } from './mensajesTipos';
import { BannerCajaCerrada } from '../pedidos/BannerCajaCerrada';
import { tieneRolUsuario } from '../../comun/rolesUsuario';
import { ListaChats } from './ListaChats';
import { CabeceraChat } from './CabeceraChat';
import { AvisosChat } from './AvisosChat';
import { FlujoMensajes } from './FlujoMensajes';
import { PanelPedido } from './PanelPedido';
import { CuadroEscribir } from './CuadroEscribir';
import { MasAcciones } from './MasAcciones';
import { ModalRechazoCambio } from './ModalRechazoCambio';
import { esUsuarioWhatsApp, telefonoDeUrl } from './utilidadesChat';

export { obtenerEstiloEspera, SIN_RESPUESTA_MIN_VISIBLE } from './utilidadesChat';

function MensajesChats({ controles }: { controles?: React.ReactNode } = {}) {
  let tieneVouchersVer = true;
  let puedeDesbloquear = false;
  try {
    const sesion = useSesion();
    puedeDesbloquear = Boolean(sesion?.tiene?.('mensajes/enviar'));
    tieneVouchersVer =
      Boolean(sesion?.tiene?.('vouchers/ver')) ||
      sesion?.usuario?.rol === 'ADMIN' ||
      tieneRolUsuario(sesion?.usuario, 'CAJERO');
  } catch {
    tieneVouchersVer = true;
  }

  const [cargando, setCargando] = useState(true);
  const [chats, setChats] = useState<ChatResumen[]>([]);
  const [conteos, setConteos] = useState({ todos: 0, atender: 0, bot: 0, atendidos: 0, bloqueadosSpam: 0 });
  const [filtro, setFiltro] = useState<FiltroChat>('todos');
  const [soloBloqueados, setSoloBloqueados] = useState(false);
  const [modalDesbloqueo, setModalDesbloqueo] = useState(false);

  const chatsOrdenados = useMemo(() => {
    const base = soloBloqueados ? chats.filter((c) => c.bloqueoSpam?.activo) : chats;
    if (filtro === 'atender') {
      return [...base].sort((a, b) => {
        const esperaA = typeof a.esperaMin === 'number' ? a.esperaMin : -1;
        const esperaB = typeof b.esperaMin === 'number' ? b.esperaMin : -1;
        return esperaB - esperaA;
      });
    }
    return base;
  }, [chats, filtro, soloBloqueados]);
  // Desde Pedidos (?telefono=) el chat del cliente se busca y se abre solo al cargar la lista
  const telefonoPendiente = React.useRef<string>(telefonoDeUrl());
  const [busqueda, setBusqueda] = useState(() => telefonoPendiente.current);
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
      setConteos({ bloqueadosSpam: 0, ...res.conteos });

      const pendiente = telefonoPendiente.current;
      const delCliente = pendiente
        ? res.chats.find((c) => c.telefono.replace(/\D/g, '').endsWith(pendiente))
        : undefined;
      if (pendiente) telefonoPendiente.current = '';

      if (delCliente) {
        setChatSeleccionadoId(delCliente.id);
      } else if (res.chats.length > 0) {
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

  // El bloqueo por spam caduca solo: al llegar su hora se vuelve a leer, sin esperar un evento
  const vencimientosSpam = [...chats.map((c) => c.bloqueoSpam), detalle?.bloqueoSpam]
    .filter((b) => b?.activo && b.hastaEn)
    .map((b) => b!.hastaEn as string)
    .join('|');
  useEffect(() => {
    if (!vencimientosSpam) return;
    const proximo = Math.min(...vencimientosSpam.split('|').map((h) => new Date(h).getTime()));
    const espera = Math.min(Math.max(proximo - Date.now() + 1000, 1000), 2_000_000_000);
    const t = setTimeout(() => {
      void cargarLista(true);
      if (chatSeleccionadoId) void cargarDetalle(chatSeleccionadoId);
    }, espera);
    return () => clearTimeout(t);
  }, [vencimientosSpam, cargarLista, cargarDetalle, chatSeleccionadoId]);

  const handleDesbloquearSpam = async (motivo: string) => {
    if (!chatSeleccionadoId) return;
    await desbloquearSpam(chatSeleccionadoId, motivo);
    setModalDesbloqueo(false);
    await cargarDetalle(chatSeleccionadoId);
    await cargarLista(true);
  };

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
    } catch { /* best-effort: el refresco es opcional, la vista ya cargo */ }
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
        .cv-chat{display:flex;flex-direction:column;min-width:0;min-height:0;overflow:hidden;background:#EFEAE2}
        .cv-panels{flex:0 1 auto;max-height:34%;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding-top:6px}
        .cv-chat>*{flex-shrink:0}
        .cv-chat>.cv-msgs,.cv-chat>.cv-panels{flex-shrink:1}
        .cv-chead{display:flex;align-items:center;gap:8px;padding:5px 12px;background:#F0F2F5;border-bottom:1px solid #D1D7DB}
        .cv-hb{flex:1;min-width:0;display:flex;flex-direction:column}
        .cv-hn{font-size:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .cv-hs{font-size:12px;color:#667781}
        .cv-back{display:none;flex:none;min-width:44px;min-height:44px;border:0;background:transparent;font-size:22px;color:#54656F;cursor:pointer;align-items:center;justify-content:center}
        .cv-banner{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;padding:4px 12px;font-size:12px;color:#111B21;border-bottom:1px solid #E9EDEF}
        .cv-bbtn{min-height:44px;padding:0 14px;border:1.5px solid #00A884;border-radius:9999px;background:#fff;color:#008069;font-weight:700;font-size:13px;cursor:pointer}
        .cv-owner{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;padding:4px 12px;font-size:12px;font-weight:700;border-bottom:1px solid #E9EDEF}
        .cv-owner button{min-height:44px;padding:0 14px;border:1.5px solid #54656F;border-radius:9999px;background:#fff;color:#111B21;font-weight:700;font-size:12px;cursor:pointer}
        .cv-msgs{flex:1 1 0;min-height:140px;overflow-y:auto;overscroll-behavior:contain;display:flex;flex-direction:column-reverse;gap:3px;padding:8px 4%}
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
        .cv-more{max-height:40%;overflow-y:auto;background:#F0F2F5;border-top:1px solid #E9EDEF;font-size:13px}
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
        <ListaChats
          controles={controles}
          conteos={conteos}
          busqueda={busqueda}
          onBuscar={setBusqueda}
          filtro={filtro}
          onFiltro={setFiltro}
          soloBloqueados={soloBloqueados}
          onToggleSoloBloqueados={() => setSoloBloqueados((v) => !v)}
          cargando={cargando}
          chats={chatsOrdenados}
          chatSeleccionadoId={chatSeleccionadoId}
          onSeleccionar={(id) => {
            setChatSeleccionadoId(id);
            setChatAbiertoMovil(true);
          }}
        />

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
              <CabeceraChat
                detalle={detalle}
                puedeDesbloquear={puedeDesbloquear}
                onVolver={() => setChatAbiertoMovil(false)}
                onEditarNombre={() => setModalEditarAbierto(true)}
                onDesbloquear={() => setModalDesbloqueo(true)}
              />
              <AvisosChat
                detalle={detalle}
                onReabrirPlantilla={handleReabrirPlantilla}
                onTogglePausaBot={handleTogglePausaBot}
                onTomarChat={() => handleTomarChat(false)}
                onSoltarChat={handleSoltarChat}
              />
              <FlujoMensajes
                mensajes={detalle.mensajes}
                voucher={detalle.voucher}
                puedeVer={tieneVouchersVer}
                onReintentar={handleReintentarMensaje}
              />
              <PanelPedido
                detalle={detalle}
                tieneVouchersVer={tieneVouchersVer}
                onAplicarCambio={handleAplicarCambio}
                onAbrirRechazarCambio={handleAbrirRechazarCambio}
                onAprobarPago={handleAprobarPago}
                onRechazarPago={handleRechazarPago}
                onRecargar={cargarDetalle}
              />
              <CuadroEscribir
                detalle={detalle}
                respuestasRapidas={respuestasRapidas}
                textoMensaje={textoMensaje}
                onCambiarTexto={setTextoMensaje}
                textoPulido={textoPulido}
                pulirError={pulirError}
                enviando={enviando}
                onElegirRapida={setTextoMensaje}
                onPulir={handlePulir}
                onUsarPulido={(texto) => {
                  setTextoMensaje(texto);
                  setTextoPulido(null);
                  setPulirError(null);
                }}
                onDejarPulido={() => setTextoPulido(null)}
                onEnviar={() => handleEnviarMensaje()}
              />
              <MasAcciones
                detalle={detalle}
                mensajeCopiado={mensajeCopiado}
                onMarcarAtendido={handleMarcarAtendido}
                onCopiarProductos={handleCopiarProductos}
                onCopiarCelular={handleCopiarCelular}
              />
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

      {modalDesbloqueo && detalle && (
        <ModalDesbloquearSpam
          nombre={detalle.nombre}
          alConfirmar={handleDesbloquearSpam}
          alCancelar={() => setModalDesbloqueo(false)}
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

      {modalRechazoCambio.abierto && (
        <ModalRechazoCambio
          estado={modalRechazoCambio}
          onCambiarMotivo={(motivo) => setModalRechazoCambio((prev) => ({ ...prev, motivo }))}
          onCancelar={() => setModalRechazoCambio({ abierto: false, motivo: '', enviando: false, error: null })}
          onConfirmar={handleConfirmarRechazoCambio}
        />
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
      tieneRolUsuario(sesion?.usuario, 'CAJERO');
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

  // Control compacto Chats / Salientes: va dentro de la cabecera de la vista, sin una fila propia
  const estiloTab = (activa: boolean) => ({
    minHeight: 44,
    padding: '0 12px',
    borderRadius: 10,
    border: 'none',
    background: activa ? '#D9FDD3' : '#F0F2F5',
    color: activa ? '#005C4B' : '#54656F',
    fontWeight: 700,
    cursor: 'pointer',
  });

  const controles = (
    <div role="tablist" aria-label="Vista de Mensajes" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flexShrink: 0 }}>
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
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <BannerCajaCerrada />
      <div style={{ flex: 1, minHeight: 0 }}>
        {vista === 'chats' ? <MensajesChats controles={controles} /> : <SalientesWhatsApp controles={controles} />}
      </div>
    </div>
  );
}
