import { useState, useEffect, useCallback } from 'react';
import { api, ErrorApi } from '../../comun/api';
import { useSesion } from '../../comun/sesion';
import { Confirmar } from '../../comun/Confirmar';
import { Insignia } from '../../comun/Insignia';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { CampoConfig } from './CampoConfig';

export interface ResumenConsumoIa {
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
}

export interface TarjetaAyudaIaConfiguracionProps {
  esAdmin?: boolean;
}

function useSesionSegura() {
  try {
    return useSesion();
  } catch {
    return null;
  }
}

export function TarjetaAyudaIaConfiguracion({ esAdmin: esAdminProp }: TarjetaAyudaIaConfiguracionProps = {}) {
  const sesion = useSesionSegura();
  const esAdmin =
    esAdminProp !== undefined
      ? esAdminProp
      : (sesion?.usuario?.rol || '').toUpperCase() === 'ADMIN';

  const [activo, setActivo] = useState<boolean>(false);
  const [consumoIa, setConsumoIa] = useState<ResumenConsumoIa | null>(null);
  const [cargando, setCargando] = useState<boolean>(true);
  const [confirmarAbierto, setConfirmarAbierto] = useState<boolean>(false);
  const [guardando, setGuardando] = useState<boolean>(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      // 1. Cargar parámetro ayuda_ia_activo
      try {
        const params = await api.get<Array<{ clave: string; valor: any }>>('/admin/configuracion');
        const paramAyuda = params.find((p) => p.clave === 'ayuda_ia_activo');
        if (paramAyuda) {
          const v = paramAyuda.valor;
          const estaActivo =
            v === true || String(v).toLowerCase() === 'true' || String(v).toLowerCase() === 'si';
          setActivo(estaActivo);
        }
      } catch {
        // Fallback si no devuelve lista de configuración
      }

      // 2. Cargar consumo de IA del mes
      try {
        const infoIa = await api.get<ResumenConsumoIa>('/admin/configuracion/ia-consumo');
        if (infoIa && typeof infoIa.tokensTotal === 'number') {
          setConsumoIa(infoIa);
        }
      } catch {
        setConsumoIa(null);
      }
    } catch (err) {
      const msg = err instanceof ErrorApi ? err.message : 'Error al cargar datos del asistente de ayuda';
      setError(msg);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const handleSolicitarCambio = () => {
    if (!esAdmin) return;
    setError(null);
    setConfirmarAbierto(true);
  };

  const handleConfirmarCambio = async () => {
    const nuevoValor = !activo;
    setGuardando(true);
    setError(null);

    try {
      await api.put('/admin/configuracion/ayuda_ia_activo', {
        valor: nuevoValor,
      });

      setActivo(nuevoValor);
      setConfirmarAbierto(false);

      const ahora = new Date();
      const horaStr = ahora.toLocaleTimeString('es-PE', { hour12: false });
      setMensajeExito(
        nuevoValor
          ? `Asistente de ayuda con IA activado a las ${horaStr}`
          : `Asistente de ayuda con IA desactivado a las ${horaStr}`,
      );

      // Recargar consumo de IA actualizado
      try {
        const infoIa = await api.get<ResumenConsumoIa>('/admin/configuracion/ia-consumo');
        if (infoIa) setConsumoIa(infoIa);
      } catch {
        // Ignorar
      }
    } catch (err) {
      const msg =
        err instanceof ErrorApi
          ? err.message
          : 'No se pudo actualizar el estado del asistente de ayuda con IA';
      setError(msg);
      setConfirmarAbierto(false);
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <div
        data-testid="tarjeta-ayuda-ia-cargando"
        style={{
          padding: '20px',
          background: 'var(--cp-white)',
          borderRadius: '14px',
          border: '1px solid var(--cp-line)',
        }}
      >
        <Cargando mensaje="Cargando configuración del asistente de ayuda..." />
      </div>
    );
  }

  return (
    <div
      data-testid="tarjeta-ayuda-ia"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        padding: '18px 20px',
        background: 'var(--cp-white)',
        border: '1px solid var(--cp-line)',
        borderRadius: '16px',
        boxShadow: '0 2px 8px rgba(11, 44, 62, 0.05)',
      }}
    >
      {/* Cabecera de la tarjeta */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'var(--cp-sand)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              fontWeight: 800,
              color: 'var(--cp-navy)',
            }}
          >
            IA
          </div>
          <div>
            <div
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: '16px',
                color: 'var(--cp-navy)',
              }}
            >
              Asistente de ayuda con IA
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--cp-soft)', marginTop: '2px' }}>
              Capri orienta al personal paso a paso con los manuales del sistema. Con la IA activada responde con un modelo de OpenAI (gasta tokens); desactivada responde solo con los manuales, sin costo de IA.
            </div>
          </div>
        </div>

        {/* Interruptor para ADMIN */}
        <CampoConfig id="ayuda-capri-interruptor" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Insignia variante={activo ? 'exito' : 'neutro'}>
            {activo ? 'Activado' : 'Desactivado'}
          </Insignia>

          {esAdmin ? (
            <Boton
              variante={activo ? 'secundario' : 'primario'}
              onClick={handleSolicitarCambio}
              aria-label="Alternar Asistente de ayuda con IA"
            >
              {activo ? 'Desactivar' : 'Activar'}
            </Boton>
          ) : (
            <span
              style={{
                fontSize: '11px',
                color: 'var(--cp-soft)',
                fontStyle: 'italic',
                padding: '4px 8px',
                background: 'var(--cp-sand)',
                borderRadius: '6px',
              }}
            >
              Solo ADMIN
            </span>
          )}
        </CampoConfig>
      </div>

      {/* Alerta de solo lectura si no es ADMIN */}
      {!esAdmin && (
        <div
          role="status"
          style={{
            fontSize: '12px',
            color: 'var(--cp-soft)',
            background: 'var(--cp-sand)',
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid var(--cp-line)',
          }}
        >
          Solo el <b>Administrador</b> puede activar o desactivar el asistente de ayuda con IA.
        </div>
      )}

      {/* Métricas de consumo de IA del mes */}
      {consumoIa && (
        <div
          data-cfg-id="ayuda-capri-consumo"
          tabIndex={-1}
          style={{
            background: 'var(--cp-cream)',
            border: '1px solid var(--cp-line)',
            borderRadius: '12px',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
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
            <span
              style={{
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--cp-navy)',
              }}
            >
              Consumo de la IA este mes ({consumoIa.periodo})
            </span>

            <Insignia
              variante={
                consumoIa.topeAlcanzado
                  ? 'peligro'
                  : activo && consumoIa.iaActiva
                  ? 'exito'
                  : 'neutro'
              }
            >
              {consumoIa.topeAlcanzado
                ? 'Tope alcanzado'
                : activo && consumoIa.iaActiva
                ? 'IA activa'
                : 'IA inactiva'}
            </Insignia>
          </div>

          <div style={{ fontSize: '12px', color: 'var(--cp-soft)', lineHeight: 1.45 }}>
            {consumoIa.llamadasTotal} consultas · {consumoIa.tokensTotal.toLocaleString()} tokens · Costo estimado: ${consumoIa.costoUsdEstimado.toFixed(4)} USD / Tope: ${consumoIa.topeMensualUsd.toFixed(2)} USD ({consumoIa.porcentajeConsumido}% consumido). Con el tope alcanzado Capri responde solo con los manuales; el tope se cambia en Parámetros (chatbot_ia_tope_mensual_usd).
          </div>
        </div>
      )}

      {/* Regla de oro visual */}
      <div
        style={{
          fontSize: '12px',
          color: 'var(--cp-soft)',
          background: 'var(--cp-white)',
          padding: '8px 12px',
          borderRadius: '8px',
          border: '1px dashed var(--cp-line)',
          lineHeight: 1.4,
        }}
      >
        <b>Yo solo te guío.</b> Capri no anula pedidos ni registra cobros: explica los pasos para que tú realices y confirmes cada acción con Sí o No en la pantalla.
      </div>

      {/* Mensaje de éxito */}
      {mensajeExito && (
        <div
          role="status"
          style={{
            color: 'var(--cp-green)',
            fontSize: '12.5px',
            fontWeight: 700,
          }}
        >
          {mensajeExito}
        </div>
      )}

      {/* Mensaje de error */}
      {error && (
        <div
          role="alert"
          style={{
            color: 'var(--cp-rust)',
            fontSize: '12.5px',
            fontWeight: 700,
          }}
        >
          {error}
        </div>
      )}

      {/* Modal de confirmación Sí/No */}
      <Confirmar
        abierto={confirmarAbierto}
        titulo={activo ? '¿Desactivar Asistente de ayuda con IA?' : '¿Activar Asistente de ayuda con IA?'}
        mensaje={
          activo
            ? 'Al desactivarlo, Capri seguirá brindando respuestas de contingencia basadas directamente en los manuales del sistema sin consumir tokens de OpenAI.'
            : 'Al activarlo, Capri utilizará el modelo de OpenAI para responder con explicaciones personalizadas guiando a los usuarios según los manuales oficiales.'
        }
        textoSi={activo ? 'Sí, desactivar' : 'Sí, activar'}
        textoNo="No, cancelar"
        cargando={guardando}
        alConfirmar={handleConfirmarCambio}
        alCancelar={() => setConfirmarAbierto(false)}
      />
    </div>
  );
}
