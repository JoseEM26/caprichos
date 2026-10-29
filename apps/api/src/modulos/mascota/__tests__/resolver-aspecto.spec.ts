import {
  calcularDuracionDias,
  estaEnRango,
  fusionarAspecto,
  normalizarMascotaConfig,
  obtenerFechaLima,
  resolverAspecto,
} from '../mascota.util';
import {
  DEFAULT_ASPECTO_BASE,
  DEFAULT_MASCOTA_CONFIG,
} from '../mascota.constantes';
import { MascotaConfig, TemaMascota } from '../mascota.tipos';

describe('Mascota Capri - Utilidades de Fecha y Rango', () => {
  describe('obtenerFechaLima', () => {
    it('mantiene la cadena si ya tiene formato MM-DD', () => {
      expect(obtenerFechaLima('10-27')).toBe('10-27');
      expect(obtenerFechaLima('12-31')).toBe('12-31');
    });

    it('convierte un objeto Date considerando la zona horaria America/Lima (UTC-5)', () => {
      // 2026-10-25 02:30:00 UTC corresponde al 2026-10-24 21:30:00 en Lima
      const dateUtc = new Date('2026-10-25T02:30:00.000Z');
      expect(obtenerFechaLima(dateUtc)).toBe('10-24');

      // 2026-10-25 06:00:00 UTC corresponde al 2026-10-25 01:00:00 en Lima
      const dateUtcNext = new Date('2026-10-25T06:00:00.000Z');
      expect(obtenerFechaLima(dateUtcNext)).toBe('10-25');
    });
  });

  describe('estaEnRango', () => {
    it('evalúa correctamente rangos dentro del mismo año (desde <= hasta)', () => {
      // Halloween: 10-24 a 11-02
      expect(estaEnRango('10-23', '10-24', '11-02')).toBe(false);
      expect(estaEnRango('10-24', '10-24', '11-02')).toBe(true);
      expect(estaEnRango('10-31', '10-24', '11-02')).toBe(true);
      expect(estaEnRango('11-02', '10-24', '11-02')).toBe(true);
      expect(estaEnRango('11-03', '10-24', '11-02')).toBe(false);
    });

    it('evalúa correctamente rangos que cruzan fin de año (desde > hasta)', () => {
      // Año Nuevo: 12-27 a 01-02
      expect(estaEnRango('12-26', '12-27', '01-02')).toBe(false);
      expect(estaEnRango('12-27', '12-27', '01-02')).toBe(true);
      expect(estaEnRango('12-31', '12-27', '01-02')).toBe(true);
      expect(estaEnRango('01-01', '12-27', '01-02')).toBe(true);
      expect(estaEnRango('01-02', '12-27', '01-02')).toBe(true);
      expect(estaEnRango('01-03', '12-27', '01-02')).toBe(false);
    });
  });

  describe('calcularDuracionDias', () => {
    it('calcula duración de rangos dentro del mismo año', () => {
      // 02-10 a 02-15 = 6 días
      expect(calcularDuracionDias('02-10', '02-15')).toBe(6);
      // Mismo día = 1 día
      expect(calcularDuracionDias('05-01', '05-01')).toBe(1);
    });

    it('calcula duración de rangos que cruzan fin de año', () => {
      // 12-27 a 01-02 = 27, 28, 29, 30, 31 Dic (5 días) + 1, 2 Ene (2 días) = 7 días
      expect(calcularDuracionDias('12-27', '01-02')).toBe(7);
    });
  });
});

