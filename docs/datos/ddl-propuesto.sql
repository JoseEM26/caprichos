-- =====================================================================
-- Caprichos · DDL de referencia (PostgreSQL 16) · DAT-CAP-001 · draft
-- Generado por IA desde el paquete (ADR-003, ADR-004, features FT-*).
-- No es la migración final: Prisma genera las migraciones (ADR-003).
-- Convenciones: ids bigint identity; montos numeric(12,2); cantidades
-- numeric(14,3); fechas timestamptz (reglas de día en America/Lima);
-- nada se borra: activo / anulado_en (RN-CAP-014); auditoría común.
-- =====================================================================

-- ---------- 0. Comunes -------------------------------------------------
-- Columnas de auditoría que llevan todas las tablas de negocio:
--   creado_en timestamptz not null default now(), creado_por bigint,
--   actualizado_en timestamptz, actualizado_por bigint
-- (se omiten abajo por brevedad salvo donde son regla de negocio).

create table lista (                          -- listas administrables (RN-CAP-129)
  id bigint generated always as identity primary key,
  codigo text not null unique,                -- TAMANO, LECHE, ENDULZANTE, ORIGEN_MOV, DESTINO_MERMA, MOTIVO_ANULACION…
  nombre text not null
);
create table lista_valor (
  id bigint generated always as identity primary key,
  lista_id bigint not null references lista(id),
  nombre text not null,
  orden int not null default 0,
  activo boolean not null default true,
  unique (lista_id, nombre)                   -- sin nombres repetidos (RN-CAP-128)
);

create table auditoria (                      -- historial de acciones (ADR-014, DT-49), solo se inserta
  id bigint generated always as identity primary key,
  categoria text not null check (categoria in ('CAMBIO','ACCESO','LECTURA_SENSIBLE')),
  modulo text not null,                        -- pedidos, caja, ofertas, usuarios, configuracion…
  accion text not null,                        -- CREAR, EDITAR, ANULAR, PERMISO, PRECIO, PARAMETRO, INGRESO, INGRESO_FALLIDO, PIN_FALLIDO, VER_DNI, VER_COMPROBANTE, EXPORTAR…
  resultado text not null default 'OK' check (resultado in ('OK','RECHAZADO')),
  entidad text, entidad_id bigint,
  antes jsonb, despues jsonb,                  -- DNI y teléfonos enmascarados (ADR-005)
  motivo text,
  party_id bigint,                             -- quién (nulo en un ingreso fallido de usuario inexistente)
  con_pin_admin boolean not null default false,
  ip inet, dispositivo text, request_id text,  -- la IP se guarda y se muestra tal cual; no se clasifica (DT-50 descartada)
  en timestamptz not null default now(),
  hash_anterior bytea, hash bytea not null     -- huella encadenada (la llena el trigger)
);
create index ix_auditoria_busqueda on auditoria (en desc, modulo, party_id);
create index ix_auditoria_entidad on auditoria (entidad, entidad_id);

-- Huella encadenada: cada fila guarda sha256 de la anterior + la suya (ADR-014)
create function auditoria_encadenar() returns trigger language plpgsql as $$
declare prev bytea;
begin
  perform pg_advisory_xact_lock(hashtext('auditoria'));   -- cadena lineal aunque haya inserciones a la vez
  select hash into prev from auditoria order by id desc limit 1;
  new.hash_anterior := prev;
  new.hash := sha256(coalesce(prev, ''::bytea) || convert_to(
      concat_ws('|', new.categoria, new.modulo, new.accion, new.resultado, new.entidad, new.entidad_id,
                new.antes::text, new.despues::text, new.motivo, new.party_id, new.con_pin_admin, new.ip, new.en), 'UTF8'));
  return new;
end $$;
create trigger tg_auditoria_encadenar before insert on auditoria for each row execute function auditoria_encadenar();

-- Nadie edita ni borra la auditoría, ni siquiera la aplicación (ADR-014)
create function auditoria_inmutable() returns trigger language plpgsql as $$
begin raise exception 'La auditoría no se edita ni se borra'; end $$;
create trigger tg_auditoria_inmutable before update or delete on auditoria for each row execute function auditoria_inmutable();
-- Además, el usuario de la base de la API solo puede insertar y leer:
--   grant select, insert on auditoria to caprichos_api;  (sin update ni delete)
-- El archivado a los 2 años lo hace un usuario de mantenimiento que desactiva el trigger dentro de su transacción.

