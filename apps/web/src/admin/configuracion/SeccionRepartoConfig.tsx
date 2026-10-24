import { useState, useEffect } from 'react';
import { api, ErrorApi } from '../../comun/api';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { Confirmar } from '../../comun/Confirmar';

export interface ConfigRepartoData {
  retrasadoMin: number;
  tardeMin: number;
  muyTardeMin: number;
  velocidadKmh: number;
  maxPedidos: number;
  localCoords?: { lat: number; lng: number };
}

interface SeccionRepartoConfigProps {
  puedeEditar: boolean;
}

interface CampoConfigItem {
  key: keyof ConfigRepartoData;
  label: string;
  ayuda: string;
  min: number;
  max: number;
  sufijo: string;
  colorBadge?: string;
  bgBadge?: string;
}

const CAMPOS_REPARTO: CampoConfigItem[] = [
  {
    key: 'retrasadoMin',
    label: 'Alerta Retrasado (amarillo)',
    ayuda:
      'Minutos desde que el cliente terminó el pedido para mostrar el marcador en amarillo (Retrasado) en el mapa y la lista de reparto.',
    min: 1,
    max: 180,
    sufijo: 'minutos',
    colorBadge: '#854D0E',
    bgBadge: '#FEF08A',
  },
  {
    key: 'tardeMin',
    label: 'Alerta Tarde (naranja)',
    ayuda:
      'Minutos desde que el cliente terminó el pedido para marcarlo en color naranja (alerta Tarde).',
    min: 2,
    max: 240,
    sufijo: 'minutos',
    colorBadge: '#9A3412',
    bgBadge: '#FFEDD5',
  },
  {
    key: 'muyTardeMin',
    label: 'Alerta Muy tarde (rojo palpitando)',
    ayuda:
      'Minutos desde que el cliente terminó el pedido para marcar el punto en rojo palpitando fuerte (alerta crítica Muy tarde).',
    min: 3,
    max: 360,
    sufijo: 'minutos',
    colorBadge: '#991B1B',
    bgBadge: '#FEE2E2',
  },
  {
    key: 'velocidadKmh',
    label: 'Velocidad media de viaje',
    ayuda:
      'Velocidad promedio estimada en moto (km/h) para calcular la duración aproximada del viaje por distancia haversine en línea recta.',
    min: 5,
    max: 100,
    sufijo: 'km/h',
  },
  {
    key: 'maxPedidos',
    label: 'Máximo de pedidos por repartidor',
    ayuda:
      'Cantidad máxima de órdenes de entrega simultáneas que puede trasladar un repartidor (hasta 3 por defecto).',
    min: 1,
    max: 20,
    sufijo: 'pedidos',
  },
];

