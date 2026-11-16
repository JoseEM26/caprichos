import { useState, useEffect, useCallback } from 'react';
import { api, ErrorApi } from '../../comun/api';
import { Boton } from '../../comun/Boton';
import { Confirmar } from '../../comun/Confirmar';
import { Insignia } from '../../comun/Insignia';
import { useSesion } from '../../comun/sesion';

export type ProveedorWhatsapp = 'META' | 'EVOLUTION';

export interface EstadoProveedorWhatsapp {
  proveedor: ProveedorWhatsapp;
  configurado: boolean;
  webhookConTokenConfigurado: boolean;
  pausado: boolean;
  conexion: { estado: 'CONECTADO' | 'DESCONECTADO' | 'DESCONOCIDO'; razon: string | null; actualizadoEn: string | null; enVivo: string | null };
  limites: Record<string, number | string>;
}

const RUTA = '/admin/whatsapp/evolution';

/** Etiqueta en español simple de cada límite anti-bloqueo. */
const LIMITES: Array<{ clave: string; texto: string; ayuda?: string; texto_libre?: boolean }> = [
  { clave: 'evolution_limite_minuto', texto: 'Máx. mensajes por minuto', ayuda: '0 = sin tope' },
  { clave: 'evolution_limite_hora', texto: 'Máx. mensajes por hora', ayuda: '0 = sin tope' },
  { clave: 'evolution_limite_dia', texto: 'Máx. mensajes por día', ayuda: '0 = sin tope' },
  { clave: 'evolution_pausa_min_seg', texto: 'Pausa mínima entre envíos (seg)' },
  { clave: 'evolution_pausa_max_seg', texto: 'Pausa máxima entre envíos (seg)' },
  { clave: 'evolution_escribiendo_ms_por_caracter', texto: '«Escribiendo…» (ms por letra)' },
  { clave: 'evolution_horario_desde', texto: 'Respaldo: avisos desde la hora (Lima)', ayuda: 'Solo si no se puede leer el horario del local; Evolution envía en el horario de Configuración › Local' },
  { clave: 'evolution_horario_hasta', texto: 'Respaldo: avisos hasta la hora (Lima)' },
  { clave: 'evolution_fallos_seguidos', texto: 'Fallos seguidos que pausan Evolution y pasan a Meta', ayuda: '0 = no pausar solo' },
  { clave: 'evolution_fallos_ventana_min', texto: 'Ventana de esos fallos (minutos)' },
  { clave: 'evolution_max_enlaces', texto: 'Máx. enlaces por mensaje' },
  { clave: 'evolution_max_texto_identico', texto: 'Mismo texto repetido antes de variar el saludo' },
  { clave: 'evolution_exigir_contacto_previo', texto: 'Solo escribir a quien ya escribió (si / no)', texto_libre: true },
  { clave: 'evolution_origenes_permitidos', texto: 'Solo estos orígenes salen por Evolution (vacío = los mismos avisos que con Meta)', texto_libre: true },
];

/** true si quien mira la pantalla es ADMIN (sin sesión: false). */
export function useEsAdminSesion(): boolean {
  try {
    return useSesion().usuario?.rol?.toUpperCase() === 'ADMIN';
  } catch {
    return false;
  }
}

const nombreProveedor = (p: ProveedorWhatsapp) => (p === 'EVOLUTION' ? 'Evolution (no oficial)' : 'Meta (oficial)');

