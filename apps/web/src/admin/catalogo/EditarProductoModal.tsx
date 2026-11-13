import { ReactNode, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ModalConPestanas, PestanaModal } from '../../comun/ModalConPestanas';
import { Confirmar } from '../../comun/Confirmar';
import { IndicadorSubida } from '../../comun/IndicadorSubida';
import { Tip } from './ayudaOpciones';
import type { CategoriaAdmin, ProductoAdmin, SaborItem } from './catalogoApi';
import './editor-opciones.css';
import './editar-producto.css';
import { textosOrigenAgotado } from './origenAgotado';
import { ALERGENOS, esAlergenoPersonalizado, normalizarAlergeno } from '../../comun/alergenos';

export interface EditarProductoModalProps {
  producto: ProductoAdmin;
  categorias: CategoriaAdmin[];
  nombre: string; setNombre: (v: string) => void;
  categoriaId: string; setCategoriaId: (v: string) => void;
  precio: string; setPrecio: (v: string) => void;
  oculto: boolean; setOculto: (v: boolean) => void;
  controlaStock: boolean; setControlaStock: (v: boolean) => void;
  porciones: string; setPorciones: (v: string) => void;
  alergenos: string[]; setAlergenos: (v: string[]) => void;
  /** Alérgenos personalizados ya usados en otros productos (para reutilizarlos con un toque). */
  alergenosSugeridos?: string[];
  alergenosConfirmados: boolean; setAlergenosConfirmados: (v: boolean) => void;
  fotoUrl: string | null;
  subiendoFoto: boolean;
  estadoFoto: any; errorFoto: any; alReintentarFoto: () => void;
  alSubirFoto: (e: React.ChangeEvent<HTMLInputElement>) => void;
  alQuitarFoto: () => void;
  sabores: SaborItem[]; setSabores: (v: SaborItem[]) => void;
  nuevoSabor: string; setNuevoSabor: (v: string) => void;
  error: string;
  puedeEditar: boolean;
  resumenOpciones: string;
  alAbrirOpciones: () => void;
  /** Botón «Ver cómo se ve en la carta» (lo arma quien contiene el formulario). */
  vistaPrevia: ReactNode;
  guardando: boolean;
  alGuardar: () => void;
  alCancelar: () => void;
}

/**
 * Editar producto en dos pestañas: «Datos» (nombre, categoría, precio, imagen, visibilidad y el acceso a
 * Tamaños y opciones) y «Stock y sabores». Un anfitrión de combo (Dúo, Cajita) no usa stock ni sabores propios.
 */
