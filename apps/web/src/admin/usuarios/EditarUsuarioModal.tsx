import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ErrorApi } from "../../comun/api";
import { Boton } from "../../comun/Boton";
import { Campo } from "../../comun/Campo";
import { Combo } from "../../comun/Combo";
import { ModalConPestanas } from "../../comun/ModalConPestanas";
import { Confirmar } from "../../comun/Confirmar";
import { useSesion } from "../../comun/sesion";
import type { UsuarioItem } from "./tipos";
import { SelectorOtrosRoles } from "./SelectorOtrosRoles";
import { SeccionPermisosExtra } from "./SeccionPermisosExtra";
import { SeccionCuentaCliente } from "./SeccionCuentaCliente";
import { HistorialLaboral } from "./HistorialLaboral";
import {
  ETIQUETAS_ROLES,
  ROLES_ASIGNABLES,
  TIPOS_DOCUMENTO,
  documentoValido,
  errorCombinacionRoles,
  mensajeDocumento,
} from "./roles";
import { EditorHorario } from "./EditorHorario";
import { SeccionSueldo } from "./SeccionSueldo";
import { PanelVinculo } from "../asistencia/VinculoVacaciones";
import { EditorReemplazos } from "./EditorReemplazos";
import {
  horarioDesdeServidor,
  horarioVacio,
  horariosParaEnviar,
  reemplazosDesdeServidor,
  reemplazosParaEnviar,
  validarHorario,
  type HorarioEstado,
  type ReemplazosEstado,
} from "./horario";
import { BloqueAlertasWhatsApp } from "./BloqueAlertasWhatsApp";
import { puedeRecibirAlertasWhatsApp } from "./alertasWhatsappApi";
import { limpiarNumeroPeruano, validarCelularPeruano } from "./alertasWhatsappApi";
import { AvisoVinculoCelular, usePreviaCelular } from "./AvisoVinculoCelular";
import {
  AUTOCOMPLETAR_CLAVE,
  AVISO_REINGRESO,
  FORMATO_CORREO_ADMIN,
} from "./claves";
import { CambiarClaveModal } from "./CambiarClaveModal";
import { FotoUsuarioAdmin } from "./FotoUsuarioAdmin";
import {
  SeccionAreasCocina,
  type AreaCocinaOpcion,
} from "./SeccionAreasCocina";
import { DarRolTemporalModal } from "./DarRolTemporalModal";
import { ActividadUsuario } from "./ActividadUsuario";
import {
  fechaLimaCorta,
  quitarRolExtra,
  type RolTemporal,
} from "./rolesTemporalesApi";
import { Insignia } from "../../comun/Insignia";

export interface EditarUsuarioModalProps {
  usuario: UsuarioItem | null;
  abierto: boolean;
  alCerrar: () => void;
  alUsuarioEditado: (usuario: UsuarioItem) => void;
  /** Se llama tras dar o quitar un rol extra: la lista se vuelve a leer sin cerrar el editor. */
  alCambiarRoles?: () => void;
}

const OPCIONES_ROLES = ROLES_ASIGNABLES.map((rol) => ({
  valor: rol,
  etiqueta: ETIQUETAS_ROLES[rol] || rol,
}));

type Seccion = "datos" | "roles" | "horario" | "reemplazos" | "historial";

const iguales = (a: string[], b: string[]): boolean =>
  a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");

/** Roles extra que se editan en el formulario: sin el principal y sin los temporales (esos se dan aparte). */
const permanentesDe = (u: UsuarioItem): string[] => {
  const temporales = (u.rolesTemporales ?? []).map((t) => t.rol);
  return (u.roles ?? []).filter((r) => r !== u.rol && !temporales.includes(r));
};

/** DD/MM con día y mes reales (febrero admite 29). */
export function cumpleanosValido(v: string): boolean {
  const m = v.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!m) return false;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  return mes >= 1 && mes <= 12 && dia >= 1 && dia <= [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1];
}

