import { useState } from 'react';
import { EstadoError } from '../../../comun/EstadoError';
import { Cargando } from '../../../comun/Cargando';
import { Boton } from '../../../comun/Boton';
import { BarrasHorizontales, ListaRanking, MapaDeCalor, TarjetaAnalisis, TarjetaIndicador, consultaDe, ddmm, useConsultaAnalisis, type PropsPestanaAnalisis } from '../comun';
import type { FilaGrupo, RespuestaVentas, SerieEvolucion, Soles } from './tipos';

const FORMATO = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });
export const soles = (n: Soles) => (n == null ? 'Sin dato' : FORMATO.format(n));
const pct = (n: number | null) => (n == null ? 'Sin dato' : `${String(n).replace('.', ',')} %`);
const un = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

const CANAL: Record<string, string> = { CARTA: 'Carta web', CAJA: 'Caja', MOZO: 'Mozo', WHATSAPP: 'WhatsApp', BOT: 'Bot', OTRO: 'Otro' };
const MODALIDAD: Record<string, string> = { MESA: 'Mesa', COMER_LOCAL: 'Comer en local', RECOGER: 'Para llevar', DELIVERY: 'Delivery', OTRA: 'Otra' };
const TURNO: Record<string, string> = { MANANA: 'Mañana (hasta 12:00)', TARDE: 'Tarde (12:00 a 18:00)', NOCHE: 'Noche (desde 18:00)' };
const MEDIO: Record<string, string> = { EFECTIVO: 'Efectivo', YAPE: 'Yape', PLIN: 'Plin', TARJETA: 'Tarjeta', TRANSFERENCIA: 'Transferencia', OTRO: 'Otro' };
const TIPO_DESCUENTO: Record<string, string> = { DESCUENTO: 'Descuento', PROMO: 'Promoción', CUPON: 'Cupón', PERSONAL: 'Personal' };

type Ranking = 'mas' | 'menos' | 'monto';

/** Pestaña «Ventas». La venta es el total del pedido (sin propina, sin anulados), como en Reportes. El Supervisor no ve montos. */
export function VentasTab({ filtros }: PropsPestanaAnalisis) {
  const { datos, estado, mensaje, recargar } = useConsultaAnalisis<RespuestaVentas>(`/admin/analisis/ventas?${consultaDe(filtros, ['modalidad', 'canal', 'turno'])}`);
  return (
    <div className="an">
      {estado === 'cargando' && !datos && <Cargando mensaje="Calculando las ventas" />}
      {estado === 'error' && !datos && <EstadoError titulo="No se pudieron calcular las ventas" mensaje={mensaje || 'Prueba de nuevo en unos segundos.'} alReintentar={recargar} />}
      {datos && <Contenido d={datos} />}
    </div>
  );
}

function barrasGrupo(filas: FilaGrupo[], nombres: Record<string, string>, conDinero: boolean) {
  const mayor = Math.max(...filas.map((f) => f.ticket ?? 0));
  return filas.map((f) => ({
    id: f.id,
    nombre: nombres[f.id] ?? f.id,
    detalle: conDinero ? `Ticket promedio ${soles(f.ticket)} · ${un(f.pedidos, 'pedido', 'pedidos')}` : un(f.pedidos, 'pedido', 'pedidos'),
    valor: conDinero ? (f.monto ?? 0) : f.pedidos,
    texto: conDinero ? `${soles(f.monto)} (${pct(f.porcentaje)})` : `${f.pedidos} (${pct(f.porcentaje)})`,
    destacada: conDinero && filas.length > 1 && f.ticket != null && f.ticket === mayor,
  }));
}

