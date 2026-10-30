import { useState } from 'react';
import { Boton } from '../../../comun/Boton';
import { Confirmar } from '../../../comun/Confirmar';
import { PisoPlano } from '../tipos';

export interface BarraControlesPlanoProps {
  pisos: PisoPlano[];
  pisoActivoId: string;
  onCambiarPiso: (id: string) => void;
  onAlternarPiso: (id: string, nuevoActivo: boolean) => Promise<void>;
  onCambiarCuadricula: (
    pisoId: string,
    nuevoAncho: number,
    nuevoAlto: number,
  ) => Promise<void>;
  herramientaActiva: string | null;
  onSeleccionarHerramienta: (tipo: string | null) => void;
  onAbrirDisenoTexto: () => void;
  onAbrirNuevoPedidoMesa: () => void;
  errorCuadricula?: string | null;
  elementosFuera?: Array<{ id: string; tipo: string; nombre?: string; numero?: number }>;
  alLimpiarError?: () => void;
}

const HERRAMIENTAS_DISPONIBLES: Array<{
  tipo: string;
  nombre: string;
  grupo: string;
}> = [
  { tipo: 'MESA', nombre: 'Mesa', grupo: 'Atención' },
  { tipo: 'BARRA', nombre: 'Barra', grupo: 'Atención' },
  { tipo: 'CAJA', nombre: 'Caja', grupo: 'Atención' },
  { tipo: 'COCINA', nombre: 'Cocina', grupo: 'Servicio' },
  { tipo: 'BANO', nombre: 'Baños', grupo: 'Servicio' },
  { tipo: 'ESCALERA', nombre: 'Escalera', grupo: 'Estructura' },
  { tipo: 'ENTRADA', nombre: 'Entrada', grupo: 'Estructura' },
  { tipo: 'PARED', nombre: 'Pared', grupo: 'Estructura' },
];