-- ---------- 1. Personas: patrón Party simple (ADR-004) -----------------
create table party (
  id bigint generated always as identity primary key,
  tipo text not null check (tipo in ('PERSONA','ORGANIZACION')),
  estado text not null default 'ACTIVO' check (estado in ('ACTIVO','ANONIMIZADO')),
  creado_en timestamptz not null default now()
);
create table person (
  party_id bigint primary key references party(id),
  nombres text not null,
  apellidos text,
  cumple_dia smallint check (cumple_dia between 1 and 31),   -- solo día y mes (RN-CAP-110)
  cumple_mes smallint check (cumple_mes between 1 and 12),
  foto_archivo_id bigint
);
create table organization (
  party_id bigint primary key references party(id),
  razon_social text not null,
  nombre_comercial text
);
create table party_identifier (
  id bigint generated always as identity primary key,
  party_id bigint not null references party(id),
  tipo text not null check (tipo in ('DNI','RUC','CE')),
  numero text not null,
  check ((tipo = 'DNI' and numero ~ '^\d{8}$') or (tipo = 'RUC' and numero ~ '^\d{11}$') or tipo = 'CE'),
  unique (tipo, numero)
);
create table contact_mechanism (
  id bigint generated always as identity primary key,
  party_id bigint not null references party(id),
  tipo text not null check (tipo in ('TELEFONO','WHATSAPP','CORREO','DIRECCION')),
  valor text not null,                         -- teléfono normalizado +51…, correo o dirección escrita
  lat numeric(9,6), lng numeric(9,6), referencia text, zona_id bigint,
  principal boolean not null default false,
  activo boolean not null default true
);
create index ix_contacto_valor on contact_mechanism (tipo, valor) where activo;
create table consent (                        -- Ley 29733 (ADR-005)
  id bigint generated always as identity primary key,
  party_id bigint not null references party(id),
  version_texto text not null,
  canal text not null check (canal in ('CARTA','CAJA','BOT','ADMIN')),
  aceptado_en timestamptz not null default now(),
  revocado_en timestamptz
);
create table party_role (
  id bigint generated always as identity primary key,
  party_id bigint not null references party(id),
  rol text not null check (rol in ('CLIENTE','TRABAJADOR','PROVEEDOR')),
  desde date not null default current_date,
  hasta date
);
create unique index ux_rol_vigente on party_role (party_id, rol) where hasta is null;
create table customer_detail (
  party_role_id bigint primary key references party_role(id),
  puntos int not null default 0 check (puntos >= 0),
  envio_tipo text check (envio_tipo in ('FIJO','PORCENTAJE')),  -- tarifa especial (RN-CAP-109)
  envio_valor numeric(12,2)
);
create table employee_detail (
  party_role_id bigint primary key references party_role(id),
  descuento_pct numeric(5,2)                    -- nulo = usa el general de Configuración (RN-CAP-058)
);
create table supplier_detail (
  party_role_id bigint primary key references party_role(id),
  dias_credito int not null default 0,
  cuenta_pago text,
  activo boolean not null default true
);

-- ---------- 2. Acceso (ADR-008) ----------------------------------------
create table rol (
  codigo text primary key check (codigo in ('ADMIN','CAJERO','COCINA','MOZO','CALLCENTER','ALMACEN','REPARTIDOR')),
  nombre text not null
);
create table permiso (
  id bigint generated always as identity primary key,
  modulo text not null, accion text not null,  -- p. ej. caja/cobrar, pedidos/anular
  unique (modulo, accion)
);
create table rol_permiso (
  rol text not null references rol(codigo),
  permiso_id bigint not null references permiso(id),
  primary key (rol, permiso_id)
);
create table user_account (
  id bigint generated always as identity primary key,
  party_id bigint not null unique references party(id),
  rol text not null references rol(codigo),
  hash text not null,                          -- argon2id (RNF-CAP-007)
  debe_cambiar boolean not null default true,  -- primer ingreso (RN-CAP-119)
  clave_inicial_vence timestamptz,             -- propuesta D-17
  pin_hash text,                               -- PIN de 6 dígitos de la supervisora, solo ADMIN (RN-CAP-094, DT-61)
  activo boolean not null default true,
  alta_en date not null default current_date
);
create table customer_account (
  id bigint generated always as identity primary key,
  party_id bigint not null unique references party(id),
  hash text,                                   -- nulo: registrado en el local sin contraseña (NEC-CAP-057)
  activo boolean not null default true
);
create table horario_trabajo (                  -- días y horas de cada persona (DT-64)
  party_id bigint references party(id), dia smallint check (dia between 1 and 7),   -- 1 = lunes
  desde time not null, hasta time not null, primary key (party_id, dia)
);
create table cobertura_turno (                  -- quién cubre un descanso un día puntual (DT-64)
  id bigint generated always as identity primary key,
  fecha date not null, rol text not null references rol(codigo),
  cubre_party_id bigint not null references party(id), reemplaza_party_id bigint references party(id),
  desde time not null, hasta time not null, por bigint not null
);
create table sesion (
  id bigint generated always as identity primary key,
  audiencia text not null check (audiencia in ('ADMIN','CARTA')),
  party_id bigint not null references party(id),
  refresh_hash text not null unique,
  dispositivo text, expira_en timestamptz not null, revocada_en timestamptz
);
create table device_key (                     -- agente de impresión y TV (ADR-002)
  id bigint generated always as identity primary key,
  tipo text not null check (tipo in ('AGENTE','TV')),
  nombre text not null, llave_hash text not null unique,
  area_id bigint, activo boolean not null default true
);

-- ---------- 3. Configuración del local (FT-CFG-01/02) ------------------
create table parametro (                      -- clave/valor con historial en auditoria (DT-20)
  clave text primary key,                      -- tiempo_prometido_min, envio_gratis_monto, envio_gratis_modo,
  valor jsonb not null                         -- pedido_minimo, tolerancia_reserva_min, puntos_porcentaje, descuento_personal_pct…
);
create table horario_dia (
  dia_semana smallint primary key check (dia_semana between 1 and 7),
  abre time, cierra time, cerrado boolean not null default false
);
create table fecha_especial (
  fecha date primary key, cerrado boolean not null, abre time, cierra time, motivo text
);
create table archivo (                        -- ADR-012
  id bigint generated always as identity primary key,
  ruta text not null unique, tipo_mime text not null, bytes int not null check (bytes <= 5242880),
  privado boolean not null default false
);
create table foto_local (archivo_id bigint primary key references archivo(id), orden int not null default 0, activo boolean not null default true);

