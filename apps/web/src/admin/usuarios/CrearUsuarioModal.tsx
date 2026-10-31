import { useState } from 'react';
import { ROLES_SISTEMA } from '@caprichos/compartido';
import { api, ErrorApi } from '../../comun/api';
import { Boton } from '../../comun/Boton';
import { Campo } from '../../comun/Campo';
import { Combo } from '../../comun/Combo';
import { Confirmar } from '../../comun/Confirmar';
import { Icono } from '../../comun/Icono';
import type { UsuarioItem } from './tipos';
import { EditorHorario } from './EditorHorario';
import { EditorReemplazos } from './EditorReemplazos';
import {
  DIAS,
  formatoHoras,
  horarioVacio,
  horariosParaEnviar,
  reemplazosParaEnviar,
  totalHorasSemana,
  validarHorario,
  type HorarioEstado,
  type ReemplazosEstado,
} from './horario';

export interface CrearUsuarioModalProps {
  abierto: boolean;
  alCerrar: () => void;
  alUsuarioCreado: (usuario: UsuarioItem, claveInicial: string) => void;
}

export const ETIQUETAS_ROLES: Record<string, string> = {
  ADMIN: 'Administrador (Control total)',
  CAJERO: 'Cajero/a (Ventas y cobros)',
  MOZO: 'Mozo (Mesas y pedidos salón)',
  COCINA: 'Cocina (Comandas y preparación)',
  BARRA: 'Barra (Bebidas y postres)',
  REPARTIDOR: 'Repartidor (Delivery)',
  CALLCENTER: 'Call center (Atención y pedidos)',
  SUPERVISOR: 'Supervisor (Caja y salón, y ve el código de supervisor)',
};

const OPCIONES_ROLES = Object.values(ROLES_SISTEMA).map((rol) => ({
  valor: rol,
  etiqueta: ETIQUETAS_ROLES[rol] || rol,
}));

const PASOS = ['Datos personales', 'Puesto', 'Horario', 'Reemplazos'];
const RESUMEN = 4; // índice del resumen final

const CSS_MODAL = `
.cp-wiz-overlay{position:fixed;inset:0;z-index:90;background:rgba(11,44,62,.65);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:16px}
.cp-wiz-panel{width:100%;max-width:560px;max-height:calc(100vh - 32px);overflow-y:auto;overflow-x:hidden;box-sizing:border-box;background:var(--cp-white);border:1.5px solid var(--cp-line);border-radius:16px;padding:24px;box-shadow:0 16px 40px rgba(11,44,62,.25);display:flex;flex-direction:column;gap:16px}
@media (max-width:600px){.cp-wiz-overlay{padding:0}.cp-wiz-panel{max-width:none;height:100%;max-height:100%;border-radius:0;border:0;padding:16px}}
`;

const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Bloque({ titulo, onEditar, children }: { titulo: string; onEditar: () => void; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid var(--cp-line)', borderRadius: '12px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <strong>{titulo}</strong>
        <Boton type="button" variante="secundario" tamano="pequeno" onClick={onEditar} aria-label={`Editar ${titulo}`}>
          Editar
        </Boton>
      </div>
      <div style={{ fontSize: '13px', lineHeight: '19px', overflowWrap: 'anywhere' }}>{children}</div>
    </div>
  );
}

