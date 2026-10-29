import { useState, useEffect, useCallback } from 'react';
import { Boton } from '../../comun/Boton';
import { Confirmar } from '../../comun/Confirmar';
import { Insignia } from '../../comun/Insignia';
import { ErrorApi } from '../../comun/api';
import {
  obtenerEstadoAlertas,
  guardarAlertas,
  enviarMensajePrueba,
  puedeRecibirAlertasWhatsApp,
  limpiarNumeroPeruano,
  validarCelularPeruano,
  EstadoAlertasUsuario,
} from './alertasWhatsappApi';

export interface BloqueAlertasWhatsAppProps {
  usuarioId: string;
  rol: string;
  deshabilitado?: boolean;
  alCambiarEstado?: (estado: EstadoAlertasUsuario) => void;
}

export function BloqueAlertasWhatsApp({
  usuarioId,
  rol,
  deshabilitado = false,
  alCambiarEstado,
}: BloqueAlertasWhatsAppProps) {
  const esRolPermitido = puedeRecibirAlertasWhatsApp(rol);

  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [enviandoPrueba, setEnviandoPrueba] = useState(false);

  const [numero, setNumero] = useState('');
  const [activa, setActiva] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [confirmadoEn, setConfirmadoEn] = useState<string | null>(null);
  const [estadoTexto, setEstadoTexto] = useState<string>('Sin alertas');

  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [errorNumero, setErrorNumero] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  const [confirmarGuardarAbierto, setConfirmarGuardarAbierto] = useState(false);
  const [confirmarPruebaAbierto, setConfirmarPruebaAbierto] = useState(false);

  const cargar = useCallback(async () => {
    if (!esRolPermitido || !usuarioId) return;
    setCargando(true);
    setErrorServidor(null);
    try {
      const data = await obtenerEstadoAlertas(usuarioId);
      setNumero(limpiarNumeroPeruano(data.numero));
      setActiva(Boolean(data.activa));
      setConfirmado(Boolean(data.confirmado));
      setConfirmadoEn(data.confirmadoEn || null);
      setEstadoTexto(data.estado || (data.confirmado ? 'Confirmado' : data.activa ? 'Pendiente de confirmar' : 'Sin alertas'));
      if (alCambiarEstado) alCambiarEstado(data);
    } catch (err: any) {
      if (err instanceof ErrorApi) {
        setErrorServidor(err.message || 'No se pudo cargar la configuración de alertas');
      } else {
        setErrorServidor('Error de conexión al cargar las alertas');
      }
    } finally {
      setCargando(false);
    }
  }, [usuarioId, esRolPermitido, alCambiarEstado]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (!esRolPermitido) {
    return null;
  }

  const handleNumeroChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 9);
    setNumero(raw);
    setErrorNumero(null);
    setMensajeExito(null);
  };

  const handleCasillaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setActiva(e.target.checked);
    setMensajeExito(null);
  };

  const solicitarGuardar = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorServidor(null);
    setMensajeExito(null);

    if (activa) {
      const validacion = validarCelularPeruano(numero);
      if (!validacion.valido) {
        setErrorNumero(validacion.error || 'Número celular inválido');
        return;
      }
    }

    setConfirmarGuardarAbierto(true);
  };

  const ejecutarGuardar = async () => {
    setGuardando(true);
    setErrorServidor(null);
    try {
      const resp = await guardarAlertas(usuarioId, {
        numero: numero.trim(),
        activa,
      });

      setNumero(limpiarNumeroPeruano(resp.numero));
      setActiva(Boolean(resp.activa));
      setConfirmado(Boolean(resp.confirmado));
      setConfirmadoEn(resp.confirmadoEn || null);
      setEstadoTexto(resp.estado || (resp.confirmado ? 'Confirmado' : resp.activa ? 'Pendiente de confirmar' : 'Sin alertas'));

      setMensajeExito('Alertas guardadas correctamente.');
      if (alCambiarEstado) alCambiarEstado(resp);
      setConfirmarGuardarAbierto(false);
    } catch (err: any) {
      setConfirmarGuardarAbierto(false);
      if (err instanceof ErrorApi) {
        setErrorServidor(err.message || 'Error al guardar alertas por WhatsApp');
      } else {
        setErrorServidor('Error de conexión al guardar las alertas');
      }
    } finally {
      setGuardando(false);
    }
  };

  const solicitarPrueba = () => {
    setErrorServidor(null);
    setMensajeExito(null);

    const validacion = validarCelularPeruano(numero);
    if (!validacion.valido) {
      setErrorNumero(validacion.error || 'Configura un número celular válido primero');
      return;
    }

    setConfirmarPruebaAbierto(true);
  };

  const ejecutarPrueba = async () => {
    setEnviandoPrueba(true);
    setErrorServidor(null);
    try {
      const resp = await enviarMensajePrueba(usuarioId);
      setMensajeExito(resp.mensaje || 'Mensaje de prueba enviado por WhatsApp.');
      setConfirmarPruebaAbierto(false);
      // Recargar estado
      await cargar();
    } catch (err: any) {
      setConfirmarPruebaAbierto(false);
      if (err instanceof ErrorApi) {
        setErrorServidor(err.message || 'Error al enviar mensaje de prueba');
      } else {
        setErrorServidor('Error de red al enviar el mensaje de prueba');
      }
    } finally {
      setEnviandoPrueba(false);
    }
  };

  const insigniaVariante: 'exito' | 'aviso' | 'neutro' =
    estadoTexto === 'Confirmado'
      ? 'exito'
      : estadoTexto === 'Pendiente de confirmar'
      ? 'aviso'
      : 'neutro';

  return (
    <div
      data-testid="bloque-alertas-whatsapp"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        padding: '16px',
        borderRadius: '14px',
        border: '1.5px solid var(--cp-line)',
        background: '#FAF7F2',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h3
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '15px',
              color: 'var(--cp-navy)',
              margin: 0,
            }}
          >
            Alertas por WhatsApp
          </h3>
          <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--cp-soft)' }}>
            Recepción de avisos críticos las 24 horas (vouchers, chats en espera, pedidos demorados y calificaciones bajas de la encuesta).
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
          <Insignia variante={insigniaVariante}>
            {estadoTexto}
          </Insignia>
          {confirmado && confirmadoEn && (
            <span style={{ fontSize: '11px', color: 'var(--cp-soft)' }}>
              Confirmado: {new Date(confirmadoEn).toLocaleDateString('es-PE')}
            </span>
          )}
        </div>
      </div>

      {cargando ? (
        <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>Cargando estado de alertas...</div>
      ) : (
        <form onSubmit={solicitarGuardar} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {errorServidor && (
            <div
              role="alert"
              style={{
                background: '#FBEDE9',
                border: '1.5px solid var(--cp-rust)',
                borderRadius: '8px',
                padding: '10px 12px',
                fontSize: '12px',
                color: 'var(--cp-rust)',
                fontWeight: 600,
              }}
            >
              {errorServidor}
            </div>
          )}

          {mensajeExito && (
            <div
              role="status"
              style={{
                background: '#EBF7EE',
                border: '1.5px solid var(--cp-green)',
                borderRadius: '8px',
                padding: '10px 12px',
                fontSize: '12px',
                color: 'var(--cp-green)',
                fontWeight: 600,
              }}
            >
              {mensajeExito}
            </div>
          )}

          {/* Casilla: Recibir alertas por WhatsApp */}
          <label
            htmlFor="casilla-alertas-whatsapp"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: deshabilitado || guardando ? 'not-allowed' : 'pointer',
              userSelect: 'none',
            }}
          >
            <input
              id="casilla-alertas-whatsapp"
              type="checkbox"
              checked={activa}
              onChange={handleCasillaChange}
              disabled={deshabilitado || guardando}
              style={{
                width: '18px',
                height: '18px',
                accentColor: 'var(--cp-navy)',
                cursor: 'pointer',
              }}
            />
            <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--cp-navy)' }}>
              Recibir alertas por WhatsApp
            </span>
          </label>

          {/* Campo celular con prefijo visual +51 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label
              htmlFor="celular-alertas-whatsapp"
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--cp-navy)',
              }}
            >
              Celular para alertas (9 dígitos)
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'stretch',
                borderRadius: '10px',
                border: errorNumero ? '1.5px solid var(--cp-rust)' : '1.5px solid var(--cp-line)',
                overflow: 'hidden',
                background: 'var(--cp-white)',
              }}
            >
              <span
                data-testid="prefijo-visual-51"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 12px',
                  background: 'var(--cp-sand)',
                  borderRight: '1.5px solid var(--cp-line)',
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 800,
                  fontSize: '13px',
                  color: 'var(--cp-navy)',
                  userSelect: 'none',
                }}
              >
                +51
              </span>
              <input
                id="celular-alertas-whatsapp"
                type="tel"
                placeholder="9XXXXXXXX"
                value={numero}
                onChange={handleNumeroChange}
                disabled={deshabilitado || guardando}
                maxLength={9}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  border: 'none',
                  outline: 'none',
                  fontFamily: 'inherit',
                  fontSize: '14px',
                  color: 'var(--cp-navy)',
                  background: 'transparent',
                }}
              />
            </div>
            {errorNumero && (
              <span style={{ fontSize: '11px', color: 'var(--cp-rust)', fontWeight: 600 }}>
                {errorNumero}
              </span>
            )}
            <span style={{ fontSize: '11px', color: 'var(--cp-soft)' }}>
              Formato peruano de 9 dígitos empezando con 9. Al cambiar el número se solicitará una nueva confirmación.
            </span>
          </div>

          {/* Botones de acción */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
            <Boton
              type="submit"
              variante="primario"
              tamano="pequeno"
              disabled={deshabilitado || guardando}
            >
              {guardando ? 'Guardando...' : 'Guardar alertas'}
            </Boton>

            {activa && numero.length === 9 && (
              <Boton
                type="button"
                variante="secundario"
                tamano="pequeno"
                onClick={solicitarPrueba}
                disabled={deshabilitado || guardando || enviandoPrueba}
              >
                {enviandoPrueba ? 'Enviando prueba...' : 'Enviar prueba de nuevo'}
              </Boton>
            )}
          </div>
        </form>
      )}

      {/* Modal Confirmar Guardar */}
      <Confirmar
        abierto={confirmarGuardarAbierto}
        titulo="¿Guardar configuración de alertas?"
        mensaje={`¿Deseas guardar el celular +51 ${numero || 'sin número'} con la casilla de alertas ${activa ? 'activa' : 'inactiva'}?`}
        textoSi="Sí, guardar"
        textoNo="Cancelar"
        cargando={guardando}
        alConfirmar={ejecutarGuardar}
        alCancelar={() => setConfirmarGuardarAbierto(false)}
      />

      {/* Modal Confirmar Prueba */}
      <Confirmar
        abierto={confirmarPruebaAbierto}
        titulo="¿Enviar mensaje de prueba?"
        mensaje={`Se enviará un mensaje interactivo por WhatsApp al número +51 ${numero} con el botón «Sí, soy yo» para confirmar la recepción.`}
        textoSi="Sí, enviar prueba"
        textoNo="Cancelar"
        cargando={enviandoPrueba}
        alConfirmar={ejecutarPrueba}
        alCancelar={() => setConfirmarPruebaAbierto(false)}
      />
    </div>
  );
}