export function EditarUsuarioModal({
  usuario,
  abierto,
  alCerrar,
  alUsuarioEditado,
  alCambiarRoles,
}: EditarUsuarioModalProps) {
  const { usuario: yo, salir } = useSesion();
  const navigate = useNavigate();
  const esAdmin = yo?.rol === "ADMIN";

  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [rol, setRol] = useState("");
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorServidor, setErrorServidor] = useState<string | null>(null);

  // Solo ADMIN: documento nuevo (vacío = no cambia), correo y contraseña del administrador para el documento.
  const [dniNuevo, setDniNuevo] = useState("");
  const [tipoDocNuevo, setTipoDocNuevo] = useState("DNI");
  const [claveAdminDni, setClaveAdminDni] = useState("");
  const [otrosRoles, setOtrosRoles] = useState<string[]>([]);
  const [paisNacimiento, setPaisNacimiento] = useState("");
  const [cumpleanos, setCumpleanos] = useState("");
  const [correoNuevo, setCorreoNuevo] = useState("");
  const [quitarCorreo, setQuitarCorreo] = useState(false);
  const [celularNuevo, setCelularNuevo] = useState("");
  const celular9 = esAdmin && validarCelularPeruano(celularNuevo).valido ? limpiarNumeroPeruano(celularNuevo) : null;
  const previaCel = usePreviaCelular(`/admin/usuarios/${usuario?.id}/celular/previa`, celular9, { nombres: nombres.trim(), apellidos: apellidos.trim() });
  const [avisosCorreo, setAvisosCorreo] = useState(false);
  const [horario247, setHorario247] = useState(false);
  const [cambiarClaveAbierto, setCambiarClaveAbierto] = useState(false);
  // Áreas de cocina del usuario (solo se muestran si tiene rol Cocina). Se guardan con el PUT tras el PATCH.
  const [areasCocina, setAreasCocina] = useState<string[]>([]);
  const [areasOriginales, setAreasOriginales] = useState<string[]>([]);
  const [areasDisponibles, setAreasDisponibles] = useState<AreaCocinaOpcion[]>(
    [],
  );
  // Roles temporales: se muestran y se dan aparte, no entran a la lista de otros roles del editor
  const [temporales, setTemporales] = useState<RolTemporal[]>([]);
  const [darRolAbierto, setDarRolAbierto] = useState(false);
  const [quitarTemporal, setQuitarTemporal] = useState<RolTemporal | null>(
    null,
  );
  const [msgRoles, setMsgRoles] = useState("");
  const rolEsCocina =
    rol === "COCINA" ||
    otrosRoles.includes("COCINA") ||
    temporales.some((t) => t.rol === "COCINA");

  const [confirmarAbierto, setConfirmarAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [seccion, setSeccion] = useState<Seccion>("datos");
  const [ayudaAbierta, setAyudaAbierta] = useState(false);
  const [descartarAbierto, setDescartarAbierto] = useState(false);
  // Foto del horario tal como llegó del servidor o se guardó, para saber si hay cambios sin guardar
  const [horarioBase, setHorarioBase] = useState("");
  const [horario, setHorario] = useState<HorarioEstado>(horarioVacio);
  const [reemplazos, setReemplazos] = useState<ReemplazosEstado>({});
  const [confirmarHorario, setConfirmarHorario] = useState(false);
  const [msgHorario, setMsgHorario] = useState("");

  useEffect(() => {
    if (!usuario || !abierto) return;
    setSeccion("datos");
    setMsgHorario("");
    api
      .get<{ horarios: any[]; reemplazos: any[] }>(
        `/admin/usuarios/${usuario.id}/horario`,
      )
      .then((d) => {
        const h = horarioDesdeServidor(d.horarios || []);
        const re = reemplazosDesdeServidor(d.reemplazos || []);
        setHorario(h);
        setReemplazos(re);
        setHorarioBase(JSON.stringify([h, re]));
      })
      .catch(() =>
        setErrorServidor("No se pudo cargar el horario de la persona."),
      );
  }, [usuario, abierto]);

  async function guardarHorario() {
    if (!usuario) return;
    setGuardando(true);
    try {
      await api.put(`/admin/usuarios/${usuario.id}/horario`, {
        horarios: horariosParaEnviar(horario),
        reemplazos: reemplazosParaEnviar(reemplazos),
      });
      setMsgHorario("Horario y reemplazos guardados.");
      setHorarioBase(JSON.stringify([horario, reemplazos]));
    } catch (err) {
      setErrorServidor(
        err instanceof ErrorApi
          ? err.message || "No se pudo guardar el horario."
          : "Error de conexión al servidor.",
      );
    } finally {
      setConfirmarHorario(false);
      setGuardando(false);
    }
  }

  function pedirGuardarHorario() {
    setErrorServidor(null);
    setMsgHorario("");
    const m = validarHorario(horario);
    if (m) return setErrorServidor(m);
    setConfirmarHorario(true);
  }

  useEffect(() => {
    if (!usuario || !abierto) return;
    let vigente = true;
    api
      .get<{ areaIds?: string[]; disponibles?: AreaCocinaOpcion[] }>(
        `/admin/usuarios/${usuario.id}/areas`,
      )
      .then((r) => {
        if (!vigente) return;
        setAreasCocina(r.areaIds ?? []);
        setAreasOriginales(r.areaIds ?? []);
        setAreasDisponibles(r.disponibles ?? []);
      })
      .catch(() => {
        if (vigente) setAreasDisponibles([]);
      });
    return () => {
      vigente = false;
    };
  }, [usuario, abierto]);

  useEffect(() => {
    if (usuario) {
      setNombres(usuario.nombres);
      setApellidos(usuario.apellidos);
      setRol(usuario.rol);
      setAvisosCorreo(Boolean(usuario.avisosCorreo));
      setHorario247(Boolean(usuario.horario24_7));
      setOtrosRoles(permanentesDe(usuario));
      setTemporales(usuario.rolesTemporales ?? []);
      setMsgRoles("");
      setPaisNacimiento(usuario.paisNacimiento ?? "");
      setCumpleanos(usuario.cumpleanos ?? "");
      setErrores({});
      setErrorServidor(null);
      setDniNuevo("");
      setTipoDocNuevo(usuario.tipoDocumento ?? "DNI");
      setClaveAdminDni("");
      setCorreoNuevo("");
      setQuitarCorreo(false);
      setCelularNuevo("");
    }
  }, [usuario]);

  if (!abierto || !usuario) return null;

  const hayCambios =
    nombres.trim() !== usuario.nombres ||
    apellidos.trim() !== usuario.apellidos ||
    rol !== usuario.rol ||
    !iguales(otrosRoles, permanentesDe(usuario)) ||
    !iguales(areasCocina, areasOriginales) ||
    paisNacimiento.trim() !== (usuario.paisNacimiento ?? "") ||
    cumpleanos.trim() !== (usuario.cumpleanos ?? "") ||
    avisosCorreo !== Boolean(usuario.avisosCorreo) ||
    horario247 !== Boolean(usuario.horario24_7) ||
    dniNuevo.trim() !== "" ||
    correoNuevo.trim() !== "" ||
    celularNuevo.trim() !== "" ||
    quitarCorreo ||
    (horarioBase !== "" &&
      JSON.stringify([horario, reemplazos]) !== horarioBase);

  /** Con cambios sin guardar pregunta Sí/No antes de cerrar. */
  function pedirCerrar() {
    if (guardando) return;
    if (hayCambios) setDescartarAbierto(true);
    else alCerrar();
  }

  function validar(): Record<string, string> {
    const nuevosErrores: Record<string, string> = {};

    if (!nombres.trim()) {
      nuevosErrores.nombres = "Los nombres son requeridos";
    }

    if (!apellidos.trim()) {
      nuevosErrores.apellidos = "Los apellidos son requeridos";
    }

    if (!rol) {
      nuevosErrores.rol = "El rol es requerido";
    }
    const combinacion = errorCombinacionRoles(rol, otrosRoles);
    if (combinacion) nuevosErrores.otrosRoles = combinacion;

    if (esAdmin) {
      if (cumpleanos.trim() && !cumpleanosValido(cumpleanos.trim())) {
        nuevosErrores.cumpleanos = "Escribe día y mes reales, por ejemplo 14/03";
      }
      if (dniNuevo.trim() && !documentoValido(tipoDocNuevo, dniNuevo.trim())) {
        nuevosErrores.dni = mensajeDocumento(tipoDocNuevo);
      } else if (dniNuevo.trim() && !claveAdminDni) {
        nuevosErrores.claveAdmin =
          "Escribe tu contraseña de administrador para cambiar el DNI";
      }
      if (celularNuevo.trim() && !validarCelularPeruano(celularNuevo).valido) {
        nuevosErrores.celular = "Debe ser un celular de 9 dígitos que empiece con 9";
      } else if (previaCel.falta) {
        nuevosErrores.celular = previaCel.previa?.estado === 'CREARA_CUENTA' ? 'Responde Sí o No a la pregunta del celular antes de continuar' : "Confirma que la cuenta de cliente es de esta persona (Sí o No) antes de guardar";
      }
      if (
        !quitarCorreo &&
        correoNuevo.trim() &&
        !FORMATO_CORREO_ADMIN.test(correoNuevo.trim())
      ) {
        nuevosErrores.correo = "El correo no tiene un formato válido";
      }
    }

    setErrores(nuevosErrores);
    return nuevosErrores;
  }

  function handleSolicitarGuardar(e: { preventDefault: () => void }) {
    e.preventDefault();
    setErrorServidor(null);
    const malos = validar();
    if (Object.keys(malos).length > 0) {
      // Lleva a la pestaña donde está el primer problema
      setSeccion(
        ["nombres", "apellidos", "dni", "claveAdmin", "correo", "cumpleanos", "celular"].some(
          (k) => malos[k],
        )
          ? "datos"
          : "roles",
      );
      return;
    }
    setConfirmarAbierto(true);
  }

  /** El servidor pide volver a entrar (se cambió el DNI o la clave propia): cierra la sesión y avisa. */
  async function volverAIngresar() {
    await salir();
    navigate("/admin/ingresar", {
      replace: true,
      state: { aviso: AVISO_REINGRESO },
    });
  }

  async function handleConfirmarGuardar() {
    if (!usuario) return;
    setGuardando(true);
    try {
      const cuerpo: Record<string, unknown> = {
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
        rol,
      };
      if (esAdmin) {
        if (dniNuevo.trim()) {
          cuerpo.tipoDocumento = tipoDocNuevo;
          cuerpo.documento = dniNuevo.trim();
          cuerpo.claveAdmin = claveAdminDni;
        }
        if (celularNuevo.trim()) {
          cuerpo.celular = celularNuevo.trim();
          if (previaCel.confirmado) cuerpo.confirmaMismaPersona = true;
        }
        if (quitarCorreo) cuerpo.correo = "";
        else if (correoNuevo.trim()) cuerpo.correo = correoNuevo.trim();
        if (!iguales(otrosRoles, permanentesDe(usuario))) {
          cuerpo.otrosRoles = otrosRoles;
        }
        if (paisNacimiento.trim() !== (usuario.paisNacimiento ?? ""))
          cuerpo.paisNacimiento = paisNacimiento.trim();
        if (cumpleanos.trim() !== (usuario.cumpleanos ?? ""))
          cuerpo.cumpleanos = cumpleanos.trim();
        if (avisosCorreo !== Boolean(usuario.avisosCorreo))
          cuerpo.avisosCorreo = avisosCorreo;
        if (horario247 !== Boolean(usuario.horario24_7))
          cuerpo.horario24_7 = horario247;
      }

      const resp = await api.patch<UsuarioItem & { reingresar?: boolean }>(
        `/admin/usuarios/${usuario.id}`,
        cuerpo,
      );

      // Áreas de cocina: solo si cambiaron y el usuario tiene rol Cocina (la regla vive en el servidor)
      if (esAdmin && rolEsCocina && !iguales(areasCocina, areasOriginales)) {
        await api.put(`/admin/usuarios/${usuario.id}/areas`, {
          areaIds: areasCocina,
        });
      }

      setConfirmarAbierto(false);
      if (resp.reingresar) {
        await volverAIngresar();
        return;
      }
      alUsuarioEditado(resp);
    } catch (err) {
      setConfirmarAbierto(false);
      if (err instanceof ErrorApi) {
        if (err.codigo === "ULTIMO_ADMIN") {
          setErrorServidor(
            "No se puede quitar el rol al último administrador activo del sistema.",
          );
        } else {
          setErrorServidor(err.message || "Error al actualizar el usuario.");
        }
      } else {
        setErrorServidor("Error de conexión al servidor.");
      }
    } finally {
      setGuardando(false);
    }
  }

  const formularioDatos = (
    <form
      onSubmit={handleSolicitarGuardar}
      style={{ display: "flex", flexDirection: "column", gap: "14px" }}
    >
      <Campo
        id="editar-dni"
        etiqueta={
          !usuario.tipoDocumento || usuario.tipoDocumento === "DNI"
            ? "DNI actual (Documento de identidad)"
            : "Documento actual"
        }
        type="text"
        value={usuario.dni}
        disabled={true}
        ayuda={
          esAdmin
            ? undefined
            : "El documento está asociado a la persona y no es editable."
        }
      />
      {esAdmin && (
        <>
          <Combo
            etiqueta="Tipo de documento"
            opciones={TIPOS_DOCUMENTO}
            valor={tipoDocNuevo}
            alCambiar={(nuevo) => {
              setTipoDocNuevo(nuevo);
              setDniNuevo("");
              if (errores.dni) setErrores((prev) => ({ ...prev, dni: "" }));
            }}
            deshabilitado={guardando}
          />
          <Campo
            id="editar-dni-nuevo"
            etiqueta={
              tipoDocNuevo === "DNI"
                ? "Nuevo DNI (deja vacío para no cambiarlo)"
                : "Nuevo número de documento (deja vacío para no cambiarlo)"
            }
            type="text"
            inputMode={tipoDocNuevo === "DNI" ? "numeric" : "text"}
            maxLength={tipoDocNuevo === "DNI" ? 8 : 12}
            value={dniNuevo}
            onChange={(e) => {
              const limpio =
                tipoDocNuevo === "DNI"
                  ? e.target.value.replace(/\D/g, "")
                  : e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
              setDniNuevo(limpio);
              if (errores.dni) setErrores((prev) => ({ ...prev, dni: "" }));
            }}
            error={errores.dni}
            ayuda={
              tipoDocNuevo === "DNI"
                ? "Es el usuario con el que la persona entra. Debe tener 8 dígitos."
                : "Es el usuario con el que la persona entra. De 7 a 12 letras o números."
            }
            disabled={guardando}
          />
        </>
      )}
      {esAdmin && dniNuevo.trim() && (
        <Campo
          id="editar-clave-admin-dni"
          etiqueta="Tu contraseña de administrador"
          type="password"
          permiteAlternarClave
          autoComplete={AUTOCOMPLETAR_CLAVE.actual}
          value={claveAdminDni}
          onChange={(e) => {
            setClaveAdminDni(e.target.value);
            if (errores.claveAdmin)
              setErrores((prev) => ({ ...prev, claveAdmin: "" }));
          }}
          error={errores.claveAdmin}
          disabled={guardando}
        />
      )}
      <Campo
        id="editar-nombres"
        etiqueta="Nombres"
        type="text"
        value={nombres}
        onChange={(e) => {
          setNombres(e.target.value);
          if (errores.nombres) setErrores((prev) => ({ ...prev, nombres: "" }));
        }}
        error={errores.nombres}
        disabled={guardando}
      />

      <Campo
        id="editar-apellidos"
        etiqueta="Apellidos"
        type="text"
        value={apellidos}
        onChange={(e) => {
          setApellidos(e.target.value);
          if (errores.apellidos)
            setErrores((prev) => ({ ...prev, apellidos: "" }));
        }}
        error={errores.apellidos}
        disabled={guardando}
      />
      {esAdmin && (
        <>
          <Campo
            id="editar-pais"
            etiqueta="País de nacimiento (opcional)"
            type="text"
            value={paisNacimiento}
            onChange={(e) => setPaisNacimiento(e.target.value)}
            disabled={guardando}
          />
          <Campo
            id="editar-cumpleanos"
            etiqueta="Cumpleaños, día/mes (opcional)"
            type="text"
            placeholder="14/03"
            maxLength={5}
            value={cumpleanos}
            onChange={(e) => {
              setCumpleanos(e.target.value);
              if (errores.cumpleanos) setErrores((prev) => ({ ...prev, cumpleanos: "" }));
            }}
            error={errores.cumpleanos}
            ayuda="Solo la ven Administración y Supervisión; se usa para el aviso de cumpleaños"
            disabled={guardando}
          />
        </>
      )}
      {esAdmin && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <Campo
            id="editar-celular"
            etiqueta="Celular (deja vacío para no cambiarlo)"
            type="tel"
            inputMode="numeric"
            autoComplete="off"
            value={celularNuevo}
            onChange={(e) => {
              setCelularNuevo(e.target.value);
              if (errores.celular)
                setErrores((prev) => ({ ...prev, celular: "" }));
            }}
            error={errores.celular}
            ayuda={
              usuario.activo && usuario.sinCelular
                ? "Sin celular: no tendrá descuento de personal en la carta"
                : "Con este celular recibe el descuento de personal en la carta; si ya tiene cuenta en la carta se vincula sola"
            }
            disabled={guardando}
          />
          <AvisoVinculoCelular previa={previaCel.previa} confirmado={previaCel.confirmado} alConfirmar={previaCel.confirmar} alRechazar={() => setCelularNuevo("")} />
          <Campo
            id="editar-correo"
            etiqueta="Correo (deja vacío para no cambiarlo)"
            type="email"
            autoComplete="off"
            value={correoNuevo}
            onChange={(e) => {
              setCorreoNuevo(e.target.value);
              setQuitarCorreo(false);
              if (errores.correo)
                setErrores((prev) => ({ ...prev, correo: "" }));
            }}
            error={errores.correo}
            disabled={guardando || quitarCorreo}
          />
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              minHeight: "44px",
              fontSize: "14px",
              color: "var(--cp-navy)",
            }}
          >
            <input
              type="checkbox"
              checked={quitarCorreo}
              onChange={(e) => {
                setQuitarCorreo(e.target.checked);
                if (e.target.checked) setCorreoNuevo("");
              }}
              disabled={guardando}
            />
            Quitar el correo actual
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              minHeight: "44px",
              fontSize: "14px",
              color: "var(--cp-navy)",
            }}
          >
            <input
              type="checkbox"
              checked={avisosCorreo}
              onChange={(e) => setAvisosCorreo(e.target.checked)}
              disabled={guardando}
            />
            Recibe los avisos del sistema por correo (necesita correo)
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              minHeight: "44px",
              fontSize: "14px",
              color: "var(--cp-navy)",
            }}
          >
            <input
              type="checkbox"
              checked={horario247}
              onChange={(e) => setHorario247(e.target.checked)}
              disabled={guardando}
            />
            Disponible 24/7 (recibe avisos fuera de su horario si nadie está de
            turno)
          </label>
        </div>
      )}
      <SeccionCuentaCliente usuarioId={usuario.id} puedeEditar={esAdmin} />
      {esAdmin && (
        <>
          <FotoUsuarioAdmin usuario={usuario} deshabilitado={guardando} />
          <div>
            <Boton
              type="button"
              variante="secundario"
              onClick={() => setCambiarClaveAbierto(true)}
              disabled={guardando}
            >
              Cambiar contraseña
            </Boton>
          </div>
        </>
      )}
    </form>
  );

  const formularioRoles = (
    <form
      onSubmit={handleSolicitarGuardar}
      style={{ display: "flex", flexDirection: "column", gap: "14px" }}
    >
      <Combo
        etiqueta="Rol principal"
        opciones={OPCIONES_ROLES}
        valor={rol}
        alCambiar={(nuevoRol) => {
          setRol(nuevoRol);
          setOtrosRoles((previos) => previos.filter((r) => r !== nuevoRol));
          if (errores.rol) setErrores((prev) => ({ ...prev, rol: "" }));
        }}
        error={errores.rol}
        deshabilitado={guardando || !esAdmin}
      />
      {esAdmin && (
        <section
          aria-label="Roles temporales"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            borderTop: "1px solid var(--cp-line)",
            paddingTop: "12px",
          }}
        >
          <strong style={{ color: "var(--cp-navy)" }}>Roles temporales</strong>
          <div style={{ fontSize: "12px", color: "var(--cp-soft)" }}>
            Un rol extra con fecha de fin (por ejemplo, supervisor suplente). Al
            vencer deja de valer solo.
          </div>
          {temporales.length === 0 && (
            <div style={{ fontSize: "13px", color: "var(--cp-soft)" }}>
              Ninguno.
            </div>
          )}
          {temporales.map((t) => (
            <div
              key={t.rol}
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                alignItems: "center",
                fontSize: "13px",
                color: "var(--cp-navy)",
              }}
            >
              <Insignia variante="aviso">
                Temporal ·{" "}
                {t.venceEn
                  ? `hasta ${fechaLimaCorta(t.venceEn)}`
                  : "sin fecha de fin"}
              </Insignia>
              <span>{t.nombre}</span>
              {t.motivo && (
                <span style={{ color: "var(--cp-soft)" }}>({t.motivo})</span>
              )}
              <button
                type="button"
                onClick={() => setQuitarTemporal(t)}
                disabled={guardando}
                style={{
                  border: 0,
                  background: "none",
                  color: "var(--cp-rust)",
                  fontWeight: 700,
                  cursor: "pointer",
                  minHeight: "32px",
                }}
              >
                Quitar
              </button>
            </div>
          ))}
          <div>
            <Boton
              variante="secundario"
              type="button"
              onClick={() => setDarRolAbierto(true)}
              deshabilitado={guardando}
            >
              Dar rol temporal
            </Boton>
          </div>
          {msgRoles && (
            <div
              role="status"
              style={{
                fontSize: "13px",
                color: "var(--cp-navy)",
                fontWeight: 700,
              }}
            >
              {msgRoles}
            </div>
          )}
        </section>
      )}
      <SelectorOtrosRoles
        principal={rol}
        valor={otrosRoles}
        alCambiar={(nuevos) => {
          setOtrosRoles(nuevos);
          if (errores.otrosRoles)
            setErrores((prev) => ({ ...prev, otrosRoles: "" }));
        }}
        error={errores.otrosRoles}
        deshabilitado={guardando || !esAdmin}
        motivoDeshabilitado={!esAdmin ? "Solo un administrador puede cambiar roles" : undefined}
      />
      {usuario && (
        <SeccionPermisosExtra usuarioId={usuario.id} puedeEditar={esAdmin} />
      )}
      {rolEsCocina && areasDisponibles.length > 0 && (
        <SeccionAreasCocina
          disponibles={areasDisponibles}
          valor={areasCocina}
          alCambiar={setAreasCocina}
          deshabilitado={guardando || !esAdmin}
        />
      )}
      {puedeRecibirAlertasWhatsApp(rol) && (
        <BloqueAlertasWhatsApp
          usuarioId={usuario.id}
          rol={rol}
          deshabilitado={guardando}
        />
      )}
    </form>
  );

  const panelHorario = (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <EditorHorario
        valor={horario}
        alCambiar={setHorario}
        deshabilitado={guardando}
      />
      {esAdmin && (rol || usuario.rol) !== "ADMIN" && (
        <>
          <SeccionSueldo partyId={usuario.partyId} deshabilitado={guardando} />
          <PanelVinculo partyId={Number(usuario.partyId)} deshabilitado={guardando} />
        </>
      )}
      {msgHorario && (
        <div
          role="status"
          style={{
            color: "var(--cp-green)",
            fontWeight: 700,
            fontSize: "13px",
          }}
        >
          {msgHorario}
        </div>
      )}
    </div>
  );

  const panelReemplazos = (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <EditorReemplazos
        valor={reemplazos}
        alCambiar={setReemplazos}
        horario={horario}
        rol={rol || usuario.rol}
        partyIdPropio={usuario.partyId}
        deshabilitado={guardando}
      />
      {msgHorario && (
        <div
          role="status"
          style={{
            color: "var(--cp-green)",
            fontWeight: 700,
            fontSize: "13px",
          }}
        >
          {msgHorario}
        </div>
      )}
    </div>
  );

  const panelHistorial = (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <HistorialLaboral
        usuarioId={usuario.id}
        esAdmin={esAdmin}
        deshabilitado={guardando}
      />
      {esAdmin && (
        <ActividadUsuario
          key={usuario.id}
          usuarioId={usuario.id}
          deshabilitado={guardando}
        />
      )}
    </div>
  );

  const enHorario = seccion === "horario" || seccion === "reemplazos";
  const errDatos = ["nombres", "apellidos", "dni", "claveAdmin", "correo"].some(
    (k) => errores[k],
  );
  const errRoles = ["rol", "otrosRoles"].some((k) => errores[k]);

  const pie = enHorario ? (
    <>
      <Boton
        type="button"
        variante="secundario"
        tamano="grande"
        onClick={pedirCerrar}
        disabled={guardando}
      >
        Cerrar
      </Boton>
      <Boton
        type="button"
        variante="primario"
        tamano="grande"
        disabled={guardando}
        onClick={pedirGuardarHorario}
      >
        Guardar horario y reemplazos
      </Boton>
    </>
  ) : (
    <>
      <Boton
        type="button"
        variante="secundario"
        tamano="grande"
        onClick={pedirCerrar}
        disabled={guardando}
      >
        Cancelar
      </Boton>
      <Boton
        type="button"
        variante="primario"
        tamano="grande"
        disabled={guardando}
        onClick={handleSolicitarGuardar}
      >
        Guardar cambios
      </Boton>
    </>
  );

  return (
    <>
      <ModalConPestanas
        titulo="Editar usuario"
        subtitulo={`${usuario.nombres} ${usuario.apellidos}`}
        ancho={640}
        alCerrar={pedirCerrar}
        bloquearCierre={guardando}
        pestanaActiva={seccion}
        alCambiarPestana={(id) => setSeccion(id as Seccion)}
        accionesEncabezado={
          <button
            type="button"
            aria-label="Ayuda de este editor"
            aria-expanded={ayudaAbierta}
            onClick={() => setAyudaAbierta((v) => !v)}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              border: "1.5px solid var(--cp-line)",
              background: "transparent",
              color: "var(--cp-navy)",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            ?
          </button>
        }
        bajoPestanas={
          (ayudaAbierta || errorServidor) && (
            <div
              style={{
                padding: "8px 16px 0",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              {ayudaAbierta && (
                <div
                  style={{
                    fontSize: "13px",
                    color: "var(--cp-soft)",
                    background: "var(--cp-sand, #EDE1D1)",
                    borderRadius: 12,
                    padding: 10,
                  }}
                >
                  Datos y Roles se guardan juntos con «Guardar cambios». Horario
                  y Reemplazos se guardan aparte con su propio botón. Los roles
                  temporales se dan y se quitan al momento, sin esperar al
                  guardado.
                </div>
              )}
              {errorServidor && (
                <div
                  role="alert"
                  style={{
                    background: "#FBEDE9",
                    border: "1.5px solid var(--cp-rust)",
                    borderRadius: "12px",
                    padding: "12px",
                    fontSize: "13px",
                    color: "var(--cp-rust)",
                    fontWeight: 600,
                  }}
                >
                  {errorServidor}
                </div>
              )}
            </div>
          )
        }
        pestanas={[
          {
            id: "datos",
            etiqueta: "Datos",
            insignia: errDatos ? "!" : null,
            insigniaError: errDatos,
            contenido: formularioDatos,
          },
          {
            id: "roles",
            etiqueta: "Roles",
            insignia: errRoles ? "!" : null,
            insigniaError: errRoles,
            contenido: formularioRoles,
          },
          { id: "horario", etiqueta: "Horario", contenido: panelHorario },
          {
            id: "reemplazos",
            etiqueta: "Reemplazos",
            contenido: panelReemplazos,
          },
          { id: "historial", etiqueta: "Historial", contenido: panelHistorial },
        ]}
        pie={pie}
      />

      {esAdmin && (
        <CambiarClaveModal
          usuario={usuario}
          abierto={cambiarClaveAbierto}
          alCerrar={() => setCambiarClaveAbierto(false)}
          alReingresar={volverAIngresar}
        />
      )}

      <Confirmar
        abierto={descartarAbierto}
        titulo="¿Cerrar sin guardar?"
        mensaje="Hay cambios sin guardar. Si cierras ahora se pierden."
        textoSi="Sí, cerrar"
        textoNo="No, seguir editando"
        peligro
        alConfirmar={() => {
          setDescartarAbierto(false);
          alCerrar();
        }}
        alCancelar={() => setDescartarAbierto(false)}
      />

      <Confirmar
        abierto={confirmarHorario}
        titulo="¿Guardar horario?"
        mensaje={`¿Guardar el horario y los reemplazos de ${usuario.nombres} ${usuario.apellidos}?`}
        textoSi="Sí, guardar"
        textoNo="No"
        cargando={guardando}
        alConfirmar={guardarHorario}
        alCancelar={() => setConfirmarHorario(false)}
      />

      <DarRolTemporalModal
        usuarioId={usuario.id}
        rolesActuales={[
          usuario.rol,
          ...(usuario.roles ?? []),
          ...temporales.map((t) => t.rol),
        ]}
        abierto={darRolAbierto}
        alCerrar={() => setDarRolAbierto(false)}
        alDarRol={(dado, mensaje) => {
          setDarRolAbierto(false);
          setMsgRoles(mensaje);
          // Se refleja aquí sin cerrar el editor: temporal con fecha, o extra permanente en el formulario
          if (dado.venceEn) {
            setTemporales((prev) => [
              ...prev.filter((t) => t.rol !== dado.rol),
              {
                rol: dado.rol,
                nombre: ETIQUETAS_ROLES[dado.rol] || dado.rol,
                venceEn: dado.venceEn,
                motivo: dado.motivo,
              },
            ]);
          } else {
            setOtrosRoles((prev) => [
              ...prev.filter((r) => r !== dado.rol),
              dado.rol,
            ]);
          }
          alCambiarRoles?.();
        }}
      />

      <Confirmar
        abierto={quitarTemporal !== null}
        titulo="¿Quitar este rol?"
        mensaje={
          quitarTemporal
            ? `Quitarle a ${usuario.nombres} ${usuario.apellidos} el rol ${quitarTemporal.nombre}. Queda en el historial.`
            : ""
        }
        textoSi="Sí, quitar"
        textoNo="No"
        peligro
        alConfirmar={async () => {
          if (!quitarTemporal) return;
          try {
            await quitarRolExtra(usuario.id, quitarTemporal.rol);
            setTemporales((prev) =>
              prev.filter((t) => t.rol !== quitarTemporal.rol),
            );
            setMsgRoles(`Rol ${quitarTemporal.nombre} quitado.`);
            alCambiarRoles?.();
          } catch (err) {
            setErrorServidor(
              err instanceof ErrorApi
                ? err.message
                : "No se pudo quitar el rol.",
            );
          } finally {
            setQuitarTemporal(null);
          }
        }}
        alCancelar={() => setQuitarTemporal(null)}
      />

      <Confirmar
        abierto={confirmarAbierto}
        titulo="¿Guardar cambios?"
        mensaje={
          esAdmin && dniNuevo.trim()
            ? `¿Cambiar el DNI de ${usuario.nombres} ${usuario.apellidos}? Si es tu propia cuenta, se cerrará tu sesión.`
            : `¿Estás seguro de modificar los datos de ${usuario.nombres} ${usuario.apellidos}?`
        }
        textoSi="Sí, guardar"
        textoNo="No, cancelar"
        cargando={guardando}
        alConfirmar={handleConfirmarGuardar}
        alCancelar={() => setConfirmarAbierto(false)}
      />
    </>
  );
}
