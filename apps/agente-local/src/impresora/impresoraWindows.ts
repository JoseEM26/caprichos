import { execFile } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { IDispositivoImpresora, EstadoDispositivo } from './dispositivo.interface';
import { ErrorImpresora } from './dispositivo.interface';
import type { ImpresoraWindowsInfo } from '../candidatas';

function powershell(script: string, env: Record<string, string> = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { env: { ...process.env, ...env }, timeout: 15000, windowsHide: true },
      (err, stdout, stderr) => (err ? reject(new Error((stderr || err.message).trim())) : resolve(stdout)),
    );
  });
}

/** Impresoras instaladas en Windows (para el asistente de configuración). */
export async function listarImpresorasWindows(): Promise<string[]> {
  const out = await powershell('Get-Printer | Select-Object -ExpandProperty Name | ConvertTo-Json -Compress');
  const j = out.trim() ? JSON.parse(out) : [];
  return Array.isArray(j) ? j : [j];
}

/** Nombre, controlador y puerto de cada impresora instalada (ayuda a distinguir las virtuales y a reconocer la USB). */
export async function listarImpresorasWindowsDetalle(): Promise<ImpresoraWindowsInfo[]> {
  const out = await powershell(
    "Get-Printer | Select-Object Name,DriverName,PortName,@{n='Estado';e={[string]$_.PrinterStatus}},WorkOffline | ConvertTo-Json -Compress",
  );
  const j = out.trim() ? JSON.parse(out) : [];
  return (Array.isArray(j) ? j : [j]).map((p: any) => ({
    nombre: p.Name,
    driver: p.DriverName,
    puerto: p.PortName,
    estado: p.Estado,
    workOffline: p.WorkOffline === true,
  }));
}

// Envío RAW al spooler (sin driver gráfico): sirve para TSPL y ESC/POS por igual
const SCRIPT_RAW = `
Add-Type -TypeDefinition @"
using System; using System.Runtime.InteropServices;
public class RawPrn {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] public class DOCINFO { public string pDocName; public string pOutputFile; public string pDataType; }
  [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)] public static extern bool OpenPrinter(string n, out IntPtr h, IntPtr d);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)] public static extern bool StartDocPrinter(IntPtr h, int l, [In] DOCINFO d);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool WritePrinter(IntPtr h, byte[] b, int c, out int w);
}
"@
$bytes = [IO.File]::ReadAllBytes($env:CAP_ARCHIVO); $h = [IntPtr]::Zero; $w = 0
try { $p = Get-Printer -Name $env:CAP_IMPRESORA -ErrorAction Stop; if ($p.WorkOffline) { Set-Printer -Name $env:CAP_IMPRESORA -WorkOffline $false -ErrorAction Stop } } catch {}
if (-not [RawPrn]::OpenPrinter($env:CAP_IMPRESORA, [ref]$h, [IntPtr]::Zero)) { throw "No se pudo abrir la impresora" }
$d = New-Object RawPrn+DOCINFO; $d.pDocName = "Caprichos"; $d.pDataType = "RAW"
[RawPrn]::StartDocPrinter($h, 1, $d) | Out-Null; [RawPrn]::StartPagePrinter($h) | Out-Null
$ok = [RawPrn]::WritePrinter($h, $bytes, $bytes.Length, [ref]$w)
[RawPrn]::EndPagePrinter($h) | Out-Null; [RawPrn]::EndDocPrinter($h) | Out-Null; [RawPrn]::ClosePrinter($h) | Out-Null
if (-not $ok) { throw "El spooler rechazó los datos" }
`;

export class ImpresoraWindows implements IDispositivoImpresora {
  /** El ejecutor y la pausa se pueden cambiar para probar sin PowerShell. */
  constructor(
    private readonly nombre: string,
    private readonly ejecutar: typeof powershell = powershell,
    private readonly pausa: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  ) {}

  obtenerRuta(): string {
    return this.nombre;
  }

  async escribir(datos: Buffer): Promise<void> {
    const archivo = path.join(os.tmpdir(), `caprichos-${process.pid}-${Date.now()}.bin`);
    await fs.promises.writeFile(archivo, datos);
    try {
      // Un USB recién conectado o el spooler ocupado a veces rechaza el primer intento: se reintenta 2 veces más.
      let ultimo: any;
      for (let intento = 0; intento < 3; intento++) {
        try {
          await this.ejecutar(SCRIPT_RAW, { CAP_ARCHIVO: archivo, CAP_IMPRESORA: this.nombre });
          return;
        } catch (err: any) {
          ultimo = err;
          if (intento < 2) await this.pausa(1500);
        }
      }
      const e = await this.verificarEstado();
      throw new ErrorImpresora(
        `No se pudo imprimir en "${this.nombre}": ${e.detalle || ultimo.message}`,
        e.estado === 'lista' ? 'error' : e.estado,
      );
    } finally {
      fs.promises.unlink(archivo).catch(() => undefined);
    }
  }

  async verificarEstado(): Promise<EstadoDispositivo> {
    try {
      const out = await this.ejecutar(
        '$p = Get-Printer -Name $env:CAP_IMPRESORA -ErrorAction Stop; "$([string]$p.PrinterStatus)|$($p.WorkOffline)"',
        { CAP_IMPRESORA: this.nombre },
      );
      const [estado, offline] = out.trim().split('|');
      if (offline === 'True' || estado === 'Offline') {
        return {
          estado: 'desconectada',
          detalle: `"${this.nombre}" está sin conexión: revisa que esté encendida y con el cable USB bien puesto (en Windows: Impresoras > quitar «Usar impresora sin conexión»)`,
        };
      }
      if (estado === 'PaperOut') return { estado: 'sin_papel', detalle: 'Sin papel' };
      if (estado === 'Normal' || estado === 'Idle' || estado === 'Printing' || estado === 'Busy' || estado === 'Waiting') {
        return { estado: 'lista' };
      }
      return { estado: 'error', detalle: `Estado de la impresora: ${estado}` };
    } catch {
      return { estado: 'desconectada', detalle: `Impresora guardada no encontrada: ${this.nombre}` };
    }
  }
}
