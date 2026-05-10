# SQLite Migrations

Sistema de migraciones SQL numerado, sin framework (Knex/Prisma/Drizzle deliberadamente descartados — ver `docs/architecture/02-schema-sqlite.md` §"Decisiones globales").

## Cómo funcionan

- Cada archivo `NNNN_descripcion.sql` se aplica en orden lexicográfico al arrancar.
- `runner.ts` registra cada aplicación en la tabla `_migrations(id, applied_at)`.
- **Idempotente**: correr `applyMigrations` N veces produce el mismo estado. Solo se aplican migraciones cuyo `id` aún no está en `_migrations`.
- **Atómico**: cada migration corre dentro de una transacción. Si falla, no queda nada aplicado a medias.

## Agregar una migration nueva

1. Crear archivo `NNNN_<descripcion>.sql` con el siguiente número disponible. Ejemplo: `0002_add_user_preferences.sql`.
2. Encabezado obligatorio: comentario `--` al tope explicando el QUÉ y el POR QUÉ.
3. Una idea por migration. Si tocás 3 tablas no relacionadas, son 3 migrations.
4. Marcá BREAKING changes explícitamente (ej. drops, renames, CHECK más estrictos).
5. **No downgrade scripts en MVP** — solo forward migrations. Si necesitás revertir, escribí una nueva migration que deshaga.

## Por qué no usamos un framework

- SQLite + ORM es históricamente frágil (Drizzle/Prisma generan SQL non-trivial para constraints que acá escribimos en 3 líneas).
- El schema vive en el repo como SQL plano: cualquier persona con `sqlite3` lo lee sin tooling.
- El runner son ~70 LOC sin dependencias. El costo cognitivo es menor que aprender el DSL de migraciones de cada framework.

## Convenciones

- Comentarios SQL al tope explicando el porqué.
- Usar `IF NOT EXISTS` solo para entidades que el runner puede crear (ej. `_migrations`).
- Indices y triggers en la misma migration que la tabla que los necesita.
- Nunca editar una migration ya aplicada en producción — escribí una nueva.