-- ---------- 4. Catálogo y contenidos (FT-CAR-01, FT-CON-01..03) --------
create table area_cocina (
  id bigint generated always as identity primary key,
  nombre text not null unique, propia boolean not null default false,
  impresora text, etiquetera text, activo boolean not null default true
);
-- máximo 4 áreas propias activas (RN-CAP-123): se valida en la aplicación.
create table categoria (
  id bigint generated always as identity primary key,
  nombre text not null unique,
  lleva_opciones boolean not null default true,            -- RN-CAP-130
  area_id bigint not null references area_cocina(id),       -- NEC-CAP-087
  orden int not null default 0, oculta boolean not null default false
);
create table producto (
  id bigint generated always as identity primary key,
  categoria_id bigint not null references categoria(id),
  nombre text not null unique,
  descripcion text, foto_archivo_id bigint references archivo(id),
  precio numeric(12,2) not null check (precio >= 0),
  por_lote boolean not null default false,                  -- donas, galletas, pan (RN-CAP-039)
  vida_util_horas int,                                       -- RN-CAP-040
  orden int not null default 0, oculto boolean not null default false,
  agotado_hasta timestamptz,                                 -- null = disponible; 'infinity' = desde Productos (RN-CAP-085)
  no_suma_beneficios boolean not null default false          -- «No suma puntos ni aplica cupones» (DT-65)
);
create table producto_tamano (
  id bigint generated always as identity primary key,
  producto_id bigint not null references producto(id),
  tamano_valor_id bigint not null references lista_valor(id),
  precio numeric(12,2) not null, activo boolean not null default true,
  unique (producto_id, tamano_valor_id)
);
create table grupo_opciones (
  id bigint generated always as identity primary key,
  nombre text not null unique,
  lista_id bigint references lista(id),
  obligatorio boolean not null default false,
  minimo int not null default 0, maximo int not null default 1 check (maximo >= minimo),
  activo boolean not null default true
);
create table opcion (
  id bigint generated always as identity primary key,
  grupo_id bigint not null references grupo_opciones(id),
  valor_id bigint not null references lista_valor(id),
  precio_extra numeric(12,2) not null default 0,
  activo boolean not null default true, agotado_hasta timestamptz,
  unique (grupo_id, valor_id)
);
create table grupo_alcance (                  -- en qué productos o categorías se pregunta (NEC-CAP-067)
  grupo_id bigint not null references grupo_opciones(id),
  producto_id bigint references producto(id),
  categoria_id bigint references categoria(id),
  orden int not null default 0,
  check (num_nonnulls(producto_id, categoria_id) = 1)
);
create table sabor (                          -- tipos con sabores (NEC-CAP-058)
  id bigint generated always as identity primary key,
  producto_id bigint not null references producto(id),
  nombre text not null, activo boolean not null default true, agotado_hasta timestamptz,
  unique (producto_id, nombre)
);
create table version_carta (                  -- publicar con acción explícita (RN-CAP-018)
  id bigint generated always as identity primary key,
  estado text not null check (estado in ('BORRADOR','PUBLICADA','ARCHIVADA')),
  organizacion text not null default 'SECCIONES' check (organizacion in ('SECCIONES','LISTA','TARJETAS')),
  decoracion text,                             -- NAVIDAD, HALLOWEEN… (NEC-CAP-012)
  contenido jsonb not null,                    -- orden, destacados superiores, ocultos
  publicada_en timestamptz, publicada_por bigint
);
create unique index ux_una_publicada on version_carta (estado) where estado = 'PUBLICADA';
create table novedad (
  id bigint generated always as identity primary key,
  tipo text not null check (tipo in ('PROMOCION','BANNER','VIDEO','FOTOS','EVENTO','AVISO')),
  titulo text not null, texto text, tema text, video_url text,
  evento_fecha timestamptz, evento_lugar text,
  desde date, hasta date, orden int not null default 0, activo boolean not null default false
);
create table novedad_foto (novedad_id bigint references novedad(id), archivo_id bigint references archivo(id), orden int, primary key (novedad_id, archivo_id));
create table destacada (
  id bigint generated always as identity primary key,
  titulo text not null, portada_archivo_id bigint references archivo(id),
  orden int not null default 0, archivada boolean not null default false
  -- excepción a RN-CAP-014: se puede eliminar (DT-06)
);
create table destacada_foto (destacada_id bigint references destacada(id) on delete cascade, archivo_id bigint references archivo(id), orden int, primary key (destacada_id, archivo_id));
create table ranking_mes (                    -- RN-CAP-052
  anio_mes char(7) not null, producto_id bigint not null references producto(id),
  unidades int not null, puesto smallint, primary key (anio_mes, producto_id)
);
create table mensaje_carta (                  -- «¿Cómo te fue?» (RN-CAP-061)
  id bigint generated always as identity primary key,
  tipo text not null check (tipo in ('COMENTARIO','SUGERENCIA','FELICITACION','QUEJA')),
  texto text not null, nombre text, contacto text,
  atendido_en timestamptz, atendido_por bigint
);