function Evolucion({ d, series, titulo, nombres }: { d: RespuestaVentas; series: SerieEvolucion[]; titulo: string; nombres: Record<string, string> }) {
  const e = d.evolucion;
  const columnas = e.periodos.map((p) => (e.granularidad === 'semana' ? `Sem. ${ddmm(p)}` : ddmm(p)));
  const formato = (n: number) => (e.unidad === 'soles' ? String(Math.round(n)) : String(n));
  return (
    <TarjetaAnalisis
      id={`an-evo-${titulo}`}
      titulo={`${titulo}: evolución ${e.granularidad === 'semana' ? 'semanal' : 'diaria'}`}
      subtitulo={e.unidad === 'soles' ? 'Soles redondeados por celda; el color solo refuerza.' : 'Pedidos por celda.'}
      estado={series.length && columnas.length ? 'ok' : 'vacio'}
      vacio="Sin ventas en este período."
      tabla={{ cabecera: ['', ...columnas], filas: series.map((s) => [nombres[s.id] ?? s.id, ...s.valores.map(formato)]) }}
    >
      <MapaDeCalor descripcion={`${titulo} por ${e.granularidad === 'semana' ? 'semana' : 'día'}`} filas={series.map((s) => nombres[s.id] ?? s.id)} columnas={columnas} valores={series.map((s) => s.valores)} formato={formato} />
    </TarjetaAnalisis>
  );
}

