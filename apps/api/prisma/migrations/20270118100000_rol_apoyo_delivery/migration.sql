-- Rol extra APOYO_DELIVERY (apps/api/src/modulos/acceso/permisos.ts). Idempotente: sirve en bases con datos y en vacías.
-- Los permisos del rol los vincula el sincronizador al arrancar (MATRIZ); aquí solo se admite el código y se crea la fila.
ALTER TABLE "rol" DROP CONSTRAINT IF EXISTS "ck_rol_codigo";
ALTER TABLE "rol" ADD CONSTRAINT "ck_rol_codigo" CHECK (
  "codigo" IN ('ADMIN','CAJERO','COCINA','MOZO','CALLCENTER','ALMACEN','REPARTIDOR','SUPERVISOR','APOYO_DELIVERY'));

INSERT INTO "rol" ("codigo", "nombre")
VALUES ('APOYO_DELIVERY', 'Apoyo en delivery')
ON CONFLICT ("codigo") DO NOTHING;
