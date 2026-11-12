import { Cargando } from '../../../comun/Cargando';
import { EstadoError } from '../../../comun/EstadoError';
import { BarrasHorizontales, TarjetaAnalisis, TarjetaIndicador, consultaDe, textoMinutos, useConsultaAnalisis, type PropsPestanaAnalisis } from '../comun';
import { diaMes, num, soles } from '../reparto/formato';
import { TableroHuecos } from './TableroHuecos';
import type { FilaProductividad, GrupoProductividad, RespuestaEquipo } from './tipos';

function Tabla({ titulo, filas, vacio }: { titulo: string; filas: FilaProductividad[]; vacio: string }) {
  if (!filas.length) return <p className="an-sub">{vacio}</p>;
  return (
    <div className="an-alt">
      <div className="an-alt__tabla">
        <table>
          <caption className="an-solo-lector">{titulo}</caption>
          <thead>
            <tr>
              <th scope="col">Persona</th>
              <th scope="col">Pedidos</th>
              <th scope="col">Ticket promedio</th>
              <th scope="col">Minutos promedio</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.id}>
                <th scope="row">{f.nombre}</th>
                <td>{f.pedidos}</td>
                <td>{soles(f.ticketPromedio)}</td>
                <td>{textoMinutos(f.minutosPromedio)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Grupo({ id, titulo, subtitulo, g, filas, vacio }: { id: string; titulo: string; subtitulo: string; g: GrupoProductividad; filas: FilaProductividad[] | null; vacio: string }) {
  return (
    <TarjetaAnalisis id={id} titulo={titulo} subtitulo={subtitulo} estado={g.pedidos ? 'ok' : 'vacio'} vacio={vacio}>
      <div className="an-rejilla an-rejilla--kpi">
        <TarjetaIndicador titulo="Pedidos" valor={String(g.pedidos)} detalle={`${g.personas} persona(s)`} />
        <TarjetaIndicador titulo="Ticket promedio" valor={soles(g.ticketPromedio)} />
        <TarjetaIndicador titulo="Tiempo promedio" valor={textoMinutos(g.minutosPromedio)} detalle={`Mediana ${textoMinutos(g.minutosMediana)}`} />
      </div>
      {filas ? <Tabla titulo={titulo} filas={filas} vacio="Sin personas en este período." /> : <p className="an-sub">El detalle por persona lo ve solo el Administrador.</p>}
    </TarjetaAnalisis>
  );
}

/** Pestaña «Equipo»: huecos ahora, puntualidad por día y productividad de mozos y cajeros. Por persona solo el ADMIN. */
export function EquipoTab({ filtros, esAdmin }: PropsPestanaAnalisis) {
  const { datos, estado, mensaje, recargar } = useConsultaAnalisis<RespuestaEquipo>(`/admin/analisis/equipo?${consultaDe(filtros, [])}`);
  const p = datos?.personas ?? null;
  const verPersonas = esAdmin && Boolean(datos?.porPersonaVisible);

  return (
    <div className="an">
      <TableroHuecos />
      {estado === 'cargando' && !datos && <Cargando mensaje="Calculando el equipo" />}
      {estado === 'error' && !datos && <EstadoError titulo="No se pudo calcular el equipo" mensaje={mensaje || 'Prueba de nuevo en unos segundos.'} alReintentar={recargar} />}
      {datos && (
        <>
          {datos.truncado && (
            <p className="an-error-fechas" role="status">
              Hay más datos de los que se leen por consulta: acorta las fechas para ver todo.
            </p>
          )}
          <TarjetaAnalisis
            id="an-puntualidad"
            titulo="Asistencia y puntualidad"
            subtitulo="Tardanzas por día según las marcas de asistencia (con la tolerancia configurada)."
            estado={datos.asistencia.porDia.length ? 'ok' : 'vacio'}
            vacio="No hay asistencia ni horarios en este período."
            tabla={{
              cabecera: ['Día', 'Con horario', 'Presentes', 'Tardanzas', 'Faltas', 'Minutos tarde'],
              filas: datos.asistencia.porDia.map((d) => [diaMes(d.fecha), d.programadas, d.presentes, d.tardanzas, d.faltas, d.minutosTarde]),
            }}
          >
            <div className="an-rejilla an-rejilla--kpi">
              <TarjetaIndicador
                titulo="Puntualidad"
                valor={datos.asistencia.totales.puntualidadPct == null ? 'Sin dato' : `${num(datos.asistencia.totales.puntualidadPct)} %`}
                detalle={`${datos.asistencia.totales.presentes} jornadas con entrada`}
              />
              <TarjetaIndicador titulo="Tardanzas" valor={String(datos.asistencia.totales.tardanzas)} detalle={`${datos.asistencia.totales.minutosTarde} min en total`} />
              <TarjetaIndicador titulo="Faltas" valor={String(datos.asistencia.totales.faltas)} />
            </div>
            <BarrasHorizontales
              descripcion="Tardanzas de cada día"
              etiquetaDestacada="Más tardanzas"
              filas={datos.asistencia.porDia.map((d) => ({
                id: d.fecha,
                nombre: diaMes(d.fecha),
                detalle: `${d.presentes} presentes · ${d.faltas} faltas`,
                valor: d.tardanzas,
                texto: `${d.tardanzas} ${d.tardanzas === 1 ? 'tardanza' : 'tardanzas'}`,
                semaforo: d.tardanzas === 0 ? 'verde' : 'ambar',
              }))}
            />
            {verPersonas && p && (
              <div className="an-alt">
                <div className="an-alt__tabla">
                  <table>
                    <caption className="an-solo-lector">Puntualidad por persona</caption>
                    <thead>
                      <tr>
                        <th scope="col">Persona</th>
                        <th scope="col">Días</th>
                        <th scope="col">Tardanzas</th>
                        <th scope="col">Minutos tarde</th>
                        <th scope="col">Faltas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.asistencia.map((f) => (
                        <tr key={f.id}>
                          <th scope="row">{f.nombre}</th>
                          <td>{f.dias}</td>
                          <td>{f.tardanzas}</td>
                          <td>{f.minutosTarde}</td>
                          <td>{f.faltas}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {!verPersonas && <p className="an-sub">El detalle por persona lo ve solo el Administrador.</p>}
          </TarjetaAnalisis>
          <div className="an-rejilla">
            <Grupo
              id="an-mozos"
              titulo="Mozos"
              subtitulo="Pedidos que registró cada mozo, su ticket promedio y minutos hasta la entrega."
              g={datos.productividad.mozos}
              filas={verPersonas && p ? p.mozos : null}
              vacio="Ningún mozo registró pedidos en este período."
            />
            <Grupo
              id="an-cajeros"
              titulo="Cobros en caja"
              subtitulo="Pedidos que cobró cada persona, ticket promedio y minutos desde el pedido hasta el cobro."
              g={datos.productividad.cajeros}
              filas={verPersonas && p ? p.cajeros : null}
              vacio="No hubo cobros en este período."
            />
          </div>
        </>
      )}
    </div>
  );
}
