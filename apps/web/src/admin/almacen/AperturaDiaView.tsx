import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
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
import { Icono } from '../../comun/Icono';
import { Insignia, type VarianteInsignia } from '../../comun/Insignia';
import { ErrorApi } from '../../comun/api';
import { MermaProductoBoton } from './MermaProductoBoton';
import { HistorialProductoBoton } from './HistorialProductoBoton';
import { ConfirmarMermasApertura, type MotivoElegido } from './ConfirmarMermasApertura';
import { MermasHoyApertura } from './MermasHoyApertura';
import { useRecargaEnVivo } from './useRecargaEnVivo';
import './apertura-dia.css';

/** Un cambio de más de la mitad del saldo (o cualquier cantidad si el saldo es 0) pide confirmación. */
const UMBRAL_DIFERENCIA = 0.5;
const SIN_AREA = 'Sin área';

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

/** Para buscar sin importar mayúsculas ni tildes. */
const normalizar = (texto: string) =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

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

const horaLima = (d: Date) =>
  d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Lima' });

/** Miniatura cuadrada del producto (carga diferida); sin foto, o si falla, un marcador neutro con la inicial. */
function Miniatura({ url, nombre }: { url?: string | null; nombre: string }) {
  const [falla, setFalla] = useState(false);
  if (!url || falla) {
    return (
      <span className="ap-mini ap-mini--vacia" aria-hidden="true">
        {nombre.trim().charAt(0).toUpperCase()}
      </span>
    );
  }
  return <img className="ap-mini" src={url} alt="" loading="lazy" decoding="async" onError={() => setFalla(true)} />;
}

const tieneSabores = (p: AperturaProductoItem) => !!p.sabores && p.sabores.length > 0;

/** Chip de estado: «Falta contar» (ámbar), «Agotado» (rojo) o «Contado hoy» (verde). */
function estadoDe(aperturaHoy: boolean, total: number): { texto: string; variante: VarianteInsignia } {
  if (!aperturaHoy) return { texto: 'Falta contar', variante: 'aviso' };
  if (total === 0) return { texto: 'Agotado', variante: 'peligro' };
  return { texto: 'Contado hoy', variante: 'exito' };
}

/**
 * Conteo de apertura del día con arrastre: el stock no se reinicia. «Quedaron de ayer» viene ya cargado
 * (editable si se contó distinto) y «Produje hoy» se suma. Los productos con sabores se cuentan sabor por sabor,
 * plegados bajo una sola fila. Se guardan los que cambiaron y los que todavía no tienen apertura hoy.
 */
