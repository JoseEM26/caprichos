import { EstadoError } from '../../../comun/EstadoError';
import { Cargando } from '../../../comun/Cargando';
import { BarrasHorizontales, Secciones, TarjetaAnalisis, TarjetaIndicador, consultaDe, ddmm, useConsultaAnalisis, type PropsPestanaAnalisis } from '../comun';

type Soles = number | null;
interface FilaMedio {
  medio: string;
  pedidos: number;
  clientes: number;
  monto: Soles;
  porcentaje?: number | null;
}
export interface RespuestaPagos {
  conDinero: boolean;
  pedidos: number;
  porMedio: FilaMedio[];
  porCanal: Array<{ canal: string; medios: FilaMedio[] }>;
  devueltosCulqi: { pedidos: number; monto: Soles };
  adopcion: { pedidosCarta: number; pedidosCulqi: number; porcentaje: number | null; ticketCulqi: Soles; ticketResto: Soles; porDia: Array<{ dia: string; pedidos: number; culqi: number; porcentaje: number | null }> };
  comision: { total: Soles; pagosCulqi: number; porConfirmar: number };
}

const FORMATO = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });
const soles = (n: Soles) => (n == null ? 'Sin dato' : FORMATO.format(n));
const pct = (n: number | null) => (n == null ? 'Sin dato' : `${String(n).replace('.', ',')} %`);
const un = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

const MEDIO: Record<string, string> = {
  YAPE: 'Yape (manual)',
  YAPE_CULQI: 'Yape · Culqi',
  TARJETA: 'Tarjeta POS',
  TARJETA_CULQI: 'Tarjeta · Culqi',
  EFECTIVO: 'Efectivo',
  PLIN: 'Plin',
  TRANSFERENCIA: 'Transferencia',
  DIVIDIDO: 'Pago dividido',
  OTRO: 'Otro',
};
const CANAL: Record<string, string> = { CARTA: 'Carta web', CAJA: 'Caja', MOZO: 'Mozo', WHATSAPP: 'WhatsApp', BOT: 'Bot' };
const esCulqi = (m: string) => m.endsWith('_CULQI');

/** Pestaña «Medios de pago»: pedidos, clientes y monto por medio, y adopción de la pasarela Culqi en la carta. */
export function PagosTab({ filtros }: PropsPestanaAnalisis) {
  const { datos, estado, mensaje, recargar } = useConsultaAnalisis<RespuestaPagos>(`/admin/analisis/pagos?${consultaDe(filtros, ['modalidad', 'canal'])}`);
  return (
    <div className="an">
      {estado === 'cargando' && !datos && <Cargando mensaje="Calculando los medios de pago" />}
      {estado === 'error' && !datos && <EstadoError titulo="No se pudieron calcular los medios de pago" mensaje={mensaje || 'Prueba de nuevo en unos segundos.'} alReintentar={recargar} />}
      {datos && <Contenido d={datos} />}
    </div>
  );
}

function barrasMedios(filas: FilaMedio[], conDinero: boolean) {
  return filas.map((f) => ({
    id: f.medio,
    nombre: `${MEDIO[f.medio] ?? f.medio}${esCulqi(f.medio) ? ' (pasarela)' : ''}`,
    detalle: `${un(f.clientes, 'cliente', 'clientes')}${conDinero ? ` · ${soles(f.monto)}` : ''}`,
    valor: f.pedidos,
    texto: `${un(f.pedidos, 'pedido', 'pedidos')}${f.porcentaje != null ? ` (${pct(f.porcentaje)})` : ''}`,
    destacada: esCulqi(f.medio),
  }));
}

const tablaMedios = (filas: FilaMedio[], conDinero: boolean) => ({
  cabecera: ['Medio', 'Pedidos', 'Clientes', 'Monto'],
  filas: filas.map((f) => [MEDIO[f.medio] ?? f.medio, f.pedidos, f.clientes, conDinero ? soles(f.monto) : 'Sin permiso']),
});