export function BarraControlesPlano({
  pisos,
  pisoActivoId,
  onCambiarPiso,
  onAlternarPiso,
  onCambiarCuadricula,
  herramientaActiva,
  onSeleccionarHerramienta,
  onAbrirDisenoTexto,
  onAbrirNuevoPedidoMesa,
  errorCuadricula,
  elementosFuera = [],
  alLimpiarError,
}: BarraControlesPlanoProps) {
  const pisoActual = pisos.find((p) => p.id === pisoActivoId) || pisos[0];
  const esPisoPrincipal =
    pisoActual?.nombre?.toLowerCase().trim() === 'piso 1' ||
    pisoActual?.id === '1';

  const [confirmarPiso, setConfirmarPiso] = useState<{
    id: string;
    nombre: string;
    activo: boolean;
  } | null>(null);
  const [cargandoPiso, setCargandoPiso] = useState(false);

  const ejecutarAlternarPiso = async () => {
    if (!confirmarPiso) return;
    setCargandoPiso(true);
    try {
      await onAlternarPiso(confirmarPiso.id, !confirmarPiso.activo);
      setConfirmarPiso(null);
    } finally {
      setCargandoPiso(false);
    }
  };

  const handleColsDelta = (delta: number) => {
    if (!pisoActual) return;
    const actual = pisoActual.cuadriculaAncho || pisoActual.cuadricula_ancho || 20;
    const nuevo = Math.max(1, actual + delta);
    if (nuevo === actual) return;
    alLimpiarError?.();
    onCambiarCuadricula(
      pisoActual.id,
      nuevo,
      pisoActual.cuadriculaAlto || pisoActual.cuadricula_alto || 12,
    );
  };

  const handleFilasDelta = (delta: number) => {
    if (!pisoActual) return;
    const actual = pisoActual.cuadriculaAlto || pisoActual.cuadricula_alto || 12;
    const nuevo = Math.max(1, actual + delta);
    if (nuevo === actual) return;
    alLimpiarError?.();
    onCambiarCuadricula(
      pisoActual.id,
      pisoActual.cuadriculaAncho || pisoActual.cuadricula_ancho || 20,
      nuevo,
    );
  };

  const cuadriculaAncho =
    pisoActual?.cuadriculaAncho || pisoActual?.cuadricula_ancho || 20;
  const cuadriculaAlto =
    pisoActual?.cuadriculaAlto || pisoActual?.cuadricula_alto || 12;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        background: 'var(--cp-white)',
        border: '1px solid var(--cp-line)',
        borderRadius: '16px',
        padding: '16px',
        boxShadow: '0 2px 8px rgba(11, 44, 62, 0.04)',
      }}
    >
      {/* Fila 1: Selector de piso y KPIs */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        {/* Pisos */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: '12px',
              fontWeight: 800,
              letterSpacing: '0.06em',
              color: 'var(--cp-soft)',
            }}
          >
            PISO
          </span>
          {pisos.map((p) => {
            const estaActivoPiso = p.id === pisoActivoId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onCambiarPiso(p.id)}
                style={{
                  minHeight: '44px',
                  padding: '0 16px',
                  borderRadius: '9999px',
                  border: '1.5px solid var(--cp-navy)',
                  background: estaActivoPiso ? 'var(--cp-navy)' : 'var(--cp-white)',
                  color: estaActivoPiso ? 'var(--cp-cream)' : 'var(--cp-navy)',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>{p.nombre}</span>
                {!p.activo && (
                  <span
                    style={{
                      fontSize: '11px',
                      opacity: 0.8,
                      background: 'rgba(0,0,0,0.1)',
                      borderRadius: '4px',
                      padding: '1px 4px',
                    }}
                  >
                    desactivado
                  </span>
                )}
              </button>
            );
          })}

          {/* Botón para activar / desactivar piso 2 u otros (piso 1 no desactivable) */}
          {pisoActual && (
            <button
              type="button"
              disabled={esPisoPrincipal}
              onClick={() => {
                if (esPisoPrincipal) return;
                setConfirmarPiso({
                  id: pisoActual.id,
                  nombre: pisoActual.nombre,
                  activo: pisoActual.activo,
                });
              }}
              style={{
                minHeight: '44px',
                padding: '0 14px',
                borderRadius: '9999px',
                border: '1.5px dashed var(--cp-navy)',
                background: 'transparent',
                color: 'var(--cp-navy)',
                fontWeight: 700,
                fontSize: '12px',
                cursor: esPisoPrincipal ? 'not-allowed' : 'pointer',
                opacity: esPisoPrincipal ? 0.45 : 1,
              }}
              title={
                esPisoPrincipal
                  ? 'El piso 1 no se puede desactivar'
                  : pisoActual.activo
                  ? 'Desactivar piso'
                  : 'Activar piso'
              }
            >
              {esPisoPrincipal
                ? 'Piso 1 (Siempre activo)'
                : pisoActual.activo
                ? `Desactivar ${pisoActual.nombre}`
                : `Activar ${pisoActual.nombre}`}
            </button>
          )}
        </div>

        {/* Totales rápidos */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <div
            style={{
              padding: '6px 12px',
              borderRadius: '10px',
              background: 'var(--cp-cream)',
              border: '1px solid var(--cp-line)',
              display: 'flex',
              flexDirection: 'column',
              minWidth: '90px',
            }}
          >
            <span style={{ fontSize: '11px', color: 'var(--cp-soft)', fontWeight: 700 }}>
              Mesas piso
            </span>
            <span
              style={{
                fontFamily: 'var(--fuente-titulos)',
                fontSize: '16px',
                fontWeight: 800,
                color: 'var(--cp-navy)',
              }}
            >
              {pisoActual?.totales?.mesas ?? pisoActual?.mesas ?? 0}
            </span>
          </div>

          <div
            style={{
              padding: '6px 12px',
              borderRadius: '10px',
              background: 'var(--cp-cream)',
              border: '1px solid var(--cp-line)',
              display: 'flex',
              flexDirection: 'column',
              minWidth: '90px',
            }}
          >
            <span style={{ fontSize: '11px', color: 'var(--cp-soft)', fontWeight: 700 }}>
              Asientos
            </span>
            <span
              style={{
                fontFamily: 'var(--fuente-titulos)',
                fontSize: '16px',
                fontWeight: 800,
                color: 'var(--cp-navy)',
              }}
            >
              {pisoActual?.totales?.asientosTotales ?? pisoActual?.asientosTotales ?? 0}
            </span>
          </div>

          <div
            style={{
              padding: '6px 12px',
              borderRadius: '10px',
              background: 'var(--cp-cream)',
              border: '1px solid var(--cp-line)',
              display: 'flex',
              flexDirection: 'column',
              minWidth: '90px',
            }}
          >
            <span style={{ fontSize: '11px', color: 'var(--cp-soft)', fontWeight: 700 }}>
              Mesas activas
            </span>
            <span
              style={{
                fontFamily: 'var(--fuente-titulos)',
                fontSize: '16px',
                fontWeight: 800,
                color: 'var(--cp-navy)',
              }}
            >
              {pisoActual?.totales?.mesasActivas ?? pisoActual?.mesasActivas ?? 0}
            </span>
          </div>

          <Boton
            type="button"
            variante="primario"
            onClick={onAbrirNuevoPedidoMesa}
            style={{ minHeight: '44px' }}
          >
            + Nuevo pedido de mesa
          </Boton>
        </div>
      </div>

      {/* Fila 2: Paleta de herramientas y Cuadrícula ajustable */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          borderTop: '1px solid var(--cp-line)',
          paddingTop: '12px',
        }}
      >
        {/* Herramientas para colocar en el plano */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: '12px',
              fontWeight: 800,
              letterSpacing: '0.04em',
              color: 'var(--cp-soft)',
              marginRight: '4px',
            }}
          >
            AGREGAR:
          </span>
          {HERRAMIENTAS_DISPONIBLES.map((t) => {
            const estaElegida = herramientaActiva === t.tipo;
            return (
              <button
                key={t.tipo}
                type="button"
                onClick={() => {
                  alLimpiarError?.();
                  onSeleccionarHerramienta(estaElegida ? null : t.tipo);
                }}
                style={{
                  minHeight: '44px',
                  padding: '0 12px',
                  borderRadius: '9999px',
                  border: `1.5px solid ${estaElegida ? 'var(--cp-orange)' : 'var(--cp-navy)'}`,
                  background: estaElegida ? 'var(--cp-orange)' : 'var(--cp-white)',
                  color: 'var(--cp-navy)',
                  fontWeight: estaElegida ? 800 : 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                  boxShadow: estaElegida ? '0 0 0 2px var(--cp-navy)' : 'none',
                }}
              >
                {t.nombre}
              </button>
            );
          })}
        </div>

        {/* Controles de cuadrícula y diseño en texto */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Ajuste de columnas */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'var(--cp-cream)',
              padding: '4px 8px',
              borderRadius: '10px',
              border: '1px solid var(--cp-line)',
            }}
          >
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-navy)' }}>
              Cols:
            </span>
            <button
              type="button"
              onClick={() => handleColsDelta(-1)}
              aria-label="Menos columnas"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '16px',
                border: '1.5px solid var(--cp-navy)',
                background: 'var(--cp-white)',
                color: 'var(--cp-navy)',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              -
            </button>
            <span
              style={{
                minWidth: '24px',
                textAlign: 'center',
                fontWeight: 800,
                fontSize: '13px',
              }}
            >
              {cuadriculaAncho}
            </span>
            <button
              type="button"
              onClick={() => handleColsDelta(1)}
              aria-label="Más columnas"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '16px',
                border: '1.5px solid var(--cp-navy)',
                background: 'var(--cp-white)',
                color: 'var(--cp-navy)',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              +
            </button>
          </div>

          {/* Ajuste de filas */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'var(--cp-cream)',
              padding: '4px 8px',
              borderRadius: '10px',
              border: '1px solid var(--cp-line)',
            }}
          >
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-navy)' }}>
              Filas:
            </span>
            <button
              type="button"
              onClick={() => handleFilasDelta(-1)}
              aria-label="Menos filas"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '16px',
                border: '1.5px solid var(--cp-navy)',
                background: 'var(--cp-white)',
                color: 'var(--cp-navy)',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              -
            </button>
            <span
              style={{
                minWidth: '24px',
                textAlign: 'center',
                fontWeight: 800,
                fontSize: '13px',
              }}
            >
              {cuadriculaAlto}
            </span>
            <button
              type="button"
              onClick={() => handleFilasDelta(1)}
              aria-label="Más filas"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '16px',
                border: '1.5px solid var(--cp-navy)',
                background: 'var(--cp-white)',
                color: 'var(--cp-navy)',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              +
            </button>
          </div>

          {/* Respaldo / diseño en texto */}
          <Boton
            type="button"
            variante="secundario"
            tamano="pequeno"
            onClick={onAbrirDisenoTexto}
          >
            Diseño en texto (respaldo)
          </Boton>
        </div>
      </div>

      {/* Indicador de ayuda cuando hay herramienta seleccionada */}
      {herramientaActiva && (
        <div
          role="status"
          style={{
            background: 'var(--cp-sand)',
            border: '1.5px solid var(--cp-orange)',
            borderRadius: '10px',
            padding: '8px 12px',
            fontSize: '13px',
            fontWeight: 700,
            color: 'var(--cp-navy)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>
            Toca una celda en el plano para colocar:{' '}
            <b>
              {HERRAMIENTAS_DISPONIBLES.find((h) => h.tipo === herramientaActiva)
                ?.nombre || herramientaActiva}
            </b>
            . Vuelve a tocar el botón para soltar la herramienta.
          </span>
          <button
            type="button"
            onClick={() => onSeleccionarHerramienta(null)}
            style={{
              border: 0,
              background: 'transparent',
              color: 'var(--cp-rust)',
              fontWeight: 800,
              cursor: 'pointer',
              textDecoration: 'underline',
              fontSize: '12px',
            }}
          >
            Soltar herramienta
          </button>
        </div>
      )}

      {/* Alerta de error en cuadrícula (ELEMENTOS_FUERA con su lista) */}
      {errorCuadricula && (
        <div
          role="alert"
          style={{
            padding: '12px 14px',
            background: '#FBEDE9',
            border: '1.5px solid var(--cp-rust)',
            borderRadius: '12px',
            color: 'var(--cp-rust)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ fontWeight: 800, fontSize: '13px' }}>{errorCuadricula}</div>
          {elementosFuera && elementosFuera.length > 0 && (
            <div style={{ fontSize: '12px', color: 'var(--cp-navy)' }}>
              Elementos que quedarían fuera:{' '}
              <b>
                {elementosFuera
                  .map(
                    (e) =>
                      e.nombre ||
                      (e.numero ? `Mesa ${e.numero}` : e.tipo.toLowerCase()),
                  )
                  .join(', ')}
              </b>
              . Muévelos hacia adentro antes de reducir la cuadrícula.
            </div>
          )}
        </div>
      )}

      {/* Confirmar activar o desactivar piso */}
      {confirmarPiso && (
        <Confirmar
          abierto={true}
          titulo={
            confirmarPiso.activo
              ? `¿Desactivar ${confirmarPiso.nombre}?`
              : `¿Activar ${confirmarPiso.nombre}?`
          }
          mensaje={
            confirmarPiso.activo
              ? `Al desactivar ${confirmarPiso.nombre}, los mozos no podrán ver ni elegir mesas de este piso al tomar pedidos.`
              : `Al activar ${confirmarPiso.nombre}, los mozos podrán elegir entre los pisos activos al tomar pedidos.`
          }
          textoSi={confirmarPiso.activo ? 'Sí, desactivar' : 'Sí, activar'}
          textoNo="No, cancelar"
          cargando={cargandoPiso}
          alConfirmar={ejecutarAlternarPiso}
          alCancelar={() => setConfirmarPiso(null)}
        />
      )}
    </div>
  );
}