export function SeccionRepartoConfig({ puedeEditar }: SeccionRepartoConfigProps) {
  const [config, setConfig] = useState<ConfigRepartoData>({
    retrasadoMin: 20,
    tardeMin: 30,
    muyTardeMin: 45,
    velocidadKmh: 25,
    maxPedidos: 3,
  });
  const [original, setOriginal] = useState<ConfigRepartoData | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  // Ayudas activas («?»)
  const [ayudasAbiertas, setAyudasAbiertas] = useState<Record<string, boolean>>({});

  // Confirmar Sí/No modal
  const [modalConfirmar, setModalConfirmar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);

  const cargarConfig = async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const res = await api.get<ConfigRepartoData>('/admin/repartos/config');
      setConfig(res);
      setOriginal(res);
    } catch (err) {
      setErrorCarga(
        err instanceof ErrorApi
          ? err.message
          : 'No se pudo cargar la configuración de reparto',
      );
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarConfig();
  }, []);

  const toggleAyuda = (campo: string) => {
    setAyudasAbiertas((prev) => ({
      ...prev,
      [campo]: !prev[campo],
    }));
  };

  const handleNumeroChange = (campo: keyof ConfigRepartoData, valorStr: string) => {
    const val = parseInt(valorStr, 10);
    setConfig((prev) => ({
      ...prev,
      [campo]: isNaN(val) ? 0 : val,
    }));
    setErrorServidor(null);
  };

  // Validaciones locales
  let errorValidacion: string | null = null;
  if (config.retrasadoMin <= 0 || config.tardeMin <= 0 || config.muyTardeMin <= 0) {
    errorValidacion = 'Los tiempos de espera deben ser mayores a 0.';
  } else if (
    !(config.retrasadoMin < config.tardeMin && config.tardeMin < config.muyTardeMin)
  ) {
    errorValidacion =
      'Los umbrales deben estar en orden ascendente: Retrasado (' +
      config.retrasadoMin +
      ' min) < Tarde (' +
      config.tardeMin +
      ' min) < Muy tarde (' +
      config.muyTardeMin +
      ' min).';
  } else if (config.velocidadKmh < 5 || config.velocidadKmh > 100) {
    errorValidacion = 'La velocidad media debe estar entre 5 y 100 km/h.';
  } else if (config.maxPedidos < 1 || config.maxPedidos > 20) {
    errorValidacion = 'El límite de pedidos por repartidor debe estar entre 1 y 20.';
  }

  const esModificado =
    original &&
    (config.retrasadoMin !== original.retrasadoMin ||
      config.tardeMin !== original.tardeMin ||
      config.muyTardeMin !== original.muyTardeMin ||
      config.velocidadKmh !== original.velocidadKmh ||
      config.maxPedidos !== original.maxPedidos);

  const solicitarGuardar = () => {
    if (!puedeEditar || errorValidacion || !esModificado) return;
    setModalConfirmar(true);
  };

  const ejecutarGuardar = async () => {
    setGuardando(true);
    setErrorServidor(null);
    try {
      const res = await api.put<ConfigRepartoData>('/admin/repartos/config', {
        retrasadoMin: config.retrasadoMin,
        tardeMin: config.tardeMin,
        muyTardeMin: config.muyTardeMin,
        velocidadKmh: config.velocidadKmh,
        maxPedidos: config.maxPedidos,
      });
      setConfig(res);
      setOriginal(res);
      setModalConfirmar(false);
      setMensajeExito('Configuración de reparto actualizada exitosamente.');
      setTimeout(() => setMensajeExito(null), 4000);
    } catch (err) {
      const msg =
        err instanceof ErrorApi
          ? err.message
          : 'Error al actualizar la configuración de reparto';
      setErrorServidor(msg);
      setModalConfirmar(false);
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return <Cargando mensaje="Cargando configuración operativa de reparto..." />;
  }

  if (errorCarga) {
    return (
      <EstadoError
        titulo="Error al cargar configuración de reparto"
        mensaje={errorCarga}
        alReintentar={cargarConfig}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {!puedeEditar && (
        <div
          role="status"
          style={{
            background: 'var(--cp-bg, #F3EBDD)',
            border: '1px solid var(--cp-line, #E2D7C3)',
            borderRadius: '10px',
            padding: '10px 14px',
            fontSize: '13px',
            color: 'var(--cp-soft, #5A6065)',
          }}
        >
          Modo sólo lectura. No tienes el permiso <b>configuracion/editar</b> para
          modificar estos parámetros.
        </div>
      )}

      {mensajeExito && (
        <div
          role="alert"
          style={{
            background: '#DCFCE7',
            border: '1.5px solid #22C55E',
            color: '#166534',
            borderRadius: '10px',
            padding: '12px 16px',
            fontWeight: 700,
            fontSize: '14px',
          }}
        >
          {mensajeExito}
        </div>
      )}

      {errorServidor && (
        <div
          role="alert"
          style={{
            background: '#FEE2E2',
            border: '1.5px solid #EF4444',
            color: '#991B1B',
            borderRadius: '10px',
            padding: '12px 16px',
            fontWeight: 700,
            fontSize: '14px',
          }}
        >
          {errorServidor}
        </div>
      )}

      <div
        style={{
          background: 'var(--cp-sand, #F7F3EB)',
          border: '1px solid var(--cp-line, #E2D7C3)',
          borderRadius: '14px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '16px',
              color: 'var(--cp-navy, #0B2C3D)',
            }}
          >
            Umbrales de espera y operación del mapa
          </div>
          <div
            style={{
              fontSize: '13px',
              lineHeight: '18px',
              color: 'var(--cp-soft, #5A6065)',
            }}
          >
            Configuración de colores de espera (verde, amarillo, naranja y rojo
            palpitando), velocidad promedio para estimación de ruta y límite de pedidos
            por repartidor.
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {CAMPOS_REPARTO.map((campo) => {
            const valor = config[campo.key] as number;
            const ayudaAbierta = Boolean(ayudasAbiertas[campo.key]);

            return (
              <div
                key={campo.key}
                style={{
                  background: 'var(--cp-white, #FFFFFF)',
                  border: '1px solid var(--cp-line, #E2D7C3)',
                  borderRadius: '12px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label
                      htmlFor={`campo-${campo.key}`}
                      style={{
                        fontWeight: 700,
                        fontSize: '14px',
                        color: 'var(--cp-navy, #0B2C3D)',
                        cursor: 'pointer',
                      }}
                    >
                      {campo.label}
                    </label>

                    {campo.colorBadge && campo.bgBadge && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          background: campo.bgBadge,
                          color: campo.colorBadge,
                        }}
                      >
                        {campo.key === 'retrasadoMin'
                          ? 'Amarillo'
                          : campo.key === 'tardeMin'
                          ? 'Naranja'
                          : 'Rojo'}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => toggleAyuda(campo.key)}
                      aria-label={`Explicación de ${campo.label}`}
                      aria-expanded={ayudaAbierta}
                      style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        border: '1px solid var(--cp-line, #E2D7C3)',
                        background: ayudaAbierta
                          ? 'var(--cp-orange, #E67929)'
                          : 'var(--cp-sand, #F7F3EB)',
                        color: ayudaAbierta
                          ? 'var(--cp-white, #FFFFFF)'
                          : 'var(--cp-navy, #0B2C3D)',
                        fontSize: '12px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        lineHeight: 1,
                        padding: 0,
                      }}
                      title="Haz clic para ver explicación"
                    >
                      ?
                    </button>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <input
                      id={`campo-${campo.key}`}
                      type="number"
                      min={campo.min}
                      max={campo.max}
                      disabled={!puedeEditar}
                      value={valor || ''}
                      onChange={(e) => handleNumeroChange(campo.key, e.target.value)}
                      style={{
                        width: '90px',
                        height: '38px',
                        padding: '0 10px',
                        borderRadius: '8px',
                        border: '1.5px solid var(--cp-line, #E2D7C3)',
                        background: puedeEditar
                          ? 'var(--cp-white, #FFFFFF)'
                          : 'var(--cp-sand, #F7F3EB)',
                        color: 'var(--cp-navy, #0B2C3D)',
                        fontWeight: 700,
                        fontSize: '15px',
                        textAlign: 'right',
                        boxSizing: 'border-box',
                      }}
                    />
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: 'var(--cp-soft, #5A6065)',
                        minWidth: '55px',
                      }}
                    >
                      {campo.sufijo}
                    </span>
                  </div>
                </div>

                {ayudaAbierta && (
                  <div
                    style={{
                      background: 'var(--cp-cream, #FFFDF8)',
                      borderLeft: '3px solid var(--cp-orange, #E67929)',
                      padding: '8px 12px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      lineHeight: '17px',
                      color: 'var(--cp-navy, #0B2C3D)',
                    }}
                  >
                    {campo.ayuda}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {errorValidacion && (
          <div
            role="alert"
            style={{
              background: '#FEF2F2',
              border: '1px solid #FCA5A5',
              color: '#B91C1C',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            {errorValidacion}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            marginTop: '6px',
            borderTop: '1px solid var(--cp-line, #E2D7C3)',
            paddingTop: '12px',
          }}
        >
          <div style={{ fontSize: '13px', color: 'var(--cp-soft, #5A6065)' }}>
            {esModificado
              ? 'Tienes cambios sin guardar.'
              : 'Valores sincronizados con el servidor.'}
          </div>

          <Boton
            variante="primario"
            deshabilitado={!puedeEditar || !esModificado || Boolean(errorValidacion)}
            onClick={solicitarGuardar}
          >
            Guardar configuración de reparto
          </Boton>
        </div>
      </div>

      <Confirmar
        abierto={modalConfirmar}
        titulo="¿Guardar configuración de reparto?"
        mensaje="¿Confirmas actualizar los umbrales de espera, velocidad media y límite de pedidos de reparto? Todos los repartidores y la carta virtual aplicarán estos valores de inmediato."
        textoSi="Sí, guardar"
        textoNo="No, cancelar"
        cargando={guardando}
        alConfirmar={ejecutarGuardar}
        alCancelar={() => setModalConfirmar(false)}
      />
    </div>
  );
}
