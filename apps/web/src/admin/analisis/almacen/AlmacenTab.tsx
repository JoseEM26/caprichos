import { useState } from 'react';
import { Cargando } from '../../../comun/Cargando';
import { EstadoError } from '../../../comun/EstadoError';
import { BarrasHorizontales, PanelDetalle, TarjetaAnalisis, TarjetaIndicador, consultaDe, useConsultaAnalisis, type NivelSemaforo, type PropsPestanaAnalisis } from '../comun';
import { diaMes, num, soles } from '../reparto/formato';
import type { EstadoInsumo, InsumoDura, MermaItem, RespuestaAlmacen, TerminadoItem } from './tipos';

const SEMAFORO: Record<EstadoInsumo, NivelSemaforo> = { AGOTADO: 'rojo', CRITICO: 'rojo', PRONTO: 'ambar', OK: 'verde', SIN_CONSUMO: 'sin_dato' };
const TEXTO_ESTADO: Record<EstadoInsumo, string> = { AGOTADO: 'Agotado', CRITICO: 'Se acaba en 3 días o menos', PRONTO: 'Se acaba en una semana o menos', OK: 'Alcanza más de una semana', SIN_CONSUMO: 'Sin consumo en el período' };
/** Barras visibles de insumos: los que se acaban antes; el resto queda en «Ver como tabla». */
const MAX_BARRAS_INSUMOS = 25;

function textoDuracion(i: InsumoDura): string {
  if (i.estado === 'AGOTADO') return 'Agotado';
  if (i.diasRestantes == null) return 'Sin consumo';
  return `${num(i.diasRestantes)} d${i.seAcabaEl ? ` · hasta el ${diaMes(i.seAcabaEl)}` : ''}`;
}

function Insumos({ items, truncado }: { items: InsumoDura[]; truncado: boolean }) {
  const [elegido, setElegido] = useState<string | null>(null);
  const i = items.find((x) => x.id === elegido) ?? null;
  return (
    <TarjetaAnalisis
      id="an-insumos"
      titulo="Cuánto dura cada insumo"
      subtitulo="Stock actual entre el consumo diario del período: lo que se acabará primero va arriba."
      estado={items.length ? 'ok' : 'vacio'}
      vacio="No hay insumos activos."
      tabla={{
        cabecera: ['Insumo', 'Unidad', 'Stock', 'Mínimo', 'Consumo diario', 'Días que dura', 'Se acaba el'],
        filas: items.map((x) => [x.nombre, x.unidad, x.stock, x.minimo, x.consumoDiario ?? 'Sin consumo', x.diasRestantes ?? 'Sin dato', x.seAcabaEl ? diaMes(x.seAcabaEl) : 'Sin dato']),
      }}
    >
      {truncado && <p className="an-error-fechas" role="status">Hay más insumos de los que se leen: se muestran los primeros por nombre.</p>}
      <BarrasHorizontales
        descripcion="Días que dura cada insumo según su consumo reciente"
        etiquetaDestacada="Bajo el mínimo"
        elegida={elegido}
        alElegir={(id) => setElegido((a) => (a === id ? null : id))}
        filas={items.slice(0, MAX_BARRAS_INSUMOS).map((x) => ({
          id: x.id,
          nombre: x.nombre,
          detalle: `Stock ${num(x.stock, 2)} ${x.unidad}`,
          valor: x.estado === 'AGOTADO' ? 0 : x.diasRestantes,
          texto: textoDuracion(x),
          semaforo: SEMAFORO[x.estado],
          destacada: x.bajoMinimo,
        }))}
      />
      {items.length > MAX_BARRAS_INSUMOS && <p className="an-sub">Se muestran los {MAX_BARRAS_INSUMOS} que se acaban antes; todos están en «Ver como tabla».</p>}
      {i && (
        <PanelDetalle titulo={i.nombre} alCerrar={() => setElegido(null)}>
          <ul className="an-lista">
            <li>
              <span className="an-lista__texto">
                <strong>{TEXTO_ESTADO[i.estado]}</strong>
                <span>
                  Stock {num(i.stock, 2)} {i.unidad} (mínimo {num(i.minimo, 2)})
                </span>
                <span className="an-sub">
                  Consumió {num(i.consumoRango, 2)} {i.unidad} en el período{i.consumoDiario == null ? '' : ` (${num(i.consumoDiario, 2)} por día)`}.
                </span>
              </span>
            </li>
          </ul>
        </PanelDetalle>
      )}
    </TarjetaAnalisis>
  );
}

