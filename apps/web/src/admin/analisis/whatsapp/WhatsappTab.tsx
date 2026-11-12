import { useState } from 'react';
import { EstadoError } from '../../../comun/EstadoError';
import { Cargando } from '../../../comun/Cargando';
import {
  BarrasHorizontales,
  ListaRanking,
  MapaDeCalor,
  PanelDetalle,
  TarjetaAnalisis,
  TarjetaIndicador,
  consultaDe,
  textoMinutos,
  useConsultaAnalisis,
  type PropsPestanaAnalisis,
} from '../comun';
import { ChatsSinRespuesta } from './ChatsSinRespuesta';
import type { RespuestaWhatsapp } from './tipos';

const num = (n: number) => n.toLocaleString('es-PE');
const pct = (n: number | null) => (n == null ? 'Sin dato' : `${n.toLocaleString('es-PE', { maximumFractionDigits: 1 })} %`);
const hora = (h: number) => `${String(h).padStart(2, '0')}:00`;
/** «CONSULTA_IA_FALLIDA» → «Consulta ia fallida». */
const motivoLegible = (m: string) => (m === 'SIN_MOTIVO' ? 'Sin motivo guardado' : m.charAt(0) + m.slice(1).toLowerCase().replace(/_/g, ' '));
const TIPO: Record<string, string> = { TEXTO: 'Texto (respuestas dentro de la ventana de 24 h)', PLANTILLA: 'Plantillas', BOTON: 'Botones', INTERACTIVO: 'Interactivos', IMAGEN: 'Imágenes' };

/** Pestaña «WhatsApp»: respuesta del equipo, bot frente a persona, derivaciones, volumen y mensajes enviados. */
export function WhatsappTab({ filtros, esAdmin }: PropsPestanaAnalisis) {
  const { datos, estado, mensaje, recargar } = useConsultaAnalisis<RespuestaWhatsapp>(`/admin/analisis/whatsapp?${consultaDe(filtros, [])}`);
  return (
    <div className="an">
      <ChatsSinRespuesta />
      {estado === 'cargando' && !datos && <Cargando mensaje="Calculando WhatsApp" />}
      {estado === 'error' && !datos && <EstadoError titulo="No se pudo analizar WhatsApp" mensaje={mensaje || 'Prueba de nuevo en unos segundos.'} alReintentar={recargar} />}
      {datos && <Contenido d={datos} esAdmin={esAdmin} />}
    </div>
  );
}

