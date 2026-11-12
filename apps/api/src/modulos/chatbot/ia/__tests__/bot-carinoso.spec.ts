jest.mock('../../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { construirPromptSistema, conUrlCarta } from '../prompt-sistema';
import { IaHerramientasService } from '../ia-herramientas.service';
import { EditarProductoDto } from '../../../catalogo/dto/editar-producto.dto';
import { CrearProductoDto } from '../../../catalogo/dto/crear-producto.dto';
import { TEXTOS_BOT, TEXTOS_SOLO_MENUS, TEXTOS_IA } from '../../conversacion/textos-bot';
import { TEXTOS_BOT_DEFECTO } from '../../configuracion/chatbot-configuracion.tipos';

describe('Capri cariñosa: prompt', () => {
  const prompt = conUrlCarta(construirPromptSistema('Ana', true), 'https://carta.ejemplo.pe');
  it('pide emojis cariñosos (3 a 6) y no los moderados', () => {
    expect(prompt).toContain('de 3 a 6');
    expect(prompt).not.toContain('moderados');
  });
  it('invita a la carta web con la URL completa y menciona promociones solo de la carta', () => {
    expect(prompt).toContain('https://carta.ejemplo.pe');
    expect(prompt).not.toContain('{{URL_CARTA}}');
    expect(prompt).toMatch(/solo de la carta web/);
    expect(prompt).toMatch(/NO reemplaza pasarAPersona/);
  });
  it('sin URL configurada usa https://caprichos.pe', () => {
    expect(conUrlCarta(construirPromptSistema(), '')).toContain('https://caprichos.pe');
  });
  it('reglas de porciones y alérgenos', () => {
    expect(prompt).toContain('según nuestra ficha no lo lleva');
    expect(prompt).toContain('alergenosConfirmados es false');
  });
});

describe('buscarEnCarta con porciones y alérgenos', () => {
  const carta = [{ nombre: 'Tortas', productos: [{
    nombre: 'Torta de chocolate', descripcion: 'Con ganache', precio: 60, disponible: true,
    porciones: '8 a 10 personas', alergenos: ['MANI', 'LACTEOS'], alergenosConfirmados: true,
    tamanos: [], grupos: [],
  }, { nombre: 'Torta simple', descripcion: null, precio: 30, disponible: true, tamanos: [], grupos: [] }] }];
  const svc = new IaHerramientasService({} as any, { obtenerCarta: async () => carta } as any);
  it('devuelve los campos nuevos', async () => {
    const r: any = await svc.buscarEnCarta('torta');
    expect(r.productos[0]).toMatchObject({ descripcion: 'Con ganache', porciones: '8 a 10 personas', alergenos: ['MANI', 'LACTEOS'], alergenosConfirmados: true });
    expect(r.productos[1]).toMatchObject({ porciones: null, alergenos: [], alergenosConfirmados: false });
  });
  it('recomendarProductos también', async () => {
    const r: any = await svc.recomendarProductos(undefined, 'tortas');
    expect(r.resultado.recomendaciones[0]).toMatchObject({ porciones: '8 a 10 personas', alergenosConfirmados: true });
  });
});

describe('DTO de producto: porciones y alérgenos', () => {
  const val = (o: object) => validate(plainToInstance(EditarProductoDto, o));
  it('acepta valores permitidos', async () => {
    expect(await val({ porciones: '8 a 10 personas', alergenos: ['MANI', 'SESAMO'], alergenosConfirmados: true })).toHaveLength(0);
  });
  it('rechaza alérgeno fuera de la lista', async () => {
    expect((await val({ alergenos: ['MANI', 'POLVO'] })).length).toBeGreaterThan(0);
  });
  it('rechaza porciones de más de 60 caracteres', async () => {
    expect((await val({ porciones: 'x'.repeat(61) })).length).toBeGreaterThan(0);
    expect(await val({ porciones: 'x'.repeat(60) })).toHaveLength(0);
  });
  it('crear usa las mismas reglas', async () => {
    const e = await validate(plainToInstance(CrearProductoDto, { nombre: 'a', categoriaId: 1, precio: 1, alergenos: ['X'] }));
    expect(e.length).toBeGreaterThan(0);
  });
});

describe('textos del bot dentro de los límites de WhatsApp', () => {
  const url = 'https://caprichos.pe';
  it('cuerpos <= 1024 y cariñosos', () => {
    const textos = [
      TEXTOS_BOT.despedida(), TEXTOS_BOT.pasarAPersona(), TEXTOS_BOT.noEntiendoDerivacion(),
      TEXTOS_BOT.noEntiendoRepregunta() + TEXTOS_SOLO_MENUS.lineaCartaNoEntiendo(url),
      TEXTOS_SOLO_MENUS.menuNoEntiendo() + TEXTOS_SOLO_MENUS.lineaCartaNoEntiendo(url),
      TEXTOS_SOLO_MENUS.derivadoPorNoEntender(), TEXTOS_SOLO_MENUS.acuse(),
      TEXTOS_IA.invitacionPreguntar(), TEXTOS_IA.errorConsulta(), TEXTOS_IA.dudaComplejaDerivacion(),
      ...Object.values(TEXTOS_BOT_DEFECTO),
    ];
    for (const t of textos) expect(t.length).toBeLessThanOrEqual(1024);
    expect(TEXTOS_SOLO_MENUS.lineaCartaNoEntiendo(url)).toContain(url);
    expect(TEXTOS_BOT.despedida()).toMatch(/🥰|💛/);
  });
});
