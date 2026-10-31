import { useCallback, useEffect, useState } from 'react';
import { Confirmar } from '../../comun/Confirmar';
import { FiltroCombo } from '../../comun/FiltroCombo';
import { useEventos } from '../../comun/socket';
import { EditarPantallaModal } from './EditarPantallaModal';
import {
  activarPantalla,
  desactivarPantalla,
  listarAreasPantalla,
  listarPantallas,
  vincularPantalla,
} from './pantallasApi';
import { AreaCocinaItem, PantallaItem } from './pantallasTipos';

export function PantallasView() {
  const [cargando, setCargando] = useState(true);
  const [pantallas, setPantallas] = useState<PantallaItem[]>([]);
  const [areas, setAreas] = useState<AreaCocinaItem[]>([]);

  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [filtroEstacion, setFiltroEstacion] = useState('Todas');

  // Formulario Vincular
  const [pairCode, setPairCode] = useState('');
  const [pairMsg, setPairMsg] = useState<{ texto: string; error?: boolean } | null>(null);
  const [vinculando, setVinculando] = useState(false);

  // Modales
  const [pantallaAEditar, setPantallaAEditar] = useState<PantallaItem | null>(null);
  const [confirmarAccion, setConfirmarAccion] = useState<{
    titulo: string;
    mensaje: string;
    textoSi?: string;
    peligro?: boolean;
    accion: () => Promise<void>;
  } | null>(null);

  // Cargar lista
  const cargar = useCallback(async () => {
    try {
      const res = await listarPantallas(busqueda, filtroEstacion);
      setPantallas(res.pantallas);
    } catch {
      // Ignorar error transitorio
    } finally {
      setCargando(false);
    }
  }, [busqueda, filtroEstacion]);

  // Cargar áreas
  useEffect(() => {
    listarAreasPantalla()
      .then((a) => setAreas(a))
      .catch(() => {});
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Escuchar eventos en vivo
  useEventos('pantallas:actualizado', () => cargar());

  // Vincular pantalla con código
  const handleIntentarVincular = () => {
    const code = pairCode.trim().toUpperCase();
    if (code.length < 6) {
      setPairMsg({
        texto: 'Escribe el código completo que aparece en la TV (6 caracteres).',
        error: true,
      });
      return;
    }
    setPairMsg(null);
    setConfirmarAccion({
      titulo: '¿Vincular esta pantalla?',
      mensaje: `La TV con el código ${code} empezará a mostrar los pedidos de cocina. No podrá cambiar nada.`,
      textoSi: 'Sí, vincular',
      accion: async () => {
        setVinculando(true);
        try {
          const res = await vincularPantalla({ codigo: code });
          setPairMsg({ texto: res.mensaje, error: false });
          setPairCode('');
          await cargar();
        } catch (err: any) {
          setPairMsg({ texto: err?.message || 'Error al vincular pantalla', error: true });
        } finally {
          setVinculando(false);
        }
      },
    });
  };

  // Alternar activar/desactivar
  const handleToggleEstado = (p: PantallaItem) => {
    const activar = !p.activo;
    setConfirmarAccion({
      titulo: activar ? `¿Activar ${p.nombre}?` : `¿Desactivar ${p.nombre}?`,
      mensaje: activar
        ? 'La pantalla volverá a recibir pedidos en vivo.'
        : 'La pantalla dejará de mostrar pedidos hasta que sea activada nuevamente.',
      textoSi: activar ? 'Sí, activar' : 'Sí, desactivar',
      peligro: !activar,
      accion: async () => {
        if (activar) await activarPantalla(p.id);
        else await desactivarPantalla(p.id);
        await cargar();
      },
    });
  };

  const pluralResultados =
    pantallas.length === 1 ? '1 resultado' : `${pantallas.length} resultados`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Barra de Búsqueda y Filtros */}
      <div
        style={{
          background: 'var(--cp-white)',
          border: '1px solid var(--cp-line)',
          borderRadius: '12px',
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <label htmlFor="t-q" style={{ position: 'absolute', left: '-9999px' }}>
            Buscar
          </label>
          <input
            id="t-q"
            type="search"
            placeholder="Buscar pantalla"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{
              flex: '1 1 0%',
              minWidth: 0,
              boxSizing: 'border-box',
              minHeight: '44px',
              borderRadius: '9999px',
              border: '1.5px solid var(--cp-line)',
              background: 'var(--cp-cream)',
              color: 'var(--cp-navy)',
              padding: '0 14px',
              fontSize: '14px',
            }}
          />
          <button
            aria-expanded={mostrarFiltros}
            onClick={() => setMostrarFiltros((prev) => !prev)}
            style={{
              flex: '0 0 auto',
              minHeight: '44px',
              padding: '0 12px',
              borderRadius: '9999px',
              border: '1.5px solid var(--cp-navy)',
              background: mostrarFiltros ? 'var(--cp-navy)' : 'transparent',
              color: mostrarFiltros ? 'var(--cp-cream)' : 'var(--cp-navy)',
              fontWeight: 700,
              fontSize: '13px',
              display: 'inline-flex',
              gap: '6px',
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
          </button>
        </div>

        {/* Desplegable de Filtros */}
        {mostrarFiltros && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 6px 2px',
              flexWrap: 'wrap',
            }}
          >
            <FiltroCombo
              etiqueta="Estación"
              valor={filtroEstacion}
              valorPorDefecto="Todas"
              opciones={['Todas', 'Cocina y barra', 'Solo barra', 'Solo cocina'].map((est) => ({ valor: est, etiqueta: est }))}
              alCambiar={setFiltroEstacion}
            />
          </div>
        )}

        <div style={{ fontSize: '13px', color: 'var(--cp-soft)', fontWeight: 600, padding: '0 4px' }}>
          {pluralResultados}
        </div>
      </div>

      {/* Grid de Tarjetas de Pantallas */}
      {cargando ? (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--cp-soft)' }}>
          Cargando pantallas...
        </div>
      ) : pantallas.length === 0 ? (
        <div
          style={{
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: '12px',
            padding: '24px',
            textAlign: 'center',
            color: 'var(--cp-soft)',
            fontSize: '14px',
          }}
        >
          No hay pantallas vinculadas que coincidan con la búsqueda.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))',
            gap: '12px',
          }}
        >
          {pantallas.map((p) => (
            <div
              key={p.id}
              style={{
                background: 'var(--cp-white)',
                border: '1px solid var(--cp-line)',
                borderRadius: '12px',
                boxShadow: 'rgba(11, 44, 62, 0.1) 0px 6px 18px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                opacity: p.activo ? 1 : 0.7,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '8px',
                }}
              >
                <div
                  style={{
                    fontFamily: 'Montserrat, sans-serif',
                    fontWeight: 800,
                    fontSize: '16px',
                    lineHeight: '21px',
                    minWidth: 0,
                    overflowWrap: 'anywhere',
                  }}
                >
                  {p.nombre}
                </div>
                <span
                  style={{
                    flex: '0 0 auto',
                    fontSize: '12px',
                    fontWeight: 700,
                    borderRadius: '9999px',
                    padding: '2px 10px',
                    background: p.activo ? 'var(--cp-navy)' : 'var(--cp-line)',
                    color: p.activo ? 'var(--cp-cream)' : 'var(--cp-navy)',
                  }}
                >
                  {p.activo ? 'Activa' : 'Desactivada'}
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0px, 1fr))',
                  gap: '8px 12px',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--cp-soft)' }}>
                    Estación
                  </div>
                  <div style={{ fontSize: '13px', lineHeight: '18px', overflowWrap: 'anywhere' }}>
                    {p.estacion}
                  </div>
                </div>

                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--cp-soft)' }}>
                    Última conexión
                  </div>
                  <div style={{ fontSize: '13px', lineHeight: '18px', overflowWrap: 'anywhere' }}>
                    {p.ultimaConexion}
                  </div>
                </div>

                <div style={{ minWidth: 0, gridColumn: 'span 2' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--cp-soft)' }}>
                    Llave
                  </div>
                  <div style={{ fontSize: '13px', lineHeight: '18px', overflowWrap: 'anywhere' }}>
                    {p.llave}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                <button
                  style={{
                    flex: '1 1 0%',
                    minHeight: '44px',
                    border: '1.5px solid var(--cp-navy)',
                    borderRadius: '12px',
                    background: 'transparent',
                    color: 'var(--cp-navy)',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                  onClick={() => setPantallaAEditar(p)}
                >
                  Editar
                </button>
                <button
                  style={{
                    flex: '1 1 0%',
                    minHeight: '44px',
                    border: '1.5px solid var(--cp-navy)',
                    borderRadius: '12px',
                    background: 'transparent',
                    color: 'var(--cp-navy)',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                  onClick={() => handleToggleEstado(p)}
                >
                  {p.activo ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--cp-soft)' }}>
        Aquí no se elimina nada: los registros se desactivan y se pueden volver a activar.
      </div>

      {/* Card Vincular Pantalla Nueva */}
      <div
        style={{
          background: 'var(--cp-white)',
          border: '1px solid var(--cp-line)',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '16px' }}>
          Vincular una pantalla nueva
        </div>
        <div style={{ fontSize: '13px', lineHeight: '19px', color: 'var(--cp-soft)' }}>
          1) En la TV abre la dirección de pantallas de Caprichos. 2) La TV muestra un código de 6 caracteres. 3) Escríbelo aquí y pulsa Vincular. La pantalla solo verá pedidos de cocina: sin teléfono ni dirección del cliente, y no entra al administrativo. Si se pierde o se filtra, desactívala en la lista.
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <label htmlFor="pair-code" style={{ position: 'absolute', left: '-9999px' }}>
            Código que muestra la TV
          </label>
          <input
            id="pair-code"
            type="text"
            maxLength={7}
            placeholder="Ejemplo: K7M-4QX"
            value={pairCode}
            onChange={(e) => {
              setPairCode(e.target.value.toUpperCase());
              setPairMsg(null);
            }}
            style={{
              flex: '1 1 200px',
              boxSizing: 'border-box',
              minHeight: '48px',
              borderRadius: '12px',
              border: '1.5px solid var(--cp-navy)',
              background: 'var(--cp-cream)',
              color: 'var(--cp-navy)',
              padding: '0 14px',
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '18px',
              letterSpacing: '0.12em',
            }}
          />
          <button
            style={{
              flex: '0 0 auto',
              minHeight: '48px',
              padding: '0 22px',
              border: 0,
              borderRadius: '12px',
              background: 'var(--cp-orange)',
              color: 'var(--cp-navy)',
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              cursor: 'pointer',
            }}
            disabled={vinculando}
            onClick={handleIntentarVincular}
          >
            Vincular pantalla
          </button>
        </div>

        {pairMsg && (
          <div
            role="status"
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: pairMsg.error ? 'var(--cp-rust)' : 'var(--cp-green)',
            }}
          >
            {pairMsg.texto}
          </div>
        )}
      </div>

      {/* Modal Editar Pantalla */}
      {pantallaAEditar && (
        <EditarPantallaModal
          pantalla={pantallaAEditar}
          areas={areas}
          alCerrar={() => setPantallaAEditar(null)}
          alGuardarExitoso={cargar}
        />
      )}

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
    </div>
  );
}