function Contenido({ d }: { d: RespuestaVentas }) {
  const [ranking, setRanking] = useState<Ranking>('mas');
  const m = d.conDinero;
  const p = d.productos;
  const lista = ranking === 'mas' ? p.masVendidos : ranking === 'menos' ? p.menosVendidos : p.masMonto;
  const detalleProd = (f: (typeof lista)[number]) => `${f.categoria}${f.combo ? ' · combo' : ''} · ${un(f.pedidos, 'pedido', 'pedidos')}`;
  const nomMedios = MEDIO;

  return (
    <>
      <div className="an-rejilla an-rejilla--kpi">
        <TarjetaIndicador titulo="Pedidos" valor={String(d.pedidos)} detalle="Sin anulados ni rechazados" />
        {m && <TarjetaIndicador titulo="Ventas" valor={soles(d.ventas.monto)} detalle={`Envío ${soles(d.ventas.envio)} · Propinas aparte ${soles(d.ventas.propinaAparte)}`} />}
        {m && <TarjetaIndicador titulo="Ticket promedio" valor={soles(d.ventas.ticket)} />}
        {m && <TarjetaIndicador titulo="Descuentos dados" valor={soles(d.ventas.descuento)} detalle={`${un(d.ofertas.pedidosConDescuento, 'pedido', 'pedidos')} con descuento`} />}
      </div>
      {!m && (
        <p className="an-sub" role="note">
          Tu rol ve pedidos y unidades; los montos en soles solo los ve el administrador.
        </p>
      )}
      {d.truncado && (
        <p className="an-error-fechas" role="status">
          Hay más de {d.limite} pedidos en el rango: se leyeron los más recientes. Acorta las fechas para ver todo.
        </p>
      )}

      <TarjetaAnalisis
        id="an-productos"
        titulo="Productos"
        subtitulo={`${p.distintos} productos vendidos. Las cortesías no cuentan; las partes de un combo no se repiten; el monto es a precio de lista, antes del descuento del pedido.`}
        estado={lista.length || p.distintos ? 'ok' : 'vacio'}
        vacio="Sin ventas en este período."
        tabla={{ cabecera: ['Producto', 'Categoría', 'Unidades', 'Monto'], filas: lista.map((f) => [f.nombre, f.categoria, f.unidades, m ? soles(f.monto) : 'Sin permiso']) }}
        acciones={
          <div role="group" aria-label="Qué ranking ver" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Boton variante={ranking === 'mas' ? 'primario' : 'secundario'} tamano="pequeno" aria-pressed={ranking === 'mas'} onClick={() => setRanking('mas')}>
              Más vendidos
            </Boton>
            <Boton variante={ranking === 'menos' ? 'primario' : 'secundario'} tamano="pequeno" aria-pressed={ranking === 'menos'} onClick={() => setRanking('menos')}>
              Menos vendidos
            </Boton>
            {m && (
              <Boton variante={ranking === 'monto' ? 'primario' : 'secundario'} tamano="pequeno" aria-pressed={ranking === 'monto'} onClick={() => setRanking('monto')}>
                Por monto
              </Boton>
            )}
          </div>
        }
      >
        {ranking === 'menos' ? (
          <BarrasHorizontales
            descripcion="Productos menos vendidos por unidades"
            etiquetaDestacada=""
            filas={lista.map((f) => ({ id: `${f.nombre}|${f.categoria}`, nombre: f.nombre, detalle: detalleProd(f), valor: f.unidades, texto: un(f.unidades, 'unidad', 'unidades') }))}
          />
        ) : (
          <ListaRanking
            descripcion={ranking === 'monto' ? 'Productos por monto vendido' : 'Productos más vendidos por unidades'}
            items={lista.map((f) => ({
              id: `${f.nombre}|${f.categoria}`,
              nombre: f.nombre,
              detalle: detalleProd(f),
              valor: ranking === 'monto' ? (f.monto ?? 0) : f.unidades,
              texto: ranking === 'monto' ? `${soles(f.monto)} · ${un(f.unidades, 'unidad', 'unidades')}` : `${un(f.unidades, 'unidad', 'unidades')}${m ? ` · ${soles(f.monto)}` : ''}`,
            }))}
          />
        )}
      </TarjetaAnalisis>

      <div className="an-rejilla">
        <TarjetaAnalisis
          id="an-canal"
          titulo={m ? 'Ventas y ticket por canal' : 'Pedidos por canal'}
          estado={d.porCanal.length ? 'ok' : 'vacio'}
          vacio="Sin ventas en este período."
          tabla={{ cabecera: ['Canal', 'Pedidos', 'Ventas', 'Ticket promedio'], filas: d.porCanal.map((f) => [CANAL[f.id] ?? f.id, f.pedidos, m ? soles(f.monto) : 'Sin permiso', m ? soles(f.ticket) : 'Sin permiso']) }}
        >
          <BarrasHorizontales descripcion="Ventas por canal" etiquetaDestacada="Ticket más alto" filas={barrasGrupo(d.porCanal, CANAL, m)} />
        </TarjetaAnalisis>
        <TarjetaAnalisis
          id="an-modalidad"
          titulo={m ? 'Ticket por modalidad' : 'Pedidos por modalidad'}
          estado={d.porModalidad.length ? 'ok' : 'vacio'}
          vacio="Sin ventas en este período."
          tabla={{ cabecera: ['Modalidad', 'Pedidos', 'Ventas', 'Ticket promedio'], filas: d.porModalidad.map((f) => [MODALIDAD[f.id] ?? f.id, f.pedidos, m ? soles(f.monto) : 'Sin permiso', m ? soles(f.ticket) : 'Sin permiso']) }}
        >
          <BarrasHorizontales descripcion="Ventas por modalidad" etiquetaDestacada="Ticket más alto" filas={barrasGrupo(d.porModalidad, MODALIDAD, m)} />
        </TarjetaAnalisis>
      </div>

      <TarjetaAnalisis
        id="an-turno"
        titulo={m ? 'Ticket por turno' : 'Pedidos por turno'}
        subtitulo="Turno por la hora de Lima en que entró el pedido."
        estado={d.porTurno.length ? 'ok' : 'vacio'}
        vacio="Sin ventas en este período."
        tabla={{ cabecera: ['Turno', 'Pedidos', 'Ventas', 'Ticket promedio'], filas: d.porTurno.map((f) => [TURNO[f.id] ?? f.id, f.pedidos, m ? soles(f.monto) : 'Sin permiso', m ? soles(f.ticket) : 'Sin permiso']) }}
      >
        <BarrasHorizontales descripcion="Ventas por turno" etiquetaDestacada="Ticket más alto" filas={barrasGrupo(d.porTurno, TURNO, m)} />
      </TarjetaAnalisis>

      <Evolucion d={d} series={d.evolucion.canales} titulo="Canales" nombres={CANAL} />

      <TarjetaAnalisis
        id="an-ofertas"
        titulo="Combos y ofertas"
        subtitulo={`${un(d.ofertas.pedidosConCombo, 'pedido llevó', 'pedidos llevaron')} un combo${m ? `, que aportan ${soles(d.ofertas.aporteCombos)} (${pct(d.ofertas.porcentajeAporte)} de las ventas)` : ''}.`}
        estado={d.ofertas.combos.length || d.ofertas.descuentos.length ? 'ok' : 'vacio'}
        vacio="No hubo combos ni descuentos en este período."
        tabla={{
          cabecera: ['Oferta', 'Tipo', 'Pedidos / unidades', 'Monto'],
          filas: [
            ...d.ofertas.combos.map((c) => [c.nombre, 'Combo', c.unidades, m ? soles(c.monto) : 'Sin permiso']),
            ...d.ofertas.descuentos.map((x) => [x.nombre, TIPO_DESCUENTO[x.tipo] ?? x.tipo, x.pedidos, m ? soles(x.monto) : 'Sin permiso']),
          ],
        }}
      >
        {d.ofertas.combos.length > 0 && (
          <ListaRanking
            descripcion="Combos vendidos"
            items={d.ofertas.combos.map((c) => ({ id: c.nombre, nombre: c.nombre, valor: c.unidades, texto: `${un(c.unidades, 'unidad', 'unidades')}${m ? ` · ${soles(c.monto)}` : ''}` }))}
          />
        )}
        {d.ofertas.descuentos.length > 0 && (
          <ListaRanking
            descripcion="Descuentos dados por oferta o cupón"
            items={d.ofertas.descuentos.map((x) => ({
              id: `${x.tipo}|${x.nombre}`,
              nombre: x.nombre,
              detalle: `${TIPO_DESCUENTO[x.tipo] ?? x.tipo} · ${un(x.pedidos, 'pedido', 'pedidos')}`,
              valor: m ? (x.monto ?? 0) : x.pedidos,
              texto: m ? `Dio ${soles(x.monto)}` : un(x.pedidos, 'pedido', 'pedidos'),
            }))}
          />
        )}
        <p className="an-sub">
          Sin dato: si los combos le quitan ventas a los productos sueltos (canibalización) y cuánto descuento da cada combo (su precio ya viene rebajado y no se guarda el precio de lista de sus partes).
        </p>
      </TarjetaAnalisis>

      <TarjetaAnalisis
        id="an-medios"
        titulo="Medios de pago"
        subtitulo={`Lo cobrado por medio, sin propinas. ${un(d.medios.pedidosSinCobro, 'pedido sin cobro registrado', 'pedidos sin cobro registrado')} (por cobrar o crédito del personal).`}
        estado={d.medios.filas.length ? 'ok' : 'vacio'}
        vacio="Aún no hay cobros en este período."
        tabla={{ cabecera: ['Medio', 'Pagos', 'Monto', '%'], filas: d.medios.filas.map((f) => [nomMedios[f.id] ?? f.id, f.pagos, m ? soles(f.monto) : 'Sin permiso', f.porcentaje ?? 'Sin dato']) }}
      >
        <BarrasHorizontales
          descripcion="Proporción por medio de pago"
          etiquetaDestacada=""
          filas={d.medios.filas.map((f) => ({
            id: f.id,
            nombre: nomMedios[f.id] ?? f.id,
            valor: m ? (f.monto ?? 0) : f.pagos,
            texto: `${pct(f.porcentaje)}${m ? ` · ${soles(f.monto)}` : ` · ${un(f.pagos, 'pago', 'pagos')}`}`,
          }))}
        />
      </TarjetaAnalisis>
      <Evolucion d={d} series={d.evolucion.medios} titulo="Medios de pago" nombres={MEDIO} />
    </>
  );
}
