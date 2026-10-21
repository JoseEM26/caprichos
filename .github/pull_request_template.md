## 📌 Descripción del cambio
<!-- Resume brevemente qué problema resuelve este Pull Request o qué funcionalidad agrega -->

## 🔗 Historia de Usuario / Ticket
- Historia: HU-CAP-
- Épica / Feature: EP-CAP- / FT-

## 🏷️ Tipo de cambio
- [ ] `feat`: Nueva funcionalidad
- [ ] `fix`: Corrección de error (bugfix)
- [ ] `refactor`: Refactorización de código sin cambio de comportamiento
- [ ] `perf`: Mejora de rendimiento
- [ ] `test`: Adición o corrección de pruebas
- [ ] `infra`: Cambios en Docker, CI/CD o despliegue
- [ ] `docs`: Actualización de documentación técnica

---

## ✅ Checklist de Calidad Obligatoria (DoD)

Por favor, confirma que se cumplen todos los siguientes puntos antes de solicitar revisión:

### 1. Pruebas y Calidad de Código
- [ ] Se ejecutaron las pruebas unitarias en local (`pnpm test`) y todas pasan.
- [ ] El linter (`pnpm lint`) pasa sin advertencias ni errores.
- [ ] Se respeta la regla de dependencias entre módulos (`pnpm check:deps` / hexagonal ligero, ADR-001).

### 2. Base de Datos y Migraciones (ADR-003)
- [ ] **Compatibilidad hacia atrás garantizada**: Si hay migraciones de Prisma, siguen la estrategia *«expandir antes de contraer»* (primero se agrega la columna/tabla nueva, se migran datos y solo en una versión posterior se elimina la antigua).
- [ ] La aplicación puede ejecutarse con la versión inmediatamente anterior de la base de datos sin romperse (rollback seguro según RB-CAP-001).
- [ ] No aplica migraciones de base de datos en este PR.

### 3. Protección de Secretos y Seguridad (DT-43 / HU-CAP-183)
- [ ] **Sin secretos**: No se incluyen tokens, contraseñas, claves privadas ni llaves de API reales en el código ni en los commits.
- [ ] El hook de pre-commit (`.githooks/pre-commit` / Gitleaks) validó los archivos sin alertas de seguridad.
- [ ] Si se agregaron nuevas variables de configuración, se documentaron con valores ficticios en `.env.example`.

### 4. Construcción y Despliegue
- [ ] El proyecto compila limpiamente (`pnpm build`).
- [ ] Las imágenes Docker correspondientes (`infra/docker/Dockerfile.api` o `Dockerfile.web`) construyen sin errores.

---

## 📸 Evidencias de Verificación
<!-- Pega aquí capturas de pantalla, logs de pruebas o salida de comandos que demuestren que funciona -->
