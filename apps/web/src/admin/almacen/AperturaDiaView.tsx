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
import { MermaProductoBoton } from './MermaProductoBoton';

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
  /** Lo que quedó de ayer (propuesto en «Quedaron de ayer»). */
  quedaronAyer: number;
  /** Lo que ya se produjo hoy (ya está en el saldo). */
  producidoHoy: number;
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
          quedaronAyer: s.quedaronAyer,
          producidoHoy: s.producidoHoy,
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
            quedaronAyer: p.quedaronAyer,
            producidoHoy: p.producidoHoy,
          },
        ],
  );
}

/**
 * Conteo de apertura del día con arrastre: el stock no se reinicia. «Quedaron de ayer» viene ya cargado
 * (editable si se contó distinto) y «Produje hoy» se suma. Los productos con sabores se cuentan sabor por sabor.
 * Se guardan los que cambiaron y los que todavía no tienen apertura hoy.
 */
export function AperturaDiaView() {
  const [datos, setDatos] = useState<AperturaDiaRespuesta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [produccion, setProduccion] = useState<Record<string, string>>({});
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
      const cs = casillasDe(res.productos);
      setValores(Object.fromEntries(cs.map((c) => [c.clave, String(c.quedaronAyer)])));
      setProduccion(Object.fromEntries(cs.map((c) => [c.clave, '0'])));
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
  const produccionDe = (clave: string) => produccion[clave] ?? '0';

  const aEnviar: Array<{ c: Casilla; cantidad: number; produccionHoy: number }> = [];
  const invalidos: string[] = [];
  for (const c of casillas) {
    const cantidad = leerCantidad(valorDe(c.clave));
    const produccionHoy = leerCantidad(produccionDe(c.clave));
    if (cantidad === null || produccionHoy === null) invalidos.push(c.clave);
    else if (!c.aperturaHoy || cantidad !== c.quedaronAyer || produccionHoy > 0) aEnviar.push({ c, cantidad, produccionHoy });
  }
  const grandes = aEnviar.filter((x) => x.cantidad !== x.c.quedaronAyer && esGrande(x.c.quedaronAyer, x.cantidad));

  const cambiarValor = (clave: string, texto: string) => {
    setExito(null);
    setError(null);
    setValores((v) => ({ ...v, [clave]: texto }));
  };

  const cambiarProduccion = (clave: string, texto: string) => {
    setExito(null);
    setError(null);
    setProduccion((v) => ({ ...v, [clave]: texto }));
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
      const items: ItemApertura[] = aEnviar.map(({ c, cantidad, produccionHoy }) =>
        c.saborId
          ? { productoId: c.productoId, saborId: c.saborId, cantidad, produccion: produccionHoy }
          : { productoId: c.productoId, cantidad, produccion: produccionHoy },
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

  /** «Quedaron de ayer» (− y + de 44 px) y «Produje hoy» (+M), para un producto o un sabor. */
  const controles = (c: Casilla) => {
    const id = `apertura-${c.clave}`;
    const idProd = `produccion-${c.clave}`;
    const invalido = invalidos.includes(c.clave);
    const quedaron = leerCantidad(valorDe(c.clave)) ?? 0;
    const producido = leerCantidad(produccionDe(c.clave)) ?? 0;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label htmlFor={id} style={{ fontWeight: 700, fontSize: 13, color: 'var(--cp-navy)' }}>
              Quedaron de ayer
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                aria-label={`Quitar uno de ${c.nombre}`}
                onClick={() => ajustar(c, -1)}
                disabled={quedaron <= 0}
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
                aria-label={`Quedaron de ayer ${c.nombre}`}
                aria-invalid={invalido || undefined}
                value={valorDe(c.clave)}
                onChange={(e) => cambiarValor(c.clave, e.target.value)}
                style={campoNumero(invalido)}
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
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label htmlFor={idProd} style={{ fontWeight: 700, fontSize: 13, color: 'var(--cp-navy)' }}>
              Produje hoy (+)
            </label>
            <input
              id={idProd}
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              aria-label={`Produje hoy ${c.nombre}`}
              value={produccionDe(c.clave)}
              onChange={(e) => cambiarProduccion(c.clave, e.target.value)}
              style={campoNumero(false)}
            />
          </div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-navy)' }}>
          {`Total: ${quedaron} + ${producido} = ${quedaron + producido}`}
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
          const total = delProducto.reduce(
            (suma, c) => suma + (leerCantidad(valorDe(c.clave)) ?? 0) + (leerCantidad(produccionDe(c.clave)) ?? 0),
            0,
          );
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
                    <MermaProductoBoton
                      productoId={c.productoId}
                      saborId={c.saborId}
                      nombre={c.nombre}
                      saldo={c.saldo}
                      alRegistrar={() => void cargar()}
                    />
                  </div>
                ))
              ) : (
                <>
                  {estado(delProducto[0])}
                  {controles(delProducto[0])}
                  <MermaProductoBoton
                    productoId={delProducto[0].productoId}
                    nombre={delProducto[0].nombre}
                    saldo={delProducto[0].saldo}
                    alRegistrar={() => void cargar()}
                  />
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

const campoNumero = (invalido: boolean): CSSProperties => ({
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
});

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