function Contenido({ d }: { d: RespuestaPagos }) {
  const m = d.conDinero;
  const a = d.adopcion;
  const c = d.comision;
  return (
    <>
      <div className="an-rejilla an-rejilla--kpi">
        <TarjetaIndicador titulo="Pedidos cobrados" valor={String(d.pedidos)} detalle="Sin anulados ni rechazados" />
        <TarjetaIndicador titulo="Carta pagada por Culqi" valor={pct(a.porcentaje)} detalle={`${a.pedidosCulqi} de ${un(a.pedidosCarta, 'pedido cobrado', 'pedidos cobrados')} de la carta`} />
        {m && <TarjetaIndicador titulo="Ticket Culqi vs resto" valor={soles(a.ticketCulqi)} detalle={`Resto de medios: ${soles(a.ticketResto)}`} />}
        {m && <TarjetaIndicador titulo="Comisión de la pasarela" valor={soles(c.total)} detalle={c.porConfirmar > 0 ? `${un(c.porConfirmar, 'pago', 'pagos')} de ${c.pagosCulqi} por confirmar` : `${un(c.pagosCulqi, 'pago', 'pagos')} Culqi`} />}
      </div>
      {m && c.porConfirmar > 0 && (
        <p className="an-sub" role="note">
          Comisión por confirmar: {un(c.porConfirmar, 'pago Culqi aún no trae', 'pagos Culqi aún no traen')} su comisión; el total la suma solo donde ya está.
        </p>
      )}
      {!m && (
        <p className="an-sub" role="note">
          Tu rol ve pedidos y clientes; los montos en soles solo los ve el administrador.
        </p>
      )}
      <Secciones
        etiqueta="Secciones de medios de pago"
        secciones={[
          {
            id: 'medios',
            nombre: 'Por medio',
            contenido: (
              <>
                <TarjetaAnalisis id="an-pagos-medio" titulo="Pedidos por medio de pago" subtitulo="Un pedido con varios medios cuenta como «Pago dividido». Los medios de la pasarela van marcados." estado={d.porMedio.length ? 'ok' : 'vacio'} vacio="Sin pedidos cobrados en este período." tabla={tablaMedios(d.porMedio, m)}>
                  <BarrasHorizontales filas={barrasMedios(d.porMedio, m)} descripcion="Pedidos por medio de pago" etiquetaDestacada="Pasarela" />
                </TarjetaAnalisis>
                {d.devueltosCulqi.pedidos > 0 && (
                  <p className="an-sub" role="note">
                    Devueltos por Culqi (aparte, no suman arriba): {un(d.devueltosCulqi.pedidos, 'pedido', 'pedidos')}
                    {m ? ` · ${soles(d.devueltosCulqi.monto)}` : ''}.
                  </p>
                )}
              </>
            ),
          },
          {
            id: 'canal',
            nombre: 'Por canal',
            contenido: d.porCanal.length ? (
              <>
                {d.porCanal.map((x) => (
                  <TarjetaAnalisis key={x.canal} id={`an-pagos-canal-${x.canal}`} titulo={CANAL[x.canal] ?? x.canal} estado="ok" tabla={tablaMedios(x.medios, m)}>
                    <BarrasHorizontales filas={barrasMedios(x.medios, m)} descripcion={`Pedidos por medio en ${CANAL[x.canal] ?? x.canal}`} etiquetaDestacada="Pasarela" />
                  </TarjetaAnalisis>
                ))}
              </>
            ) : (
              <TarjetaAnalisis id="an-pagos-canal" titulo="Por canal" estado="vacio" vacio="Sin pedidos cobrados en este período." />
            ),
          },
          {
            id: 'adopcion',
            nombre: 'Adopción de Culqi',
            contenido: (
              <TarjetaAnalisis
                id="an-pagos-adopcion"
                titulo="Carta pagada por Culqi, por día"
                subtitulo="Porcentaje de los pedidos cobrados de la carta que se pagaron por la pasarela."
                estado={a.porDia.length ? 'ok' : 'vacio'}
                vacio="Sin pedidos cobrados de la carta en este período."
                tabla={{ cabecera: ['Día', 'Pedidos carta', 'Pagados por Culqi', '% Culqi'], filas: a.porDia.map((x) => [ddmm(x.dia), x.pedidos, x.culqi, pct(x.porcentaje)]) }}
              >
                <BarrasHorizontales
                  descripcion="Porcentaje de la carta pagado por Culqi por día"
                  etiquetaDestacada="Mayor adopción"
                  filas={a.porDia.map((x) => ({ id: x.dia, nombre: ddmm(x.dia), detalle: `${x.culqi} de ${x.pedidos} pedidos`, valor: x.porcentaje ?? 0, texto: pct(x.porcentaje) }))}
                />
              </TarjetaAnalisis>
            ),
          },
        ]}
      />
    </>
  );
}
