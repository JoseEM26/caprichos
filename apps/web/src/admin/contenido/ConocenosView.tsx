import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../comun/api';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { Confirmar } from '../../comun/Confirmar';
import { PaginaConocenos } from '../../carta/PaginaConocenos';
import { DispositivoForzado, useEsMovil } from '../../carta/useEsMovil';
import { CONOCENOS_DEFAULT, normalizarConocenos } from '../../carta/conocenosContenido';
import type { ContenidoConocenos } from '../../carta/conocenosContenido';
import { limpiarUrlFoto } from '../../carta/contenido/VisorHistoriasModal';
import type { DatosLocalCarta, EstadoLocalCarta } from '../../carta/tipos';

interface RespuestaConocenos {
  contenido: ContenidoConocenos;
  publicado: ContenidoConocenos;
  tieneBorrador: boolean;
}

type Accion = 'guardar' | 'publicar' | 'descartar' | 'restablecer';

const NOMBRE_BLOQUE: Record<string, string> = {
  donde: 'Dónde estamos',
  horario: 'Horario',
  contacto: 'Contáctanos',
  redes: 'Síguenos',
  momentos: 'Mosaico de momentos',
};

const campo: CSSProperties = {
  width: '100%', boxSizing: 'border-box', minHeight: 44, padding: '8px 12px',
  border: '1px solid var(--cp-line)', borderRadius: 10, fontSize: 14, fontFamily: 'inherit',
};
const etiquetaCampo: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 700 };

