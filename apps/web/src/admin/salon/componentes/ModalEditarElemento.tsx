import React, { useState } from 'react';
import { Boton } from '../../../comun/Boton';
import { Confirmar } from '../../../comun/Confirmar';
import { ElementoPlano } from '../tipos';
import { ESTILOS_ELEMENTOS } from './CuadriculaPlano';

export interface ModalEditarElementoProps {
  elemento: ElementoPlano | null;
  alCerrar: () => void;
  alActualizarPropiedades: (
    id: string,
    cambios: {
      nombre?: string;
      asientos?: number;
      ancho?: number;
      alto?: number;
    },
  ) => Promise<void>;
  alGirar: (id: string) => Promise<void>;
  alAlternarActivo: (id: string, nuevoActivo: boolean) => Promise<void>;
  alEliminar: (id: string) => Promise<void>;
  errorOperacion?: string | null;
  alLimpiarError?: () => void;
  detallesMesaEnUso?: {
    motivo: string;
    mensaje: string;
    sugerencia?: string;
  } | null;
}

export function ModalEditarElemento({
  elemento,
  alCerrar,
  alActualizarPropiedades,
  alGirar,
  alAlternarActivo,
  alEliminar,
  errorOperacion,
  alLimpiarError,
  detallesMesaEnUso,
}: ModalEditarElementoProps) {
  const [nombre, setNombre] = useState(elemento?.nombre || '');
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const [confirmarAlternar, setConfirmarAlternar] = useState(false);
  const [confirmarDesactivarMesaEnUso, setConfirmarDesactivarMesaEnUso] =
    useState(false);
  const [cargando, setCargando] = useState(false);

  // Sincronizar nombre cuando cambia el elemento
  React.useEffect(() => {
    setNombre(elemento?.nombre || '');
  }, [elemento]);

  if (!elemento) return null;

  const esMesa = elemento.tipo === 'MESA';
  const esPared = elemento.tipo === 'PARED';
  const config = ESTILOS_ELEMENTOS[elemento.tipo] || ESTILOS_ELEMENTOS.OTRO;

  const handleGuardarNombre = async () => {
    if (nombre === (elemento.nombre || '')) return;
    setCargando(true);
    try {
      await alActualizarPropiedades(elemento.id, { nombre: nombre.trim() });
    } finally {
      setCargando(false);
    }
  };

  const handleCambiarAsientos = async (delta: number) => {
    const actuales = elemento.asientos ?? 4;
    const nuevos = Math.max(1, actuales + delta);
    if (nuevos === actuales) return;
    setCargando(true);
    try {
      await alActualizarPropiedades(elemento.id, { asientos: nuevos });
    } finally {
      setCargando(false);
    }
  };

  const handleCambiarAncho = async (delta: number) => {
    const nuevoAncho = Math.max(1, elemento.ancho + delta);
    if (nuevoAncho === elemento.ancho) return;
    setCargando(true);
    try {
      await alActualizarPropiedades(elemento.id, { ancho: nuevoAncho });
    } finally {
      setCargando(false);
    }
  };

  const handleCambiarAlto = async (delta: number) => {
    const nuevoAlto = Math.max(1, elemento.alto + delta);
    if (nuevoAlto === elemento.alto) return;
    setCargando(true);
    try {
      await alActualizarPropiedades(elemento.id, { alto: nuevoAlto });
    } finally {
      setCargando(false);
    }
  };

  const ejecutarEliminar = async () => {
    setCargando(true);
    try {
      await alEliminar(elemento.id);
      setConfirmarEliminar(false);
      alCerrar();
    } finally {
      setCargando(false);
    }
  };

  const ejecutarAlternar = async () => {
    setCargando(true);
    try {
      await alAlternarActivo(elemento.id, !elemento.activo);
      setConfirmarAlternar(false);
    } finally {
      setCargando(false);
    }
  };

  const ejecutarDesactivarMesaEnUso = async () => {
    setCargando(true);
    try {
      await alAlternarActivo(elemento.id, false);
      setConfirmarDesactivarMesaEnUso(false);
      alCerrar();
    } finally {
      setCargando(false);
    }
  };

  return (
    <>
      <div
        data-testid="panel-editar-elemento"
        style={{
          background: 'var(--cp-white)',
          border: '2px solid var(--cp-orange)',
          borderRadius: '16px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          boxShadow: '0 4px 16px rgba(11, 44, 62, 0.08)',
        }}
      >
        {/* Cabecera del elemento seleccionado */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--cp-line)',
            paddingBottom: '8px',
          }}
        >
          <div>
            <span
              style={{
                fontFamily: 'var(--fuente-titulos)',
                fontWeight: 800,
                fontSize: '16px',
                color: 'var(--cp-navy)',
              }}
            >
              {config.nombre} {elemento.numero ? `#${elemento.numero}` : ''}
            </span>
            <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
              Posición: x={elemento.x}, y={elemento.y} · {elemento.ancho}x{elemento.alto} celdas
            </div>
          </div>
          <button
            onClick={alCerrar}
            aria-label="Cerrar panel de edición"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '18px',
              border: '1.5px solid var(--cp-line)',
              background: 'transparent',
              color: 'var(--cp-navy)',
              fontWeight: 800,
              fontSize: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            x
          </button>
        </div>

        {/* Nombre / etiqueta (no aplica a paredes) */}
        {!esPared && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label
              htmlFor="elem-nombre-input"
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--cp-navy)',
              }}
            >
              Nombre o etiqueta
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                id="elem-nombre-input"
                type="text"
                value={nombre}
                onChange={(e) => {
                  setNombre(e.target.value);
                  alLimpiarError?.();
                }}
                onBlur={handleGuardarNombre}
                placeholder={esMesa ? `Mesa ${elemento.numero || ''}` : config.nombre}
                style={{
                  flex: 1,
                  minHeight: '44px',
                  boxSizing: 'border-box',
                  borderRadius: '10px',
                  border: '1.5px solid var(--cp-line)',
                  background: 'var(--cp-cream)',
                  padding: '0 12px',
                  fontSize: '13px',
                  color: 'var(--cp-navy)',
                }}
              />
              <Boton
                type="button"
                variante="secundario"
                tamano="pequeno"
                disabled={cargando || nombre === (elemento.nombre || '')}
                onClick={handleGuardarNombre}
              >
                Guardar
              </Boton>
            </div>
          </div>
        )}

        {/* Asientos (solo para mesas) */}
        {esMesa && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--cp-cream)',
              padding: '8px 12px',
              borderRadius: '10px',
            }}
          >
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cp-navy)' }}>
              Asientos
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => handleCambiarAsientos(-1)}
                disabled={cargando || (elemento.asientos ?? 4) <= 1}
                aria-label="Menos asientos"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '18px',
                  border: '1.5px solid var(--cp-navy)',
                  background: 'var(--cp-white)',
                  color: 'var(--cp-navy)',
                  fontWeight: 800,
                  fontSize: '18px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                -
              </button>
              <span
                style={{
                  minWidth: '24px',
                  textAlign: 'center',
                  fontWeight: 800,
                  fontSize: '15px',
                  color: 'var(--cp-navy)',
                }}
              >
                {elemento.asientos ?? 4}
              </span>
              <button
                type="button"
                onClick={() => handleCambiarAsientos(1)}
                disabled={cargando}
                aria-label="Más asientos"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '18px',
                  border: '1.5px solid var(--cp-navy)',
                  background: 'var(--cp-white)',
                  color: 'var(--cp-navy)',
                  fontWeight: 800,
                  fontSize: '18px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                +
              </button>
            </div>
          </div>
        )}

        {/* Tamaño: Ancho y Alto en celdas */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {/* Ancho */}
          <div
            style={{
              flex: '1 1 120px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--cp-cream)',
              padding: '6px 10px',
              borderRadius: '10px',
            }}
          >
            <span style={{ fontSize: '12px', fontWeight: 700 }}>Ancho</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={() => handleCambiarAncho(-1)}
                disabled={cargando || elemento.ancho <= 1}
                aria-label="Menos ancho"
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
              <span style={{ minWidth: '18px', textAlign: 'center', fontWeight: 800 }}>
                {elemento.ancho}
              </span>
              <button
                type="button"
                onClick={() => handleCambiarAncho(1)}
                disabled={cargando}
                aria-label="Más ancho"
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
          </div>

          {/* Alto */}
          <div
            style={{
              flex: '1 1 120px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--cp-cream)',
              padding: '6px 10px',
              borderRadius: '10px',
            }}
          >
            <span style={{ fontSize: '12px', fontWeight: 700 }}>Alto</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={() => handleCambiarAlto(-1)}
                disabled={cargando || elemento.alto <= 1}
                aria-label="Menos alto"
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
              <span style={{ minWidth: '18px', textAlign: 'center', fontWeight: 800 }}>
                {elemento.alto}
              </span>
              <button
                type="button"
                onClick={() => handleCambiarAlto(1)}
                disabled={cargando}
                aria-label="Más alto"
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
          </div>
        </div>

        {/* Botones de acción: Girar, Desactivar / Activar, Eliminar */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
          <Boton
            type="button"
            variante="secundario"
            tamano="pequeno"
            disabled={cargando}
            onClick={() => {
              alLimpiarError?.();
              alGirar(elemento.id);
            }}
            style={{ flex: '1 1 140px' }}
          >
            Girar (horizontal/vertical)
          </Boton>

          <Boton
            type="button"
            variante="secundario"
            tamano="pequeno"
            disabled={cargando}
            onClick={() => {
              alLimpiarError?.();
              setConfirmarAlternar(true);
            }}
            style={{ flex: '1 1 100px' }}
          >
            {elemento.activo ? 'Desactivar' : 'Activar'}
          </Boton>

          <Boton
            type="button"
            variante="peligro"
            tamano="pequeno"
            disabled={cargando}
            onClick={() => {
              alLimpiarError?.();
              setConfirmarEliminar(true);
            }}
            style={{ flex: '1 1 100px' }}
          >
            Eliminar
          </Boton>
        </div>

        {/* Mensaje de error (NO_CABE, SUPERPUESTO, etc.) */}
        {errorOperacion && (
          <div
            role="alert"
            style={{
              padding: '10px 12px',
              background: '#FBEDE9',
              border: '1.5px solid var(--cp-rust)',
              borderRadius: '10px',
              color: 'var(--cp-rust)',
              fontSize: '12px',
              fontWeight: 700,
              lineHeight: '16px',
            }}
          >
            {errorOperacion}
          </div>
        )}

        {/* Aviso de MESA_EN_USO con sugerencia de desactivarla */}
        {detallesMesaEnUso && (
          <div
            style={{
              padding: '12px',
              background: '#FFF8E6',
              border: '1.5px solid var(--cp-gold)',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div
              style={{
                fontWeight: 700,
                fontSize: '13px',
                color: 'var(--cp-rust)',
                lineHeight: '18px',
              }}
            >
              {detallesMesaEnUso.mensaje}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--cp-navy)' }}>
              Motivo: <b>{detallesMesaEnUso.motivo}</b>. Las mesas con actividad hoy no pueden eliminarse, pero puedes desactivarlas para que no aparezcan en nuevos pedidos.
            </div>
            <Boton
              type="button"
              variante="primario"
              tamano="pequeno"
              onClick={() => setConfirmarDesactivarMesaEnUso(true)}
            >
              Desactivar mesa en su lugar
            </Boton>
          </div>
        )}
      </div>

      {/* Confirmar eliminación */}
      <Confirmar
        abierto={confirmarEliminar}
        titulo={`¿Eliminar ${config.nombre.toLowerCase()}?`}
        mensaje={`Esta acción eliminará "${elemento.nombre || config.nombre}" del plano. Si es una mesa que ya se usó anteriormente, sus pedidos históricos conservarán el nombre. ¿Deseas continuar?`}
        textoSi="Sí, eliminar"
        textoNo="No, conservar"
        peligro
        cargando={cargando}
        alConfirmar={ejecutarEliminar}
        alCancelar={() => setConfirmarEliminar(false)}
      />

      {/* Confirmar desactivar / activar */}
      <Confirmar
        abierto={confirmarAlternar}
        titulo={elemento.activo ? '¿Desactivar elemento?' : '¿Activar elemento?'}
        mensaje={
          elemento.activo
            ? `Dejará de verse para el mozo al tomar pedidos de mesa. No se elimina y puedes activarlo de nuevo cuando desees.`
            : `Volverá a estar activo y disponible para el mozo en el plano del salón.`
        }
        textoSi={elemento.activo ? 'Sí, desactivar' : 'Sí, activar'}
        textoNo="No, cancelar"
        cargando={cargando}
        alConfirmar={ejecutarAlternar}
        alCancelar={() => setConfirmarAlternar(false)}
      />

      {/* Confirmar desactivar por MESA_EN_USO */}
      <Confirmar
        abierto={confirmarDesactivarMesaEnUso}
        titulo="¿Desactivar la mesa?"
        mensaje={`La mesa "${elemento.nombre || `Mesa ${elemento.numero}`}" quedará desactivada para nuevos pedidos mientras concluye su uso actual. ¿Deseas continuar?`}
        textoSi="Sí, desactivar mesa"
        textoNo="No, cancelar"
        cargando={cargando}
        alConfirmar={ejecutarDesactivarMesaEnUso}
        alCancelar={() => setConfirmarDesactivarMesaEnUso(false)}
      />
    </>
  );
}
