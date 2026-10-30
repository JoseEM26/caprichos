import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import sharp from 'sharp';
import { ArchivosService } from './archivos.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';

describe('ArchivosService', () => {
  let service: ArchivosService;
  let prisma: {
    archivo: {
      create: jest.Mock;
      findUnique: jest.Mock;
    };
  };
  let auditoria: {
    registrar: jest.Mock;
  };
  let configService: {
    get: jest.Mock;
  };

  let tempDir: string;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'caprichos-uploads-test-'));
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    prisma = {
      archivo: {
        create: jest.fn(),
        findUnique: jest.fn(),
      },
    };
    auditoria = {
      registrar: jest.fn().mockResolvedValue(undefined),
    };
    configService = {
      get: jest.fn().mockImplementation((key: string, defaultVal: any) => {
        if (key === 'UPLOADS_DIR') return tempDir;
        return defaultVal;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArchivosService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditoriaService, useValue: auditoria },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<ArchivosService>(ArchivosService);
  });

  it('sube un png, queda en webp <= 1200 px', async () => {
    // Generar imagen PNG de prueba de 2000x1000 px
    const bufferPng = await sharp({
      create: {
        width: 2000,
        height: 1000,
        channels: 4,
        background: { r: 255, g: 120, b: 0, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const mockFile: Express.Multer.File = {
      fieldname: 'archivo',
      originalname: 'foto-grande.png',
      encoding: '7bit',
      mimetype: 'image/png',
      size: bufferPng.length,
      buffer: bufferPng,
      destination: '',
      filename: '',
      path: '',
      stream: null as any,
    };

    prisma.archivo.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: BigInt(101),
        ...data,
      }),
    );

    const resultado = await service.subirArchivo(mockFile, false);

    expect(resultado.id).toBe('101');
    expect(resultado.url).toMatch(/^\/archivos\/publico\/\d{4}\/\d{2}\/[a-f0-9-]+\.webp$/);

    // Verificar en BD
    expect(prisma.archivo.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tipo_mime: 'image/webp',
        privado: false,
      }),
    });

    // Verificar que el archivo guardado en disco sea WebP con lado máx <= 1200 px
    const llamadaData = prisma.archivo.create.mock.calls[0][0].data;
    const rutaGuardada = path.resolve(tempDir, llamadaData.ruta);
    expect(fs.existsSync(rutaGuardada)).toBe(true);

    const metadata = await sharp(rutaGuardada).metadata();
    expect(metadata.format).toBe('webp');
    expect(metadata.width).toBeLessThanOrEqual(1200);
    expect(metadata.height).toBeLessThanOrEqual(1200);
    expect(metadata.width).toBe(1200);
    expect(metadata.height).toBe(600); // 2000x1000 escalado a 1200x600
  });

  it('rechaza pdf público con 415 TIPO_NO_PERMITIDO', async () => {
    const mockFile: Express.Multer.File = {
      fieldname: 'archivo',
      originalname: 'documento.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      size: 1024,
      buffer: Buffer.from('%PDF-1.4...'),
      destination: '',
      filename: '',
      path: '',
      stream: null as any,
    };

    try {
      await service.subirArchivo(mockFile, false);
      fail('Debió lanzar excepción');
    } catch (error: any) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.UNSUPPORTED_MEDIA_TYPE);
      expect(error.getResponse()).toEqual({
        codigo: 'TIPO_NO_PERMITIDO',
        mensaje: 'Tipo de archivo no permitido: application/pdf',
      });
    }
  });

  it('permite pdf privado sin tocar su formato', async () => {
    const pdfBuffer = Buffer.from('%PDF-1.4 contenido de prueba de comprobante');
    const mockFile: Express.Multer.File = {
      fieldname: 'archivo',
      originalname: 'voucher.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      size: pdfBuffer.length,
      buffer: pdfBuffer,
      destination: '',
      filename: '',
      path: '',
      stream: null as any,
    };

    prisma.archivo.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: BigInt(202),
        ...data,
      }),
    );

    const resultado = await service.subirArchivo(mockFile, true);

    expect(resultado.id).toBe('202');
    expect(resultado.url).toBe('/admin/archivos/202');
    expect(prisma.archivo.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tipo_mime: 'application/pdf',
        privado: true,
      }),
    });
  });

  it('rechaza archivos mayores a 5 MB con 413 ARCHIVO_GRANDE', async () => {
    const tamanioGrande = 5 * 1024 * 1024 + 1; // 5 MB + 1 byte
    const mockFile: Express.Multer.File = {
      fieldname: 'archivo',
      originalname: 'pesado.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size: tamanioGrande,
      buffer: Buffer.alloc(10), // mock de buffer
      destination: '',
      filename: '',
      path: '',
      stream: null as any,
    };

    try {
      await service.subirArchivo(mockFile, false);
      fail('Debió lanzar excepción');
    } catch (error: any) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.PAYLOAD_TOO_LARGE);
      expect(error.getResponse()).toEqual({
        codigo: 'ARCHIVO_GRANDE',
        mensaje: 'El archivo excede el tamaño máximo permitido de 5 MB',
      });
    }
  });

  it('rechaza path traversal -> 400', () => {
    const intentos = [
      '../../privado/secreto.pdf',
      '../etc/passwd',
      'sub/../../../etc/shadow',
      '..\\windows\\win.ini',
      'archivo\0.webp',
    ];

    for (const intento of intentos) {
      try {
        service.validarYSolucionarRutaPublica(intento);
        fail(`Debió rechazar path traversal: ${intento}`);
      } catch (error: any) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        expect(error.getResponse().codigo).toBe('RUTA_INVALIDA');
      }
    }
  });

  it('urlDeArchivo retorna url pública para fotos y privada para comprobantes', async () => {
    prisma.archivo.findUnique.mockImplementation(({ where }) => {
      if (where.id === BigInt(1)) {
        return Promise.resolve({
          id: BigInt(1),
          ruta: 'publico/2026/10/foto.webp',
          privado: false,
        });
      }
      if (where.id === BigInt(2)) {
        return Promise.resolve({
          id: BigInt(2),
          ruta: 'privado/2026/10/voucher.pdf',
          privado: true,
        });
      }
      return Promise.resolve(null);
    });

    const urlPub = await service.urlDeArchivo(1);
    expect(urlPub).toBe('/archivos/publico/2026/10/foto.webp');

    const urlPriv = await service.urlDeArchivo(BigInt(2));
    expect(urlPriv).toBe('/admin/archivos/2');

    const urlInexistente = await service.urlDeArchivo(999);
    expect(urlInexistente).toBeNull();
  });
});
