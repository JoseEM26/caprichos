import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import {
  almacenApi,
  AperturaDiaRespuesta,
  AperturaProductoItem,
  ItemApertura,
  productoPendienteApertura,
} from './almacenApi';
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
 * Una casilla de conteo: el producto entero, o un sabor de un producto con sabores.
 * `nombre` (completo, «DONA · Chocolate») sirve para mensajes y etiquetas accesibles.
 */
interface Casilla {
  clave: string;
  productoId: string;
  saborId?: string;
  etiqueta: string;
  nombre: string;
  saldo: number;
  aperturaHoy: boolean;
  aperturaCantidad: number | null;
}

const claveCasilla = (productoId: string, saborId?: string) => (saborId ? `${productoId}#${saborId}` : productoId);

function casillasDe(productos: AperturaProductoItem[]): Casilla[] {
  return productos.flatMap((p) =>
    p.sabores && p.sabores.length > 0
      ? p.sabores.map((s) => ({
          clave: claveCasilla(p.productoId, s.saborId),
          productoId: p.productoId,
          saborId: s.saborId,
          etiqueta: s.nombre,
          nombre: `${p.nombre} · ${s.nombre}`,
          saldo: s.saldo,
          aperturaHoy: s.aperturaHoy,
          aperturaCantidad: s.aperturaCantidad,
        }))
      : [
          {
            clave: p.productoId,
            productoId: p.productoId,
            etiqueta: p.nombre,
            nombre: p.nombre,
            saldo: p.saldo,
            aperturaHoy: p.aperturaHoy,
            aperturaCantidad: p.aperturaCantidad,
          },
        ],
  );
}

/**
 * Conteo de apertura del día: cuántos hay de cada producto controlado al empezar.
 * Los productos con sabores se cuentan sabor por sabor. Se guardan los que el usuario cambió
 * y los que todavía no tienen apertura hoy.
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
      setValores(Object.fromEntries(casillasDe(res.productos).map((c) => [c.clave, String(c.saldo)])));
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
  const casillas = casillasDe(productos);
  const valorDe = (clave: string) => valores[clave] ?? '';

  const aEnviar: Array<{ c: Casilla; cantidad: number }> = [];
  const invalidos: string[] = [];
  for (const c of casillas) {
    const cantidad = leerCantidad(valorDe(c.clave));
    if (cantidad === null) invalidos.push(c.clave);
    else if (!c.aperturaHoy || cantidad !== c.saldo) aEnviar.push({ c, cantidad });
  }
  const grandes = aEnviar.filter((x) => esGrande(x.c.saldo, x.cantidad));

  const cambiarValor = (clave: string, texto: string) => {
    setExito(null);
    setError(null);
    setValores((v) => ({ ...v, [clave]: texto }));
  };

  const ajustar = (c: Casilla, delta: number) => {
    const actual = leerCantidad(valorDe(c.clave)) ?? 0;
    cambiarValor(c.clave, String(Math.max(0, actual + delta)));
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
      const items: ItemApertura[] = aEnviar.map(({ c, cantidad }) =>
        c.saborId
          ? { productoId: c.productoId, saborId: c.saborId, cantidad }
          : { productoId: c.productoId, cantidad },
      );
      const res = await almacenApi.registrarApertura(items);
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

  /** Campo «¿Cuántos hay ahora?» con − y + de 44 px, para un producto o un sabor. */
  const controles = (c: Casilla) => {
    const id = `apertura-${c.clave}`;
    const invalido = invalidos.includes(c.clave);
    const cantidad = leerCantidad(valorDe(c.clave)) ?? 0;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label htmlFor={id} style={{ fontWeight: 700, fontSize: 13, color: 'var(--cp-navy)' }}>
          ¿Cuántos hay ahora?
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            aria-label={`Quitar uno de ${c.nombre}`}
            onClick={() => ajustar(c, -1)}
            disabled={cantidad <= 0}
            style={botonCantidad}
          >
            −
          </button>
          <input
            id={id}
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            aria-label={`¿Cuántos hay ahora? ${c.nombre}`}
            aria-invalid={invalido || undefined}
            value={valorDe(c.clave)}
            onChange={(e) => cambiarValor(c.clave, e.target.value)}
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
            aria-label={`Sumar uno a ${c.nombre}`}
            onClick={() => ajustar(c, 1)}
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
    );
  };

  /** Línea de estado de la apertura de hoy: «Apertura registrada hoy: N» o «Falta la apertura de hoy». */
  const estado = (c: Casilla) => (
    <div style={{ fontSize: 12.5, fontWeight: 700, color: c.aperturaHoy ? 'var(--cp-navy)' : 'var(--cp-rust)' }}>
      {c.aperturaHoy ? `Apertura registrada hoy: ${c.aperturaCantidad ?? 0}` : 'Falta la apertura de hoy'}
    </div>
  );

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

  const pendientes = productos.filter(productoPendienteApertura).length;

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
          const delProducto = casillas.filter((c) => c.productoId === p.productoId);
          const conSabores = !!p.sabores && p.sabores.length > 0;
          const conError = delProducto.some((c) => invalidos.includes(c.clave));
          const total = delProducto.reduce((suma, c) => suma + (leerCantidad(valorDe(c.clave)) ?? 0), 0);
          return (
            <li
              key={p.productoId}
              data-testid="apertura-fila"
              style={{
                background: 'var(--cp-white)',
                border: `1px solid ${conError ? 'var(--cp-rust)' : 'var(--cp-line)'}`,
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
                  {conSabores && (
                    <div style={{ fontSize: 12, color: 'var(--cp-soft)' }}>Se cuenta por sabor</div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: 13, color: 'var(--cp-navy)' }}>
                  <div>Saldo actual: <b>{p.saldo}</b></div>
                  {conSabores && <div>{`Total ahora: ${total}`}</div>}
                </div>
              </div>

              {conSabores ? (
                delProducto.map((c) => (
                  <div
                    key={c.clave}
                    data-testid="apertura-sabor"
                    style={{ borderTop: '1px solid var(--cp-line)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--cp-navy)', overflowWrap: 'anywhere', minWidth: 0 }}>
                        {c.etiqueta}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--cp-navy)' }}>Saldo: <b>{c.saldo}</b></div>
                    </div>
                    {estado(c)}
                    {controles(c)}
                  </div>
                ))
              ) : (
                <>
                  {estado(delProducto[0])}
                  {controles(delProducto[0])}
                </>
              )}
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
          Se guardan los productos y sabores que cambiaste y los que aún no tienen apertura hoy.
        </div>
      </div>

      <Confirmar
        abierto={confirmarAbierto}
        titulo="¿Guardar una diferencia grande?"
        mensaje={`Hay ${grandes.length} ${grandes.length === 1 ? 'producto' : 'productos'} con una diferencia de más de la mitad frente al saldo: ${grandes
          .map((x) => `${x.c.nombre} (saldo ${x.c.saldo}, ahora ${x.cantidad})`)
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
