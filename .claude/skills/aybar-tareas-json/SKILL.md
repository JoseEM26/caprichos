---
name: aybar-tareas-json
description: Use cuando hay que crear, actualizar o validar el desglose de tareas tecnicas en JSON por epica para el Gate G4 en el paquete de analisis y diseno Aybar.
---

# Aybar · Desglose de Tareas en JSON (`backlog/tareas/EP-XXX-###.json`)

> **REGLA DE TRABAJO (innegociable): un documento a la vez, aprobado por el usuario antes del siguiente.**
> 1. Crea **un solo** documento (o una sola sección si es muy largo) y **detente**.
> 2. Muéstraselo al usuario y espera su visto bueno explícito. Si pide cambios, corrige ese mismo documento.
> 3. Solo con su aprobación pasa al siguiente, empezando por el primero de la cadena (intake → BRD → épica/feature → diseño → ADR → HU → DoR → tareas).
> 4. **Nunca generes varios documentos, carpetas o copias de golpe**, ni reorganices el paquete, sin que el usuario lo haya pedido paso a paso. Tampoco delegues la creación en masa a otros agentes.
> 5. Si el trabajo toca archivos existentes, pregunta antes: no muevas, copies ni borres por tu cuenta.

> **CARPETA DESTINO (fija): `<paquete>/backlog/tareas/`** — archivo `EP-<DOM>-###.json`. El nombre de la carpeta es exactamente ese y no se cambia (mismo esquema que `Roles y permisos`). `<paquete>` es la carpeta del proyecto en curso. Si la carpeta no existe, créala con ese nombre al guardar el primer documento de este tipo; no la crees antes ni dejes el archivo suelto en la raíz.

## 1. Para que sirve y en que gate entra

El archivo JSON de tareas desglosa a nivel técnico las actividades necesarias para construir cada Historia de Usuario (`HU`) que compone una Épica (`EP`). Permite planificar el sprint, asignar responsables preliminares y dar seguimiento a las dependencias técnicas entre capas de arquitectura. Entra en el **Gate G4** (preparación para desarrollo y estimación técnica). Existe exactamente **un archivo JSON por cada épica** del paquete (`backlog/tareas/EP-<DOM>-###.json`).

## 2. Esquema real y estructura JSON obligatoria

Un JSON válido contiene la cabecera de auditoría y la lista de historias con sus tareas:

```json
{
  "epica": "EP-IDN-005",
  "generado_por_ia": true,
  "revisado_por": null,
  "historias": [
    {
      "hu": "HU-IDN-054",
      "tareas": [
        {
          "id": "HU-IDN-054-T01",
          "titulo": "Definir alcance idn.catalogo.registrar y DDL IDN_OAUTH_CLIENT_SCOPE",
          "capa": "modelo",
          "actividad": "ANALISIS",
          "responsable": "Sony",
          "estimacion_horas": null,
          "depende_de": []
        },
        {
          "id": "HU-IDN-054-T02",
          "titulo": "Implementar validación de scopes en filtro de autorización",
          "capa": "adapters",
          "actividad": "DESARROLLO",
          "responsable": "Sony",
          "estimacion_horas": null,
          "depende_de": [
            "HU-IDN-054-T01"
          ]
        }
      ]
    }
  ]
}
```

### Convenciones de nomenclatura
- **Ruta y nombre de archivo:** `backlog/tareas/<epica-id>.json` (ejemplo: `backlog/tareas/EP-IDN-005.json`).
- **Identificador de tarea:** `<hu-id>-Tnn` con numeración secuencial de 2 dígitos (ej. `HU-IDN-054-T01`, `HU-IDN-054-T02`, ...).

## 3. Catálogo cerrado de valores reales (Capa y Actividad)

De la auditoría de los 16 archivos JSON existentes en el paquete, los valores válidos y cerrados son:

### Capas (`capa`):
- `adapters`: Controladores REST, filtros web, repositorios JPA/SQL, clientes de API externas.
- `application`: Casos de uso, servicios de aplicación, coordinadores y orquestadores.
- `boot`: Configuración de Spring Boot, inyección de dependencias, variables de entorno.
- `docs`: Documentación de decisiones, especificaciones, actualización de OpenAPI / contratos.
- `domain`: Entidades de dominio, objetos de valor, interfaces de repositorios, reglas de negocio.
- `infrastructure`: Configuración de infraestructura, migraciones Flyway/PostgreSQL, Key Vault, cloud.
- `modelo`: Definición de DDL, esquemas relacionales, scripts de base de datos.
- `ux`: Diseño de interfaces, validación contra mockups Figma, flujos de pantalla.

### Actividades (`actividad`):
- `ANALISIS`: Investigación técnica, definición de casos de uso y huecos de especificación.
- `DESARROLLO`: Implementación de código funcional de dominio, aplicación o adaptadores.
- `DESPLIEGUE`: Configuración de CI/CD, aprovisionamiento de infraestructura o ambientes.
- `DISENO`: Diseño de arquitectura, endpoints OpenAPI o diagramas técnicos.
- `DOCUMENTACION`: Actualización de documentación técnica, especificaciones o guías.
- `PRUEBAS`: Pruebas unitarias, de integración, adversariales o de carga.

## 4. Reglas obligatorias y errores típicos observados

- **Cobertura total:** Toda HU perteneciente a la épica debe figurar en el arreglo `historias` y **toda HU debe tener tareas asignadas**.
- **Integridad de dependencias:** El arreglo `depende_de` **solo** puede contener identificadores de tareas existentes en el paquete (pueden ser de la misma HU o de otra HU ya creada). Jamás incluir IDs inexistentes o rotos.
- **Estimación en null:** `estimacion_horas` debe permanecer siempre en `null` hasta que el equipo de ingeniería realice la sesión de estimación (la IA no inventa horas).
- **Trazabilidad:** `generado_por_ia: true` y `revisado_por: null` (hasta la revisión humana por el Líder Técnico).
- **Responsables:** Nombres asignados preliminares según roadmap (ej. `Marisol`, `Sony`), sin inventar personas fuera del equipo.

## 5. Documentos modelo

- Modelo conciso: `backlog/tareas/EP-IDN-007.json` (estructura limpia y secuencial).
- Modelos complejos de referencia: `backlog/tareas/EP-IDN-005.json` y `backlog/tareas/EP-IDN-001.json`.

## 6. Validación técnica y verificación final

### Comando de una línea para validar estructura y dependencias
```bash
python3 -c "import json, glob, sys; files=glob.glob('backlog/tareas/*.json'); all_ids={t['id'] for f in files for h in json.load(open(f)).get('historias',[]) for t in h.get('tareas',[])}; bad=[(f, t['id'], d) for f in files for h in json.load(open(f)).get('historias',[]) for t in h.get('tareas',[]) for d in t.get('depende_de',[]) if d not in all_ids]; sys.exit(f'Dependencias rotas: {bad}') if bad else print(f'OK: {len(all_ids)} tareas validadas sin errores de dependencias')"
```

### Checklist final
- [ ] Archivo creado con el nombre exacto `backlog/tareas/<epica-id>.json`.
- [ ] Todas las HU de la épica incluidas con al menos una tarea.
- [ ] Identificadores con convención `<hu-id>-Tnn`.
- [ ] Atributos `capa` y `actividad` pertenecientes estrictamente al catálogo cerrado.
- [ ] Campo `estimacion_horas: null` sin horas ficticias.
- [ ] `depende_de` sin ciclos y apuntando únicamente a IDs válidos.
- [ ] Ejecutar el validador global del paquete:
```bash
python3 -I '/home/jose/Aybar-Corp/equipo-innovacion/NEXORA/.claude/skills/aybar-siguiente-paso/scripts/estado.py' '<ruta-del-paquete>'
```