export function AperturaDiaView() {
  const [datos, setDatos] = useState<AperturaDiaRespuesta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [produccion, setProduccion] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [confirmarAbierto, setConfirmarAbierto] = useState(false);
  const [mermasAbierto, setMermasAbierto] = useState(false);
  const [motivos, setMotivos] = useState<Record<string, MotivoElegido>>({});
  const [recargaMermas, setRecargaMermas] = useState(0);
  const [exito, setExito] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [soloFaltan, setSoloFaltan] = useState(false);
  /** Productos con sabores desplegados. Por defecto, plegados salvo que falte contar algo. */
  const [desplegados, setDesplegados] = useState<Record<string, boolean>>({});

  /** Saldo/«esperado» por casilla de la última carga: sirve para saber qué filas toca la persona y cuáles cambiaron en servidor. */
  const baseRef = useRef<Record<string, Casilla>>({});
  const valoresRef = useRef(valores);
  valoresRef.current = valores;
  const produccionRef = useRef(produccion);
  produccionRef.current = produccion;
  const guardandoRef = useRef(false);
  guardandoRef.current = guardando;
  const secuencia = useRef(0);
  const [cambiadas, setCambiadas] = useState<Record<string, { antes: number; ahora: number }>>({});
  const [ultimaCarga, setUltimaCarga] = useState<Date | null>(null);
  const [fallaEnVivo, setFallaEnVivo] = useState(false);

  /** `silencioso`: refresca saldos sin spinner y conserva lo que la persona escribió y lo plegado. */
  const cargar = useCallback(async (silencioso = false) => {
    if (silencioso && guardandoRef.current) return;
    const mia = ++secuencia.current;
    if (!silencioso) {
      setCargando(true);
      setErrorCarga(null);
    }
    try {
      const res = await almacenApi.obtenerApertura();
      if (mia !== secuencia.current) return; // llegó una respuesta más nueva
      const cs = casillasDe(res.productos);
      const previas = baseRef.current;
      const nuevosValores: Record<string, string> = {};
      const nuevaProduccion: Record<string, string> = {};
      const avisos: Record<string, { antes: number; ahora: number }> = {};
      const editadas = new Set<string>();
      for (const c of cs) {
        const pre = previas[c.clave];
        const v = valoresRef.current[c.clave];
        const p = produccionRef.current[c.clave];
        const editada =
          silencioso && !!pre && ((v !== undefined && v !== String(pre.quedaronAyer)) || (p !== undefined && p !== '0'));
        if (editada) {
          editadas.add(c.clave);
          nuevosValores[c.clave] = v ?? String(c.quedaronAyer);
          nuevaProduccion[c.clave] = p ?? '0';
          if (pre.saldo !== c.saldo || pre.quedaronAyer !== c.quedaronAyer || pre.producidoHoy !== c.producidoHoy) {
            avisos[c.clave] = { antes: pre.saldo, ahora: c.saldo };
          }
        } else {
          nuevosValores[c.clave] = String(c.quedaronAyer);
          nuevaProduccion[c.clave] = '0';
        }
      }
      baseRef.current = Object.fromEntries(cs.map((c) => [c.clave, c]));
      setDatos(res);
      setValores(nuevosValores);
      setProduccion(nuevaProduccion);
      setCambiadas((prev) => {
        const sig: Record<string, { antes: number; ahora: number }> = {};
        for (const k of editadas) {
          const nuevo = avisos[k];
          const viejo = prev[k];
          // «antes» es el saldo contra el que la persona empezó a contar: el guardado lo manda como esperado
          if (nuevo || viejo) sig[k] = { antes: viejo?.antes ?? nuevo.antes, ahora: nuevo?.ahora ?? viejo.ahora };
        }
        return sig;
      });
      const porDefecto = Object.fromEntries(
        res.productos.filter(tieneSabores).map((p) => [p.productoId, productoPendienteApertura(p)]),
      );
      // Lo que el usuario ya plegó o desplegó se conserva al recargar
      setDesplegados((previo) => ({ ...porDefecto, ...previo }));
      setUltimaCarga(new Date());
      setFallaEnVivo(false);
    } catch (err) {
      if (mia !== secuencia.current) return;
      if (silencioso) setFallaEnVivo(true);
      else setErrorCarga(err instanceof ErrorApi ? err.message : 'No se pudo cargar la apertura del día.');
    } finally {
      if (!silencioso && mia === secuencia.current) setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const recargaEnVivo = useCallback(() => {
    void cargar(true);
    setRecargaMermas((n) => n + 1);
  }, [cargar]);
  const socketConectado = useRecargaEnVivo(recargaEnVivo);

  const productos = datos?.productos ?? [];
  const casillas = casillasDe(productos);
  const valorDe = (clave: string) => valores[clave] ?? '';
  const produccionDe = (clave: string) => produccion[clave] ?? '0';
  const quedaronDe = (c: Casilla) => leerCantidad(valorDe(c.clave)) ?? 0;
  const producidoDe = (c: Casilla) => leerCantidad(produccionDe(c.clave)) ?? 0;
  /**
   * Saldo que quedará al guardar (el mismo que calcula la API). Sin tocar «Quedaron de ayer» es el saldo real de hoy
   * (ya lleva ventas y lo producido antes) más lo que se suma ahora; si se corrige, es lo contado más lo producido hoy.
   */
  const totalDe = (c: Casilla) =>
    (quedaronDe(c) === c.quedaronAyer ? c.saldo : quedaronDe(c) + c.producidoHoy) + producidoDe(c);

  /** Cuánto BAJA el saldo con lo escrito (la API calcula igual): eso se registra como merma. */
  const mermaDe = (c: Casilla) => {
    const q = leerCantidad(valorDe(c.clave));
    if (q === null || q === c.quedaronAyer) return 0;
    return Math.max(0, c.saldo - (q + c.producidoHoy));
  };

  const aEnviar: Array<{ c: Casilla; cantidad: number; produccionHoy: number }> = [];
  const invalidos: string[] = [];
  for (const c of casillas) {
    const cantidad = leerCantidad(valorDe(c.clave));
    const produccionHoy = leerCantidad(produccionDe(c.clave));
    if (cantidad === null || produccionHoy === null) invalidos.push(c.clave);
    else if (!c.aperturaHoy || cantidad !== c.quedaronAyer || produccionHoy > 0) aEnviar.push({ c, cantidad, produccionHoy });
  }
  const mermas = aEnviar.filter((x) => mermaDe(x.c) > 0);
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
    setMermasAbierto(false);
    if (aEnviar.length === 0) {
      setExito(null);
      setError('No hay cambios que guardar. Todos los productos ya tienen su apertura de hoy.');
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const items: ItemApertura[] = aEnviar.map(({ c, cantidad, produccionHoy }) => {
        const item: ItemApertura = { productoId: c.productoId, cantidad, produccion: produccionHoy };
        if (c.saborId) item.saborId = c.saborId;
        if (mermaDe(c) > 0) {
          const m = motivos[c.clave];
          // si el stock cambió mientras contaba, se manda el saldo contra el que contó: la API lo rechaza y recuenta
          item.saldoEsperado = cambiadas[c.clave]?.antes ?? c.saldo;
          item.motivo = m?.motivo || undefined;
          if (m?.motivo === 'OTRO') item.nota = m.nota.trim();
        }
        return item;
      });
      const res = await almacenApi.registrarApertura(items);
      const conMerma = res.mermas ? ` ${res.mermas} ${res.mermas === 1 ? 'merma registrada' : 'mermas registradas'}.` : '';
      setExito(`Apertura guardada: ${res.registrados} ${res.registrados === 1 ? 'producto' : 'productos'}.${conMerma}`);
      setMotivos({});
      setRecargaMermas((n) => n + 1);
      await cargar();
    } catch (err) {
      const msg = err instanceof ErrorApi ? err.message : 'No se pudo guardar la apertura. Revisa la conexión e intenta de nuevo.';
      // El stock cambió mientras contaba: se recarga para que cuente de nuevo con el saldo real
      if (err instanceof ErrorApi && err.codigo === 'CONTEO_DESACTUALIZADO') await cargar();
      setError(msg);
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
    if (mermas.length > 0) {
      setMermasAbierto(true);
      return;
    }
    if (grandes.length > 0) {
      setConfirmarAbierto(true);
      return;
    }
    void enviar();
  };

  // ── Filtros ────────────────────────────────────────────────────────────────
  const q = normalizar(busqueda);
  /** Un sabor se ve si cumple «solo faltan» (si está activo) y la búsqueda (por producto o por sabor). */
  const saborVisible = (p: AperturaProductoItem, s: { nombre: string; aperturaHoy: boolean }) =>
    (!soloFaltan || !s.aperturaHoy) && (!q || normalizar(p.nombre).includes(q) || normalizar(s.nombre).includes(q));
  const saboresVisibles = (p: AperturaProductoItem) => (p.sabores ?? []).filter((s) => saborVisible(p, s));
  const productoVisible = (p: AperturaProductoItem) =>
    tieneSabores(p)
      ? saboresVisibles(p).length > 0
      : (!soloFaltan || !p.aperturaHoy) && (!q || normalizar(p.nombre).includes(q));

  const visibles = productos.filter(productoVisible);
  const grupos: Array<{ nombre: string; productos: AperturaProductoItem[] }> = [];
  for (const p of visibles) {
    const nombre = p.areaNombre || SIN_AREA;
    let grupo = grupos.find((g) => g.nombre === nombre);
    if (!grupo) {
      grupo = { nombre, productos: [] };
      grupos.push(grupo);
    }
    grupo.productos.push(p);
  }
  grupos.sort((a, b) => Number(a.nombre === SIN_AREA) - Number(b.nombre === SIN_AREA));

  const expandibles = visibles.filter(tieneSabores);
  const todosDesplegados = expandibles.length > 0 && expandibles.every((p) => desplegados[p.productoId]);
  const alternar = (productoId: string) => setDesplegados((d) => ({ ...d, [productoId]: !d[productoId] }));
  const desplegarTodos = (abrir: boolean) =>
    setDesplegados((d) => ({ ...d, ...Object.fromEntries(expandibles.map((p) => [p.productoId, abrir])) }));

  // ── Celdas ─────────────────────────────────────────────────────────────────
  /** «Quedaron de ayer»: − campo + (el campo acepta escribir). */
  const celdaQuedaron = (c: Casilla) => {
    const invalido = leerCantidad(valorDe(c.clave)) === null;
    return (
      <>
        <div className="ap-cantidad">
          <button
            type="button"
            className="ap-paso"
            aria-label={`Quitar uno de ${c.nombre}`}
            onClick={() => ajustar(c, -1)}
            disabled={quedaronDe(c) <= 0}
          >
            −
          </button>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            aria-label={`Quedaron de ayer ${c.nombre}`}
            aria-invalid={invalido || undefined}
            className={`ap-campo${invalido ? ' ap-campo--error' : ''}`}
            value={valorDe(c.clave)}
            onChange={(e) => cambiarValor(c.clave, e.target.value)}
          />
          <button
            type="button"
            className="ap-paso"
            aria-label={`Sumar uno a ${c.nombre}`}
            onClick={() => ajustar(c, 1)}
          >
            +
          </button>
        </div>
        {invalido && (
          <span role="alert" className="ap-error-campo">
            Escribe un número entero de 0 o más.
          </span>
        )}
        {mermaDe(c) > 0 && <span className="ap-merma-chip">Merma: −{mermaDe(c)}</span>}
        {cambiadas[c.clave] && (
          <span className="ap-aviso-cambio" data-testid="aviso-cambio">
            Cambió el stock mientras contabas: ahora {cambiadas[c.clave].ahora}
          </span>
        )}
      </>
    );
  };

  /** «Produje hoy (+)»: se suma al saldo al guardar. */
  const celdaProduccion = (c: Casilla) => {
    const invalido = leerCantidad(produccionDe(c.clave)) === null;
    return (
      <>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          aria-label={`Produje hoy ${c.nombre}`}
          aria-invalid={invalido || undefined}
          className={`ap-campo${invalido ? ' ap-campo--error' : ''}`}
          value={produccionDe(c.clave)}
          onChange={(e) => cambiarProduccion(c.clave, e.target.value)}
        />
        {invalido && (
          <span role="alert" className="ap-error-campo">
            Escribe un número entero de 0 o más.
          </span>
        )}
      </>
    );
  };

  const chipEstado = (texto: string, variante: VarianteInsignia, detalle?: string) => (
    <span className="ap-estado">
      <Insignia variante={variante}>{texto}</Insignia>
      {detalle && <small>{detalle}</small>}
    </span>
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
  const totalProductos = productos.length;

  return (
    <div className="ap-vista">
      <div className="ap-cabecera">
        <div className="ap-fecha">
          <b>Día {fechaDMA(datos!.fecha)}</b>
          <small className="ap-envivo" data-testid="indicador-en-vivo">
            {fallaEnVivo ? 'Sin conexión con el servidor' : socketConectado ? 'En vivo' : 'Reconectando…'}
            {ultimaCarga ? ` · actualizado ${horaLima(ultimaCarga)}` : ''}
          </small>
          <div className="ap-chips">
            <Insignia variante="neutro">
              {totalProductos} {totalProductos === 1 ? 'producto' : 'productos'}
            </Insignia>
            {pendientes > 0 ? (
              <Insignia variante="aviso">faltan {pendientes} por contar</Insignia>
            ) : (
              <Insignia variante="exito">todos contados hoy</Insignia>
            )}
          </div>
        </div>
        <p className="ap-ayuda">
          Cuenta lo que quedó de ayer, suma lo que produjiste hoy y guarda. La carta mostrará cuántos quedan.
        </p>
      </div>

      <div className="ap-filtros">
        <input
          type="search"
          className="ap-buscar"
          placeholder="Buscar producto o sabor"
          aria-label="Buscar producto o sabor"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <label className="ap-check">
          <input type="checkbox" checked={soloFaltan} onChange={(e) => setSoloFaltan(e.target.checked)} />
          Solo los que faltan contar
        </label>
        {expandibles.length > 0 && (
          <button type="button" className="ap-boton-texto" onClick={() => desplegarTodos(!todosDesplegados)}>
            {todosDesplegados ? 'Plegar todos' : 'Desplegar todos'}
          </button>
        )}
      </div>

      <div className="ap-tabla-wrap">
        <table className="ap-tabla" aria-label="Conteo de apertura por producto">
          <thead>
            <tr>
              <th scope="col">Producto</th>
              <th scope="col">Quedaron de ayer</th>
              <th scope="col">Produje hoy (+)</th>
              <th scope="col">Total</th>
              <th scope="col">Estado</th>
              <th scope="col">
                <span className="ap-sronly">Botar a merma</span>
              </th>
            </tr>
          </thead>
          {grupos.map((g) => (
            <tbody key={g.nombre} className="ap-grupo">
              <tr className="ap-grupo-titulo">
                <th colSpan={6} scope="colgroup">
                  {g.nombre} <span className="ap-grupo-cuenta">· {g.productos.length}</span>
                </th>
              </tr>
              {g.productos.map((p) => {
                const delProducto = casillas.filter((c) => c.productoId === p.productoId);
                const total = delProducto.reduce((suma, c) => suma + totalDe(c), 0);
                const conError = delProducto.some((c) => invalidos.includes(c.clave));

                if (!tieneSabores(p)) {
                  const c = delProducto[0];
                  return (
                    <tr key={p.productoId} data-testid="apertura-fila" className={`ap-fila${conError ? ' ap-fila--error' : ''}`}>
                      <td className="ap-celda-nombre">
                        <div className="ap-nombre-fila">
                          <Miniatura url={p.fotoUrl} nombre={p.nombre} />
                          <div>
                            <div className="ap-nombre">{p.nombre}</div>
                            <div className="ap-saldo">Saldo actual: {p.saldo}</div>
                          </div>
                        </div>
                      </td>
                      <td data-label="Quedaron de ayer">{celdaQuedaron(c)}</td>
                      <td data-label="Produje hoy (+)">{celdaProduccion(c)}</td>
                      <td data-label="Total" className="ap-total">{total}</td>
                      <td data-label="Estado">
                        {chipEstado(
                          estadoDe(c.aperturaHoy, total).texto,
                          estadoDe(c.aperturaHoy, total).variante,
                          c.aperturaHoy ? `Guardado: ${c.aperturaCantidad ?? 0}` : undefined,
                        )}
                      </td>
                      <td data-label="Botar a merma" className="ap-celda-merma">
                        <div className="ap-acciones-fila">
                          <MermaProductoBoton
                            compacto
                            productoId={c.productoId}
                            nombre={c.nombre}
                            saldo={c.saldo}
                            alRegistrar={() => void cargar(true)}
                          />
                          <HistorialProductoBoton productoId={c.productoId} nombre={c.nombre} />
                        </div>
                      </td>
                    </tr>
                  );
                }

                const abierto = !!desplegados[p.productoId];
                const saboresVis = delProducto.filter((c) => saborVisible(p, { nombre: c.etiqueta, aperturaHoy: c.aperturaHoy }));
                const pendientesSabores = delProducto.filter((c) => !c.aperturaHoy).length;
                const quedaronTotal = delProducto.reduce((s, c) => s + quedaronDe(c), 0);
                const producidoTotal = delProducto.reduce((s, c) => s + producidoDe(c), 0);
                const estadoProducto: { texto: string; variante: VarianteInsignia; detalle?: string } =
                  pendientesSabores > 0
                    ? { texto: 'Falta contar', variante: 'aviso', detalle: `${pendientesSabores} de ${delProducto.length} sabores` }
                    : estadoDe(true, total);
                return (
                  <Fragment key={p.productoId}>
                    <tr data-testid="apertura-fila" className={`ap-fila ap-fila--grupo${conError ? ' ap-fila--error' : ''}`}>
                      <td className="ap-celda-nombre">
                        <button
                          type="button"
                          className="ap-plegar"
                          aria-expanded={abierto}
                          aria-label={`${p.nombre}, ${delProducto.length} sabores`}
                          onClick={() => alternar(p.productoId)}
                        >
                          <Icono nombre="chevronDerecha" tamano={16} aria-hidden="true" className="ap-chevron" />
                          <Miniatura url={p.fotoUrl} nombre={p.nombre} />
                          <span>
                            <span className="ap-nombre">{p.nombre}</span>
                            <span className="ap-saldo">{delProducto.length} sabores</span>
                            {delProducto.some((c) => cambiadas[c.clave]) && (
                              <span className="ap-aviso-cambio">Cambió el stock de un sabor mientras contabas</span>
                            )}
                          </span>
                        </button>
                      </td>
                      <td data-label="Quedaron de ayer" className="ap-resumen">{quedaronTotal}</td>
                      <td data-label="Produje hoy (+)" className="ap-resumen">{producidoTotal}</td>
                      <td data-label="Total" className="ap-total">{total}</td>
                      <td data-label="Estado">{chipEstado(estadoProducto.texto, estadoProducto.variante, estadoProducto.detalle)}</td>
                      <td className="ap-celda-merma" />
                    </tr>
                    {abierto &&
                      saboresVis.map((c) => {
                        const totalSabor = totalDe(c);
                        const atenuado = !c.aperturaHoy && totalSabor === 0;
                        const estado = estadoDe(c.aperturaHoy, totalSabor);
                        return (
                          <tr
                            key={c.clave}
                            data-testid="apertura-sabor"
                            className={`ap-sabor${atenuado ? ' ap-sabor--atenuado' : ''}${invalidos.includes(c.clave) ? ' ap-fila--error' : ''}`}
                          >
                            <td className="ap-celda-nombre">
                              <span className="ap-nombre-sabor">{c.etiqueta}</span>
                              <span className="ap-saldo">Saldo {c.saldo}</span>
                            </td>
                            <td data-label="Quedaron de ayer">{celdaQuedaron(c)}</td>
                            <td data-label="Produje hoy (+)">{celdaProduccion(c)}</td>
                            <td data-label="Total" className="ap-total">{totalSabor}</td>
                            <td data-label="Estado">
                              {chipEstado(
                                estado.texto,
                                estado.variante,
                                c.aperturaHoy ? `Guardado: ${c.aperturaCantidad ?? 0}` : undefined,
                              )}
                            </td>
                            <td data-label="Botar a merma" className="ap-celda-merma">
                              <div className="ap-acciones-fila">
                                <MermaProductoBoton
                                  compacto
                                  productoId={c.productoId}
                                  saborId={c.saborId}
                                  nombre={c.nombre}
                                  saldo={c.saldo}
                                  alRegistrar={() => void cargar(true)}
                                />
                                <HistorialProductoBoton productoId={c.productoId} saborId={c.saborId} nombre={c.nombre} />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </Fragment>
                );
              })}
            </tbody>
          ))}
          {grupos.length === 0 && (
            <tbody>
              <tr>
                <td colSpan={6} className="ap-vacio">
                  Ningún producto coincide con la búsqueda o con el filtro.
                </td>
              </tr>
            </tbody>
          )}
        </table>
      </div>

      {exito && (
        <div role="status" className="ap-mensaje ap-mensaje--ok">
          {exito}
        </div>
      )}
      {error && (
        <div role="alert" className="ap-mensaje ap-mensaje--error">
          {error}
        </div>
      )}

      <div className="ap-pie">
        <Boton
          tamano="grande"
          onClick={guardar}
          cargando={guardando}
          deshabilitado={invalidos.length > 0 || guardando}
          style={{ width: '100%' }}
        >
          {aEnviar.length > 0 ? `Guardar apertura (${aEnviar.length})` : 'Guardar apertura'}
        </Boton>
        <div className="ap-pie-nota">Se guardan los productos y sabores que cambiaste y los que aún no tienen apertura hoy.</div>
      </div>

      <MermasHoyApertura recarga={recargaMermas} />

      {mermasAbierto && (
        <ConfirmarMermasApertura
          lineas={mermas.map((x) => ({ clave: x.c.clave, nombre: x.c.nombre, cantidad: mermaDe(x.c) }))}
          motivos={motivos}
          alCambiar={setMotivos}
          alConfirmar={() => void enviar()}
          alCancelar={() => setMermasAbierto(false)}
          guardando={guardando}
        />
      )}

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