-- ---------- 5. Ofertas (FT-OFE-01..03) ---------------------------------
create table oferta (
  id bigint generated always as identity primary key,
  tipo text not null check (tipo in ('COMBO','LLEVA_PAGA','DESCUENTO')),
  nombre text not null unique,
  lleva int, paga int,                          -- LLEVA_PAGA (NEC-CAP-109)
  alcance_categoria_id bigint references categoria(id), alcance_producto_id bigint references producto(id),
  descuento_tipo text check (descuento_tipo in ('PORCENTAJE','MONTO')), descuento_valor numeric(12,2),
  compra_minima numeric(12,2),
  dias smallint[], hora_desde time, hora_hasta time, fecha_desde date, fecha_hasta date,  -- RN-CAP-132
  canales text[] not null default '{CARTA,ADMIN,BOT}', limite_usos int,   -- al llegar al límite se desactiva sola (FT-OFE-01)
  no_suma_beneficios boolean not null default false,                     -- DT-65
  orden int not null default 0, activo boolean not null default false
);
create table combo_precio (oferta_id bigint references oferta(id), tamano_valor_id bigint references lista_valor(id), precio numeric(12,2) not null, primary key (oferta_id, tamano_valor_id));
create table combo_parte (
  id bigint generated always as identity primary key,
  oferta_id bigint not null references oferta(id),
  tipo text not null check (tipo in ('A_ELECCION','UNA_DE','FIJO')),   -- NEC-CAP-066
  cantidad int not null default 1,
  categorias bigint[], productos bigint[]
);
create table regla_acumulacion (               -- RN-CAP-070, D-10
  id smallint primary key default 1 check (id = 1),
  cupon_con_descuento boolean not null default false,
  promo_con_descuento boolean not null default false,
  cupones_por_comprobante int not null default 2, texto_pie text
);
create table cupon (
  id bigint generated always as identity primary key,
  modo text not null check (modo in ('UNICO_COMPROBANTE','COMPARTIDO')),   -- RN-CAP-134
  codigo_base text not null unique,
  descuento_tipo text not null check (descuento_tipo in ('PORCENTAJE','MONTO')), descuento_valor numeric(12,2) not null,
  compra_minima numeric(12,2), categoria_id bigint, producto_id bigint, canales text[],
  requiere_cuenta boolean not null default false,
  dias_validez int,                              -- código único: vence a N días de la compra
  tope_usos int, max_por_cliente int,
  check (modo <> 'COMPARTIDO' or tope_usos is not null),
  orden int not null default 0, activo boolean not null default true
);
create table cupon_emitido (
  id bigint generated always as identity primary key,
  cupon_id bigint not null references cupon(id),
  codigo text not null unique,                   -- al azar, no correlativo (RN-CAP-133)
  pedido_origen_id bigint, vence_en timestamptz,
  estado text not null default 'VIGENTE' check (estado in ('VIGENTE','CANJEADO','VENCIDO','ANULADO')),
  canjeado_en timestamptz, pedido_canje_id bigint
);
create table cupon_canje_compartido (cupon_id bigint references cupon(id), pedido_id bigint, party_id bigint, en timestamptz default now(), primary key (cupon_id, pedido_id));

-- ---------- 6. Reparto y salón (FT-DEL-01, FT-SAL-01..03) --------------
create table zona_reparto (
  id bigint generated always as identity primary key,
  codigo text not null unique,                   -- Z2, Z3, Z4, Z5, Z7 (V9)
  poligono jsonb not null,                       -- [[lat,lng],…] (RN-CAP-122)
  tarifa numeric(12,2) not null, activa boolean not null default true
);
create table piso (id bigint generated always as identity primary key, nombre text not null, activo boolean not null default true, cuadricula_ancho int not null, cuadricula_alto int not null);
create table elemento_plano (                   -- se puede eliminar (RN-CAP-014, excepción)
  id bigint generated always as identity primary key,
  piso_id bigint not null references piso(id),
  tipo text not null check (tipo in ('MESA','COCINA','BARRA','BANO','PARED','ENTRADA','OTRO')),
  x int not null, y int not null, ancho int not null, alto int not null,
  numero int, asientos int, activo boolean not null default true
);
create unique index ux_mesa_numero on elemento_plano (numero) where tipo = 'MESA';
create table reserva (
  id bigint generated always as identity primary key,
  nombre text not null, telefono text not null, personas int not null check (personas > 0),
  hora timestamptz not null, tolerancia_min int not null,
  estado text not null default 'ACTIVA' check (estado in ('ACTIVA','SENTADA','NO_ASISTIO','CANCELADA')),
  motivo_cancelacion text, pedido_id bigint
);
create table reserva_mesa (reserva_id bigint references reserva(id), mesa_id bigint references elemento_plano(id), primary key (reserva_id, mesa_id));