function Mermas({ datos }: { datos: RespuestaAlmacen['mermas'] }) {
  const items: MermaItem[] = datos.items;
  const max = items.length ? items.map((m) => m.costo ?? m.cantidad) : [];
  return (
    <TarjetaAnalisis
      id="an-mermas"
      titulo="Mermas"
      subtitulo="Lo que se botó o perdió en el período. El costo sale del costo guardado del insumo; sin costo se muestra la cantidad."
      estado={items.length ? 'ok' : 'vacio'}
      vacio="No se registró ninguna merma en este período."
      tabla={{
        cabecera: ['Nombre', 'Tipo', 'Veces', 'Cantidad', 'Costo', 'Motivo más repetido'],
        filas: items.map((m) => [m.nombre, m.tipo === 'INSUMO' ? 'Insumo' : 'Producto', m.veces, `${num(m.cantidad, 2)}${m.unidad ? ` ${m.unidad}` : ''}`, m.costo == null ? 'Sin costo guardado' : soles(m.costo), m.motivos[0]?.motivo ?? 'Sin motivo']),
      }}
    >
      {datos.truncado && <p className="an-error-fechas" role="status">Hay más de {datos.limite} mermas: se leyeron las más recientes. Acorta las fechas.</p>}
      <div className="an-rejilla an-rejilla--kpi">
        <TarjetaIndicador titulo="Registros de merma" valor={String(datos.registros)} />
        <TarjetaIndicador titulo="Costo de las mermas" valor={soles(datos.costoTotal)} detalle={datos.costoTotal == null ? 'Ningún insumo con costo guardado' : 'Solo insumos con costo'} />
      </div>
      <BarrasHorizontales
        descripcion="Mermas por insumo o producto"
        etiquetaDestacada="Mayor pérdida"
        filas={items.slice(0, 15).map((m, k) => ({
          id: `${m.tipo}-${m.nombre}`,
          nombre: m.nombre,
          detalle: `${m.veces} ${m.veces === 1 ? 'vez' : 'veces'} · ${m.motivos.map((x) => x.motivo).join(', ')}`,
          valor: max[k],
          texto: m.costo == null ? `${num(m.cantidad, 2)}${m.unidad ? ` ${m.unidad}` : ''}` : soles(m.costo),
          destacada: k === 0 && items.length > 1,
        }))}
      />
    </TarjetaAnalisis>
  );
}

function Terminados({ items, umbral }: { items: TerminadoItem[]; umbral: number }) {
  const pocas = items.filter((t) => t.pocas);
  return (
    <TarjetaAnalisis
      id="an-terminados"
      titulo="Productos terminados con pocas unidades"
      subtitulo={`Donas, galletas y otros con conteo propio: quedan ${umbral} o menos. Funciona aunque el Control de almacén esté apagado.`}
      estado={items.length ? 'ok' : 'vacio'}
      vacio="Ningún producto lleva conteo de unidades."
      tabla={{
        cabecera: ['Producto', 'Unidades', 'Vendidas en el período', 'Venta diaria', 'Días que alcanza'],
        filas: items.map((t) => [t.nombre, t.unidades, t.vendidasRango, t.ventaDiaria ?? 'Sin venta', t.diasRestantes ?? 'Sin dato']),
      }}
    >
      {pocas.length === 0 ? (
        <p className="an-sub" role="status">Todos tienen más de {umbral} unidades.</p>
      ) : (
        <BarrasHorizontales
          descripcion="Unidades que quedan de cada producto con pocas unidades"
          etiquetaDestacada="Agotado"
          filas={pocas.map((t) => ({
            id: t.id,
            nombre: t.nombre,
            detalle: t.diasRestantes == null ? (t.ventaDiaria == null ? 'Sin ventas en el período' : undefined) : `Alcanza ${num(t.diasRestantes)} d al ritmo de ${num(t.ventaDiaria, 2)} por día`,
            valor: t.unidades,
            texto: t.agotado ? 'Agotado' : `${num(t.unidades, 0)} u.`,
            semaforo: t.agotado ? 'rojo' : 'ambar',
            destacada: t.agotado,
          }))}
        />
      )}
    </TarjetaAnalisis>
  );
}

/** Pestaña «Almacén»: duración de insumos, mermas y productos terminados con pocas unidades. */
export function AlmacenTab({ filtros }: PropsPestanaAnalisis) {
  const { datos, estado, mensaje, recargar } = useConsultaAnalisis<RespuestaAlmacen>(`/admin/analisis/almacen?${consultaDe(filtros, [])}`);
  return (
    <div className="an">
      {estado === 'cargando' && !datos && <Cargando mensaje="Calculando el almacén" />}
      {estado === 'error' && !datos && <EstadoError titulo="No se pudo calcular el almacén" mensaje={mensaje || 'Prueba de nuevo en unos segundos.'} alReintentar={recargar} />}
      {datos && (
        <>
          {!datos.almacenActivo && (
            <section className="an-tarjeta" role="status" aria-labelledby="an-apagado-t">
              <h3 id="an-apagado-t">Control de almacén apagado</h3>
              <p>
                Mientras esté apagado, vender no descuenta insumos y no hay consumo que analizar: no se muestran la duración de los insumos ni sus mermas.
                El ADMIN lo enciende en Configuración. Abajo siguen los productos terminados, que llevan su propio conteo.
              </p>
            </section>
          )}
          {datos.insumos && <Insumos items={datos.insumos.items} truncado={datos.insumos.truncado} />}
          <Mermas datos={datos.mermas} />
          <Terminados items={datos.terminados.items} umbral={datos.umbralPocas} />
        </>
      )}
    </div>
  );
}
