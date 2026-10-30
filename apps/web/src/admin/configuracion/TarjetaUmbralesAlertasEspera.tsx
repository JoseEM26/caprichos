import { useState, useEffect, useCallback } from 'react';
import { api, ErrorApi } from '../../comun/api';
import { useSesion } from '../../comun/sesion';
import { Boton } from '../../comun/Boton';
import { Confirmar } from '../../comun/Confirmar';
import { Insignia } from '../../comun/Insignia';
import { ParametroItem } from './ParametrosOperacionTab';
import { AyudaDetalle } from './AyudaDetalle';
import { AYUDA_PARAMETROS, idParametro } from './catalogo/parametros';
import './configuracion-nav.css';

export interface UmbralesAlertasEspera {
  alerta_voucher_min_1: number;
  alerta_voucher_min_2: number;
  espera_cliente_aviso_min: number;
  chat_tomado_liberar_min: number;
  alerta_pedido_sin_confirmar_min: number;
  asistido_espera_min: number;
}

export const VALORES_DEFECTO_UMBRALES: UmbralesAlertasEspera = {
  alerta_voucher_min_1: 5,
  alerta_voucher_min_2: 15,
  espera_cliente_aviso_min: 10,
  chat_tomado_liberar_min: 10,
  alerta_pedido_sin_confirmar_min: 5,
  asistido_espera_min: 3,
};

const CAMPOS_UMBRALES: Array<{
  clave: keyof UmbralesAlertasEspera;
  etiqueta: string;
  descripcion: string;
  defecto: number;
}> = [
  {
    clave: 'alerta_voucher_min_1',
    etiqueta: 'Primer aviso de voucher sin revisar',
    descripcion: 'Aviso a administradores tras captura recibida',
    defecto: 5,
  },
  {
    clave: 'alerta_voucher_min_2',
    etiqueta: 'Segundo aviso y urgente voucher',
    descripcion: 'Segundo aviso a administradores y marca urgente',
    defecto: 15,
  },
  {
    clave: 'espera_cliente_aviso_min',
    etiqueta: 'Aviso de espera al cliente',
    descripcion: 'Mensaje interactivo de tranquilidad al cliente',
    defecto: 10,
  },
  {
    clave: 'chat_tomado_liberar_min',
    etiqueta: 'Liberar chat tomado y abandonado',
    descripcion: 'Devolver conversación al bot por inactividad',
    defecto: 10,
  },
  {
    clave: 'alerta_pedido_sin_confirmar_min',
    etiqueta: 'Aviso pedido sin confirmar en Caja',
    descripcion: 'Alerta a administradores por orden estancada',
    defecto: 5,
  },
  {
    clave: 'asistido_espera_min',
    etiqueta: 'Espera antes de modo asistido',
    descripcion: 'Minutos sin respuesta de asesor antes de activar el bot asistido',
    defecto: 3,
  },
];

export interface TarjetaUmbralesAlertasEsperaProps {
  esAdmin?: boolean;
  alGuardar?: () => void;
}

function useSesionSegura() {
  try {
    return useSesion();
  } catch {
    return null;
  }
}

