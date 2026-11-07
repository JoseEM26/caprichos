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
  marcarChatNoVisto,
  marcarChatVisto,
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
import { FlujoMensajes } from './FlujoMensajes';
import { BarraAccionPendiente } from './BarraAccionPendiente';
import { PanelPedido } from './PanelPedido';
import { CuadroEscribir } from './CuadroEscribir';
import { ModalRechazoCambio } from './ModalRechazoCambio';
import { eventosDelChat } from './EventoSistema';
import { esUsuarioWhatsApp, telefonoDeUrl } from './utilidadesChat';
import './mensajes.css';

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
  const [conteos, setConteos] = useState({ todos: 0, atender: 0, bot: 0, atendidos: 0, sinVer: 0, bloqueadosSpam: 0 });
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
  // Panel «Pedido y acciones»: abierto en pantallas anchas; en celular sale como hoja inferior
  const [panelAbierto, setPanelAbierto] = useState<boolean>(
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 1200px)').matches,
  );
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
      setConteos({ bloqueadosSpam: 0, sinVer: 0, ...res.conteos });

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

  // Chat que la persona abrió ella misma: solo ese se da por visto (el que se abre solo al cargar la lista, no)
  const abiertoPorPersona = React.useRef<string | null>(null);

  const alMarcarVisto = useCallback(
    async (id: string) => {
      try {
        await marcarChatVisto(id);
      } catch {
        /* se reintenta en el siguiente refresco */
      }
      await cargarLista(true);
      setDetalle((prev) => (prev && prev.id === id ? { ...prev, marcadoNoVisto: false } : prev));
    },
    [cargarLista],
  );

  const alMarcarNoVisto = useCallback(
    async (id: string) => {
      if (abiertoPorPersona.current === id) abiertoPorPersona.current = null;
      try {
        await marcarChatNoVisto(id);
      } catch {
        return;
      }
      setDetalle((prev) => (prev && prev.id === id ? { ...prev, marcadoNoVisto: true } : prev));
      await cargarLista(true);
    },
    [cargarLista],
  );

  // Si llegan mensajes mientras el chat sigue abierto por la persona, se dan por vistos
  useEffect(() => {
    const id = abiertoPorPersona.current;
    if (!id) return;
    const fila = chats.find((c) => c.id === id);
    if (fila && fila.sinLeer > 0 && !fila.marcadoNoVisto) void marcarChatVisto(id).then(() => cargarLista(true)).catch(() => {});
  }, [chats, cargarLista]);

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

  const eventos = detalle ? eventosDelChat(detalle) : [];
  const acciones = {
    onEditarNombre: () => setModalEditarAbierto(true),
    onTogglePausaBot: handleTogglePausaBot,
    onTomarChat: () => handleTomarChat(false),
    onSoltarChat: handleSoltarChat,
    onMarcarAtendido: handleMarcarAtendido,
    onCopiarProductos: handleCopiarProductos,
    onCopiarCelular: handleCopiarCelular,
  };
  const alternarPanel = () => setPanelAbierto((v) => !v);

  return (
    <div className="msg-root" data-fs={pantallaCompleta ? '1' : '0'}>
      {/* Controles de vista: pantalla completa y zoom (solo escritorio) */}
      <div className="msg-barra">
        <button className="msg-zb" aria-pressed={pantallaCompleta} style={{ padding: '0 12px', fontSize: 13 }} onClick={toggleFullscreen}>
          {pantallaCompleta ? 'Salir de pantalla completa' : 'Pantalla completa'}
        </button>
        <div role="group" aria-label="Tamaño de la vista" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#33434B' }}>Zoom</span>
          <button className="msg-zb" aria-label="Alejar" onClick={() => setZoom((z) => Math.max(60, z - 10))}>
            −
          </button>
          <button className="msg-zb" aria-label="Restablecer el tamaño" style={{ minWidth: 60 }} onClick={() => setZoom(85)}>
            {zoom}%
          </button>
          <button className="msg-zb" aria-label="Acercar" onClick={() => setZoom((z) => Math.min(120, z + 10))}>
            +
          </button>
        </div>
      </div>

      {/* Tres zonas: lista | conversación | pedido y acciones. En celular, dos vistas. */}
      <div
        className="msg-wrap"
        data-open={chatAbiertoMovil ? '1' : '0'}
        data-panel={panelAbierto ? '1' : '0'}
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
            abiertoPorPersona.current = id;
            const fila = chats.find((c) => c.id === id);
            if (fila && (fila.sinLeer > 0 || fila.marcadoNoVisto)) void alMarcarVisto(id);
            setChatSeleccionadoId(id);
            setChatAbiertoMovil(true);
          }}
          onMarcarNoVisto={alMarcarNoVisto}
          onMarcarVisto={alMarcarVisto}
        />

        <section className="msg-chat" aria-label="Conversación">
          {!chatSeleccionadoId || (!detalle && cargandoDetalle) ? (
            <div className="msg-vacio" style={{ margin: 'auto' }}>
              {cargandoDetalle ? 'Cargando conversación...' : 'Selecciona un chat para ver la conversación'}
            </div>
          ) : !detalle ? (
            <div className="msg-vacio" style={{ margin: 'auto' }}>
              No se pudo cargar la conversación.
            </div>
          ) : (
            <>
              <CabeceraChat
                detalle={detalle}
                puedeDesbloquear={puedeDesbloquear}
                onVolver={() => setChatAbiertoMovil(false)}
                onAbrirDetalles={() => setPanelAbierto(true)}
                onDesbloquear={() => setModalDesbloqueo(true)}
                acciones={acciones}
              />
              <button
                type="button"
                className="msg-btn msg-btn-no-visto"
                data-testid="btn-no-visto-detalle"
                onClick={() => {
                  if (detalle.marcadoNoVisto) void alMarcarVisto(detalle.id);
                  else {
                    void alMarcarNoVisto(detalle.id);
                    setChatAbiertoMovil(false);
                  }
                }}
              >
                {detalle.marcadoNoVisto ? 'Marcar como visto' : 'Marcar como no visto'}
              </button>
              <FlujoMensajes mensajes={detalle.mensajes} eventos={eventos} onReintentar={handleReintentarMensaje} />
              <BarraAccionPendiente
                detalle={detalle}
                onReabrirPlantilla={handleReabrirPlantilla}
                onAprobarPago={handleAprobarPago}
                onRechazarPago={handleRechazarPago}
                onAplicarCambio={handleAplicarCambio}
                onAbrirRechazarCambio={handleAbrirRechazarCambio}
              />
              <CuadroEscribir
                detalle={detalle}
                respuestasRapidas={respuestasRapidas}
                textoMensaje={textoMensaje}
                onCambiarTexto={setTextoMensaje}
                textoPulido={textoPulido}
                pulirError={pulirError}
                mensajeCopiado={mensajeCopiado}
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
            </>
          )}
        </section>

        {detalle && (
          <PanelPedido
            detalle={detalle}
            tieneVouchersVer={tieneVouchersVer}
            panelAbierto={panelAbierto}
            onTogglePanel={alternarPanel}
            onAplicarCambio={handleAplicarCambio}
            onAbrirRechazarCambio={handleAbrirRechazarCambio}
            onAprobarPago={handleAprobarPago}
            onRechazarPago={handleRechazarPago}
            onRecargar={cargarDetalle}
            onTomarChat={() => handleTomarChat(false)}
            onSoltarChat={handleSoltarChat}
          />
        )}
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