export function TarjetaWhatsappProveedor({ esAdmin = false }: { esAdmin?: boolean }) {
  const [e, setE] = useState<EstadoProveedorWhatsapp | null>(null);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [destino, setDestino] = useState<ProveedorWhatsapp | null>(null);
  const [confirmarLimites, setConfirmarLimites] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [qr, setQr] = useState<{ base64: string | null; codigo: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const aplicar = (r: EstadoProveedorWhatsapp) => {
    setE(r);
    setValores(Object.fromEntries(Object.entries(r.limites ?? {}).map(([k, v]) => [k, String(v)])));
  };

  const cargar = useCallback(async () => {
    try {
      const r = await api.get<EstadoProveedorWhatsapp>(RUTA);
      if (r?.proveedor && r.conexion) aplicar(r);
      setError(null);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo cargar el estado de WhatsApp.');
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const ejecutar = async (accion: () => Promise<unknown>, mensaje: string) => {
    setGuardando(true);
    try {
      await accion();
      setError(null);
      setExito(mensaje);
      await cargar();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo guardar el cambio.');
    } finally {
      setDestino(null);
      setConfirmarLimites(false);
      setGuardando(false);
    }
  };

  const pedirQr = async () => {
    try {
      const r = await api.get<{ disponible: boolean; base64: string | null; codigo: string | null }>(`${RUTA}/qr`);
      setQr(r.disponible ? r : { base64: null, codigo: null });
      if (!r.disponible) setError('Evolution no entregó un QR. Puede que el número ya esté vinculado o que Evolution no esté configurado.');
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo pedir el QR.');
    }
  };

  const conectado = e?.conexion.enVivo ? e.conexion.enVivo === 'open' : e?.conexion.estado === 'CONECTADO';
  // Con el QR a la vista: se revisa la conexión cada 5 s y se pide uno nuevo cada 40 s (vence en un minuto) hasta vincular
  const qrVisible = Boolean(qr?.base64);
  useEffect(() => {
    if (!qrVisible) return;
    if (conectado) { setQr(null); return; }
    const estado = setInterval(() => void cargar(), 5000);
    const nuevo = setInterval(() => void pedirQr(), 40000);
    return () => { clearInterval(estado); clearInterval(nuevo); };
  }, [qrVisible, conectado, cargar]);
  const cambiosLimites = e ? Object.entries(valores).filter(([k, v]) => String(e.limites[k]) !== v) : [];
  const campo = { minHeight: 44, padding: '0 8px', borderRadius: 8, border: '1.5px solid var(--cp-line)', fontWeight: 700 } as const;

  return (
    <div
      data-testid="tarjeta-whatsapp-proveedor"
      style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <h3 style={{ margin: 0, fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 15, color: 'var(--cp-navy)' }}>
        Número de WhatsApp: Meta o Evolution
      </h3>
      {error && <div role="alert" style={{ color: 'var(--cp-rust)', fontSize: 12, fontWeight: 700 }}>{error}</div>}
      {exito && <div role="status" style={{ color: 'var(--cp-green)', fontSize: 12, fontWeight: 700 }}>{exito}</div>}
      {e && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 13, color: 'var(--cp-navy)' }}>
            <span>En uso ahora:</span>
            <Insignia variante={e.proveedor === 'EVOLUTION' ? 'aviso' : 'exito'}>{nombreProveedor(e.proveedor)}</Insignia>
            {esAdmin && (
              <Boton variante="secundario" disabled={guardando} onClick={() => setDestino(e.proveedor === 'EVOLUTION' ? 'META' : 'EVOLUTION')}>
                {e.proveedor === 'EVOLUTION' ? 'Volver a Meta' : 'Cambiar a Evolution'}
              </Boton>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 13 }}>
            <span>Estado de Evolution:</span>
            {!e.configurado ? (
              <Insignia variante="neutro">Sin configurar (modo simulado)</Insignia>
            ) : (
              <Insignia variante={conectado ? 'exito' : 'peligro'}>{conectado ? 'Conectado' : 'Desconectado'}</Insignia>
            )}
            {e.pausado && <Insignia variante="peligro">Envío en pausa</Insignia>}
            {esAdmin && e.configurado && (
              <Boton variante="secundario" disabled={guardando} onClick={() => void ejecutar(() => api.post(`${RUTA}/pausa`, { pausado: !e.pausado }), e.pausado ? 'Envío reanudado' : 'Envío en pausa')}>
                {e.pausado ? 'Reanudar envío' : 'Pausar envío'}
              </Boton>
            )}
            {esAdmin && e.configurado && !conectado && (
              <Boton variante="secundario" onClick={() => void pedirQr()}>Mostrar QR para vincular</Boton>
            )}
          </div>
          {!e.webhookConTokenConfigurado && (
            <div style={{ fontSize: 12, color: 'var(--cp-rust)', fontWeight: 700 }}>
              Falta el token del webhook (EVOLUTION_WEBHOOK_TOKEN): sin él no se reciben mensajes de Evolution.
            </div>
          )}
          {qr?.base64 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
              <img alt="QR para vincular el número" src={qr.base64.startsWith('data:') ? qr.base64 : `data:image/png;base64,${qr.base64}`} style={{ width: 220, height: 220 }} />
              <span style={{ fontSize: 12, color: 'var(--cp-soft)' }}>En el celular: WhatsApp, Dispositivos vinculados, Vincular un dispositivo. Se renueva solo hasta que quede vinculado.</span>
            </div>
          )}

          <fieldset disabled={!esAdmin || guardando} style={{ border: '1px solid var(--cp-line)', borderRadius: 10, padding: 12, display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' }}>
            <legend style={{ fontSize: 12, fontWeight: 800 }}>Límites anti-bloqueo (solo cuando se usa Evolution)</legend>
            {LIMITES.map((l) => (
              <label key={l.clave} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 700 }}>
                {l.texto}{l.ayuda ? ` (${l.ayuda})` : ''}
                <input
                  type={l.texto_libre ? 'text' : 'number'}
                  min={0}
                  value={valores[l.clave] ?? ''}
                  onChange={(ev) => { setExito(null); setValores({ ...valores, [l.clave]: ev.target.value }); }}
                  style={campo}
                />
              </label>
            ))}
          </fieldset>
          {esAdmin && (
            <div>
              <Boton variante="primario" disabled={guardando || cambiosLimites.length === 0} onClick={() => setConfirmarLimites(true)}>
                Guardar límites
              </Boton>
            </div>
          )}
        </>
      )}
      <p style={{ margin: 0, fontSize: 12, color: 'var(--cp-soft)' }}>
        Con Evolution (WhatsApp no oficial) el bot manda los menús como texto numerado («Responde 1, 2 o 3») y solo avisa por su cuenta el estado del pedido y la encuesta;
        puntos, cumpleaños, recordatorios y campañas no salen. Meta queda de respaldo: se puede volver en cualquier momento.
        Solo un administrador puede cambiar esto.
      </p>
      <Confirmar
        abierto={destino !== null}
        titulo={destino === 'EVOLUTION' ? '¿Usar Evolution como número de WhatsApp?' : '¿Volver a Meta?'}
        mensaje={destino === 'EVOLUTION'
          ? 'Desde ahora el bot y los avisos saldrán por el número vinculado a Evolution. Un número no oficial puede ser bloqueado por WhatsApp. Se puede volver a Meta cuando quieras.'
          : 'Desde ahora el bot y los avisos saldrán por el WhatsApp oficial de Meta.'}
        textoSi="Sí, cambiar"
        textoNo="No, cancelar"
        peligro={destino === 'EVOLUTION'}
        cargando={guardando}
        alConfirmar={() => ejecutar(() => api.put(`${RUTA}/proveedor`, { proveedor: destino }), `Ahora se usa ${destino ? nombreProveedor(destino) : ''}`)}
        alCancelar={() => setDestino(null)}
      />
      <Confirmar
        abierto={confirmarLimites}
        titulo="¿Guardar los límites?"
        mensaje="Los nuevos límites se aplican a los próximos envíos por Evolution."
        textoSi="Sí, guardar"
        textoNo="No, cancelar"
        cargando={guardando}
        alConfirmar={() => ejecutar(() => api.put(`${RUTA}/limites`, Object.fromEntries(cambiosLimites)), 'Límites guardados')}
        alCancelar={() => setConfirmarLimites(false)}
      />
    </div>
  );
}