function Contenido({ d, esAdmin }: { d: RespuestaWhatsapp; esAdmin: boolean }) {
  const [horaElegida, setHoraElegida] = useState<string | null>(null);
  const r = d.respuesta;
  const conDatos = r.porHora.filter((h) => h.n > 0);
  const elegida = conDatos.find((h) => String(h.hora) === horaElegida) ?? null;
  const mes = d.consumoMes;
  return (
    <>
      <div className="an-rejilla an-rejilla--kpi">
        <TarjetaIndicador titulo="Respuesta del equipo (mediana)" valor={textoMinutos(r.equipo.mediana)} detalle={r.equipo.n ? `En ${num(r.equipo.n)} consultas` : 'Nadie respondió a mano en este período'} />
        <TarjetaIndicador titulo="El 10 % que más esperó" valor={textoMinutos(r.equipo.p90)} detalle="Percentil 90" />
        <TarjetaIndicador titulo="Solo con el bot" valor={pct(d.bot.pctSoloBot)} detalle={`${num(d.bot.chats)} chats con mensajes del cliente`} />
        <TarjetaIndicador titulo="Derivaciones al equipo" valor={num(d.derivaciones.total)} detalle="Veces que el bot pidió a una persona" />
      </div>
      {r.truncado && (
        <p className="an-error-fechas" role="status">
          Hay más de {num(r.limite)} consultas en el rango: se midieron las más antiguas. Acorta las fechas para ver todo.
        </p>
      )}

      <TarjetaAnalisis
        id="an-wa-hora"
        titulo="Tiempo de respuesta por hora"
        subtitulo="Desde que el cliente escribe hasta la primera respuesta de una persona, según la hora en que escribió (Lima). Toca una hora para ver el detalle."
        estado={conDatos.length ? 'ok' : 'vacio'}
        vacio="Ninguna persona respondió chats en este período."
        tabla={{
          cabecera: ['Hora', 'Consultas', 'Mediana (min)', 'Más lento 10 % (min)', 'Máximo (min)'],
          filas: conDatos.map((h) => [hora(h.hora), h.n, h.mediana ?? 'Sin dato', h.p90 ?? 'Sin dato', h.maximo ?? 'Sin dato']),
        }}
      >
        <BarrasHorizontales
          descripcion="Mediana de espera por hora del día"
          alElegir={(id) => setHoraElegida((a) => (a === id ? null : id))}
          elegida={horaElegida}
          filas={conDatos.map((h) => ({ id: String(h.hora), nombre: hora(h.hora), detalle: `${num(h.n)} consultas`, valor: h.mediana, texto: textoMinutos(h.mediana) }))}
        />
        <p className="an-sub">
          Cuentan solo las consultas que respondió primero una persona: {num(r.atendidasPorPersona)}. Las que atendió el bot ({num(r.atendidasPorBot)}) y las que siguen sin respuesta ({num(r.sinRespuesta)}) no entran.
        </p>
        {elegida && (
          <PanelDetalle titulo={`Hora ${hora(elegida.hora)}`} alCerrar={() => setHoraElegida(null)}>
            <p>
              {num(elegida.n)} consultas. Mediana {textoMinutos(elegida.mediana)}, promedio {textoMinutos(elegida.promedio)}, el 10 % más lento {textoMinutos(elegida.p90)}, máximo {textoMinutos(elegida.maximo)}.
            </p>
          </PanelDetalle>
        )}
      </TarjetaAnalisis>

      {esAdmin ? (
        <TarjetaAnalisis
          id="an-wa-personas"
          titulo="Respuesta por persona"
          subtitulo="Solo lo ve el administrador. Cuenta los mensajes enviados desde Mensajes; los antiguos pueden salir «Sin identificar»."
          estado={r.personas?.length ? 'ok' : 'vacio'}
          vacio="Ninguna persona respondió chats en este período."
          tabla={{
            cabecera: ['Persona', 'Consultas', 'Mediana (min)', 'Más lento 10 % (min)'],
            filas: (r.personas ?? []).map((p) => [p.nombre, p.n, p.mediana ?? 'Sin dato', p.p90 ?? 'Sin dato']),
          }}
        >
          <BarrasHorizontales
            descripcion="Mediana de espera de cada persona"
            filas={(r.personas ?? []).map((p) => ({ id: p.id, nombre: p.nombre, detalle: `${num(p.n)} consultas · el 10 % más lento ${textoMinutos(p.p90)}`, valor: p.mediana, texto: textoMinutos(p.mediana) }))}
          />
        </TarjetaAnalisis>
      ) : (
        <p className="an-sub">El detalle por persona lo ve solo el administrador.</p>
      )}

      <div className="an-rejilla">
        <TarjetaAnalisis
          id="an-wa-bot"
          titulo="Bot frente a persona"
          subtitulo="Chats con mensajes del cliente en el período."
          estado={d.bot.chats ? 'ok' : 'vacio'}
          vacio="No hubo chats en este período."
          tabla={{
            cabecera: ['Quién lo atendió', 'Chats', 'Porcentaje'],
            filas: [
              ['Solo el bot', d.bot.soloBot, pct(d.bot.pctSoloBot)],
              ['Una persona', d.bot.conPersona, pct(d.bot.pctConPersona)],
              ['Sin respuesta', d.bot.sinRespuesta, pct(d.bot.pctSinRespuesta)],
            ],
          }}
        >
          <BarrasHorizontales
            descripcion="Chats según quién respondió"
            filas={[
              { id: 'bot', nombre: 'Solo el bot', valor: d.bot.soloBot, texto: `${num(d.bot.soloBot)} · ${pct(d.bot.pctSoloBot)}` },
              { id: 'persona', nombre: 'Una persona', valor: d.bot.conPersona, texto: `${num(d.bot.conPersona)} · ${pct(d.bot.pctConPersona)}` },
              { id: 'nada', nombre: 'Sin respuesta', valor: d.bot.sinRespuesta, texto: `${num(d.bot.sinRespuesta)} · ${pct(d.bot.pctSinRespuesta)}` },
            ]}
          />
        </TarjetaAnalisis>

        <TarjetaAnalisis
          id="an-wa-motivos"
          titulo="Motivos de derivación"
          subtitulo="Por qué el bot pasó el chat al equipo, según la nota que deja."
          estado={d.derivaciones.total ? 'ok' : 'vacio'}
          vacio="El bot no derivó chats en este período."
          tabla={{ cabecera: ['Motivo', 'Derivaciones', 'Chats'], filas: d.derivaciones.motivos.map((m) => [motivoLegible(m.motivo), m.n, m.chats]) }}
        >
          <ListaRanking
            descripcion="Derivaciones por motivo"
            items={d.derivaciones.motivos.map((m) => ({ id: m.motivo, nombre: motivoLegible(m.motivo), valor: m.n, texto: num(m.n), detalle: `${num(m.chats)} chats` }))}
          />
        </TarjetaAnalisis>
      </div>

      <TarjetaAnalisis
        id="an-wa-volumen"
        titulo="Mensajes por hora"
        subtitulo="Cantidad de mensajes por hora de Lima, sin los avisos internos."
        estado={d.volumen.some((v) => v.cliente + v.bot + v.persona > 0) ? 'ok' : 'vacio'}
        vacio="No hubo mensajes en este período."
      >
        <MapaDeCalor
          descripcion="Mensajes por hora del día: clientes, bot y personas"
          filas={['Clientes', 'Bot', 'Personas']}
          columnas={d.volumen.map((v) => String(v.hora))}
          valores={[d.volumen.map((v) => v.cliente), d.volumen.map((v) => v.bot), d.volumen.map((v) => v.persona)]}
        />
        <p className="an-sub">Las columnas son la hora del día, de 0 a 23.</p>
      </TarjetaAnalisis>

      <TarjetaAnalisis
        id="an-wa-salientes"
        titulo="Mensajes enviados por WhatsApp"
        subtitulo={`Meta cobra los mensajes que pasan de ${num(mes.gratisMes)} al mes. Este mes (${mes.mes}) van ${num(mes.total)} (${pct(mes.porcentaje)}), se proyectan ${num(mes.proyeccionFinDeMes)}${mes.costoEstimadoPen ? ` y el costo estimado es S/ ${mes.costoEstimadoPen.toFixed(2)}` : ''}.`}
        estado={d.salientes.total ? 'ok' : 'vacio'}
        vacio="No se envió ningún mensaje en este período."
        tabla={{ cabecera: ['Tipo', 'Mensajes'], filas: d.salientes.tipos.map((t) => [TIPO[t.tipo] ?? t.tipo, t.n]) }}
      >
        <BarrasHorizontales descripcion="Mensajes enviados por tipo" filas={d.salientes.tipos.map((t) => ({ id: t.tipo, nombre: TIPO[t.tipo] ?? t.tipo, valor: t.n, texto: num(t.n) }))} />
        {d.salientes.plantillas.length > 0 && (
          <ListaRanking descripcion="Plantillas más enviadas" max={5} items={d.salientes.plantillas.map((p) => ({ id: p.plantilla, nombre: p.plantilla, valor: p.n, texto: num(p.n) }))} />
        )}
      </TarjetaAnalisis>
    </>
  );
}
