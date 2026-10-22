import { useEffect, useState, useMemo } from 'react';
import { api } from '../comun/api';
import { Cargando } from '../comun/Cargando';
import { EstadoError } from '../comun/EstadoError';
import {
  CategoriaCarta,
  DatosLocalCarta,
  EstadoLocalCarta,
} from './tipos';
import { CarritoProvider, useCarrito } from './CarritoContext';
import { CabeceraCarta } from './CabeceraCarta';
import { ChipsCategorias } from './ChipsCategorias';
import { TarjetaProducto } from './TarjetaProducto';
import { VentanaProducto } from './VentanaProducto';
import { CajonCarrito } from './CajonCarrito';
import { FormularioCheckout } from './FormularioCheckout';
import { PantallaConfirmacion } from './PantallaConfirmacion';
import { NotificacionAgregado } from './NotificacionAgregado';

function normalizarTexto(txt: string): string {
  return txt
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function ContenidoCartaPublica() {
  const [categorias, setCategorias] = useState<CategoriaCarta[]>([]);
  const [estadoLocal, setEstadoLocal] = useState<EstadoLocalCarta | null>(null);
  const [datosLocal, setDatosLocal] = useState<DatosLocalCarta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState('');
  const [categoriaActivaId, setCategoriaActivaId] = useState<string | null>(null);

  const { productoEnModal, cerrarModalProducto } = useCarrito();

  const cargarDatos = async () => {
    setCargando(true);
    setError(null);
    try {
      const [resCarta, resEstado, resLocal] = await Promise.all([
        api.get<CategoriaCarta[]>('/carta'),
        api.get<EstadoLocalCarta>('/carta/estado').catch(() => null),
        api.get<DatosLocalCarta>('/carta/local').catch(() => null),
      ]);

      setCategorias(Array.isArray(resCarta) ? resCarta : []);
      if (resEstado) setEstadoLocal(resEstado);
      if (resLocal) setDatosLocal(resLocal);

      if (Array.isArray(resCarta) && resCarta.length > 0) {
        setCategoriaActivaId(resCarta[0].id);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo cargar la carta. Por favor verifica tu conexión.',
      );
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  // Filtrado reactivo de categorías y productos por término de búsqueda
  const categoriasFiltradas = useMemo(() => {
    const qLimpio = normalizarTexto(busqueda.trim());
    if (!qLimpio) return categorias;

    const terminos = qLimpio.split(/\s+/).filter(Boolean);

    return categorias
      .map((cat) => {
        const productosCoincidentes = cat.productos.filter((prod) => {
          const texto = normalizarTexto(`${prod.nombre} ${prod.descripcion || ''}`);
          return terminos.every((t) => texto.includes(t));
        });

        return {
          ...cat,
          productos: productosCoincidentes,
        };
      })
      .filter((cat) => cat.productos.length > 0);
  }, [categorias, busqueda]);

  const seleccionarCategoria = (id: string) => {
    setCategoriaActivaId(id);
    const elem = document.getElementById(`categoria-${id}`);
    if (elem) {
      const yOffset = -140; // compensación por barra de cabecera y chips
      const y = elem.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  if (cargando) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--cp-cream)',
        }}
      >
        <Cargando mensaje="Cargando la carta..." />
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          backgroundColor: 'var(--cp-cream)',
        }}
      >
        <EstadoError
          mensaje={error}
          alReintentar={cargarDatos}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--cp-cream)',
        color: 'var(--cp-navy)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Cabecera pegajosa */}
      <CabeceraCarta
        busqueda={busqueda}
        onCambioBusqueda={setBusqueda}
        estadoLocal={estadoLocal}
      />

      {/* Chips de categorías */}
      <ChipsCategorias
        categorias={categoriasFiltradas}
        categoriaActivaId={categoriaActivaId}
        onSeleccionarCategoria={seleccionarCategoria}
      />

      {/* Lista de productos por categoría */}
      <main
        style={{
          maxWidth: '1200px',
          width: '100%',
          margin: '0 auto',
          padding: '20px 16px 64px',
          flex: 1,
        }}
      >
        {categoriasFiltradas.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '64px 20px',
              color: 'var(--cp-soft)',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--fuente-titulos)',
                fontWeight: 800,
                fontSize: '20px',
                color: 'var(--cp-navy)',
                marginBottom: '8px',
              }}
            >
              No encontramos resultados para &ldquo;{busqueda}&rdquo;
            </div>
            <p style={{ margin: 0, fontSize: '14px' }}>
              Prueba con otra palabra o borra el buscador para ver toda la carta.
            </p>
            <button
              onClick={() => setBusqueda('')}
              style={{
                marginTop: '16px',
                minHeight: '44px',
                padding: '0 20px',
                borderRadius: '12px',
                border: 0,
                backgroundColor: 'var(--cp-orange)',
                color: '#FFFFFF',
                fontFamily: 'var(--fuente-titulos)',
                fontWeight: 800,
                fontSize: '14px',
              }}
            >
              Ver toda la carta
            </button>
          </div>
        ) : (
          categoriasFiltradas.map((cat) => (
            <section
              key={cat.id}
              id={`categoria-${cat.id}`}
              style={{
                marginTop: '28px',
                scrollMarginTop: '140px',
              }}
            >
              {/* Título de categoría estilo mockup con líneas decorativas */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '16px',
                }}
              >
                <span
                  style={{
                    flex: 1,
                    height: '2.5px',
                    backgroundColor: 'var(--cp-orange)',
                    borderRadius: '2px',
                    opacity: 0.85,
                  }}
                />
                <h2
                  style={{
                    fontFamily: 'var(--fuente-titulos)',
                    fontWeight: 800,
                    fontSize: '22px',
                    lineHeight: '26px',
                    letterSpacing: '0.04em',
                    color: 'var(--cp-navy)',
                    textAlign: 'center',
                  }}
                >
                  {cat.nombre}
                </h2>
                <span
                  style={{
                    flex: 1,
                    height: '2.5px',
                    backgroundColor: 'var(--cp-orange)',
                    borderRadius: '2px',
                    opacity: 0.85,
                  }}
                />
              </div>

              {/* Grid de productos responsiva */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                  gap: '16px',
                }}
              >
                {cat.productos.map((prod) => (
                  <TarjetaProducto key={prod.id} producto={prod} />
                ))}
              </div>
            </section>
          ))
        )}
      </main>

      {/* Pie informativo */}
      <footer
        style={{
          borderTop: '1px solid var(--cp-line)',
          backgroundColor: 'var(--cp-sand)',
          padding: '24px 16px',
          textAlign: 'center',
          fontSize: '12px',
          color: 'var(--cp-soft)',
        }}
      >
        <div style={{ fontWeight: 700, color: 'var(--cp-navy)', marginBottom: '4px' }}>
          {datosLocal?.nombre || 'Caprichos'}
        </div>
        <div>{datosLocal?.direccion || 'Av. Principal 123'} · Tel: {datosLocal?.telefono || '999888777'}</div>
      </footer>

      {/* Ventana modal de detalle del producto */}
      {productoEnModal && (
        <VentanaProducto
          producto={productoEnModal}
          onCerrar={cerrarModalProducto}
        />
      )}

      {/* Cajón lateral del carrito */}
      <CajonCarrito estadoLocal={estadoLocal} />

      {/* Formulario de Checkout */}
      <FormularioCheckout
        estadoLocal={estadoLocal}
        datosLocal={datosLocal}
      />

      {/* Pantalla de confirmación de pedido */}
      <PantallaConfirmacion />

      {/* Notificación Toast "Agregado a tu pedido" */}
      <NotificacionAgregado />
    </div>
  );
}

export function CartaPublica() {
  return (
    <CarritoProvider>
      <ContenidoCartaPublica />
    </CarritoProvider>
  );
}