-- ---------- 7. Pedidos, caja y cocina (FT-PED, FT-CAJ, FT-CIE, FT-COC) --
create table pedido (
  id bigint generated always as identity primary key,
  codigo text not null unique,                   -- corto, para el cliente
  canal text not null check (canal in ('CARTA','BOT','TELEFONO','MOSTRADOR','MOZO')),
  modalidad text not null check (modalidad in ('DELIVERY','RECOGER','MESA','LLEVAR')),
  estado text not null check (estado in ('POR_CONFIRMAR','EN_COCINA','LISTO','EN_CAMINO',      -- sin EN_PREPARACION: solo «Despejar» (DT-58)
                                         'ENTREGADO','EN_COORDINACION','COBRADO','RECHAZADO','ANULADO')),
  party_id bigint references party(id),          -- cliente si se identificó
  es_personal boolean not null default false,    -- pedido del personal (RN-CAP-106)
  -- copia de datos del momento (ADR-004)
  cliente_nombre text, cliente_telefono text,
  entrega_direccion text, entrega_referencia text, entrega_lat numeric(9,6), entrega_lng numeric(9,6),
  entrega_origen text check (entrega_origen in ('GPS','ESCRITA','MAPA','WHATSAPP','ENLACE','ASESOR')),   -- de dónde vino el punto (DT-79)
  zona_id bigint references zona_reparto(id),
  pago_preferido text, paga_con numeric(12,2),
  subtotal numeric(12,2) not null, descuento numeric(12,2) not null default 0,
  envio numeric(12,2), total numeric(12,2) not null,
  comprobante_tipo text not null default 'NOTA_VENTA' check (comprobante_tipo in ('NOTA_VENTA','BOLETA','FACTURA')),
  comprobante_doc text, comprobante_razon text, nota text,
  oferta_ids bigint[], cupon_emitido_id bigint, puntos_canjeados numeric(12,2) not null default 0,   -- DT-55
  pago_coordinado_en timestamptz, pago_coordinado_por bigint,   -- pedido de la carta: pago por coordinar (DT-57)
  despachado_en timestamptz, despachado_por bigint,             -- despacho (DT-58)
  confirmado_en timestamptz, confirmado_por bigint, pasa_cocina_en timestamptz, listo_en timestamptz,
  entregado_en timestamptz, anulado_en timestamptz, anulado_por bigint, motivo_anulacion text,
  anulacion_aprobada_por bigint,                 -- supervisora que puso su PIN (DT-61)
  creado_en timestamptz not null default now(),
  check (modalidad <> 'DELIVERY' or estado not in ('EN_CAMINO','ENTREGADO') or (entrega_lat is not null and zona_id is not null)),  -- RN-CAP-104; la carta va a cocina sin ubicación (DT-57)
  check (anulado_en is null or (motivo_anulacion is not null and anulacion_aprobada_por is not null))   -- DT-61
);
create table pedido_mesa (                      -- un pedido, varias mesas (RN-CAP-108)
  pedido_id bigint references pedido(id), mesa_id bigint references elemento_plano(id),
  abierta boolean not null default true, primary key (pedido_id, mesa_id)
);
create unique index ux_mesa_un_pedido_abierto on pedido_mesa (mesa_id) where abierta;   -- NEC-CAP-023, R-09
create table pedido_linea (
  id bigint generated always as identity primary key,
  pedido_id bigint not null references pedido(id),
  producto_id bigint references producto(id), oferta_id bigint references oferta(id), linea_combo_id bigint references pedido_linea(id),
  nombre text not null, tamano text, opciones jsonb not null default '[]', sabor text, nota text,
  cantidad int not null check (cantidad > 0), precio_unit numeric(12,2) not null,
  area_id bigint references area_cocina(id), adicional boolean not null default false,  -- comanda adicional (RN-CAP-090)
  nombres_persona text[],                        -- quién toma cada bebida, para la etiqueta (DT-57)
  check (nombres_persona is null or cardinality(nombres_persona) <= cantidad)
);
create table comanda_area (                     -- estado por área (RN-CAP-084)
  pedido_id bigint references pedido(id), area_id bigint references area_cocina(id),
  estado text not null default 'EN_COCINA' check (estado in ('EN_COCINA','DESPEJADA')),   -- un solo botón «Despejar» (DT-58)
  llego_en timestamptz not null default now(), despejada_en timestamptz, despejada_por bigint,
  devuelta_en timestamptz, devuelta_por bigint,  -- devuelta desde el Historial
  primary key (pedido_id, area_id)
);
create table comprobante_pago (                 -- capturas, carpeta privada (ADR-005, ADR-012)
  id bigint generated always as identity primary key,
  pedido_id bigint not null references pedido(id), archivo_id bigint not null references archivo(id),
  codigo_operacion text, estado text not null default 'POR_VALIDAR' check (estado in ('POR_VALIDAR','APROBADO','RECHAZADO')),
  decidido_por bigint, decidido_en timestamptz, motivo text
);
create table caja (
  id bigint generated always as identity primary key,
  fecha date not null unique, apertura numeric(12,2) not null default 0,   -- RN-CAP-077
  estado text not null default 'ABIERTA' check (estado in ('ABIERTA','CERRADA')),
  abierta_por bigint not null, cerrada_por bigint, cerrada_en timestamptz
);
create unique index ux_una_caja_abierta on caja (estado) where estado = 'ABIERTA';
create table cobro (
  id bigint generated always as identity primary key,
  pedido_id bigint not null unique references pedido(id),
  caja_id bigint not null references caja(id), total numeric(12,2) not null,
  credito_personal boolean not null default false, cobrado_por bigint not null, en timestamptz not null default now(),
  anulado_en timestamptz, anulado_por bigint, motivo_anulacion text
);
create table cobro_pago (                       -- pago mixto (RN-CAP-082)
  id bigint generated always as identity primary key,
  cobro_id bigint not null references cobro(id),
  medio text not null check (medio in ('EFECTIVO','YAPE','PLIN','TRANSFERENCIA','TARJETA','OTRO')),
  monto numeric(12,2) not null check (monto > 0), recibido numeric(12,2), vuelto numeric(12,2)
);
create table movimiento_caja (
  id bigint generated always as identity primary key,
  caja_id bigint not null references caja(id),
  tipo text not null check (tipo in ('INGRESO','EGRESO')), monto numeric(12,2) not null check (monto > 0),
  motivo text not null, anulado_en timestamptz, motivo_anulacion text
);
create table liquidacion (                      -- efectivo del repartidor (RN-CAP-088)
  id bigint generated always as identity primary key,
  caja_id bigint not null references caja(id), repartidor_party_id bigint not null references party(id),
  esperado numeric(12,2) not null, entregado numeric(12,2) not null, en timestamptz not null default now()
);
create table cierre_caja (                      -- no se edita ni borra (RN-CAP-080), ciego (DT-61)
  caja_id bigint primary key references caja(id),
  conteo jsonb not null,                         -- {"200":3,"100":0,…,"0.10":4}
  resultado text not null check (resultado in ('CUADRA','NO_CUADRA')),
  aprobado_por bigint,                           -- supervisora con PIN; obligatorio si no cuadra
  nota text,
  check (resultado = 'CUADRA' or aprobado_por is not null)
);
create table conteo_cierre (                    -- cada intento del arqueo ciego (DT-61)
  caja_id bigint references caja(id), intento smallint not null,
  conteo jsonb not null, medios jsonb not null,  -- lo que anotó el cajero; no ve lo esperado
  resultado text not null check (resultado in ('CUADRA','NO_CUADRA')),
  por bigint not null, en timestamptz not null default now(), primary key (caja_id, intento)
);
create table cierre_medio (
  caja_id bigint references cierre_caja(caja_id), medio text not null,
  sistema numeric(12,2) not null, visto numeric(12,2) not null,
  diferencia numeric(12,2) generated always as (visto - sistema) stored,
  primary key (caja_id, medio)
);
create table agotado (                          -- historial de agotados (FT-COC-03)
  id bigint generated always as identity primary key,
  producto_id bigint, opcion_id bigint, sabor_id bigint,
  alcance text not null check (alcance in ('HOY','INDEFINIDO')), desde timestamptz not null default now(),
  hasta timestamptz, por bigint not null
);
create table alta_demanda (
  id bigint generated always as identity primary key,
  minutos int not null check (minutos between 5 and 180), pausa boolean not null default false,   -- RN-CAP-113
  desde timestamptz not null default now(), hasta timestamptz, por bigint not null,   -- por: quién la activó, visible en todas las áreas (DT-58)
  area_id bigint references area_cocina(id)
);
create table print_job (                        -- ADR-002
  id bigint generated always as identity primary key,
  pedido_id bigint references pedido(id), area_id bigint references area_cocina(id),
  tipo text not null check (tipo in ('COMANDA','ETIQUETA_GENERAL','ETIQUETA_AREA','ETIQUETA_BEBIDA','PRECUENTA','COMPROBANTE','DESPACHO')),
  copia boolean not null default false, estado text not null default 'PENDIENTE' check (estado in ('PENDIENTE','IMPRESO','FALLIDO')),
  intentos int not null default 0, error text, en timestamptz not null default now()
);
create table asignacion_reparto (               -- uno solo lo toma (RN-CAP-024)
  pedido_id bigint primary key references pedido(id),
  repartidor_party_id bigint not null references party(id),
  tomado_en timestamptz not null default now(), salida_en timestamptz, llegado_en timestamptz, entregado_en timestamptz,   -- Tomar → En camino → He llegado → Entregado (DT-59)
  cobrado_efectivo numeric(12,2)
);
create table incidente_entrega (
  id bigint generated always as identity primary key,
  pedido_id bigint not null references pedido(id),
  motivo text not null check (motivo in ('NO_CONTESTA','DIRECCION_NO_ENCONTRADA')), intento int not null,
  en timestamptz not null default now(),
  cierre text check (cierre in ('REPROGRAMADO','DEVUELTO','COBRADO_IGUAL')), recargo numeric(12,2), cerrado_por bigint,
  contactos jsonb not null default '[]',         -- cada llamada o WhatsApp con su hora (DT-70)
  foto_archivo_id bigint references archivo(id)  -- foto opcional de la puerta, carpeta privada; se conserva como la auditoría (DT-70)
);
create table mensaje_reparto (                  -- avisos al cliente al salir y al llegar (DT-60)
  pedido_id bigint references pedido(id), numero smallint check (numero between 1 and 3),
  enviado_en timestamptz not null default now(), respondido_en timestamptz,
  estado text not null default 'ENVIADO' check (estado in ('ENVIADO','RESPONDIDO','FALLIDO')),
  primary key (pedido_id, numero)
);
create table consumo_personal (                 -- crédito del personal; se ve por semana o rango (RN-CAP-131, DT-63)
  id bigint generated always as identity primary key,
  party_id bigint not null references party(id), fecha date not null,
  pedido_id bigint not null unique references pedido(id), monto numeric(12,2) not null
);
create table movimiento_puntos (
  id bigint generated always as identity primary key,
  party_id bigint not null references party(id), pedido_id bigint references pedido(id),
  puntos numeric(12,2) not null,                 -- 5 % del total (DT-55)
  tipo text not null check (tipo in ('SUMA','REVERSA','CANJE','DEVOLUCION_CANJE')),
  en timestamptz not null default now(),
  unique (pedido_id, tipo)                       -- suma una sola vez (RN-CAP-072)
);

