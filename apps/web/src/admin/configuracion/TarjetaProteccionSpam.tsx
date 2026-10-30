import { useState, useEffect, useCallback } from 'react';
import { api, ErrorApi } from '../../comun/api';
import { Boton } from '../../comun/Boton';
import { Confirmar } from '../../comun/Confirmar';
import type { ParametroItem } from './ParametrosOperacionTab';
import { CampoAyuda } from './AyudaCampo';

type ClaveSpam =
  | 'chatbot_antispam_max_minuto'
  | 'chatbot_antispam_max_hora'
  | 'spam_bloqueo_excesos'
  | 'spam_bloqueo_min'
  | 'spam_bloqueo_reincidente_min'
  | 'whatsapp_max_pedidos_sin_pagar';

/** Rangos iguales a los que valida el servidor (RANGOS_PROTECCION_SPAM). Único lugar donde se editan estos límites. */
export const CAMPOS_SPAM: Array<{
  clave: ClaveSpam; etiqueta: string; ayuda: string; efecto: string; ejemplo: string;
  min: number; max: number; defecto: number; unidad: string; cfgId: string;
}> = [
  { clave: 'chatbot_antispam_max_minuto', cfgId: 'chatbot-limite-spam', etiqueta: 'Mensajes por minuto', ayuda: 'Más de esto en un minuto cuenta como exceso: el bot le pide esperar una vez y luego guarda silencio.', efecto: 'Bajarlo corta antes a quien escribe mucho, pero también a un cliente que manda varios mensajes seguidos. Subirlo lo vuelve más tolerante. Aplica desde el siguiente mensaje.', ejemplo: 'Con 10, el cliente que manda 11 mensajes en un minuto cuenta un exceso.', min: 3, max: 60, defecto: 10, unidad: 'mensajes' },
  { clave: 'chatbot_antispam_max_hora', cfgId: 'chatbot-limite-spam-hora', etiqueta: 'Mensajes por hora', ayuda: 'Más de esto en una hora también cuenta como exceso, aunque no pase el límite por minuto.', efecto: 'Bajarlo protege más contra quien escribe poco a poco todo el día; subirlo admite conversaciones largas. Aplica desde el siguiente mensaje.', ejemplo: 'Con 60, el mensaje 61 de la hora cuenta un exceso.', min: 10, max: 600, defecto: 60, unidad: 'mensajes' },
  { clave: 'spam_bloqueo_excesos', cfgId: 'chatbot-spam-excesos', etiqueta: 'Excesos para bloquear', ayuda: 'Cuántos excesos en una hora bloquean al contacto: el bot deja de responderle y el equipo recibe una notificación.', efecto: 'Con 1 se bloquea al primer exceso; con valores altos se perdona más. Un administrador puede desbloquear desde Mensajes.', ejemplo: 'Con 3, al tercer exceso en una hora el contacto queda bloqueado.', min: 1, max: 20, defecto: 3, unidad: 'excesos' },
  { clave: 'spam_bloqueo_min', cfgId: 'chatbot-spam-bloqueo-min', etiqueta: 'Duración del bloqueo', ayuda: 'Tiempo que el bot no responde al contacto bloqueado. Sus mensajes quedan guardados en el chat.', efecto: 'Más minutos castigan más tiempo a un cliente real bloqueado por error; menos minutos dejan volver pronto al spammer.', ejemplo: 'Con 60, el bot ignora al contacto 1 hora.', min: 5, max: 1440, defecto: 60, unidad: 'minutos' },
  { clave: 'spam_bloqueo_reincidente_min', cfgId: 'chatbot-spam-bloqueo-reincidente', etiqueta: 'Bloqueo por reincidencia', ayuda: 'Duración del bloqueo si el contacto vuelve a bloquearse dentro de las 24 horas siguientes al bloqueo anterior.', efecto: 'Solo afecta a quien ya fue bloqueado hoy; no cambia el primer bloqueo.', ejemplo: 'Con 1440, el reincidente queda bloqueado 24 horas.', min: 60, max: 10080, defecto: 1440, unidad: 'minutos' },
  { clave: 'whatsapp_max_pedidos_sin_pagar', cfgId: 'chatbot-pedidos-sin-pagar', etiqueta: 'Pedidos sin pagar por número', ayuda: 'Tope de pedidos por WhatsApp esperando pago por cada teléfono; con el tope el bot no crea otro.', efecto: 'Bajarlo frena pedidos falsos pero también a un cliente que pide varias veces antes de pagar. No afecta pedidos ya creados.', ejemplo: 'Con 3, quien tiene 3 pedidos sin pagar no puede hacer un cuarto por teléfono.', min: 1, max: 10, defecto: 3, unidad: 'pedidos' },
];

