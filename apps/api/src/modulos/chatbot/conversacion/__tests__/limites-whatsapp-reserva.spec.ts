import {
  BOTONES_RESERVA_PERSONAS,
  BOTONES_RESERVA_FECHA,
  BOTONES_RESERVA_NOMBRE_CONFIRMAR,
  BOTONES_RESERVA_NOTA,
  BOTONES_RESERVA_CONFIRMAR_FINAL,
  BOTONES_RESERVA_CANCELAR_CONFIRMAR,
  BOTON_VOLVER_MENU_RESERVA,
  BOTON_HABLAR_PERSONA_RESERVA,
  BOTONES_RESERVA_ACCIONES_EXISTENTE,
  BOTON_LISTA_HORAS,
  TITULO_SECCION_HORAS,
  TEXTOS_RESERVA,
} from '../textos-reserva';
import { BotonAccion, FilaLista } from '../tipos-conversacion';

describe('Límites estrictos de WhatsApp Cloud API — Textos y Botones de Reserva', () => {
  const LIMITE_BOTON_TITULO = 20;
  const LIMITE_BOTON_LISTA = 20;
  const LIMITE_FILA_TITULO = 24;
  const LIMITE_FILA_DESCRIPCION = 72;
  const LIMITE_CUERPO_MENSAJE = 1024;
  const MAX_BOTONES_POR_MENSAJE = 3;
  const MAX_FILAS_POR_SECCION = 10;

  describe('Botones de respuesta rápida (título <= 20 caracteres, máx 3 por mensaje)', () => {
    const gruposBotones: { nombre: string; botones: BotonAccion[] }[] = [
      { nombre: 'BOTONES_RESERVA_PERSONAS', botones: BOTONES_RESERVA_PERSONAS },
      { nombre: 'BOTONES_RESERVA_FECHA', botones: BOTONES_RESERVA_FECHA },
      { nombre: 'BOTONES_RESERVA_NOMBRE_CONFIRMAR', botones: BOTONES_RESERVA_NOMBRE_CONFIRMAR },
      { nombre: 'BOTONES_RESERVA_NOTA', botones: BOTONES_RESERVA_NOTA },
      { nombre: 'BOTONES_RESERVA_CONFIRMAR_FINAL', botones: BOTONES_RESERVA_CONFIRMAR_FINAL },
      { nombre: 'BOTONES_RESERVA_CANCELAR_CONFIRMAR', botones: BOTONES_RESERVA_CANCELAR_CONFIRMAR },
      { nombre: 'BOTONES_RESERVA_ACCIONES_EXISTENTE', botones: BOTONES_RESERVA_ACCIONES_EXISTENTE },
    ];

    gruposBotones.forEach(({ nombre, botones }) => {
      it(`${nombre} no supera los 3 botones por mensaje`, () => {
        expect(botones.length).toBeLessThanOrEqual(MAX_BOTONES_POR_MENSAJE);
      });

      botones.forEach((btn) => {
        it(`${nombre} -> botón '${btn.id}' (${btn.titulo}) tiene <= 20 caracteres`, () => {
          expect(btn.titulo.length).toBeLessThanOrEqual(LIMITE_BOTON_TITULO);
          expect(btn.titulo.trim().length).toBeGreaterThan(0);
        });
      });
    });

    it('Botones individuales no superan 20 caracteres', () => {
      expect(BOTON_VOLVER_MENU_RESERVA.titulo.length).toBeLessThanOrEqual(LIMITE_BOTON_TITULO);
      expect(BOTON_HABLAR_PERSONA_RESERVA.titulo.length).toBeLessThanOrEqual(LIMITE_BOTON_TITULO);
    });
  });

  describe('Mensajes de lista interactiva (botón <= 20, título fila <= 24, desc fila <= 72, máx 10 filas)', () => {
    it('Botón de lista de horas tiene <= 20 caracteres', () => {
      expect(BOTON_LISTA_HORAS.length).toBeLessThanOrEqual(LIMITE_BOTON_LISTA);
    });

    it('Título de sección de lista tiene <= 24 caracteres', () => {
      expect(TITULO_SECCION_HORAS.length).toBeLessThanOrEqual(LIMITE_FILA_TITULO);
    });

    it('Ejemplo de filas de franjas horarias respeta límites', () => {
      const horas = ['15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30'];
      const filas: FilaLista[] = horas.map((h) => ({
        id: `res_h_${h.replace(':', '')}`,
        titulo: h,
        descripcion: 'Mesa para 4 personas',
      }));

      expect(filas.length).toBeLessThanOrEqual(MAX_FILAS_POR_SECCION);
      filas.forEach((f) => {
        expect(f.titulo.length).toBeLessThanOrEqual(LIMITE_FILA_TITULO);
        expect(f.descripcion!.length).toBeLessThanOrEqual(LIMITE_FILA_DESCRIPCION);
      });
    });
  });

  describe('Cuerpo de los mensajes generados (cuerpo <= 1024 caracteres)', () => {
    it('pedirPersonas no excede 1024 caracteres', () => {
      const txt = TEXTOS_RESERVA.pedirPersonas();
      expect(txt.length).toBeLessThanOrEqual(LIMITE_CUERPO_MENSAJE);
    });

    it('personasExcesivas no excede 1024 caracteres', () => {
      const txt = TEXTOS_RESERVA.personasExcesivas();
      expect(txt.length).toBeLessThanOrEqual(LIMITE_CUERPO_MENSAJE);
    });

    it('limiteSolicitudesExcedido no excede 1024 caracteres', () => {
      const txt = TEXTOS_RESERVA.limiteSolicitudesExcedido();
      expect(txt.length).toBeLessThanOrEqual(LIMITE_CUERPO_MENSAJE);
    });

    it('pedirFecha y pedirFechaOtra no exceden 1024 caracteres', () => {
      expect(TEXTOS_RESERVA.pedirFecha().length).toBeLessThanOrEqual(LIMITE_CUERPO_MENSAJE);
      expect(TEXTOS_RESERVA.pedirFechaOtra().length).toBeLessThanOrEqual(LIMITE_CUERPO_MENSAJE);
    });

    it('mensajes de fecha inválida o cerrada no exceden 1024 caracteres', () => {
      expect(TEXTOS_RESERVA.fechaPasada().length).toBeLessThanOrEqual(LIMITE_CUERPO_MENSAJE);
      expect(TEXTOS_RESERVA.fechaFormatoInvalido().length).toBeLessThanOrEqual(LIMITE_CUERPO_MENSAJE);
      expect(TEXTOS_RESERVA.localCerradoFecha('2026-12-25', 'Navidad').length).toBeLessThanOrEqual(LIMITE_CUERPO_MENSAJE);
      expect(TEXTOS_RESERVA.anticipacionExcedida(30).length).toBeLessThanOrEqual(LIMITE_CUERPO_MENSAJE);
    });

    it('pedirHoraPrompt y sinDisponibilidadFecha no exceden 1024 caracteres', () => {
      expect(TEXTOS_RESERVA.pedirHoraPrompt('14:00').length).toBeLessThanOrEqual(LIMITE_CUERPO_MENSAJE);
      expect(TEXTOS_RESERVA.sinDisponibilidadFecha(6, '2026-10-28').length).toBeLessThanOrEqual(LIMITE_CUERPO_MENSAJE);
      expect(TEXTOS_RESERVA.horaInvalida().length).toBeLessThanOrEqual(LIMITE_CUERPO_MENSAJE);
    });

    it('confirmarNombre, pedirNombre, pedirTelefono no exceden 1024 caracteres', () => {
      expect(TEXTOS_RESERVA.confirmarNombre('Juan Pérez').length).toBeLessThanOrEqual(LIMITE_CUERPO_MENSAJE);
      expect(TEXTOS_RESERVA.pedirNombre().length).toBeLessThanOrEqual(LIMITE_CUERPO_MENSAJE);
      expect(TEXTOS_RESERVA.pedirTelefono().length).toBeLessThanOrEqual(LIMITE_CUERPO_MENSAJE);
      expect(TEXTOS_RESERVA.telefonoInvalido().length).toBeLessThanOrEqual(LIMITE_CUERPO_MENSAJE);
    });

    it('preguntarNota y resumenSolicitud no exceden 1024 caracteres', () => {
      expect(TEXTOS_RESERVA.preguntarNota().length).toBeLessThanOrEqual(LIMITE_CUERPO_MENSAJE);
      const resumen = TEXTOS_RESERVA.resumenSolicitud({
        personas: 6,
        fechaTexto: 'Miércoles 28/10',
        hora: '19:30',
        nombre: 'María Elena Gonzales del Valle',
        telefono: '987654321',
        nota: 'Celebramos cumpleaños 🎂 y necesitamos una silla para bebé 👶.',
      });
      expect(resumen.length).toBeLessThanOrEqual(LIMITE_CUERPO_MENSAJE);
    });

    it('mensajes de éxito, confirmación y rechazo no exceden 1024 caracteres', () => {
      const exito = TEXTOS_RESERVA.solicitudEnviadaExito({
        personas: 4,
        fechaTexto: 'Hoy',
        hora: '20:00',
        toleranciaMin: 15,
      });
      expect(exito.length).toBeLessThanOrEqual(LIMITE_CUERPO_MENSAJE);

      const conf = TEXTOS_RESERVA.reservaConfirmadaCliente({
        personas: 4,
        fechaTexto: 'Hoy',
        hora: '20:00',
        toleranciaMin: 15,
      });
      expect(conf.length).toBeLessThanOrEqual(LIMITE_CUERPO_MENSAJE);

      const rech = TEXTOS_RESERVA.reservaRechazadaCliente({
        nombre: 'Carlos',
        fechaTexto: '2026-10-28',
        hora: '20:00',
        motivo: 'Salón completo para eventos privados',
        alternativas: '18:00, 21:30',
      });
      expect(rech.length).toBeLessThanOrEqual(LIMITE_CUERPO_MENSAJE);
    });

    it('mensajes de recordatorio y tolerancia vencida no exceden 1024 caracteres', () => {
      const rec = TEXTOS_RESERVA.recordatorioReservaCliente({
        nombre: 'Lucía',
        personas: 2,
        hora: '19:00',
        mesas: 'Mesa 3, Mesa 4',
        minutos: 30,
        toleranciaMin: 15,
      });
      expect(rec).toContain('en 30 min');
      expect(rec).toContain('Mesa 3, Mesa 4');
      expect(rec.length).toBeLessThanOrEqual(LIMITE_CUERPO_MENSAJE);

      const venc = TEXTOS_RESERVA.toleranciaVencidaCliente({
        nombre: 'Lucía',
        hora: '19:00',
      });
      expect(venc.length).toBeLessThanOrEqual(LIMITE_CUERPO_MENSAJE);
    });

    it('mensajes de cancelación y cambio no exceden 1024 caracteres', () => {
      const lista = TEXTOS_RESERVA.listarReservasFuturas([
        { id: '101', fecha: '2026-10-28', hora: '19:00', personas: 4 },
        { id: '102', fecha: '2026-10-30', hora: '20:30', personas: 2 },
      ]);
      expect(lista.length).toBeLessThanOrEqual(LIMITE_CUERPO_MENSAJE);

      expect(TEXTOS_RESERVA.sinReservasActivas().length).toBeLessThanOrEqual(LIMITE_CUERPO_MENSAJE);
      expect(TEXTOS_RESERVA.confirmarCancelar({ fecha: '2026-10-28', hora: '19:00', personas: 4 }).length).toBeLessThanOrEqual(LIMITE_CUERPO_MENSAJE);
      expect(TEXTOS_RESERVA.cancelacionExitosa().length).toBeLessThanOrEqual(LIMITE_CUERPO_MENSAJE);
      expect(TEXTOS_RESERVA.pedirDetalleCambio({ fecha: '2026-10-28', hora: '19:00' }).length).toBeLessThanOrEqual(LIMITE_CUERPO_MENSAJE);
      expect(TEXTOS_RESERVA.cambioRegistradoExito().length).toBeLessThanOrEqual(LIMITE_CUERPO_MENSAJE);
    });
  });
});