-- ---------- 8. Stock, almacén, producción y compras -------------------
create table lugar_stock (id bigint generated always as identity primary key, nombre text not null unique, tipo text not null check (tipo in ('ALMACEN','AREA')), area_id bigint references area_cocina(id));
create table insumo (
  id bigint generated always as identity primary key,
  nombre text not null unique,
  unidad_compra text not null, unidad_almacen text not null, unidad_receta text not null,
  factor_compra numeric(14,3) not null,          -- 1 unidad de compra = N de almacén
  factor_receta numeric(14,6) not null,          -- 1 de almacén = N de receta
  minimo numeric(14,3) not null, intermedio numeric(14,3), maximo numeric(14,3) not null,
  lugar_consumo_id bigint references lugar_stock(id),
  costo_unit numeric(12,4), proveedor_a bigint, proveedor_b bigint, proveedor_c bigint,
  check (proveedor_a is distinct from proveedor_b and proveedor_a is distinct from proveedor_c
         and (proveedor_b is null or proveedor_b is distinct from proveedor_c)),         -- RN-CAP-082 (2.ª)
  activo boolean not null default true
);
create table stock (                            -- por lugar (RN-CAP-127)
  insumo_id bigint references insumo(id), producto_id bigint references producto(id),
  lugar_id bigint not null references lugar_stock(id),
  cantidad numeric(14,3) not null,               -- puede ser negativa en un área por venta («avisar y dejar vender»)
  check (num_nonnulls(insumo_id, producto_id) = 1)
);
create unique index ux_stock on stock (coalesce(insumo_id, 0), coalesce(producto_id, 0), lugar_id);
create table movimiento_stock (                 -- RNF-CAP-020
  id bigint generated always as identity primary key,
  tipo text not null check (tipo in ('ENTRADA','SALIDA','MERMA','DEVOLUCION','VENTA','PRODUCCION_CONSUMO','PRODUCCION_ALTA',
                                    'TRASLADO_SALIDA','TRASLADO_ENTRADA','DIFERENCIA_CONTEO','ANULACION')),
  insumo_id bigint references insumo(id), producto_id bigint references producto(id),
  lugar_id bigint not null references lugar_stock(id), cantidad numeric(14,3) not null,
  origen_valor_id bigint references lista_valor(id), destino_valor_id bigint references lista_valor(id),
  pedido_id bigint, produccion_id bigint, traslado_id bigint, compra_id bigint, nota text,
  movimiento_anulado_id bigint references movimiento_stock(id),
  por bigint not null, en timestamptz not null default now()
);
create table receta (
  id bigint generated always as identity primary key,
  producto_id bigint not null references producto(id), tamano_valor_id bigint references lista_valor(id),
  es_produccion boolean not null default false, rinde numeric(14,3),   -- receta por tanda (NEC-CAP-081)
  unique (producto_id, tamano_valor_id, es_produccion)
);
create table receta_linea (receta_id bigint references receta(id), insumo_id bigint references insumo(id), cantidad numeric(14,3) not null, primary key (receta_id, insumo_id));
create table ajuste_opcion (                    -- opción que suma, quita o reemplaza (NEC-CAP-088)
  opcion_id bigint references opcion(id), insumo_id bigint references insumo(id),
  efecto text not null check (efecto in ('SUMA','QUITA','REEMPLAZA')), reemplaza_insumo_id bigint references insumo(id),
  cantidad numeric(14,3), primary key (opcion_id, insumo_id)
);
create table traslado (
  id bigint generated always as identity primary key,
  insumo_id bigint not null references insumo(id), destino_lugar_id bigint not null references lugar_stock(id),
  enviado numeric(14,3) not null, recibido numeric(14,3),
  estado text not null default 'POR_RECIBIR' check (estado in ('POR_RECIBIR','RECIBIDO')),
  pedido_interno_id bigint, recibido_por bigint, recibido_en timestamptz
);
create table pedido_interno (id bigint generated always as identity primary key, area_id bigint not null references area_cocina(id), detalle jsonb not null, estado text not null default 'PENDIENTE' check (estado in ('PENDIENTE','RECIBIDO','ENTREGADO')), por bigint not null, en timestamptz default now(),
  avisado_party_id bigint references party(id), recibido_por bigint, recibido_en timestamptz);   -- suena hasta «Recibido»; WhatsApp a quien está de turno (DT-64)