function Seccion({ titulo, abierta, alAlternar, children }: { titulo: string; abierta: boolean; alAlternar: () => void; children: ReactNode }) {
  return (
    <section style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: 12 }}>
      <button
        type="button"
        aria-expanded={abierta}
        onClick={alAlternar}
        style={{ width: '100%', minHeight: 44, padding: '0 16px', border: 0, background: 'transparent', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 16, cursor: 'pointer', color: 'var(--cp-navy)' }}
      >
        <span>{titulo}</span>
        <span aria-hidden="true">{abierta ? '−' : '+'}</span>
      </button>
      {abierta && <div style={{ padding: '4px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>}
    </section>
  );
}

const aTexto = (c: ContenidoConocenos) => c.parrafos.join('\n\n');
const aParrafos = (t: string) => t.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

/** Editor de la página Conócenos con vista previa en vivo (mismo componente que la carta). */
export function ConocenosView() {
  const navigate = useNavigate();
  const esMovil = useEsMovil();
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [c, setC] = useState<ContenidoConocenos>(CONOCENOS_DEFAULT);
  const [textoParr, setTextoParr] = useState(aTexto(CONOCENOS_DEFAULT));
  const [tieneBorrador, setTieneBorrador] = useState(false);
  const [sinGuardar, setSinGuardar] = useState(false);
  const [abiertas, setAbiertas] = useState<Record<string, boolean>>({ encabezado: true });
  const [pestana, setPestana] = useState<'editor' | 'vista'>('editor');
  const [celular, setCelular] = useState(false);
  const [confirmar, setConfirmar] = useState<Accion | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [datosLocal, setDatosLocal] = useState<DatosLocalCarta | null>(null);
  const [estadoLocal, setEstadoLocal] = useState<EstadoLocalCarta | null>(null);
  const [fotos, setFotos] = useState<string[]>([]);

  const aplicar = (r: RespuestaConocenos) => {
    setC(r.contenido);
    setTextoParr(aTexto(r.contenido));
    setTieneBorrador(r.tieneBorrador);
    setSinGuardar(false);
  };

  useEffect(() => {
    (async () => {
      try {
        aplicar(await api.get<RespuestaConocenos>('/admin/contenido/conocenos'));
      } catch (e: any) {
        setError(e?.message || 'No se pudo cargar Conócenos');
      } finally {
        setCargando(false);
      }
    })();
    api.get<DatosLocalCarta>('/carta/local').then(setDatosLocal).catch(() => {});
    api.get<EstadoLocalCarta>('/carta/estado').then(setEstadoLocal).catch(() => {});
    api.get<any>('/carta/contenido')
      .then((ct) => setFotos(
        (ct?.destacadas ?? []).flatMap((d: any) => (d.activo !== false && Array.isArray(d.fotos) ? d.fotos.map((f: any) => limpiarUrlFoto(f.url)) : [])).filter(Boolean),
      ))
      .catch(() => {});
  }, []);

  const actual = useMemo(() => normalizarConocenos({ ...c, parrafos: aParrafos(textoParr) }), [c, textoParr]);
  const cambiar = (parcial: Partial<ContenidoConocenos>) => { setC((p) => ({ ...p, ...parcial })); setSinGuardar(true); };
  const cambiarBloque = (id: string, parcial: Partial<ContenidoConocenos['bloques'][number]>) =>
    cambiar({ bloques: c.bloques.map((b) => (b.id === id ? { ...b, ...parcial } : b)) });
  const mover = (i: number, d: -1 | 1) => {
    const copia = [...c.bloques];
    [copia[i], copia[i + d]] = [copia[i + d], copia[i]];
    cambiar({ bloques: copia });
  };
  const alternar = (k: string) => setAbiertas((p) => ({ ...p, [k]: !p[k] }));

  const ejecutar = async () => {
    if (!confirmar) return;
    setTrabajando(true);
    try {
      let r: RespuestaConocenos;
      let msg: string;
      if (confirmar === 'guardar') {
        r = await api.put<RespuestaConocenos>('/admin/contenido/conocenos', actual);
        msg = 'Borrador guardado';
      } else if (confirmar === 'publicar') {
        await api.put('/admin/contenido/conocenos', actual);
        r = await api.post<RespuestaConocenos>('/admin/contenido/conocenos/publicar', {});
        msg = 'Conócenos publicado: ya lo ven los clientes';
      } else if (confirmar === 'descartar') {
        r = await api.post<RespuestaConocenos>('/admin/contenido/conocenos/descartar', {});
        msg = 'Borrador descartado';
      } else {
        r = await api.put<RespuestaConocenos>('/admin/contenido/conocenos', CONOCENOS_DEFAULT);
        msg = 'Textos originales restablecidos como borrador; falta publicar';
      }
      aplicar({ ...r, contenido: r.contenido ?? CONOCENOS_DEFAULT });
      setMensaje(msg);
    } catch (e: any) {
      setMensaje(e?.message || 'No se pudo completar la acción');
    } finally {
      setTrabajando(false);
      setConfirmar(null);
    }
  };

  if (cargando) return <Cargando mensaje="Cargando Conócenos..." />;
  if (error) return <EstadoError mensaje={error} />;

  const textoConfirmar: Record<Accion, { titulo: string; mensaje: string; si: string }> = {
    guardar: { titulo: 'Guardar borrador', mensaje: 'Se guarda como borrador. Los clientes aún no lo ven.', si: 'Sí, guardar' },
    publicar: { titulo: 'Publicar Conócenos', mensaje: 'Los clientes verán estos textos en la carta virtual.', si: 'Sí, publicar' },
    descartar: { titulo: 'Descartar borrador', mensaje: 'Se pierden los cambios no publicados.', si: 'Sí, descartar' },
    restablecer: { titulo: 'Restablecer textos originales', mensaje: 'Se vuelve a los textos de siempre (queda como borrador).', si: 'Sí, restablecer' },
  };

  const editor = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      <Seccion titulo="Encabezado" abierta={!!abiertas.encabezado} alAlternar={() => alternar('encabezado')}>
        <label style={etiquetaCampo}>Etiqueta
          <input style={campo} value={c.etiqueta} maxLength={40} onChange={(e) => cambiar({ etiqueta: e.target.value })} />
        </label>
        <label style={etiquetaCampo}>Título
          <input style={campo} value={c.titulo} maxLength={120} onChange={(e) => cambiar({ titulo: e.target.value })} />
        </label>
        <label style={etiquetaCampo}>Texto principal (deja una línea en blanco entre párrafos)
          <textarea style={{ ...campo, minHeight: 120 }} value={textoParr} onChange={(e) => { setTextoParr(e.target.value); setSinGuardar(true); }} />
        </label>
      </Seccion>

      <Seccion titulo="Bloques" abierta={!!abiertas.bloques} alAlternar={() => alternar('bloques')}>
        <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>Elige qué bloques se ven y en qué orden. La dirección, el horario, el teléfono y las redes se editan en la configuración del local.</div>
        <Boton variante="secundario" onClick={() => navigate('/admin/mirest')}>Editar dirección, horario y contacto</Boton>
        {c.bloques.map((b, i) => (
          <div key={b.id} style={{ border: '1px solid var(--cp-line)', borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, fontWeight: 700, flex: 1 }}>
                <input type="checkbox" style={{ width: 22, height: 22 }} checked={b.visible} onChange={(e) => cambiarBloque(b.id, { visible: e.target.checked })} />
                Mostrar {NOMBRE_BLOQUE[b.id]}
              </label>
              <Boton variante="secundario" tamano="pequeno" disabled={i === 0} aria-label={`Subir ${NOMBRE_BLOQUE[b.id]}`} onClick={() => mover(i, -1)}>Subir</Boton>
              <Boton variante="secundario" tamano="pequeno" disabled={i === c.bloques.length - 1} aria-label={`Bajar ${NOMBRE_BLOQUE[b.id]}`} onClick={() => mover(i, 1)}>Bajar</Boton>
            </div>
            {b.id !== 'momentos' && (
              <label style={etiquetaCampo}>Título del bloque
                <input style={campo} value={b.titulo} maxLength={80} aria-label={`Título de ${NOMBRE_BLOQUE[b.id]}`} onChange={(e) => cambiarBloque(b.id, { titulo: e.target.value })} />
              </label>
            )}
          </div>
        ))}
      </Seccion>

      <Seccion titulo="Momentos" abierta={!!abiertas.momentos} alAlternar={() => alternar('momentos')}>
        <label style={etiquetaCampo}>Título del mosaico
          <input style={campo} value={c.bloques.find((b) => b.id === 'momentos')?.titulo ?? ''} maxLength={80} aria-label="Título del mosaico" onChange={(e) => cambiarBloque('momentos', { titulo: e.target.value })} />
        </label>
        <label style={etiquetaCampo}>Cuántas fotos muestra (1 a 24)
          <input style={campo} type="number" min={1} max={24} value={c.momentosCantidad} onChange={(e) => cambiar({ momentosCantidad: Math.min(24, Math.max(1, Number(e.target.value) || 1)) })} />
        </label>
      </Seccion>

      <Seccion titulo="Fotos" abierta={!!abiertas.fotos} alAlternar={() => alternar('fotos')}>
        <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>Las fotos del mosaico vienen de «Momentos» del diseño de la carta. La galería «Nuestro lugar» se sube en la configuración del local.</div>
        <Boton variante="secundario" onClick={() => navigate('/admin/mirest')}>Subir fotos de Nuestro lugar</Boton>
        <Boton variante="secundario" onClick={() => navigate('/admin/disenador')}>Elegir fotos de Momentos</Boton>
      </Seccion>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Boton variante="secundario" disabled={trabajando} onClick={() => setConfirmar('guardar')}>Guardar borrador</Boton>
        <Boton disabled={trabajando} onClick={() => setConfirmar('publicar')}>Publicar</Boton>
        <Boton variante="secundario" disabled={trabajando || !tieneBorrador} onClick={() => setConfirmar('descartar')}>Descartar borrador</Boton>
        <Boton variante="peligro" disabled={trabajando} onClick={() => setConfirmar('restablecer')}>Restablecer a los textos originales</Boton>
      </div>
    </div>
  );

  const vista = (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <Boton variante={celular ? 'secundario' : 'oscuro'} onClick={() => setCelular(false)} aria-pressed={!celular}>PC</Boton>
        <Boton variante={celular ? 'oscuro' : 'secundario'} onClick={() => setCelular(true)} aria-pressed={celular}>Celular</Boton>
      </div>
      <div
        data-testid={`preview-conocenos-${celular ? 'celular' : 'pc'}`}
        style={{ width: '100%', maxWidth: celular ? 390 : 1200, margin: '0 auto', border: celular ? '8px solid var(--cp-navy)' : '1px solid var(--cp-line)', borderRadius: celular ? 28 : 16, background: 'var(--cp-cream)', boxSizing: 'border-box', overflow: 'hidden' }}
      >
        <div style={{ height: 720, overflowY: 'auto', overflowX: 'hidden', position: 'relative', background: 'var(--cp-cream)' }}>
          <DispositivoForzado movil={celular}>
            <PaginaConocenos datosLocal={datosLocal} estadoLocal={estadoLocal} fotos={fotos} contenido={actual} />
          </DispositivoForzado>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
      <div>
        <h1 style={{ margin: 0, fontFamily: 'var(--fuente-titulos)', fontSize: 22, color: 'var(--cp-navy)' }}>Conócenos</h1>
        <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>
          {sinGuardar ? 'Tienes cambios sin guardar.' : tieneBorrador ? 'Hay un borrador sin publicar.' : 'Lo publicado coincide con lo que ves.'}
        </div>
      </div>
      {mensaje && <div role="status" style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--cp-sand)', fontWeight: 700 }}>{mensaje}</div>}

      {esMovil ? (
        <>
          <div style={{ display: 'flex', gap: 8 }}>
            <Boton variante={pestana === 'editor' ? 'oscuro' : 'secundario'} onClick={() => setPestana('editor')}>Editor</Boton>
            <Boton variante={pestana === 'vista' ? 'oscuro' : 'secundario'} onClick={() => setPestana('vista')}>Vista previa</Boton>
          </div>
          {pestana === 'editor' ? editor : vista}
        </>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 440px) minmax(0, 1fr)', gap: 20, alignItems: 'start' }}>
          {editor}
          {vista}
        </div>
      )}

      <Confirmar
        abierto={confirmar !== null}
        titulo={confirmar ? textoConfirmar[confirmar].titulo : ''}
        mensaje={confirmar ? textoConfirmar[confirmar].mensaje : ''}
        textoConfirmar={confirmar ? textoConfirmar[confirmar].si : undefined}
        textoNo="No"
        peligro={confirmar === 'descartar' || confirmar === 'restablecer'}
        cargando={trabajando}
        alConfirmar={ejecutar}
        alCancelar={() => setConfirmar(null)}
      />
    </div>
  );
}
