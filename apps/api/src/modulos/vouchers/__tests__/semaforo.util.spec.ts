import {
  calcularSemaforo,
  titularesCoinciden,
  compararUltimos9Digitos,
  normalizarFecha,
  DatosVoucherExtraidos,
  ContextoSemaforo,
} from '../semaforo.util';

describe('SemaforoVoucher - semaforo.util', () => {
  const voucherBase: DatosVoucherExtraidos = {
    legible: true,
    monto: 35.5,
    moneda: 'PEN',
    operacion: '12345678',
    fecha: '2026-10-27',
    hora: '14:30',
    titular: 'Maria Jose M.',
    destinoNumero: '977503006',
    medioDetectado: 'YAPE',
    confianza: 0.95,
  };

  const contextoBase: ContextoSemaforo = {
    pedidoTotal: 35.5,
    medioEsperado: 'YAPE',
    titularEsperado: 'Maria Jose Morillo Ruiz',
    yapeNumeroEsperado: '977503006',
    plinNumeroEsperado: '977503006',
    fechaActual: '2026-10-27',
    operacionDuplicada: false,
    hashDuplicado: false,
  };

  describe('SIN_LECTURA', () => {
    it('retorna SIN_LECTURA si sinLectura es true', () => {
      const res = calcularSemaforo(voucherBase, { ...contextoBase, sinLectura: true });
      expect(res.semaforo).toBe('SIN_LECTURA');
      expect(res.motivos[0]).toMatch(/no disponible o apagada/i);
    });

    it('retorna SIN_LECTURA si extraido es null', () => {
      const res = calcularSemaforo(null, contextoBase);
      expect(res.semaforo).toBe('SIN_LECTURA');
    });
  });

  describe('ILEGIBLE', () => {
    it('retorna ILEGIBLE si legible es false', () => {
      const res = calcularSemaforo({ ...voucherBase, legible: false }, contextoBase);
      expect(res.semaforo).toBe('ILEGIBLE');
      expect(res.motivos).toContain('Voucher no legible');
    });

    it('retorna ILEGIBLE si la confianza es menor a 0.5', () => {
      const res = calcularSemaforo({ ...voucherBase, confianza: 0.45 }, contextoBase);
      expect(res.semaforo).toBe('ILEGIBLE');
      expect(res.motivos.some((m) => m.includes('Baja confianza'))).toBe(true);
    });

    it('retorna ILEGIBLE si no se detectó monto', () => {
      const res = calcularSemaforo({ ...voucherBase, monto: null }, contextoBase);
      expect(res.semaforo).toBe('ILEGIBLE');
      expect(res.motivos.some((m) => m.includes('monto'))).toBe(true);
    });
  });

  describe('RARO', () => {
    it('retorna RARO si medioDetectado es OTRO', () => {
      const res = calcularSemaforo({ ...voucherBase, medioDetectado: 'OTRO' }, contextoBase);
      expect(res.semaforo).toBe('RARO');
      expect(res.motivos.some((m) => m.includes('No parece ser un comprobante de Yape ni Plin'))).toBe(true);
    });

    it('retorna RARO si medioDetectado es null con legible=true', () => {
      const res = calcularSemaforo({ ...voucherBase, medioDetectado: null }, contextoBase);
      expect(res.semaforo).toBe('RARO');
      expect(res.motivos.some((m) => m.includes('No parece ser un comprobante de Yape ni Plin'))).toBe(true);
    });

    it('retorna RARO si el hash de imagen ya fue registrado en otro pedido', () => {
      const res = calcularSemaforo(voucherBase, { ...contextoBase, hashDuplicado: true });
      expect(res.semaforo).toBe('RARO');
      expect(res.motivos.some((m) => m.includes('misma imagen'))).toBe(true);
    });

    it('retorna RARO si la operacion ya fue registrada en otro pedido', () => {
      const res = calcularSemaforo(voucherBase, { ...contextoBase, operacionDuplicada: true });
      expect(res.semaforo).toBe('RARO');
      expect(res.motivos.some((m) => m.includes('Número de operación'))).toBe(true);
    });
  });

  describe('OBSERVADO', () => {
    it('retorna OBSERVADO si el monto leído es menor al del pedido', () => {
      const res = calcularSemaforo({ ...voucherBase, monto: 30.0 }, contextoBase);
      expect(res.semaforo).toBe('OBSERVADO');
      expect(res.motivos.some((m) => m.includes('Monto menor al pedido'))).toBe(true);
    });

    it('retorna OBSERVADO si el monto leído es mayor al del pedido', () => {
      const res = calcularSemaforo({ ...voucherBase, monto: 40.0 }, contextoBase);
      expect(res.semaforo).toBe('OBSERVADO');
      expect(res.motivos.some((m) => m.includes('Monto mayor al pedido'))).toBe(true);
    });

    it('retorna OBSERVADO si el titular leído no coincide con el esperado', () => {
      const res = calcularSemaforo({ ...voucherBase, titular: 'Carlos Sánchez' }, contextoBase);
      expect(res.semaforo).toBe('OBSERVADO');
      expect(res.motivos.some((m) => m.includes('Titular no coincide'))).toBe(true);
    });

    it('retorna OBSERVADO si el número destino no coincide con los 9 dígitos', () => {
      const res = calcularSemaforo({ ...voucherBase, destinoNumero: '987654321' }, contextoBase);
      expect(res.semaforo).toBe('OBSERVADO');
      expect(res.motivos.some((m) => m.includes('Número destino no coincide'))).toBe(true);
    });

    it('retorna OBSERVADO si la fecha es de otro día', () => {
      const res = calcularSemaforo({ ...voucherBase, fecha: '2026-10-25' }, contextoBase);
      expect(res.semaforo).toBe('OBSERVADO');
      expect(res.motivos.some((m) => m.includes('Fecha de otro día'))).toBe(true);
    });

    it('retorna OBSERVADO si el medio detectado no coincide con el elegido', () => {
      const res = calcularSemaforo(
        { ...voucherBase, medioDetectado: 'PLIN' },
        { ...contextoBase, medioEsperado: 'YAPE' },
      );
      expect(res.semaforo).toBe('OBSERVADO');
      expect(res.motivos.some((m) => m.includes('distinto al elegido'))).toBe(true);
    });

    it('retorna OBSERVADO si la confianza está entre 0.5 y 0.8', () => {
      const res = calcularSemaforo({ ...voucherBase, confianza: 0.72 }, contextoBase);
      expect(res.semaforo).toBe('OBSERVADO');
      expect(res.motivos.some((m) => m.includes('Confianza media'))).toBe(true);
    });
  });

  describe('CONFIABLE', () => {
    it('retorna CONFIABLE cuando todos los datos coinciden y confianza >= 0.8', () => {
      const res = calcularSemaforo(voucherBase, contextoBase);
      expect(res.semaforo).toBe('CONFIABLE');
      expect(res.motivos.length).toBeGreaterThan(0);
    });

    it('acepta coincidencia flexible de titular (e.g. Maria Jose M. vs Maria Jose Morillo Ruiz)', () => {
      expect(titularesCoinciden('Maria Jose M.', 'Maria Jose Morillo Ruiz')).toBe(true);
      expect(titularesCoinciden('Maria Morillo', 'Maria Jose Morillo Ruiz')).toBe(true);
      expect(titularesCoinciden('MARIA JOSE MORILLO', 'maria jose morillo ruiz')).toBe(true);
      expect(titularesCoinciden('María José', 'Maria Jose Morillo Ruiz')).toBe(true);
      expect(titularesCoinciden('Carlos Gómez', 'Maria Jose Morillo Ruiz')).toBe(false);
    });

    it('compara números por los últimos 9 dígitos correctamente', () => {
      expect(compararUltimos9Digitos('+51 977 503 006', '977503006')).toBe(true);
      expect(compararUltimos9Digitos('51977503006', '977503006')).toBe(true);
      expect(compararUltimos9Digitos('977503006', '977503006')).toBe(true);
      expect(compararUltimos9Digitos('999999999', '977503006')).toBe(false);
    });

    it('normaliza fechas en distintos formatos', () => {
      expect(normalizarFecha('2026-10-27')).toBe('2026-10-27');
      expect(normalizarFecha('27/10/2026')).toBe('2026-10-27');
      expect(normalizarFecha('27-10-2026')).toBe('2026-10-27');
      expect(normalizarFecha(new Date('2026-10-27T12:00:00Z'))).toBe('2026-10-27');
    });
  });
});