export function TarjetaUmbralesAlertasEspera({
  esAdmin: esAdminProp,
  alGuardar,
}: TarjetaUmbralesAlertasEsperaProps = {}) {
  const sesion = useSesionSegura();
  const esAdmin =
    esAdminProp !== undefined
      ? esAdminProp
      : (sesion?.usuario?.rol || '').toUpperCase() === 'ADMIN' ||
        Boolean(sesion?.tiene?.('ADMIN'));

  const [umbrales, setUmbrales] = useState<UmbralesAlertasEspera>(VALORES_DEFECTO_UMBRALES);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [mensajeGuardado, setMensajeGuardado] = useState<string | null>(null);
  const [confirmarAbierto, setConfirmarAbierto] = useState(false);

  const cargar = useCallback(async () => {
    if (!esAdmin) {
      setCargando(false);
      return;
    }
    setCargando(true);
    setErrorServidor(null);
    try {
      const res = await api.get<ParametroItem[]>('/admin/configuracion');
      const nuevosUmbrales = { ...VALORES_DEFECTO_UMBRALES };

      for (const item of res) {
        if (item.clave in nuevosUmbrales) {
          const val = Number(item.valor);
          if (!isNaN(val) && val > 0) {
            nuevosUmbrales[item.clave as keyof UmbralesAlertasEspera] = val;
          }
        }
      }

      setUmbrales(nuevosUmbrales);
    } catch (err: any) {
      // Si falla, se conservan los valores por defecto sembrados
      const msg = err instanceof ErrorApi ? err.message : 'Error al cargar los umbrales';
      setErrorServidor(msg);
    } finally {
      setCargando(false);
    }
  }, [esAdmin]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Si no es ADMIN, no se muestra (tarjeta pequeña solo ADMIN)
  if (!esAdmin) {
    return null;
  }

  const handleInputChange = (clave: keyof UmbralesAlertasEspera, valorRaw: string) => {
    const num = parseInt(valorRaw, 10);
    setUmbrales((prev) => ({
      ...prev,
      [clave]: isNaN(num) ? 0 : Math.max(0, num),
    }));
    setMensajeGuardado(null);
  };

  const solicitarGuardar = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorServidor(null);
    setMensajeGuardado(null);

    // Validar que sean mayores a 0
    for (const c of CAMPOS_UMBRALES) {
      if (umbrales[c.clave] <= 0) {
        setErrorServidor(`El valor para «${c.etiqueta}» debe ser un número entero mayor a 0.`);
        return;
      }
    }

    setConfirmarAbierto(true);
  };

  const ejecutarGuardar = async () => {
    setGuardando(true);
    setErrorServidor(null);
    try {
      // Guardar cada umbral mediante el endpoint que ya usa Configuración
      for (const c of CAMPOS_UMBRALES) {
        await api.put<ParametroItem>(`/admin/configuracion/${c.clave}`, {
          valor: umbrales[c.clave],
        });
      }

      const ahora = new Date();
      const horaStr = ahora.toLocaleTimeString('es-PE', { hour12: false });
      setMensajeGuardado(`Guardado a las ${horaStr}`);
      setConfirmarAbierto(false);
      if (alGuardar) alGuardar();
    } catch (err: any) {
      setConfirmarAbierto(false);
      const msg = err instanceof ErrorApi ? err.message : 'No se pudieron guardar los umbrales';
      setErrorServidor(msg);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div
      data-testid="tarjeta-umbrales-alertas-espera"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        padding: '18px',
        borderRadius: '16px',
        border: '1.5px solid var(--cp-line)',
        background: 'var(--cp-white)',
        boxShadow: '0 2px 8px rgba(11, 44, 62, 0.04)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: '15px',
                color: 'var(--cp-navy)',
                margin: 0,
              }}
            >
              Umbrales de alertas y espera
            </h3>
            <Insignia variante="neutro">Solo ADMIN</Insignia>
          </div>
          <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: 'var(--cp-soft)' }}>
            Tiempos en minutos para disparar avisos por WhatsApp y liberación de conversaciones.
          </p>
        </div>

        {mensajeGuardado && (
          <span
            role="status"
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--cp-green)',
            }}
          >
            {mensajeGuardado}
          </span>
        )}
      </div>

      {cargando ? (
        <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>Cargando umbrales del sistema...</div>
      ) : (
        <form noValidate onSubmit={solicitarGuardar} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
              gap: '12px',
            }}
          >
            {CAMPOS_UMBRALES.map((c) => (
              <div
                key={c.clave}
                data-cfg-id={idParametro(c.clave)}
                tabIndex={-1}
                className="cfg-campo"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: 'var(--cp-cream)',
                  border: '1px solid var(--cp-line)',
                }}
              >
                <label
                  htmlFor={`input-${c.clave}`}
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: 'var(--cp-navy)',
                    lineHeight: '16px',
                  }}
                >
                  {c.etiqueta}
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                  <input
                    id={`input-${c.clave}`}
                    type="number"
                    min={1}
                    max={180}
                    value={umbrales[c.clave]}
                    aria-describedby={`ayuda-umbral-${c.clave}-ayuda`}
                    onChange={(e) => handleInputChange(c.clave, e.target.value)}
                    disabled={guardando}
                    style={{
                      width: '70px',
                      padding: '6px 8px',
                      borderRadius: '8px',
                      border: '1.5px solid var(--cp-line)',
                      background: 'var(--cp-white)',
                      fontFamily: 'inherit',
                      fontSize: '14px',
                      fontWeight: 700,
                      color: 'var(--cp-navy)',
                      textAlign: 'center',
                    }}
                  />
                  <span style={{ fontSize: '12px', color: 'var(--cp-soft)', fontWeight: 600 }}>
                    minutos (def. {c.defecto})
                  </span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--cp-soft)', marginTop: '2px' }}>
                  {c.descripcion}
                </span>
                <AyudaDetalle
                  id={`ayuda-umbral-${c.clave}`}
                  etiqueta={c.etiqueta}
                  nombreBoton={c.clave}
                  ayuda={AYUDA_PARAMETROS[c.clave].descripcion}
                  unidad="minutos"
                  rango="1 a 180"
                  porDefecto={String(c.defecto)}
                  efecto={AYUDA_PARAMETROS[c.clave].efecto}
                  ejemplo={AYUDA_PARAMETROS[c.clave].ejemplo}
                />
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '4px' }}>
            <Boton
              type="submit"
              variante="primario"
              tamano="pequeno"
              disabled={guardando}
            >
              {guardando ? 'Guardando umbrales...' : 'Guardar umbrales'}
            </Boton>
          </div>
        </form>
      )}

      {/* Modal Confirmar Sí/No */}
      <Confirmar
        abierto={confirmarAbierto}
        titulo="¿Guardar umbrales de alerta y espera?"
        mensaje="¿Estás seguro de actualizar los minutos de aviso por WhatsApp y tiempos de espera? El servidor los aplicará en el siguiente ciclo."
        textoSi="Sí, guardar"
        textoNo="Cancelar"
        cargando={guardando}
        alConfirmar={ejecutarGuardar}
        alCancelar={() => setConfirmarAbierto(false)}
      />
    </div>
  );
}