export function CrearUsuarioModal({
  abierto,
  alCerrar,
  alUsuarioCreado,
}: CrearUsuarioModalProps) {
  const [paso, setPaso] = useState(0);
  const [dni, setDni] = useState('');
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [celular, setCelular] = useState('');
  const [correo, setCorreo] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [rol, setRol] = useState<string>(ROLES_SISTEMA.CAJERO);
  const [descuento, setDescuento] = useState('');
  const [horario, setHorario] = useState<HorarioEstado>(horarioVacio);
  const [reemplazos, setReemplazos] = useState<ReemplazosEstado>({});
  const [nombresReemplazo, setNombresReemplazo] = useState<Record<string, string>>({});

  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [confirmarAbierto, setConfirmarAbierto] = useState(false);

  if (!abierto) return null;

  const limpiarError = (campo: string) => errores[campo] && setErrores((prev) => ({ ...prev, [campo]: '' }));

  function validarPaso(p: number): boolean {
    const e: Record<string, string> = {};
    if (p === 0) {
      const dniLimpio = dni.trim();
      if (!dniLimpio) e.dni = 'El DNI es obligatorio';
      else if (!/^\d{8}$/.test(dniLimpio)) e.dni = 'El DNI debe tener exactamente 8 dígitos numéricos';
      if (!nombres.trim()) e.nombres = 'Los nombres son requeridos';
      if (!apellidos.trim()) e.apellidos = 'Los apellidos son requeridos';
      if (celular && !/^9\d{8}$/.test(celular)) e.celular = 'El celular debe tener 9 dígitos y empezar en 9';
      if (correo.trim() && !REGEX_CORREO.test(correo.trim())) e.correo = 'El correo no es válido';
      if (fechaNacimiento && fechaNacimiento > new Date().toISOString().slice(0, 10)) {
        e.fechaNacimiento = 'La fecha de nacimiento no puede ser futura';
      }
    } else if (p === 1) {
      if (!rol) e.rol = 'Selecciona un rol para el usuario';
      if (descuento.trim() !== '') {
        const n = Number(descuento);
        if (Number.isNaN(n) || n < 0 || n > 100) e.descuento = 'El descuento debe estar entre 0 y 100';
      }
    } else if (p === 2) {
      const m = validarHorario(horario);
      if (m) e.horario = m;
    }
    setErrores(e);
    return Object.keys(e).length === 0;
  }

  function siguiente() {
    setErrorServidor(null);
    if (!validarPaso(paso)) return;
    setPaso(paso + 1);
  }

  function irAEditar(p: number) {
    setErrores({});
    setPaso(p);
  }

  function pedirConfirmacion(e: React.FormEvent) {
    e.preventDefault();
    if (paso !== RESUMEN) return siguiente();
    setErrorServidor(null);
    for (let p = 0; p < 3; p++) {
      if (!validarPaso(p)) return setPaso(p);
    }
    setConfirmarAbierto(true);
  }

  async function crear() {
    setConfirmarAbierto(false);
    setGuardando(true);
    try {
      const respuesta = await api.post<{
        id: string;
        partyId: string;
        nombres: string;
        apellidos: string;
        dni: string;
        rol: string;
        activo: boolean;
        debeCambiar: boolean;
        claveInicial: string;
      }>('/admin/usuarios', {
        dni: dni.trim(),
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
        rol,
        ...(celular ? { celular } : {}),
        ...(correo.trim() ? { correo: correo.trim() } : {}),
        ...(fechaNacimiento ? { fechaNacimiento } : {}),
        ...(descuento.trim() !== '' ? { descuentoPct: Number(descuento) } : {}),
        horarios: horariosParaEnviar(horario),
        reemplazos: reemplazosParaEnviar(reemplazos),
      });

      setDni('');
      setNombres('');
      setApellidos('');
      setCelular('');
      setCorreo('');
      setFechaNacimiento('');
      setDescuento('');
      setRol(ROLES_SISTEMA.CAJERO);
      setHorario(horarioVacio());
      setReemplazos({});
      setErrores({});
      setPaso(0);

      alUsuarioCreado(
        {
          id: respuesta.id,
          partyId: respuesta.partyId,
          nombres: respuesta.nombres,
          apellidos: respuesta.apellidos,
          dni: respuesta.dni,
          rol: respuesta.rol,
          activo: respuesta.activo,
          debeCambiar: respuesta.debeCambiar,
        },
        respuesta.claveInicial,
      );
    } catch (err) {
      if (err instanceof ErrorApi) {
        if (err.codigo === 'DNI_DUPLICADO') {
          setPaso(0);
          setErrorServidor('El DNI ingresado ya se encuentra registrado en el sistema.');
        } else {
          setErrorServidor(err.message || 'Error al crear el usuario.');
        }
      } else {
        setErrorServidor('Error de conexión al servidor.');
      }
    } finally {
      setGuardando(false);
    }
  }

  const enResumen = paso === RESUMEN;
  const etiquetaPaso = enResumen ? 'Resumen final' : `Paso ${paso + 1} de ${PASOS.length} · ${PASOS[paso]}`;
  const diasTrabaja = DIAS.filter((d) => horario[d.dia].trabaja);
  const descansos = DIAS.filter((d) => !horario[d.dia].trabaja);
  const hayReemplazos = reemplazosParaEnviar(reemplazos).length > 0;

  return (
    <div
      className="cp-wiz-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-crear-usuario-titulo"
      onClick={guardando ? undefined : alCerrar}
    >
      <style>{CSS_MODAL}</style>
      <div className="cp-wiz-panel" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2
            id="modal-crear-usuario-titulo"
            style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '20px', color: 'var(--cp-navy)', margin: 0 }}
          >
            Nuevo usuario
          </h2>
          <button
            type="button"
            onClick={alCerrar}
            disabled={guardando}
            aria-label="Cerrar modal"
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '22px',
              border: '1.5px solid var(--cp-line)',
              background: 'transparent',
              color: 'var(--cp-navy)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: guardando ? 'not-allowed' : 'pointer',
            }}
          >
            <Icono nombre="cerrar" tamano={18} />
          </button>
        </div>

        <div>
          <div role="status" aria-live="polite" style={{ fontWeight: 800, fontSize: '14px', color: 'var(--cp-navy)' }}>
            {etiquetaPaso}
          </div>
          <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }} aria-hidden="true">
            {[...PASOS, 'Resumen'].map((n, i) => (
              <div
                key={n}
                style={{ flex: 1, height: '6px', borderRadius: '3px', background: i <= paso ? 'var(--cp-navy)' : 'var(--cp-line)' }}
              />
            ))}
          </div>
        </div>

        {errorServidor && (
          <div
            role="alert"
            style={{ background: '#FBEDE9', border: '1.5px solid var(--cp-rust)', borderRadius: '12px', padding: '12px', fontSize: '13px', color: 'var(--cp-rust)', fontWeight: 600 }}
          >
            {errorServidor}
          </div>
        )}

        <form onSubmit={pedirConfirmacion} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }} noValidate>
          {paso === 0 && (
            <>
              <Campo
                id="crear-dni"
                etiqueta="DNI (8 dígitos)"
                type="text"
                inputMode="numeric"
                maxLength={8}
                placeholder="12345678"
                value={dni}
                onChange={(e) => {
                  setDni(e.target.value.replace(/\D/g, '').slice(0, 8));
                  limpiarError('dni');
                }}
                error={errores.dni}
                disabled={guardando}
              />
              <Campo
                id="crear-nombres"
                etiqueta="Nombres"
                type="text"
                placeholder="Ej: Ana María"
                value={nombres}
                onChange={(e) => {
                  setNombres(e.target.value);
                  limpiarError('nombres');
                }}
                error={errores.nombres}
                disabled={guardando}
              />
              <Campo
                id="crear-apellidos"
                etiqueta="Apellidos"
                type="text"
                placeholder="Ej: Pérez Quispe"
                value={apellidos}
                onChange={(e) => {
                  setApellidos(e.target.value);
                  limpiarError('apellidos');
                }}
                error={errores.apellidos}
                disabled={guardando}
              />
              <Campo
                id="crear-celular"
                etiqueta="Celular (opcional)"
                type="text"
                inputMode="numeric"
                maxLength={9}
                placeholder="987654321"
                value={celular}
                onChange={(e) => {
                  setCelular(e.target.value.replace(/\D/g, '').slice(0, 9));
                  limpiarError('celular');
                }}
                error={errores.celular}
                disabled={guardando}
              />
              <Campo
                id="crear-correo"
                etiqueta="Correo (opcional)"
                type="email"
                placeholder="nombre@correo.com"
                value={correo}
                onChange={(e) => {
                  setCorreo(e.target.value);
                  limpiarError('correo');
                }}
                error={errores.correo}
                disabled={guardando}
              />
              <Campo
                id="crear-nacimiento"
                etiqueta="Fecha de nacimiento (opcional)"
                type="date"
                value={fechaNacimiento}
                onChange={(e) => {
                  setFechaNacimiento(e.target.value);
                  limpiarError('fechaNacimiento');
                }}
                error={errores.fechaNacimiento}
                disabled={guardando}
              />
            </>
          )}

          {paso === 1 && (
            <>
              <Combo
                etiqueta="Rol o cargo en el sistema"
                opciones={OPCIONES_ROLES}
                valor={rol}
                alCambiar={(nuevoRol) => {
                  setRol(nuevoRol);
                  limpiarError('rol');
                }}
                error={errores.rol}
                deshabilitado={guardando}
              />
              <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                Cocina y Barra son las áreas de producción. Entra al sistema con su DNI; la clave inicial se genera al crear.
              </div>
              <Campo
                id="crear-descuento"
                etiqueta="Descuento de personal % (opcional)"
                type="text"
                inputMode="decimal"
                placeholder="Ej: 20"
                value={descuento}
                onChange={(e) => {
                  setDescuento(e.target.value.replace(/[^\d.]/g, ''));
                  limpiarError('descuento');
                }}
                error={errores.descuento}
                disabled={guardando}
              />
            </>
          )}

          {paso === 2 && (
            <>
              <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
                Activa los días que trabaja y su hora de entrada y salida. Puedes dejarlo vacío y completarlo después.
              </div>
              {errores.horario && (
                <div role="alert" style={{ color: 'var(--cp-rust)', fontSize: '13px', fontWeight: 700 }}>{errores.horario}</div>
              )}
              <EditorHorario valor={horario} alCambiar={setHorario} deshabilitado={guardando} />
            </>
          )}

          {paso === 3 && (
            <EditorReemplazos
              valor={reemplazos}
              alCambiar={setReemplazos}
              alCargarPersonal={(lista) =>
                setNombresReemplazo(Object.fromEntries(lista.map((p) => [p.partyId, `${p.nombres} ${p.apellidos}`.trim()])))
              }
              horario={horario}
              rol={rol}
              deshabilitado={guardando}
            />
          )}

          {enResumen && (
            <>
              <Bloque titulo="Datos personales" onEditar={() => irAEditar(0)}>
                {nombres.trim()} {apellidos.trim()} · DNI {dni.trim()}
                <br />
                Celular: {celular || 'No indicado'} · Correo: {correo.trim() || 'No indicado'}
                <br />
                Nacimiento: {fechaNacimiento || 'No indicado'}
              </Bloque>
              <Bloque titulo="Puesto" onEditar={() => irAEditar(1)}>
                {ETIQUETAS_ROLES[rol] || rol}
                <br />
                Descuento de personal: {descuento.trim() !== '' ? `${descuento}%` : 'No indicado'}
              </Bloque>
              <Bloque titulo="Horario" onEditar={() => irAEditar(2)}>
                {diasTrabaja.length === 0
                  ? 'Sin horario por ahora.'
                  : diasTrabaja.map((d) => (
                      <div key={d.dia}>
                        {d.nombre}: {horario[d.dia].entrada} a {horario[d.dia].salida}
                      </div>
                    ))}
                <strong>Total por semana: {formatoHoras(totalHorasSemana(horario))}</strong>
              </Bloque>
              <Bloque titulo="Reemplazos" onEditar={() => irAEditar(3)}>
                {hayReemplazos
                  ? DIAS.filter((d) => reemplazos[d.dia]).map((d) => (
                      <div key={d.dia}>
                        {d.nombre}: {nombresReemplazo[reemplazos[d.dia]] || `persona ${reemplazos[d.dia]}`}
                      </div>
                    ))
                  : `Sin reemplazos${descansos.length ? ' definidos' : ''}.`}
              </Bloque>
            </>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '8px', flexWrap: 'wrap' }}>
            {paso > 0 && (
              <Boton type="button" variante="secundario" tamano="grande" onClick={() => irAEditar(paso - 1)} disabled={guardando}>
                Atrás
              </Boton>
            )}
            {paso === 3 && (
              <Boton type="button" variante="secundario" tamano="grande" disabled={guardando} onClick={() => { setReemplazos({}); setPaso(RESUMEN); }}>
                Omitir
              </Boton>
            )}
            {enResumen ? (
              <Boton type="submit" variante="primario" tamano="grande" cargando={guardando} style={{ flex: 1 }}>
                Crear usuario
              </Boton>
            ) : (
              <Boton type="submit" variante="primario" tamano="grande" style={{ flex: 1 }} disabled={guardando}>
                Siguiente
              </Boton>
            )}
            <Boton type="button" variante="texto" tamano="grande" onClick={alCerrar} disabled={guardando}>
              Cancelar
            </Boton>
          </div>
        </form>
        <Confirmar
          abierto={confirmarAbierto}
          titulo="Crear usuario"
          mensaje={`¿Crear la cuenta de ${nombres.trim()} ${apellidos.trim()} con DNI ${dni.trim()}? Se generará una contraseña inicial que se mostrará una sola vez.`}
          textoSi="Sí, crear"
          textoNo="No"
          alConfirmar={crear}
          alCancelar={() => setConfirmarAbierto(false)}
        />
      </div>
    </div>
  );
}
