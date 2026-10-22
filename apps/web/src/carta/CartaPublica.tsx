import { PieLegal } from './legal';
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
import type { PaginaCarta } from './CabeceraCarta';
import { PortadaCarta } from './PortadaCarta';
import { PaginaConocenos } from './PaginaConocenos';
import { PaginaNovedades } from './PaginaNovedades';
import { CuentaProvider } from './cuenta/CuentaContext';
import { PanelCuenta } from './cuenta/PanelCuenta';
import { useEsMovil } from './useEsMovil';
import { TarjetaProducto } from './TarjetaProducto';
import { VentanaProducto } from './VentanaProducto';
import { CajonCarrito } from './CajonCarrito';
import { FormularioCheckout } from './FormularioCheckout';
import { PantallaConfirmacion } from './PantallaConfirmacion';
import { NotificacionAgregado } from './NotificacionAgregado';

// ponytail: notas fijas por categoría; el diseñador de la carta (FT-CON-02) las hará editables
const NOTAS_CATEGORIA: Record<string, string> = {
  COMBOS: 'Precio por tamaño de bebida',
  FRAPPES: 'Todos al mismo precio: 12 oz S/ 14.50 · 16 oz S/ 16.50 · 21 oz S/ 17.50',
  ICED: 'Bebidas frías con hielo',
  FROZEN: 'Solo tamaño extra de 21 oz',
  CALIENTES: 'Servidas en taza de vidrio',
  WAFFLES: 'Completo o 1/2',
  SALADOS: 'Hamburguesas, sándwiches, papas, petit pan y empanadas',
  CROISSANTS: 'Hojaldrados, hechos a mano',
  POSTRES: 'Donas, galletas, tortas y postres individuales',
};

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
  const [categoriaActivaId, setCategoriaActivaId] = useState<string>('todo');
  const [pagina, setPagina] = useState<PaginaCarta>('carta');
  const movil = useEsMovil();

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

  // Con «TODO» se ve la portada y todas las secciones; con una categoría, solo esa (como el mockup)
  const secciones = useMemo(() => {
    if (busqueda.trim() || categoriaActivaId === 'todo') return categoriasFiltradas;
    return categoriasFiltradas.filter((c) => c.id === categoriaActivaId);
  }, [categoriasFiltradas, categoriaActivaId, busqueda]);

  const fotoDestacada = useMemo(() => {
    const prod = categorias.flatMap((c) => c.productos).find((p) => p.nombre === 'FRAPPE MARACUYÁ' && p.fotoUrl);
    return prod?.fotoUrl ?? categorias.flatMap((c) => c.productos).find((p) => p.fotoUrl)?.fotoUrl ?? null;
  }, [categorias]);

  const irACarta = () => {
    setPagina('carta');
    setCategoriaActivaId('todo');
    setTimeout(() => document.getElementById('carta-lista')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const cambiarPagina = (p: PaginaCarta) => {
    setPagina(p);
    window.scrollTo({ top: 0 });
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
      {/* Cabecera pegajosa con las categorías dentro */}
      <CabeceraCarta
        busqueda={busqueda}
        onCambioBusqueda={setBusqueda}
        estadoLocal={estadoLocal}
        datosLocal={datosLocal}
        pagina={pagina}
        onPagina={cambiarPagina}
        categorias={categorias.map((c) => ({ id: c.id, nombre: c.nombre }))}
        categoriaActivaId={categoriaActivaId}
        onCategoria={(id) => {
          setCategoriaActivaId(id);
          setBusqueda('');
        }}
      />

      {pagina === 'conocenos' && <PaginaConocenos datosLocal={datosLocal} estadoLocal={estadoLocal} />}
      {pagina === 'novedades' && <PaginaNovedades onVerCarta={irACarta} />}

      {pagina === 'carta' && !busqueda.trim() && categoriaActivaId === 'todo' && (
        <PortadaCarta
          datosLocal={datosLocal}
          estadoLocal={estadoLocal}
          fotoDestacada={fotoDestacada}
          onPedir={irACarta}
          onVerCarta={irACarta}
        />
      )}

      {/* Lista de productos por categoría */}
      {pagina === 'carta' && (
      <main
        id="carta-lista"
        style={{
          maxWidth: '1200px',
          width: '100%',
          margin: '0 auto',
          padding: movil ? '8px 16px 48px' : '24px 24px 64px',
          flex: 1,
        }}
      >
        {secciones.length === 0 ? (
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
          secciones.map((cat) => (
            <section
              key={cat.id}
              id={`categoria-${cat.id}`}
              style={{
                marginTop: movil ? '24px' : '32px',
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
                    height: '3px',
                    backgroundColor: 'var(--cp-orange)',
                    borderRadius: '2px',
                  }}
                />
                <h2
                  style={{
                    fontFamily: 'var(--fuente-titulos)',
                    fontWeight: 800,
                    fontSize: movil ? '22px' : '28px',
                    lineHeight: movil ? '28px' : '34px',
                    letterSpacing: '0.03em',
                    color: 'var(--cp-navy)',
                    textAlign: 'center',
                  }}
                >
                  {cat.nombre}
                </h2>
                <span
                  style={{
                    flex: 1,
                    height: '3px',
                    backgroundColor: 'var(--cp-orange)',
                    borderRadius: '2px',
                  }}
                />
              </div>

              {NOTAS_CATEGORIA[cat.nombre.toUpperCase()] && (
                <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--cp-soft)', margin: '-8px 0 16px' }}>
                  {NOTAS_CATEGORIA[cat.nombre.toUpperCase()]}
                </div>
              )}

              {/* Grid de productos responsiva */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
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
      )}

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

      {/* Pie con términos, privacidad y libro de reclamaciones */}
      <PieLegal />

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

      {/* Cuenta del cliente */}
      <PanelCuenta />
    </div>
  );
}

export function CartaPublica() {
  return (
    <CarritoProvider>
      <CuentaProvider>
        <ContenidoCartaPublica />
      </CuentaProvider>
    </CarritoProvider>
  );
}