export function EditarProductoModal(p: EditarProductoModalProps) {
  const esCombo = p.producto.esAnfitrionCombo === true;
  const [confirmarSalir, setConfirmarSalir] = useState(false);
  const [confirmarOpciones, setConfirmarOpciones] = useState(false);
  const [otroAlergeno, setOtroAlergeno] = useState('');
  const agregarOtro = () => {
    const v = normalizarAlergeno(otroAlergeno);
    if (v && !p.alergenos.includes(v)) p.setAlergenos([...p.alergenos, v]);
    if (v) setOtroAlergeno('');
  };
  const inicial = useRef(JSON.stringify([p.nombre, p.categoriaId, p.precio, p.oculto, p.controlaStock, p.fotoUrl, p.sabores, p.porciones, p.alergenos, p.alergenosConfirmados]));
  const sucio = JSON.stringify([p.nombre, p.categoriaId, p.precio, p.oculto, p.controlaStock, p.fotoUrl, p.sabores, p.porciones, p.alergenos, p.alergenosConfirmados]) !== inicial.current;
  // Tamaños y opciones reemplaza a este modal (nunca dos a la vez): con cambios sin guardar, se avisa antes.
  const abrirOpciones = () => (sucio ? setConfirmarOpciones(true) : p.alAbrirOpciones());
  const cerrar = () => (sucio ? setConfirmarSalir(true) : p.alCancelar());
  const bloqueado = !p.puedeEditar;

  const hayVentas = p.sabores.length > 0;
  const guardado = p.producto.controlaStock === true; // el estado de abajo es el del servidor, no el del interruptor sin guardar
  const sinAperturaSabores = p.sabores.some((s) => s.aperturaHoy === false || s.quedan === null || s.quedan === undefined);
  const totalQuedan = p.sabores.reduce((a, s) => a + (s.activo !== false && typeof s.quedan === 'number' ? s.quedan : 0), 0);
  const aperturaFalta = hayVentas ? sinAperturaSabores : p.producto.aperturaHoy === false;
  const quedanHoy = hayVentas ? totalQuedan : p.producto.quedan ?? 0;

  const datos = (
    <>
      <section className="ep-sec" aria-label="Datos">
        <h3 className="ep-h">Datos</h3>
        <div className="ep-fila3">
          <label className="ep-campo ep-nombre"><span>Nombre</span>
            <input className="eo-input" type="text" value={p.nombre} onChange={(e) => p.setNombre(e.target.value)} />
          </label>
          <label className="ep-campo"><span>Categoría</span>
            <select className="eo-input" value={p.categoriaId} onChange={(e) => p.setCategoriaId(e.target.value)}>
              {p.categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </label>
          <label className="ep-campo ep-precio"><span>Precio (s/)</span>
            <input className="eo-input" type="number" step="0.50" value={p.precio} onChange={(e) => p.setPrecio(e.target.value)} />
          </label>
        </div>
        <div className="ep-imagen">
          <img src={p.fotoUrl || '/logo.png'} alt="Imagen actual" className="ep-miniatura" />
          <div className="ep-imagen-acciones">
            <div className="ep-campo"><span>Imagen</span></div>
            <div className="ep-botones">
              <label className="eo-btn ep-subir">
                {p.subiendoFoto ? 'Subiendo imagen…' : 'Subir imagen'}
                <input type="file" accept="image/*" onChange={p.alSubirFoto} disabled={p.subiendoFoto} className="ep-oculto" />
              </label>
              {p.fotoUrl && <button type="button" className="eo-btn ep-quitar" onClick={p.alQuitarFoto}>Quitar imagen</button>}
            </div>
            <IndicadorSubida estado={p.estadoFoto} error={p.errorFoto} onReintentar={p.alReintentarFoto} />
          </div>
        </div>
      </section>

      <section className="ep-sec" aria-label="Alcance y alérgenos">
        <h3 className="ep-h">Alcance y alérgenos</h3>
        <label className="ep-campo"><span>Alcanza para</span>
          <input className="eo-input" type="text" maxLength={60} placeholder="Ej.: 8 a 10 personas" value={p.porciones}
            disabled={bloqueado} onChange={(e) => p.setPorciones(e.target.value)} />
        </label>
        <div className="ep-campo"><span>Alérgenos</span></div>
        <div className="ep-alergenos" role="group" aria-label="Alérgenos">
          {ALERGENOS.map((a) => {
            const marcado = p.alergenos.includes(a.valor);
            return (
              <button key={a.valor} type="button" className={`eo-btn${marcado ? ' ep-chip-activo' : ''}`} aria-pressed={marcado} disabled={bloqueado}
                onClick={() => p.setAlergenos(marcado ? p.alergenos.filter((x) => x !== a.valor) : [...p.alergenos, a.valor])}>
                {a.etiqueta}
              </button>
            );
          })}
          {p.alergenos.filter(esAlergenoPersonalizado).map((v) => (
            <button key={v} type="button" className="eo-btn ep-chip-activo" disabled={bloqueado} aria-label={`Quitar ${v}`}
              onClick={() => p.setAlergenos(p.alergenos.filter((x) => x !== v))}>
              {v} ×
            </button>
          ))}
          {(p.alergenosSugeridos ?? []).filter((v) => !p.alergenos.includes(v)).map((v) => (
            <button key={`s-${v}`} type="button" className="eo-btn" disabled={bloqueado} aria-label={`Agregar ${v}`}
              onClick={() => p.setAlergenos([...p.alergenos, v])}>
              + {v}
            </button>
          ))}
        </div>
        <div className="ep-otro-alergeno">
          <input className="eo-input" type="text" maxLength={30} placeholder="Otro alérgeno (ej.: lúcuma)" aria-label="Otro alérgeno"
            value={otroAlergeno} disabled={bloqueado} onChange={(e) => setOtroAlergeno(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarOtro(); } }} />
          <button type="button" className="eo-btn" disabled={bloqueado || !otroAlergeno.trim()} onClick={agregarOtro}>Agregar</button>
        </div>
        <label className="eo-interruptor">
          <input type="checkbox" checked={p.alergenosConfirmados} disabled={bloqueado} onChange={(e) => p.setAlergenosConfirmados(e.target.checked)} />
          <span className="eo-pista" aria-hidden="true" />
          <span className="eo-interruptor-texto">Revisé los alérgenos de este producto</span>
        </label>
        <div className="eo-micro">Sin esta casilla, la carta no muestra los alérgenos y el bot no afirma si lleva o no un alérgeno: pasa la duda a una persona.</div>
      </section>

      <section className="ep-sec" aria-label="Visibilidad">
        <h3 className="ep-h">Visibilidad</h3>
        <label className="eo-interruptor">
          <input type="checkbox" checked={!p.oculto} onChange={(e) => p.setOculto(!e.target.checked)} />
          <span className="eo-pista" aria-hidden="true" />
          <span className="eo-interruptor-texto">Mostrar en la carta</span>
        </label>
        <div className="eo-micro">Apagado, el producto se oculta de la carta y del bot, pero no se borra.</div>
      </section>

      {p.puedeEditar && (
        <section className="ep-sec" aria-label="Tamaños y opciones">
          <h3 className="ep-h">Tamaños y opciones</h3>
          <button type="button" className="eo-btn ep-enlace" onClick={abrirOpciones}>
            Tamaños y opciones · {p.resumenOpciones}
          </button>
          {p.vistaPrevia}
        </section>
      )}
      {!p.puedeEditar && p.vistaPrevia}
    </>
  );

  const stock = esCombo ? (
    <div className="ep-nota-combo" role="note">
      Este producto es un combo: su disponibilidad sale de lo que lo compone. Las opciones del combo se enlazan al stock en «Tamaños y opciones» › «Stock de opciones».
    </div>
  ) : (
    <>
      <section className="ep-sec" aria-label="Stock">
        <h3 className="ep-h">Stock</h3>
        {p.producto.disponible === false && (
          <div className="ep-estado" role="status" title={textosOrigenAgotado(p.producto.agotadoOrigen).ayuda}>
            {textosOrigenAgotado(p.producto.agotadoOrigen).corto}
          </div>
        )}
        <div className="ep-ajuste">
          <label className="eo-interruptor">
            <input type="checkbox" checked={p.controlaStock} disabled={bloqueado}
              onChange={(e) => p.setControlaStock(e.target.checked)} />
            <span className="eo-pista" aria-hidden="true" />
            <span className="eo-interruptor-texto">Controlar stock de este producto</span>
          </label>
          <Tip etiqueta="Controlar stock"
            texto="Para productos que se acaban, como donas o galletas: se descuenta al vender, se marca Agotado al llegar a 0 y la carta muestra cuántos quedan. Necesita el conteo de apertura de cada día." />
        </div>
        {p.controlaStock && !guardado && (
          <div className="ep-estado" role="status">Se activa al guardar. Después carga el conteo en <Link to="/admin/apertura">Apertura del día</Link>.</div>
        )}
        {p.controlaStock && guardado && (
          <div className="ep-estado" role="status">
            Quedan {quedanHoy} hoy
            {aperturaFalta && <> · Sin apertura de hoy: cárgala en <Link to="/admin/apertura">Apertura del día</Link></>}
          </div>
        )}
      </section>

      <section className="ep-sec" aria-label="Sabores o variantes">
        <h3 className="ep-h">
          Sabores o variantes
          <Tip etiqueta="Sabores o variantes"
            texto="Son las opciones que el cliente elige al pedir este producto (p. ej. el relleno o sabor de una dona). El bot de WhatsApp las ofrece al pedir y los avisos de agotados también las usan. Toca «Disponible» o «Agotado» para cada una." />
        </h3>
        {p.sabores.length === 0 && <div className="eo-micro">Este producto no tiene sabores. Agrega uno abajo si el cliente elige entre varios.</div>}
        <div className="ep-sabores">
          {p.sabores.map((s, i) => {
            const activo = s.activo !== false;
            const sin = s.quedan === null || s.quedan === undefined;
            return (
              <div className="ep-sabor" key={s.id ?? `nuevo-${i}`}>
                <div className="ep-sabor-nombre">
                  <div className="ep-sabor-titulo">{s.nombre}</div>
                  {p.controlaStock && (
                    <div className={sin ? 'ep-sabor-estado ep-sin' : 'ep-sabor-estado'}>
                      {sin ? 'Sin apertura hoy' : `Quedan ${s.quedan}${s.aperturaHoy === false ? ' · sin apertura hoy' : ''}`}
                    </div>
                  )}
                </div>
                <button type="button" className={`eo-btn eo-mini ${activo ? 'lleno' : ''}`} aria-pressed={activo}
                  aria-label={`${s.nombre}: ${activo ? 'disponible, tocar para marcar agotado' : 'agotado, tocar para marcar disponible'}`}
                  onClick={() => p.setSabores(p.sabores.map((x, k) => (k === i ? { ...x, activo: !activo } : x)))}>
                  {activo ? 'Disponible' : 'Agotado'}
                </button>
              </div>
            );
          })}
        </div>
        <div className="ep-nuevo">
          <input className="eo-input" type="text" aria-label="Nuevo sabor" value={p.nuevoSabor}
            onChange={(e) => p.setNuevoSabor(e.target.value)} placeholder="Nuevo sabor (ej.: Pistacho, Nutella)" />
          <button type="button" className="eo-btn principal" onClick={() => {
            if (!p.nuevoSabor.trim()) return;
            p.setSabores([...p.sabores, { nombre: p.nuevoSabor.trim(), activo: true }]);
            p.setNuevoSabor('');
          }}>+ Agregar</button>
        </div>
        {p.controlaStock && hayVentas && (
          <div className="eo-micro">El stock de cada sabor se registra en «Apertura del día» (Almacén), no aquí.</div>
        )}
      </section>
    </>
  );

  const pestanas: PestanaModal[] = [
    { id: 'datos', etiqueta: 'Datos', contenido: <div className="ep-pagina">{datos}</div> },
    { id: 'stock', etiqueta: 'Stock y sabores', insignia: esCombo ? null : p.sabores.length || null, contenido: <div className="ep-pagina">{stock}</div> },
  ];

  return (
    <>
      <ModalConPestanas
        titulo={`Editar: ${p.producto.nombre}`}
        pestanas={pestanas}
        alCerrar={cerrar}
        bloquearCierre={p.guardando}
        ancho={640}
        pie={(
          <>
            {p.error && <div role="alert" className="eo-error ep-error">{p.error}</div>}
            {sucio && <span role="status" className="eo-pendiente">● Hay cambios sin guardar</span>}
            <button type="button" className="eo-btn" onClick={cerrar}>Cancelar</button>
            <button type="button" className="eo-btn principal" disabled={p.guardando} onClick={p.alGuardar}>Guardar</button>
          </>
        )}
      />
      <Confirmar abierto={confirmarSalir} titulo="¿Salir sin guardar?" mensaje="Hiciste cambios en este producto que aún no se guardaron."
        textoSi="Sí, salir" textoNo="No" peligro
        alConfirmar={() => { setConfirmarSalir(false); p.alCancelar(); }} alCancelar={() => setConfirmarSalir(false)} />
      <Confirmar abierto={confirmarOpciones} titulo="Hay cambios sin guardar" mensaje="Si abres «Tamaños y opciones» se descartan los cambios de este producto. Guarda primero si quieres conservarlos."
        textoSi="Descartar y abrir" textoNo="Volver" peligro
        alConfirmar={() => { setConfirmarOpciones(false); p.alAbrirOpciones(); }} alCancelar={() => setConfirmarOpciones(false)} />
    </>
  );
}