create table produccion (
  id bigint generated always as identity primary key,
  receta_id bigint not null references receta(id), tandas numeric(8,2) not null check (tandas > 0),
  unidades numeric(14,3) not null, producido_en timestamptz not null default now(), por bigint not null,
  anulado_en timestamptz, motivo_anulacion text
);
create table cierre_dia (id bigint generated always as identity primary key, fecha date not null, lugar_id bigint not null references lugar_stock(id), detalle jsonb not null, por bigint not null, en timestamptz default now(), unique (fecha, lugar_id));
create table pedido_proveedor (
  id bigint generated always as identity primary key,
  proveedor_party_id bigint not null references party(id),
  estado text not null default 'POR_RECIBIR' check (estado in ('POR_RECIBIR','PARCIAL','RECIBIDO','ANULADO')),
  enviado_en timestamptz default now(), motivo_anulacion text
);
create table pedido_proveedor_linea (pedido_proveedor_id bigint references pedido_proveedor(id), insumo_id bigint references insumo(id), cantidad_compra numeric(14,3) not null, recibido numeric(14,3) not null default 0, primary key (pedido_proveedor_id, insumo_id));
create unique index ux_insumo_un_pedido_abierto on pedido_proveedor_linea (insumo_id) where recibido = 0;  -- aviso RN-CAP-137 (aprox.; se afina en G3)
create table compra (
  id bigint generated always as identity primary key,
  proveedor_party_id bigint not null references party(id), pedido_proveedor_id bigint references pedido_proveedor(id),
  comprobante_tipo text not null, comprobante_numero text not null, archivo_id bigint references archivo(id),
  condicion text not null check (condicion in ('CONTADO','CREDITO')), total numeric(12,2) not null,
  pagada_en timestamptz, anulada_en timestamptz, motivo_anulacion text,
  unique (proveedor_party_id, comprobante_tipo, comprobante_numero)
);
create table compra_linea (
  id bigint generated always as identity primary key,
  compra_id bigint not null references compra(id), insumo_id bigint not null references insumo(id),
  cantidad_compra numeric(14,3) not null, costo_unit numeric(12,4) not null   -- sin lote ni vencimiento (DT-64)
);

