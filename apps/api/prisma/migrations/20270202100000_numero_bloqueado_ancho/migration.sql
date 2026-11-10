-- Se pueden bloquear números que no son celulares peruanos de 9 dígitos (ensanchar es seguro: no toca filas)
ALTER TABLE "numero_bloqueado" ALTER COLUMN "celular" TYPE VARCHAR(40);
