import { useEffect, useState, useTransition } from 'react';
import type { ClienteItem } from './tipos';
import {
  listarClientes,
  cambiarEstadoCliente,
  type FiltrosClientes,
} from './clientesApi';
import { ModalNuevoCliente } from './ModalNuevoCliente';
import { ModalFichaCliente } from './ModalFichaCliente';
import { ModalEditarCliente } from './ModalEditarCliente';
import { BarraFiltros, FiltroCombo } from '../../comun/FiltroCombo';

export function ClientesAdminView() {
  const [, startTransition] = useTransition();
  const [clientes, setClientes] = useState<ClienteItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [total, setTotal] = useState(0);
  const [paginas, setPaginas] = useState(1);
  const [pagina, setPagina] = useState(1);

  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<string>('Todos');
  const [filtroCredito, setFiltroCredito] = useState<string>('Todos');
  const [filtroRegistro, setFiltroRegistro] = useState<string>('Todos');

  // Modales
  const [modalNuevoAbierto, setModalNuevoAbierto] = useState(false);
  const [clienteFicha, setClienteFicha] = useState<ClienteItem | null>(null);
  const [clienteEditar, setClienteEditar] = useState<ClienteItem | null>(null);

  // Confirmación de activar/desactivar
  const [confirmarEstado, setConfirmarEstado] = useState<{
    cliente: ClienteItem;
    nuevoEstado: boolean;
  } | null>(null);
  const [guardandoEstado, setGuardandoEstado] = useState(false);

  const cargarDatos = (pg: number = pagina) => {
    setCargando(true);
    const filtros: FiltrosClientes = {
      q: busqueda.trim() || undefined,
      tipo: filtroTipo !== 'Todos' ? filtroTipo : undefined,
      creditoPersonal: filtroCredito !== 'Todos' ? filtroCredito : undefined,
      estado: filtroRegistro !== 'Todos' ? filtroRegistro : undefined,
      pagina: pg,
      limite: 6,
    };

    listarClientes(filtros)
      .then((res) => {
        startTransition(() => {
          setClientes(res.items);
          setTotal(res.total);
          setPaginas(res.paginas || 1);
          setPagina(res.pagina || 1);
        });
      })
      .catch(() => {
        setClientes([]);
        setTotal(0);
        setPaginas(1);
      })
      .finally(() => setCargando(false));
  };

  useEffect(() => {
    cargarDatos(1);
  }, [busqueda, filtroTipo, filtroCredito, filtroRegistro]);

  const numFiltrosActivos = (filtroTipo !== 'Todos' ? 1 : 0) +
    (filtroCredito !== 'Todos' ? 1 : 0) +
    (filtroRegistro !== 'Todos' ? 1 : 0);

  const limpiarFiltros = () => {
    setFiltroTipo('Todos');
    setFiltroCredito('Todos');
    setFiltroRegistro('Todos');
    setBusqueda('');
  };

  const ejecutarCambioEstado = async () => {
    if (!confirmarEstado) return;
    setGuardandoEstado(true);
    try {
      await cambiarEstadoCliente(confirmarEstado.cliente.id, confirmarEstado.nuevoEstado);
      setConfirmarEstado(null);
      cargarDatos(pagina);
    } catch {
      setConfirmarEstado(null);
    } finally {
      setGuardandoEstado(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 1. Nota explicativa */}
      <div
        style={{
          border: '1px solid var(--cp-line)',
          background: 'var(--cp-white)',
          borderRadius: 12,
          padding: '12px 14px',
          fontSize: 13,
          lineHeight: '19px',
        }}
      >
        <b>Nota.</b> Historial de quienes piden. Quien compra como invitado no suma puntos; quien crea
        cuenta (correo, cumpleaños y su visto bueno para guardar sus datos) suma puntos: el % del
        total que se define en Configuración. Nunca se obliga a crear cuenta.
      </div>

      {/* 2. Botón Nuevo Cliente */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={() => setModalNuevoAbierto(true)}
          style={{
            minHeight: 48,
            padding: '0 18px',
            border: 0,
            borderRadius: 12,
            background: 'var(--cp-orange)',
            color: 'var(--cp-navy)',
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 800,
            fontSize: 15,
            cursor: 'pointer',
          }}
        >
          + Nuevo cliente
        </button>
      </div>

      {/* 3. Comentarios de los clientes */}
      <div
        style={{
          background: 'var(--cp-white)',
          border: '2px solid var(--cp-orange)',
          borderRadius: 12,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 16 }}>
          Comentarios de los clientes
        </div>
        <div style={{ fontSize: 13, lineHeight: '19px', color: 'var(--cp-soft)' }}>
          Llegan desde &quot;¿Cómo te fue en Caprichos?&quot; al final de la carta virtual. Las quejas
          se avisan al correo del dueño (Configuración del local). Nada se elimina: se marca como
          atendido.
        </div>
        <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>
          Todavía no hay comentarios. Escribe uno desde la carta para ver cómo llega.
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 10,
          }}
        />
      </div>

      {/* 4. Buscador y Filtros */}
      <div
        style={{
          background: 'var(--cp-white)',
          border: '1px solid var(--cp-line)',
          borderRadius: 12,
          padding: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label htmlFor="t-q" style={{ position: 'absolute', left: -9999 }}>
            Buscar
          </label>
          <input
            id="t-q"
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o celular"
            style={{
              flex: '1 1 0%',
              minWidth: 0,
              boxSizing: 'border-box',
              minHeight: 44,
              borderRadius: 9999,
              border: '1.5px solid var(--cp-line)',
              background: 'var(--cp-cream)',
              color: 'var(--cp-navy)',
              padding: '0 14px',
              fontSize: 14,
            }}
          />
          <button
            type="button"
            onClick={() => setFiltrosAbiertos(!filtrosAbiertos)}
            aria-expanded={filtrosAbiertos}
            style={{
              flex: 'none',
              minHeight: 44,
              padding: '0 12px',
              borderRadius: 9999,
              border: '1.5px solid var(--cp-navy)',
              background: filtrosAbiertos || numFiltrosActivos > 0 ? 'var(--cp-navy)' : 'transparent',
              color: filtrosAbiertos || numFiltrosActivos > 0 ? 'var(--cp-cream)' : 'var(--cp-navy)',
              fontWeight: 700,
              fontSize: 13,
              display: 'inline-flex',
              gap: 6,
              alignItems: 'center',
              cursor: 'pointer',
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 5h18l-7 8v6l-4 2v-8z" />
            </svg>
            Filtros
            {numFiltrosActivos > 0 && (
              <span
                style={{
                  minWidth: 20,
                  height: 20,
                  boxSizing: 'border-box',
                  borderRadius: 10,
                  background: 'var(--cp-orange)',
                  color: 'var(--cp-navy)',
                  fontSize: 12,
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 5px',
                }}
              >
                {numFiltrosActivos}
              </span>
            )}
          </button>
        </div>

        {/* Panel de Filtros desplegable */}
        {filtrosAbiertos && (
          <BarraFiltros style={{ borderTop: '1px solid var(--cp-line)', paddingTop: 8 }}>
            {/* Filtros en combo: tipo, crédito del personal y registro */}
            <FiltroCombo
              etiqueta="Tipo"
              valor={filtroTipo}
              opciones={['Todos', 'Persona', 'Empresa', 'Personal'].map((o) => ({ valor: o, etiqueta: o }))}
              alCambiar={setFiltroTipo}
            />
            <FiltroCombo
              etiqueta="Crédito del personal"
              valor={filtroCredito}
              opciones={['Todos', 'Sí', 'No'].map((o) => ({ valor: o, etiqueta: o }))}
              alCambiar={setFiltroCredito}
            />
            <FiltroCombo
              etiqueta="Registro"
              valor={filtroRegistro}
              opciones={['Todos', 'Activos', 'Desactivados'].map((o) => ({ valor: o, etiqueta: o }))}
              alCambiar={setFiltroRegistro}
            />

            {/* Botones Limpiar y Listo */}
            <div
              style={{
                flex: '1 1 100%',
                display: 'flex',
                gap: 8,
                justifyContent: 'flex-end',
                marginTop: 4,
              }}
            >
              <button
                type="button"
                onClick={limpiarFiltros}
                style={{
                  minHeight: 34,
                  padding: '0 10px',
                  border: 0,
                  background: 'transparent',
                  color: 'var(--cp-rust)',
                  fontWeight: 700,
                  fontSize: 13,
                  textDecoration: 'underline',
                  cursor: 'pointer',
                }}
              >
                Limpiar filtros
              </button>
              <button
                type="button"
                onClick={() => setFiltrosAbiertos(false)}
                style={{
                  minHeight: 34,
                  padding: '0 16px',
                  border: 0,
                  borderRadius: 10,
                  background: 'var(--cp-navy)',
                  color: 'var(--cp-cream)',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Listo
              </button>
            </div>
          </BarraFiltros>
        )}

        <div style={{ fontSize: 13, color: 'var(--cp-soft)', fontWeight: 600 }}>
          {total} {total === 1 ? 'resultado' : 'resultados'}
        </div>
      </div>

      {/* 5. Tarjetas de clientes */}
      {cargando ? (
        <div
          style={{
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: 12,
            padding: 24,
            textAlign: 'center',
            color: 'var(--cp-soft)',
          }}
        >
          Cargando clientes...
        </div>
      ) : clientes.length === 0 ? (
        <div
          style={{
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: 12,
            padding: 24,
            textAlign: 'center',
            color: 'var(--cp-soft)',
          }}
        >
          Nada coincide con los filtros.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))',
            gap: 12,
          }}
        >
          {clientes.map((c) => {
            const off = !c.activo;
            return (
              <div
                key={c.id}
                style={{
                  background: 'var(--cp-white)',
                  border: '1px solid var(--cp-line)',
                  borderRadius: 12,
                  boxShadow: '0 6px 18px rgba(11,44,62,0.10)',
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  opacity: off ? 0.6 : 1,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'Montserrat, sans-serif',
                      fontWeight: 800,
                      fontSize: 16,
                      lineHeight: '21px',
                      minWidth: 0,
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {c.nombre}
                  </div>
                  {off && (
                    <span
                      style={{
                        flex: 'none',
                        fontSize: 12,
                        fontWeight: 700,
                        borderRadius: 9999,
                        padding: '2px 10px',
                        background: 'var(--cp-line)',
                        color: 'var(--cp-soft)',
                      }}
                    >
                      Desactivado
                    </span>
                  )}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: '8px 12px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--cp-soft)' }}>
                      Tipo
                    </div>
                    <div style={{ fontSize: 13, lineHeight: '18px', overflowWrap: 'anywhere' }}>
                      {c.tipo}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--cp-soft)' }}>
                      Teléfono
                    </div>
                    <div style={{ fontSize: 13, lineHeight: '18px', overflowWrap: 'anywhere' }}>
                      {c.telefono || '—'}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--cp-soft)' }}>
                      Correo (opcional)
                    </div>
                    <div style={{ fontSize: 13, lineHeight: '18px', overflowWrap: 'anywhere' }}>
                      {c.correo || 'sin correo'}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--cp-soft)' }}>
                      Cumpleaños
                    </div>
                    <div style={{ fontSize: 13, lineHeight: '18px', overflowWrap: 'anywhere' }}>
                      {c.cumpleanos || '—'}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--cp-soft)' }}>
                      Pedidos
                    </div>
                    <div style={{ fontSize: 13, lineHeight: '18px', overflowWrap: 'anywhere' }}>
                      {c.pedidos}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--cp-soft)' }}>
                      Puntos
                    </div>
                    <div style={{ fontSize: 13, lineHeight: '18px', overflowWrap: 'anywhere' }}>
                      {c.puntos}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--cp-soft)' }}>
                      Crédito del personal
                    </div>
                    <div style={{ fontSize: 13, lineHeight: '18px', overflowWrap: 'anywhere' }}>
                      {c.creditoPersonal ? 'Sí' : 'No'}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--cp-soft)' }}>
                      Envío fijo (s/)
                    </div>
                    <div style={{ fontSize: 13, lineHeight: '18px', overflowWrap: 'anywhere' }}>
                      {c.envioFijo !== null && c.envioFijo !== undefined ? String(c.envioFijo) : '—'}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--cp-soft)' }}>
                      Descuento de envío (%)
                    </div>
                    <div style={{ fontSize: 13, lineHeight: '18px', overflowWrap: 'anywhere' }}>
                      {c.descuentoEnvio !== null && c.descuentoEnvio !== undefined ? String(c.descuentoEnvio) : '—'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                  <button
                    type="button"
                    onClick={() => setClienteEditar(c)}
                    style={{
                      flex: 1,
                      minHeight: 44,
                      border: '1.5px solid var(--cp-navy)',
                      borderRadius: 12,
                      background: 'transparent',
                      color: 'var(--cp-navy)',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Editar
                  </button>

                  <button
                    type="button"
                    onClick={() => setConfirmarEstado({ cliente: c, nuevoEstado: off })}
                    style={{
                      flex: 1,
                      minHeight: 44,
                      border: '1.5px solid var(--cp-navy)',
                      borderRadius: 12,
                      background: off ? 'var(--cp-orange)' : 'transparent',
                      color: 'var(--cp-navy)',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {off ? 'Activar' : 'Desactivar'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setClienteFicha(c)}
                    style={{
                      flex: 1.2,
                      minHeight: 44,
                      border: 0,
                      borderRadius: 12,
                      background: 'var(--cp-orange)',
                      color: 'var(--cp-navy)',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Ver historial
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 6. Nota de que nada se elimina */}
      <div style={{ fontSize: 12, color: 'var(--cp-soft)', textAlign: 'center' }}>
        Aquí no se elimina nada: los registros se desactivan y se pueden volver a activar.
      </div>

      {/* 7. Paginación */}
      {paginas > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 6 }}>
          <button
            type="button"
            disabled={pagina <= 1}
            onClick={() => {
              if (pagina > 1) {
                setPagina(pagina - 1);
                cargarDatos(pagina - 1);
              }
            }}
            style={{
              minHeight: 44,
              padding: '0 12px',
              borderRadius: 12,
              border: '1.5px solid var(--cp-navy)',
              background: 'transparent',
              color: 'var(--cp-navy)',
              fontWeight: 700,
              cursor: pagina <= 1 ? 'not-allowed' : 'pointer',
              opacity: pagina <= 1 ? 0.35 : 1,
            }}
          >
            ← Anterior
          </button>

          {Array.from({ length: paginas }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setPagina(p);
                cargarDatos(p);
              }}
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                border: '1.5px solid var(--cp-navy)',
                background: p === pagina ? 'var(--cp-navy)' : 'transparent',
                color: p === pagina ? 'var(--cp-cream)' : 'var(--cp-navy)',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {p}
            </button>
          ))}

          <button
            type="button"
            disabled={pagina >= paginas}
            onClick={() => {
              if (pagina < paginas) {
                setPagina(pagina + 1);
                cargarDatos(pagina + 1);
              }
            }}
            style={{
              minHeight: 44,
              padding: '0 12px',
              borderRadius: 12,
              border: '1.5px solid var(--cp-navy)',
              background: 'transparent',
              color: 'var(--cp-navy)',
              fontWeight: 700,
              cursor: pagina >= paginas ? 'not-allowed' : 'pointer',
              opacity: pagina >= paginas ? 0.35 : 1,
            }}
          >
            Siguiente →
          </button>
        </div>
      )}

      {/* Modales */}
      <ModalNuevoCliente
        abierto={modalNuevoAbierto}
        alCerrar={() => setModalNuevoAbierto(false)}
        alGuardarExitoso={() => cargarDatos(1)}
      />

      <ModalFichaCliente
        abierto={!!clienteFicha}
        cliente={clienteFicha}
        alCerrar={() => setClienteFicha(null)}
        alPuntosActualizados={() => cargarDatos(pagina)}
      />

      <ModalEditarCliente
        abierto={!!clienteEditar}
        cliente={clienteEditar}
        alCerrar={() => setClienteEditar(null)}
        alGuardarExitoso={() => cargarDatos(pagina)}
      />

      {/* Confirmación Activar / Desactivar */}
      {confirmarEstado && (
        <>
          <div
            onClick={() => !guardandoEstado && setConfirmarEstado(null)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 80,
              background: 'rgba(11,44,62,0.6)',
            }}
          />
          <div
            role="alertdialog"
            aria-label="Confirmar acción"
            style={{
              position: 'fixed',
              zIndex: 90,
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'min(420px, calc(100% - 24px))',
              background: 'var(--cp-cream)',
              borderRadius: 20,
              boxShadow: '0 20px 50px rgba(11,44,62,0.45)',
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: 20,
                lineHeight: '26px',
              }}
            >
              ¿{confirmarEstado.nuevoEstado ? 'Activar' : 'Desactivar'} &quot;{confirmarEstado.cliente.nombre}&quot;?
            </div>
            <div style={{ fontSize: 14, lineHeight: '20px', color: 'var(--cp-soft)' }}>
              {confirmarEstado.nuevoEstado
                ? 'Volverá a estar activo.'
                : 'Quedará desactivado. No se elimina y se puede activar de nuevo.'}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button
                type="button"
                onClick={ejecutarCambioEstado}
                disabled={guardandoEstado}
                style={{
                  flex: 1,
                  minHeight: 52,
                  border: 0,
                  borderRadius: 12,
                  background: 'var(--cp-orange)',
                  color: 'var(--cp-navy)',
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 800,
                  fontSize: 16,
                  cursor: 'pointer',
                }}
              >
                Sí
              </button>
              <button
                type="button"
                onClick={() => setConfirmarEstado(null)}
                disabled={guardandoEstado}
                style={{
                  flex: 1,
                  minHeight: 52,
                  border: '1.5px solid var(--cp-navy)',
                  borderRadius: 12,
                  background: 'transparent',
                  color: 'var(--cp-navy)',
                  fontWeight: 800,
                  fontSize: 16,
                  cursor: 'pointer',
                }}
              >
                No
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