-- ---------- 9. Bot, atención y notificaciones -------------------------
create table conversacion (
  id bigint generated always as identity primary key,
  telefono text not null unique, party_id bigint references party(id),
  duenio text not null default 'BOT' check (duenio in ('BOT','PERSONA')),   -- RN-CAP-102
  tomado_por bigint, tomado_en timestamptz, urgente boolean not null default false,
  estado text not null default 'ABIERTA' check (estado in ('ABIERTA','VALIDAR_PAGO','ATENDIDA')),
  flujo jsonb,                                   -- estado de la máquina del bot y carrito
  ultima_actividad timestamptz not null default now()
);
create table mensaje_chat (
  id bigint generated always as identity primary key,
  conversacion_id bigint not null references conversacion(id),
  direccion text not null check (direccion in ('ENTRA','SALE')), autor text not null check (autor in ('CLIENTE','BOT','PERSONA')),
  tipo text not null, contenido jsonb not null, meta_id text unique, en timestamptz not null default now()
);
create table respuesta_rapida (id bigint generated always as identity primary key, titulo text not null unique, texto text not null, activo boolean not null default true);
create table solicitud_reserva (id bigint generated always as identity primary key, conversacion_id bigint references conversacion(id), personas int, hora timestamptz, estado text not null default 'PENDIENTE' check (estado in ('PENDIENTE','APROBADA','RECHAZADA')), reserva_id bigint references reserva(id));
create table solicitud_cambio (id bigint generated always as identity primary key, pedido_id bigint not null references pedido(id), tipo text not null check (tipo in ('DIRECCION','PEDIDO','CANCELAR')), detalle text, estado text not null default 'PENDIENTE' check (estado in ('PENDIENTE','ACEPTADA','RECHAZADA')), decidido_por bigint, motivo text);
create table encuesta (id bigint generated always as identity primary key, pedido_id bigint not null unique references pedido(id), nota smallint check (nota between 1 and 5), comentario text, derivada boolean not null default false, enviada_en timestamptz, respondida_en timestamptz);
create table uso_externo (id bigint generated always as identity primary key, servicio text not null check (servicio in ('OPENAI','WHATSAPP_PLANTILLA','GOOGLE_PLACES')), unidades int not null, costo_usd numeric(10,4), en timestamptz not null default now());
create table notificacion (
  id bigint generated always as identity primary key,
  tipo text not null, rol_destino text references rol(codigo), party_destino bigint references party(id),
  titulo text not null, enlace text, leida_en timestamptz, en timestamptz not null default now()
);

-- ---------- 10. Legal (FT-LEG-01/02) ------------------------------------
create table reclamo (
  id bigint generated always as identity primary key,
  numero text not null unique, tipo text not null check (tipo in ('RECLAMO','QUEJA')),
  nombre text not null, documento text not null, domicilio text not null, contacto text not null,
  detalle text not null, pedido_id bigint references pedido(id),
  vence_respuesta date not null, respuesta text, respondido_en timestamptz, respondido_por bigint
);
create table data_request (id bigint generated always as identity primary key, party_id bigint not null references party(id), tipo text not null check (tipo in ('EXPORTAR','ANONIMIZAR')), estado text not null default 'PENDIENTE', en timestamptz default now());

-- ---------- 10b. Iniciativas del equipo (FT-INI-01, DT-53) --------------
-- Todo el personal ve y comenta; solo ADMIN cambia el estado. Nada se borra.
-- Cada acción se registra en auditoria con @Auditar('iniciativas', ...) (ADR-014).
create table iniciativa (
  id bigint generated always as identity primary key,
  codigo text not null unique,                  -- IN-0001
  tipo text not null check (tipo in ('QUEJA','MEJORA','IDEA')),
  area text not null check (area in ('CARTA_WEB','PEDIDOS_CAJA','COCINA','REPARTO','ALMACEN_COMPRAS','OTRO')),
  titulo text not null check (char_length(titulo) between 1 and 80),
  detalle text not null check (char_length(detalle) between 1 and 600),
  archivo_id bigint references archivo(id),     -- la captura (archivo privado, ADR-012)
  estado text not null default 'NUEVA' check (estado in ('NUEVA','EN_REVISION','HECHA','NO_POR_AHORA')),
  creado_en timestamptz not null default now(),
  creado_por bigint not null references user_account(id),
  estado_cambiado_en timestamptz,
  estado_cambiado_por bigint references user_account(id)
);
create index iniciativa_estado_idx on iniciativa(estado, creado_en desc);
create table iniciativa_comentario (
  id bigint generated always as identity primary key,
  iniciativa_id bigint not null references iniciativa(id),
  texto text not null check (char_length(texto) between 1 and 400),
  creado_en timestamptz not null default now(),
  creado_por bigint not null references user_account(id)
);
create index iniciativa_comentario_idx on iniciativa_comentario(iniciativa_id, creado_en);

-- ---------- 11. Vistas de lectura (ADR-004) ------------------------------
create view vw_clientes as
  select p.id party_id, coalesce(pe.nombres || ' ' || coalesce(pe.apellidos,''), o.razon_social) nombre,
         di.tipo doc_tipo, di.numero doc_numero, cd.puntos, (ca.id is not null) con_cuenta
  from party p join party_role r on r.party_id = p.id and r.rol = 'CLIENTE' and r.hasta is null
  left join person pe on pe.party_id = p.id left join organization o on o.party_id = p.id
  left join party_identifier di on di.party_id = p.id
  left join customer_detail cd on cd.party_role_id = r.id left join customer_account ca on ca.party_id = p.id;
create view vw_personal as
  select p.id party_id, pe.nombres, pe.apellidos, di.numero dni, u.rol, u.activo, u.alta_en
  from user_account u join party p on p.id = u.party_id join person pe on pe.party_id = p.id
  left join party_identifier di on di.party_id = p.id and di.tipo = 'DNI';
create view vw_proveedores as
  select p.id party_id, o.razon_social, di.numero ruc, sd.dias_credito, sd.cuenta_pago, sd.activo
  from party p join party_role r on r.party_id = p.id and r.rol = 'PROVEEDOR' and r.hasta is null
  join organization o on o.party_id = p.id left join party_identifier di on di.party_id = p.id and di.tipo = 'RUC'
  left join supplier_detail sd on sd.party_role_id = r.id;