const inicial = () => Object.fromEntries(CAMPOS_SPAM.map((c) => [c.clave, c.defecto])) as Record<ClaveSpam, number>;

export function TarjetaProteccionSpam({ esAdmin = false, alGuardar }: { esAdmin?: boolean; alGuardar?: () => void }) {
  const [valores, setValores] = useState<Record<ClaveSpam, number>>(inicial);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const lista = await api.get<ParametroItem[]>('/admin/configuracion');
      const nuevos = inicial();
      for (const p of lista) {
        const c = CAMPOS_SPAM.find((x) => x.clave === p.clave);
        const n = Number(p.valor);
        if (c && Number.isFinite(n) && n > 0) nuevos[c.clave] = n;
      }
      setValores(nuevos);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo cargar la protección contra spam.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const fueraDeRango = CAMPOS_SPAM.filter((c) => !Number.isInteger(valores[c.clave]) || valores[c.clave] < c.min || valores[c.clave] > c.max);

  const solicitar = (e: React.FormEvent) => {
    e.preventDefault();
    setExito(null);
    if (fueraDeRango.length) {
      setError(`Revisa «${fueraDeRango[0].etiqueta}»: debe ser un entero entre ${fueraDeRango[0].min} y ${fueraDeRango[0].max}.`);
      return;
    }
    setError(null);
    setConfirmar(true);
  };

  const ejecutar = async () => {
    setGuardando(true);
    try {
      // El servidor valida el rango y audita cada cambio (PUT /admin/configuracion/:clave)
      for (const c of CAMPOS_SPAM) await api.put(`/admin/configuracion/${c.clave}`, { valor: valores[c.clave] });
      setExito(`Guardado a las ${new Date().toLocaleTimeString('es-PE', { hour12: false })}`);
      alGuardar?.();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo guardar la protección contra spam.');
    } finally {
      setConfirmar(false);
      setGuardando(false);
    }
  };

  return (
    <div
      data-testid="tarjeta-proteccion-spam"
      style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}
    >
      <div>
        <h3 style={{ margin: 0, fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 15, color: 'var(--cp-navy)' }}>
          Protección contra spam y pedidos falsos
        </h3>
        <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--cp-soft)' }}>
          Único lugar para fijar cuántos mensajes admite cada contacto por minuto y por hora, cuándo se le bloquea, por cuánto tiempo y cuántos pedidos sin pagar admite cada número.
        </p>
      </div>
      {cargando ? (
        <div style={{ fontSize: 12, color: 'var(--cp-soft)' }}>Cargando...</div>
      ) : (
        <form noValidate onSubmit={solicitar} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {error && (
            <div role="alert" style={{ color: 'var(--cp-rust)', fontSize: 12, fontWeight: 700 }}>
              {error}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {CAMPOS_SPAM.map((c) => (
              <div key={c.clave} style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--cp-cream)', border: '1px solid var(--cp-line)' }}>
                <CampoAyuda
                  id={`spam-${c.clave}`}
                  etiqueta={c.etiqueta}
                  ayuda={c.ayuda}
                  efecto={c.efecto}
                  ejemplo={c.ejemplo}
                  unidad={c.unidad}
                  rango={`${c.min} a ${c.max}`}
                  porDefecto={String(c.defecto)}
                  cfgId={c.cfgId}
                >
                  <input
                    type="number"
                    min={c.min}
                    max={c.max}
                    value={valores[c.clave]}
                    disabled={!esAdmin || guardando}
                    onChange={(e) => {
                      setExito(null);
                      setValores((v) => ({ ...v, [c.clave]: e.target.value === '' ? 0 : Number(e.target.value) }));
                    }}
                    style={{ width: 110, minHeight: 44, padding: '0 8px', borderRadius: 8, border: '1.5px solid var(--cp-line)', fontWeight: 700, textAlign: 'center' }}
                  />
                </CampoAyuda>
              </div>
            ))}
          </div>
          {esAdmin ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Boton type="submit" variante="primario" disabled={guardando}>
                Guardar protección
              </Boton>
              {exito && (
                <span role="status" style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-green)' }}>
                  {exito}
                </span>
              )}
            </div>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--cp-soft)' }}>Solo el Administrador puede cambiar estos valores.</span>
          )}
        </form>
      )}
      <Confirmar
        abierto={confirmar}
        titulo="¿Guardar la protección contra spam?"
        mensaje="Los nuevos límites se aplican desde el siguiente mensaje que reciba el bot. El cambio queda auditado."
        textoSi="Sí, guardar"
        textoNo="No, cancelar"
        cargando={guardando}
        alConfirmar={ejecutar}
        alCancelar={() => setConfirmar(false)}
      />
    </div>
  );
}
