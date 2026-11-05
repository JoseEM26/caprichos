import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { almacenApi, AperturaDiaRespuesta, AperturaProductoItem } from './almacenApi';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { Confirmar } from '../../comun/Confirmar';
import { EstadoError } from '../../comun/EstadoError';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { ErrorApi } from '../../comun/api';

/** Un cambio de más de la mitad del saldo (o cualquier cantidad si el saldo es 0) pide confirmación. */
const UMBRAL_DIFERENCIA = 0.5;

/** Texto del campo → entero >= 0, o null si no es un número válido. */
export function leerCantidad(texto: string): number | null {
  const t = texto.trim();
  return /^\d+$/.test(t) ? Number(t) : null;
}

function esGrande(saldo: number, cantidad: number): boolean {
  if (saldo === 0) return cantidad > 0;
  return Math.abs(cantidad - saldo) / saldo > UMBRAL_DIFERENCIA;
}

function fechaDMA(iso: string): string {
  const [a, m, d] = iso.split('-');
  return a && m && d ? `${d}/${m}/${a}` : iso;
}

/**
 * Conteo de apertura del día: cuántos hay de cada producto controlado al empezar.
 * Se guardan los que el usuario cambió y los que todavía no tienen apertura hoy.
 */
export function AperturaDiaView() {
  const [datos, setDatos] = useState<AperturaDiaRespuesta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [confirmarAbierto, setConfirmarAbierto] = useState(false);
  const [exito, setExito] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const res = await almacenApi.obtenerApertura();
      setDatos(res);
      setValores(Object.fromEntries(res.productos.map((p) => [p.productoId, String(p.saldo)])));
    } catch (err) {
      setErrorCarga(err instanceof ErrorApi ? err.message : 'No se pudo cargar la apertura del día.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const productos = datos?.productos ?? [];

  const aEnviar: Array<{ p: AperturaProductoItem; cantidad: number }> = [];
  const invalidos: string[] = [];
  for (const p of productos) {
    const cantidad = leerCantidad(valores[p.productoId] ?? '');
    if (cantidad === null) invalidos.push(p.productoId);
    else if (!p.aperturaHoy || cantidad !== p.saldo) aEnviar.push({ p, cantidad });
  }
  const grandes = aEnviar.filter((x) => esGrande(x.p.saldo, x.cantidad));

  const cambiarValor = (productoId: string, texto: string) => {
    setExito(null);
    setError(null);
    setValores((v) => ({ ...v, [productoId]: texto }));
  };

  const ajustar = (p: AperturaProductoItem, delta: number) => {
    const actual = leerCantidad(valores[p.productoId] ?? '') ?? 0;
    cambiarValor(p.productoId, String(Math.max(0, actual + delta)));
  };

  const enviar = async () => {
    setConfirmarAbierto(false);
    if (aEnviar.length === 0) {
      setExito(null);
      setError('No hay cambios que guardar. Todos los productos ya tienen su apertura de hoy.');
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const res = await almacenApi.registrarApertura(
        aEnviar.map((x) => ({ productoId: x.p.productoId, cantidad: x.cantidad })),
      );
      setExito(`Apertura guardada: ${res.registrados} ${res.registrados === 1 ? 'producto' : 'productos'}.`);
      await cargar();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo guardar la apertura. Revisa la conexión e intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  const guardar = () => {
    setExito(null);
    setError(null);
    if (invalidos.length > 0) {
      setError('Revisa los campos marcados: deben ser números enteros de 0 o más.');
      return;
    }
    if (aEnviar.length === 0) {
      setError('No hay cambios que guardar. Todos los productos ya tienen su apertura de hoy.');
      return;
    }
    if (grandes.length > 0) {
      setConfirmarAbierto(true);
      return;
    }
    void enviar();
  };

  if (cargando && !datos) {
    return (
      <div style={{ padding: 20 }}>
        <Cargando mensaje="Cargando apertura del día..." />
      </div>
    );
  }

  if (errorCarga) {
    return <EstadoError titulo="No se pudo cargar" mensaje={errorCarga} alReintentar={() => void cargar()} />;
  }

  if (productos.length === 0) {
    return (
      <EstadoVacio
        titulo="No hay productos con control de stock"
        descripcion="Para contar la apertura, primero marca los productos que se acaban (donas, galletas) con la casilla «Controlar stock de este producto» en Catálogo › Productos."
      />
    );
  }

  const pendientes = productos.filter((p) => !p.aperturaHoy).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 760 }}>
      <div style={{ fontSize: 14, color: 'var(--cp-navy)' }}>
        <b>Día {fechaDMA(datos!.fecha)}</b> · {productos.length} {productos.length === 1 ? 'producto' : 'productos'} con stock
        propio · {pendientes > 0 ? `faltan ${pendientes} de contar` : 'todos contados hoy'}
      </div>

      <ul
        aria-label="Productos para contar la apertura"
        style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        {productos.map((p) => {
          const id = p.productoId;
          const valor = valores[id] ?? '';
          const invalido = invalidos.includes(id);
          const cantidad = leerCantidad(valor) ?? 0;
          return (
            <li
              key={id}
              data-testid="apertura-fila"
              style={{
                background: 'var(--cp-white)',
                border: `1px solid ${invalido ? 'var(--cp-rust)' : 'var(--cp-line)'}`,
                borderRadius: 14,
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                minWidth: 0,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
                <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                  <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, color: 'var(--cp-navy)' }}>
                    {p.nombre}
                  </div>
                  {p.areaNombre && <div style={{ fontSize: 12, color: 'var(--cp-soft)' }}>{p.areaNombre}</div>}
                </div>
                <div style={{ fontSize: 13, color: 'var(--cp-navy)' }}>Saldo actual: <b>{p.saldo}</b></div>
              </div>

              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: p.aperturaHoy ? 'var(--cp-navy)' : 'var(--cp-rust)',
                }}
              >
                {p.aperturaHoy
                  ? `Apertura registrada hoy: ${p.aperturaCantidad ?? 0}`
                  : 'Falta la apertura de hoy'}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label htmlFor={`apertura-${id}`} style={{ fontWeight: 700, fontSize: 13, color: 'var(--cp-navy)' }}>
                  ¿Cuántos hay ahora?
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    aria-label={`Quitar uno de ${p.nombre}`}
                    onClick={() => ajustar(p, -1)}
                    disabled={cantidad <= 0}
                    style={botonCantidad}
                  >
                    −
                  </button>
                  <input
                    id={`apertura-${id}`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    aria-label={`¿Cuántos hay ahora? ${p.nombre}`}
                    aria-invalid={invalido || undefined}
                    value={valor}
                    onChange={(e) => cambiarValor(id, e.target.value)}
                    style={{
                      width: 110,
                      minHeight: 44,
                      boxSizing: 'border-box',
                      borderRadius: 10,
                      border: `1.5px solid ${invalido ? 'var(--cp-rust)' : 'var(--cp-navy)'}`,
                      background: 'var(--cp-white)',
                      color: 'var(--cp-navy)',
                      fontFamily: 'Montserrat, sans-serif',
                      fontWeight: 800,
                      fontSize: 18,
                      textAlign: 'center',
                      padding: '0 8px',
                    }}
                  />
                  <button
                    type="button"
                    aria-label={`Sumar uno a ${p.nombre}`}
                    onClick={() => ajustar(p, 1)}
                    style={botonCantidad}
                  >
                    +
                  </button>
                </div>
                {invalido && (
                  <span role="alert" style={{ fontSize: 12, color: 'var(--cp-rust)', fontWeight: 700 }}>
                    Escribe un número entero de 0 o más.
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {exito && (
        <div role="status" style={{ fontSize: 14, fontWeight: 700, color: 'var(--cp-navy)' }}>
          {exito}
        </div>
      )}
      {error && (
        <div role="alert" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-rust)' }}>
          {error}
        </div>
      )}

      <div style={{ position: 'sticky', bottom: 0, background: 'var(--cp-cream)', padding: '8px 0' }}>
        <Boton
          tamano="grande"
          onClick={guardar}
          cargando={guardando}
          deshabilitado={invalidos.length > 0 || guardando}
          style={{ width: '100%' }}
        >
          {aEnviar.length > 0 ? `Guardar apertura (${aEnviar.length})` : 'Guardar apertura'}
        </Boton>
        <div style={{ fontSize: 12, color: 'var(--cp-soft)', marginTop: 4 }}>
          Se guardan los productos que cambiaste y los que aún no tienen apertura hoy.
        </div>
      </div>

      <Confirmar
        abierto={confirmarAbierto}
        titulo="¿Guardar una diferencia grande?"
        mensaje={`Hay ${grandes.length} ${grandes.length === 1 ? 'producto' : 'productos'} con una diferencia de más de la mitad frente al saldo: ${grandes
          .map((x) => `${x.p.nombre} (saldo ${x.p.saldo}, ahora ${x.cantidad})`)
          .join('; ')}. ¿Guardar igual?`}
        textoSi="Sí, guardar"
        textoNo="No, revisar"
        alConfirmar={enviar}
        alCancelar={() => setConfirmarAbierto(false)}
      />
    </div>
  );
}

const botonCantidad: CSSProperties = {
  minWidth: 44,
  minHeight: 44,
  borderRadius: 12,
  border: '1.5px solid var(--cp-navy)',
  background: 'var(--cp-white)',
  color: 'var(--cp-navy)',
  fontFamily: 'Montserrat, sans-serif',
  fontWeight: 800,
  fontSize: 20,
  cursor: 'pointer',
};
