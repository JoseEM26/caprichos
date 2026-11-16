import { EstadoError } from '../../../comun/EstadoError';
import { Cargando } from '../../../comun/Cargando';
import { BarrasHorizontales, ListaRanking, TarjetaAnalisis, TarjetaIndicador, consultaDe, useConsultaAnalisis, type NivelSemaforo, type PropsPestanaAnalisis } from '../comun';
import type { NivelUso, RespuestaSalud } from './tipos';

const num = (n: number) => n.toLocaleString('es-PE');
const pct = (n: number | null) => (n == null ? 'Sin dato' : `${n.toLocaleString('es-PE', { maximumFractionDigits: 1 })} %`);
const semaforo = (n: NivelUso): NivelSemaforo => (n === 'critico' ? 'rojo' : n === 'atencion' ? 'ambar' : 'verde');
const PALABRA: Record<NivelUso, string> = { ok: 'Normal (menos de 70 %)', atencion: 'Atención (70 % o más)', critico: 'Crítico (90 % o más)' };
const legible = (m: string) => (m === 'SIN_CODIGO' ? 'Sin código guardado' : m.charAt(0) + m.slice(1).toLowerCase().replace(/_/g, ' '));
const ACCION: Record<string, string> = {
  pausa_automatica: 'Pausa automática',
  reanudar_automatico: 'Reanudó solo',
  pausar: 'Pausa manual',
  reanudar: 'Reanudó a mano',
  desconexion: 'Se desconectó',
  reconexion: 'Se reconectó',
};
const cuando = (iso: string) => new Date(iso).toLocaleString('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const fechaCorta = (f: string) => f.slice(8, 10) + '/' + f.slice(5, 7);
const hora = (h: number) => `${String(h).padStart(2, '0')}:00`;

/** Sección «Salud del bot»: lo enviado frente a los topes anti-baneo, descartes, respuestas del bot, conexión y encuestas. */
export function SaludBot({ filtros }: Pick<PropsPestanaAnalisis, 'filtros'>) {
  const { datos, estado, mensaje, recargar } = useConsultaAnalisis<RespuestaSalud>(`/admin/analisis/whatsapp/salud?${consultaDe(filtros, [])}`);
  if (estado === 'cargando' && !datos) return <Cargando mensaje="Calculando la salud del bot" />;
  if (estado === 'error' && !datos) return <EstadoError titulo="No se pudo calcular la salud del bot" mensaje={mensaje || 'Prueba de nuevo en unos segundos.'} alReintentar={recargar} />;
  return datos ? <Contenido d={datos} /> : null;
}

function Contenido({ d }: { d: RespuestaSalud }) {
  const { uso, topes, cola, proporcion: p, bot, conexion, encuestas } = d;
  const sin = p.sinContactoPrevio;
  const horas = d.porHoraDelDia.filter((h) => h.total > 0);
  const hayEnvios = p.totalEnviados > 0;
  const tope = (t: number) => (t > 0 ? t : null);
  return (
    <>
      <p className="an-sub">
        Proveedor en uso: {d.proveedor === 'EVOLUTION' ? 'Evolution (no oficial: aquí se vigila el baneo)' : 'Meta (oficial). Los topes de Evolution solo aplican si lo activas.'} Topes de Configuración: {topes.minuto || 'sin tope'} por minuto, {topes.hora || 'sin tope'} por hora, {topes.dia || 'sin tope'} por día.
      </p>

      <div className="an-rejilla an-rejilla--kpi">
        <TarjetaIndicador
          titulo="Uso del tope diario (día más alto)"
          valor={pct(uso.dia.pct)}
          detalle={`${num(uso.dia.max)} de ${tope(uso.dia.tope) ?? 'sin tope'}${uso.dia.fecha ? ` el ${fechaCorta(uso.dia.fecha)}` : ''}`}
          semaforo={semaforo(uso.dia.nivel)}
        />
        <TarjetaIndicador titulo="Pico en una hora" valor={`${num(uso.hora.max)} de ${tope(uso.hora.tope) ?? 'sin tope'}`} detalle={pct(uso.hora.pct)} semaforo={semaforo(uso.hora.nivel)} />
        <TarjetaIndicador titulo="Pico en un minuto" valor={`${num(uso.minuto.max)} de ${tope(uso.minuto.tope) ?? 'sin tope'}`} detalle={pct(uso.minuto.pct)} semaforo={semaforo(uso.minuto.nivel)} />
        <TarjetaIndicador
          titulo="Iniciados a quien nunca escribió"
          valor={num(sin.mensajes)}
          detalle={sin.numeros ? `${num(sin.numeros)} números. Debe ser 0` : 'Debe ser 0: ningún caso'}
          semaforo={sin.mensajes > 0 ? 'rojo' : 'verde'}
        />
      </div>

      <section className="an-tarjeta" aria-labelledby="an-salud-reco">
        <h3 id="an-salud-reco">
          Recomendaciones
        </h3>
        <ul>
          {d.recomendaciones.map((r) => (
            <li key={r.texto}>
              <strong>{r.nivel === 'alta' ? 'Urgente: ' : r.nivel === 'media' ? 'Atención: ' : 'Nota: '}</strong>
              {r.texto}
            </li>
          ))}
        </ul>
      </section>

      <TarjetaAnalisis
        id="an-salud-dia"
        titulo="Enviados por día frente al tope diario"
        subtitulo="Mensajes que salieron por el número en cada día de Lima. La marca vertical es el tope diario configurado."
        estado={hayEnvios ? 'ok' : 'vacio'}
        vacio="No salió ningún mensaje en este período."
        tabla={{ cabecera: ['Día', 'Enviados', 'Tope diario', 'Uso', 'Nivel'], filas: d.porDia.map((x) => [x.fecha, x.enviados, tope(topes.dia) ?? 'Sin tope', pct(x.pct), PALABRA[x.nivel]]) }}
      >
        <BarrasHorizontales
          descripcion="Mensajes enviados por día"
          filas={d.porDia.map((x) => ({
            id: x.fecha,
            nombre: fechaCorta(x.fecha),
            valor: x.enviados,
            texto: `${num(x.enviados)} · ${pct(x.pct)}`,
            meta: tope(topes.dia) ?? undefined,
            textoMeta: `Tope diario: ${topes.dia}`,
            semaforo: semaforo(x.nivel),
            textoSemaforo: PALABRA[x.nivel],
          }))}
        />
      </TarjetaAnalisis>

      <TarjetaAnalisis
        id="an-salud-hora"
        titulo="Enviados por hora del día frente al tope por hora"
        subtitulo="Para cada hora de Lima: la mayor cantidad enviada en esa hora en algún día del período (pico). La marca es el tope por hora."
        estado={horas.length ? 'ok' : 'vacio'}
        vacio="No salió ningún mensaje en este período."
        tabla={{ cabecera: ['Hora', 'Total en el período', 'Pico en una hora', 'Uso del tope por hora'], filas: horas.map((h) => [hora(h.hora), h.total, h.pico, pct(h.pctPico)]) }}
      >
        <BarrasHorizontales
          descripcion="Pico de mensajes enviados por hora del día"
          filas={horas.map((h) => ({
            id: String(h.hora),
            nombre: hora(h.hora),
            detalle: `${num(h.total)} en total`,
            valor: h.pico,
            texto: `${num(h.pico)} · ${pct(h.pctPico)}`,
            meta: tope(topes.hora) ?? undefined,
            textoMeta: `Tope por hora: ${topes.hora}`,
            semaforo: semaforo(h.nivel),
            textoSemaforo: PALABRA[h.nivel],
          }))}
        />
      </TarjetaAnalisis>

      <div className="an-rejilla">
        <TarjetaAnalisis
          id="an-salud-cola"
          titulo="Enviados, fallidos, descartados y pendientes"
          subtitulo="De lo que se pidió enviar en el período."
          estado={cola.enviados + cola.fallidos + cola.descartados + cola.pendientes ? 'ok' : 'vacio'}
          vacio="No se pidió enviar ningún mensaje."
          tabla={{
            cabecera: ['Estado', 'Mensajes'],
            filas: [['Enviados', cola.enviados], ['Fallidos', cola.fallidos], ['Descartados', cola.descartados], ['Pendientes', cola.pendientes]],
          }}
        >
          <BarrasHorizontales
            descripcion="Mensajes por estado"
            filas={[
              { id: 'env', nombre: 'Enviados', valor: cola.enviados, texto: num(cola.enviados) },
              { id: 'fal', nombre: 'Fallidos', detalle: cola.pctFallidos == null ? undefined : `${pct(cola.pctFallidos)} de los cerrados`, valor: cola.fallidos, texto: num(cola.fallidos) },
              { id: 'des', nombre: 'Descartados', valor: cola.descartados, texto: num(cola.descartados) },
              { id: 'pen', nombre: 'Pendientes', valor: cola.pendientes, texto: num(cola.pendientes) },
            ]}
          />
        </TarjetaAnalisis>

        <TarjetaAnalisis
          id="an-salud-descartes"
          titulo="Por qué se descartó o falló"
          subtitulo="Fuera de la ventana de 24 h, pausa, número inválido, sin contacto previo…"
          estado={cola.motivosDescartados.length + cola.motivosFallidos.length ? 'ok' : 'vacio'}
          vacio="No hubo descartes ni fallos."
          tabla={{
            cabecera: ['Estado', 'Motivo', 'Mensajes'],
            filas: [...cola.motivosDescartados.map((m) => ['Descartado', legible(m.codigo), m.n]), ...cola.motivosFallidos.map((m) => ['Fallido', legible(m.codigo), m.n])],
          }}
        >
          <ListaRanking
            descripcion="Motivos de descarte y fallo"
            items={[
              ...cola.motivosDescartados.map((m) => ({ id: `d-${m.codigo}`, nombre: legible(m.codigo), detalle: 'Descartado', valor: m.n, texto: num(m.n) })),
              ...cola.motivosFallidos.map((m) => ({ id: `f-${m.codigo}`, nombre: legible(m.codigo), detalle: 'Fallido', valor: m.n, texto: num(m.n) })),
            ]}
          />
        </TarjetaAnalisis>
      </div>

      <TarjetaAnalisis
        id="an-salud-proporcion"
        titulo="Entrantes y salientes: quién empieza la conversación"
        subtitulo={`Lo sano es que casi todo lo que sale sea respuesta a un cliente. ${p.salientesPorEntrante == null ? '' : `Por cada mensaje que entra salen ${p.salientesPorEntrante.toLocaleString('es-PE')}.`}`}
        estado={hayEnvios || p.entrantes ? 'ok' : 'vacio'}
        vacio="No hubo mensajes en este período."
        tabla={{
          cabecera: ['Tipo', 'Mensajes'],
          filas: [
            ['Entrantes (clientes)', p.entrantes],
            ['Salientes: respuestas a un cliente', p.respuestas],
            ['Salientes: pedidos por el cliente (código, reserva)', p.pedidosPorElCliente],
            ['Salientes: avisos al equipo', p.alEquipo],
            ['Salientes: iniciados por nosotros (avisos, encuesta)', p.iniciados],
            ['Iniciados a quien nunca escribió', sin.mensajes],
          ],
        }}
      >
        <BarrasHorizontales
          descripcion="Entrantes frente a salientes"
          filas={[
            { id: 'ent', nombre: 'Entrantes (clientes)', valor: p.entrantes, texto: num(p.entrantes) },
            { id: 'res', nombre: 'Salientes: respuestas', valor: p.respuestas, texto: num(p.respuestas) },
            { id: 'ped', nombre: 'Salientes: pedidos por el cliente', valor: p.pedidosPorElCliente, texto: num(p.pedidosPorElCliente) },
            { id: 'equ', nombre: 'Salientes: al equipo', valor: p.alEquipo, texto: num(p.alEquipo) },
            { id: 'ini', nombre: 'Salientes: iniciados por nosotros', detalle: p.pctIniciados == null ? undefined : `${pct(p.pctIniciados)} de lo enviado`, valor: p.iniciados, texto: num(p.iniciados) },
            {
              id: 'nun',
              nombre: 'Iniciados a quien nunca escribió',
              detalle: 'Debe ser 0',
              valor: sin.mensajes,
              texto: num(sin.mensajes),
              semaforo: sin.mensajes > 0 ? 'rojo' : 'verde',
              textoSemaforo: sin.mensajes > 0 ? 'Riesgo de baneo' : 'Sin riesgo',
            },
          ]}
        />
        {sin.truncado && <p className="an-sub">Se revisaron los primeros {num(sin.numerosRevisados)} números; acorta las fechas para ver todo.</p>}
      </TarjetaAnalisis>

      <div className="an-rejilla">
        <TarjetaAnalisis
          id="an-salud-bot"
          titulo="Respuestas del bot por tipo"
          subtitulo={`Turnos de IA por conversación: promedio ${bot.turnosPorConversacion.promedio == null ? 'sin dato' : bot.turnosPorConversacion.promedio.toLocaleString('es-PE')}, máximo ${num(bot.turnosPorConversacion.maximo)} (${num(bot.turnosPorConversacion.conversaciones)} conversaciones). Pasaron a una persona: ${num(bot.derivadasAPersona)}.`}
          estado={bot.total ? 'ok' : 'vacio'}
          vacio="El bot no respondió en este período."
          tabla={{
            cabecera: ['Tipo', 'Mensajes'],
            filas: [['Menú y flujos', bot.menu], ['IA', bot.ia], ['Aviso de local cerrado', bot.cerrado], ['Bienvenida', bot.bienvenida], ['Encuesta', bot.encuesta], ['Avisos del pedido', bot.avisoPedido]],
          }}
        >
          <BarrasHorizontales
            descripcion="Mensajes del bot por tipo"
            filas={[
              { id: 'menu', nombre: 'Menú y flujos', valor: bot.menu, texto: num(bot.menu) },
              { id: 'ia', nombre: 'IA', detalle: bot.iaErrores ? `${num(bot.iaErrores)} con error` : undefined, valor: bot.ia, texto: num(bot.ia) },
              { id: 'cer', nombre: 'Aviso de local cerrado', valor: bot.cerrado, texto: num(bot.cerrado) },
              { id: 'bie', nombre: 'Bienvenida', valor: bot.bienvenida, texto: num(bot.bienvenida) },
              { id: 'enc', nombre: 'Encuesta', valor: bot.encuesta, texto: num(bot.encuesta) },
              { id: 'avi', nombre: 'Avisos del pedido', valor: bot.avisoPedido, texto: num(bot.avisoPedido) },
            ]}
          />
        </TarjetaAnalisis>

        <TarjetaAnalisis
          id="an-salud-conexion"
          titulo="Pausas, desconexiones y reconexiones"
          subtitulo={`Pausas automáticas ${num(conexion.pausasAutomaticas)}, manuales ${num(conexion.pausasManuales)}, desconexiones ${num(conexion.desconexiones)}, reconexiones ${num(conexion.reconexiones)}.`}
          estado={conexion.ultimos.length ? 'ok' : 'vacio'}
          vacio="Sin pausas ni desconexiones registradas en este período."
          tabla={{ cabecera: ['Cuándo (Lima)', 'Qué pasó', 'Motivo'], filas: conexion.ultimos.map((u) => [cuando(u.en), ACCION[u.accion] ?? u.accion, u.motivo ?? '']) }}
        >
          <ListaRanking
            descripcion="Últimos eventos de conexión"
            items={conexion.ultimos.map((u, i) => ({ id: `${u.en}-${i}`, nombre: ACCION[u.accion] ?? u.accion, detalle: u.motivo ?? undefined, valor: 1, texto: cuando(u.en) }))}
          />
        </TarjetaAnalisis>
      </div>

      <TarjetaAnalisis
        id="an-salud-encuestas"
        titulo="Encuestas de posventa"
        subtitulo={`Enviadas ${num(encuestas.enviadas)}, respondidas ${num(encuestas.respondidas)}. Tasa de respuesta ${pct(encuestas.tasaRespuesta)}. Promedio ${encuestas.promedio == null ? 'sin dato' : `${encuestas.promedio.toLocaleString('es-PE')} de 5`}.`}
        estado={encuestas.enviadas ? 'ok' : 'vacio'}
        vacio="No se envió ninguna encuesta en este período."
        tabla={{ cabecera: ['Enviadas', 'Respondidas', 'Tasa de respuesta', 'Promedio (1 a 5)'], filas: [[encuestas.enviadas, encuestas.respondidas, pct(encuestas.tasaRespuesta), encuestas.promedio ?? 'Sin dato']] }}
      >
        <BarrasHorizontales
          descripcion="Encuestas enviadas y respondidas"
          filas={[
            { id: 'env', nombre: 'Enviadas', valor: encuestas.enviadas, texto: num(encuestas.enviadas) },
            { id: 'res', nombre: 'Respondidas', detalle: pct(encuestas.tasaRespuesta), valor: encuestas.respondidas, texto: num(encuestas.respondidas) },
          ]}
        />
      </TarjetaAnalisis>
    </>
  );
}