describe('Mascota Capri - resolverAspecto (función pura)', () => {
  const configPrueba: MascotaConfig = {
    base: {
      piel: '#FFE0C2',
      cabello: { color: '#3D2314', estilo: 'colitas' },
      ojos: '#1C1C22',
      uniforme: { principal: '#E67929', delantal: '#1C1C22', ribete: '#D99E39' },
      gorro: { tipo: 'chef', color: '#FBF4EC' },
      accesorios: [],
    },
    temas: [
      {
        clave: 'halloween',
        nombre: 'Halloween',
        desde: '10-24',
        hasta: '11-02',
        activo: true,
        aspecto: {
          gorro: { tipo: 'bruja', color: '#4A154B' },
          accesorios: ['calabaza'],
        },
      },
      {
        clave: 'ano_nuevo',
        nombre: 'Año Nuevo',
        desde: '12-27',
        hasta: '01-02',
        activo: true,
        aspecto: {
          gorro: { tipo: 'sombrero', color: '#D99E39' },
          accesorios: ['confeti'],
        },
      },
      {
        clave: 'inactivo_especial',
        nombre: 'Tema Inactivo',
        desde: '10-01',
        hasta: '10-31',
        activo: false,
        aspecto: {
          gorro: { tipo: 'corona', color: '#FF0000' },
        },
      },
    ],
    modo: 'AUTOMATICO',
    temaManual: 'normal',
  };

  it('resuelve aspecto base cuando ninguna temporada está activa en la fecha dada', () => {
    const resuelto = resolverAspecto(configPrueba, '06-15');
    expect(resuelto.tema).toBeNull();
    expect(resuelto.aspecto.gorro.tipo).toBe('chef');
    expect(resuelto.aspecto.piel).toBe('#FFE0C2');
    expect(resuelto.aspecto.accesorios).toEqual([]);
  });

  it('aplica tema normal dentro del mismo año (Halloween)', () => {
    const resuelto = resolverAspecto(configPrueba, '10-31');
    expect(resuelto.tema).toBe('halloween');
    expect(resuelto.aspecto.gorro.tipo).toBe('chef');
    expect(resuelto.aspecto.gorro.color).toBe('#FBF4EC');
    expect(resuelto.aspecto.accesorios).toEqual(['calabaza']);
    // Conserva los valores base no sobreescritos
    expect(resuelto.aspecto.piel).toBe('#FFE0C2');
    expect(resuelto.aspecto.cabello.estilo).toBe('colitas');
    expect(resuelto.aspecto.uniforme.principal).toBe('#E67929');
  });

  it('aplica tema con rango que cruza fin de año (Año Nuevo en diciembre)', () => {
    const resuelto = resolverAspecto(configPrueba, '12-31');
    expect(resuelto.tema).toBe('ano_nuevo');
    expect(resuelto.aspecto.gorro.tipo).toBe('chef');
    expect(resuelto.aspecto.accesorios).toEqual(['confeti']);
  });

  it('aplica tema con rango que cruza fin de año (Año Nuevo en enero)', () => {
    const resuelto = resolverAspecto(configPrueba, '01-01');
    expect(resuelto.tema).toBe('ano_nuevo');
    expect(resuelto.aspecto.gorro.tipo).toBe('chef');
  });

  it('ignora temas desactivados (activo: false)', () => {
    // 10-15 cae dentro del rango de inactivo_especial (10-01 a 10-31), pero está inactivo
    const resuelto = resolverAspecto(configPrueba, '10-15');
    expect(resuelto.tema).toBeNull();
    expect(resuelto.aspecto.gorro.tipo).toBe('chef');
  });

  it('desempata eligiendo el tema de menor duración en días cuando varios coinciden', () => {
    const configConSolapamiento: MascotaConfig = {
      ...configPrueba,
      temas: [
        {
          clave: 'temporada_larga',
          nombre: 'Temporada Larga',
          desde: '10-01',
          hasta: '11-15', // 46 días
          activo: true,
          aspecto: { gorro: { tipo: 'corona', color: '#111111' } },
        },
        {
          clave: 'halloween_corto',
          nombre: 'Halloween Corto',
          desde: '10-28',
          hasta: '11-02', // 6 días
          activo: true,
          aspecto: { gorro: { tipo: 'bruja', color: '#222222' } },
        },
      ],
    };

    const resuelto = resolverAspecto(configConSolapamiento, '10-31');
    // Coinciden ambos, pero 'halloween_corto' dura 6 días frente a 46 días
    expect(resuelto.tema).toBe('halloween_corto');
    expect(resuelto.aspecto.gorro.tipo).toBe('chef');
  });

  it('desempata de forma determinista (primer tema en la lista) cuando la duración es idéntica', () => {
    const configEmpateExacto: MascotaConfig = {
      ...configPrueba,
      temas: [
        {
          clave: 'tema_a',
          nombre: 'Tema A',
          desde: '10-25',
          hasta: '10-31', // 7 días
          activo: true,
          aspecto: { gorro: { tipo: 'corona', color: '#AAAAAA' } },
        },
        {
          clave: 'tema_b',
          nombre: 'Tema B',
          desde: '10-25',
          hasta: '10-31', // 7 días
          activo: true,
          aspecto: { gorro: { tipo: 'sombrero', color: '#BBBBBB' } },
        },
      ],
    };

    const resuelto = resolverAspecto(configEmpateExacto, '10-27');
    expect(resuelto.tema).toBe('tema_a');
    expect(resuelto.aspecto.gorro.tipo).toBe('chef');
  });

  describe('Modo MANUAL', () => {
    it('aplica el tema manual indicado sin importar la fecha', () => {
      const configManual: MascotaConfig = {
        ...configPrueba,
        modo: 'MANUAL',
        temaManual: 'halloween',
      };

      // Fecha en junio (fuera de Halloween)
      const resuelto = resolverAspecto(configManual, '06-10');
      expect(resuelto.tema).toBe('halloween');
      expect(resuelto.aspecto.gorro.tipo).toBe('chef');
    });

    it('retorna aspecto base si temaManual es "normal"', () => {
      const configManualNormal: MascotaConfig = {
        ...configPrueba,
        modo: 'MANUAL',
        temaManual: 'normal',
      };

      const resuelto = resolverAspecto(configManualNormal, '10-31');
      expect(resuelto.tema).toBeNull();
      expect(resuelto.aspecto.gorro.tipo).toBe('chef');
    });

    it('retorna aspecto base si el temaManual seleccionado está inactivo', () => {
      const configManualInactivo: MascotaConfig = {
        ...configPrueba,
        modo: 'MANUAL',
        temaManual: 'inactivo_especial',
      };

      const resuelto = resolverAspecto(configManualInactivo, '10-15');
      expect(resuelto.tema).toBeNull();
      expect(resuelto.aspecto.gorro.tipo).toBe('chef');
    });

    it('retorna aspecto base si el temaManual no existe', () => {
      const configManualInexistente: MascotaConfig = {
        ...configPrueba,
        modo: 'MANUAL',
        temaManual: 'no_existe_este_tema',
      };

      const resuelto = resolverAspecto(configManualInexistente, '10-31');
      expect(resuelto.tema).toBeNull();
      expect(resuelto.aspecto.gorro.tipo).toBe('chef');
    });
  });

  it('utiliza DEFAULT_MASCOTA_CONFIG si se recibe null o undefined', () => {
    const resuelto = resolverAspecto(null, '06-15');
    expect(resuelto.aspecto.piel).toBe(DEFAULT_ASPECTO_BASE.piel);
    expect(resuelto.aspecto.uniforme.principal).toBe(DEFAULT_ASPECTO_BASE.uniforme.principal);
  });
describe('normalizarMascotaConfig: opciones nuevas y retrocompatibilidad', () => {
  it('una configuración antigua (sin prenda ni escala) sigue siendo válida', () => {
    const antigua = {
      base: {
        ...DEFAULT_ASPECTO_BASE,
        uniforme: { principal: '#E67929', delantal: '#1C1C22', ribete: '#D99E39' },
      },
      temas: DEFAULT_MASCOTA_CONFIG.temas,
      modo: 'AUTOMATICO',
    } as any;
    const norm = normalizarMascotaConfig(antigua);
    expect(norm.base.uniforme.prenda).toBe('chaqueta');
    expect(norm.escala).toBe(1);
  });

  it('la escala fuera de rango se corrige a 0.7 - 1.5', () => {
    expect(normalizarMascotaConfig({ ...DEFAULT_MASCOTA_CONFIG, escala: 9 }).escala).toBe(1.5);
    expect(normalizarMascotaConfig({ ...DEFAULT_MASCOTA_CONFIG, escala: 0.2 }).escala).toBe(0.7);
    expect(normalizarMascotaConfig({ ...DEFAULT_MASCOTA_CONFIG, escala: 1.2 }).escala).toBe(1.2);
  });

  it('valores desconocidos caen al por defecto y se conservan las opciones nuevas válidas', () => {
    const norm = normalizarMascotaConfig({
      ...DEFAULT_MASCOTA_CONFIG,
      base: {
        ...DEFAULT_ASPECTO_BASE,
        gorro: { tipo: 'casco' as any, color: '#112233' },
        cabello: { color: '#112233', estilo: 'mohawk' as any },
        uniforme: { ...DEFAULT_ASPECTO_BASE.uniforme, prenda: 'smoking' as any },
        accesorios: ['nave' as any, 'lentes', 'medalla'],
      },
    });
    expect(norm.base.gorro.tipo).toBe('chef');
    expect(norm.base.cabello.estilo).toBe('colitas');
    expect(norm.base.uniforme.prenda).toBe('chaqueta');
    expect(norm.base.accesorios).toEqual(['lentes', 'medalla']);

    const nuevo = normalizarMascotaConfig({
      ...DEFAULT_MASCOTA_CONFIG,
      base: {
        ...DEFAULT_ASPECTO_BASE,
        gorro: { tipo: 'boina', color: '#112233' },
        cabello: { color: '#112233', estilo: 'rizado' },
        uniforme: { ...DEFAULT_ASPECTO_BASE.uniforme, prenda: 'polo' },
      },
    });
    expect(nuevo.base.gorro.tipo).toBe('boina');
    expect(nuevo.base.cabello.estilo).toBe('rizado');
    expect(nuevo.base.uniforme.prenda).toBe('polo');
  });
});
});
