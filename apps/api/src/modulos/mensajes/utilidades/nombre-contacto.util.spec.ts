import {
  esRemitenteSinTelefono,
  limpiarNombrePerfil,
  obtenerNombreMostrar,
} from './nombre-contacto.util';

describe('nombre-contacto.util', () => {
  describe('limpiarNombrePerfil', () => {
    it('elimina saltos de línea y tabuladores reemplazándolos por espacios simples', () => {
      const sucio = '  Juan \n\r Pérez \t Cliente  ';
      expect(limpiarNombrePerfil(sucio)).toBe('Juan Pérez Cliente');
    });

    it('recorta a un máximo de 80 caracteres', () => {
      const largo = 'A'.repeat(100);
      const limpio = limpiarNombrePerfil(largo);
      expect(limpio?.length).toBe(80);
      expect(limpio).toBe('A'.repeat(80));
    });

    it('retorna null para cadenas vacías o solo con espacios en blanco', () => {
      expect(limpiarNombrePerfil('')).toBeNull();
      expect(limpiarNombrePerfil('   \n\t  ')).toBeNull();
      expect(limpiarNombrePerfil(null)).toBeNull();
      expect(limpiarNombrePerfil(undefined)).toBeNull();
    });
  });

  describe('esRemitenteSinTelefono', () => {
    it('detecta USUARIO_WA como remitente sin teléfono', () => {
      expect(esRemitenteSinTelefono({ identificador_tipo: 'USUARIO_WA' })).toBe(true);
    });

    it('detecta prefijo wa-user: como remitente sin teléfono', () => {
      expect(esRemitenteSinTelefono({ telefono: 'wa-user:usr_12345' })).toBe(true);
    });

    it('retorna false para números de teléfono normales', () => {
      expect(esRemitenteSinTelefono({ identificador_tipo: 'TELEFONO', telefono: '51987654321' })).toBe(false);
      expect(esRemitenteSinTelefono({ telefono: '51987654321' })).toBe(false);
    });
  });

  describe('obtenerNombreMostrar (Jerarquía de 5 niveles)', () => {
    // Caso 1: Nombre editado a mano
    it('Nivel 1: Retorna nombre editado a mano cuando nombre_editado = true, sobre party, perfil WA y teléfono', () => {
      const res = obtenerNombreMostrar({
        nombre_editado: true,
        nombre_contacto: 'Don Pepe Panadería',
        party: {
          persona: { nombres: 'José', apellidos: 'Pérez' },
        },
        telefono: '51987654321',
        identificador_tipo: 'TELEFONO',
      });
      expect(res).toBe('Don Pepe Panadería');
    });

    // Caso 2: Persona vinculada (party)
    it('Nivel 2: Retorna persona vinculada cuando nombre_editado = false, sobre perfil WA y teléfono', () => {
      const res = obtenerNombreMostrar({
        nombre_editado: false,
        nombre_contacto: 'Perfil WhatsApp Antiguo',
        party: {
          persona: { nombres: 'María', apellidos: 'González' },
        },
        telefono: '51987654321',
        identificador_tipo: 'TELEFONO',
      });
      expect(res).toBe('María González');
    });

    // Caso 3: Nombre de perfil de WhatsApp
    it('Nivel 3: Retorna nombre de perfil de WhatsApp cuando no hay edición ni party', () => {
      const res = obtenerNombreMostrar({
        nombre_editado: false,
        nombre_contacto: 'Carlos WA',
        party: null,
        telefono: '51987654321',
        identificador_tipo: 'TELEFONO',
      });
      expect(res).toBe('Carlos WA');
    });

    it('Nivel 3: Recupera nombre_perfil_wa desde flujo si nombre_contacto estuviera nulo', () => {
      const res = obtenerNombreMostrar({
        nombre_editado: false,
        nombre_contacto: null,
        flujo: { nombre_perfil_wa: 'Carlos desde Flujo' },
        party: null,
        telefono: '51987654321',
        identificador_tipo: 'TELEFONO',
      });
      expect(res).toBe('Carlos desde Flujo');
    });

    // Caso 4: Teléfono enmascarado
    it('Nivel 4: Retorna teléfono enmascarado cuando no hay nombre editado, party ni perfil WA', () => {
      const res = obtenerNombreMostrar({
        nombre_editado: false,
        nombre_contacto: null,
        party: null,
        telefono: '51987654361',
        identificador_tipo: 'TELEFONO',
      });
      expect(res).toBe('+51 9*** ***61');
    });

    // Caso 5: Contacto sin nombre
    it('Nivel 5: Retorna "Contacto sin nombre" si no hay ningún dato disponible', () => {
      const res = obtenerNombreMostrar({
        nombre_editado: false,
        nombre_contacto: null,
        party: null,
        telefono: null,
      });
      expect(res).toBe('Contacto sin nombre');
    });

    it('Nivel 5 para usuario de WhatsApp sin nombre ni teléfono muestra Usuario de WhatsApp', () => {
      const res = obtenerNombreMostrar({
        nombre_editado: false,
        nombre_contacto: null,
        party: null,
        telefono: 'wa-user:usr_998877',
        identificador_tipo: 'USUARIO_WA',
      });
      expect(res).toBe('Usuario de WhatsApp');
    });

    it('Usuario de WhatsApp con nombre de perfil muestra Usuario de WhatsApp más el nombre de perfil', () => {
      const res = obtenerNombreMostrar({
        nombre_editado: false,
        nombre_contacto: 'Lucía BSUID',
        party: null,
        telefono: 'wa-user:PE.187654326',
        identificador_tipo: 'USUARIO_WA',
      });
      expect(res).toBe('Usuario de WhatsApp (Lucía BSUID)');
    });
  });
});
