# Prisma Migration Recovery

Use this only when Prisma migration history is blocked but the schema change is already present in the database.

## Local case fixed on 2026-05-04

The local `library_system` database already had the material-indexing schema from
`20260503000001_add_material_indexing`, but `_prisma_migrations` still contained
failed entries for that migration. That blocked later migrations, including
`20260504093000_add_book_pdf_indexing`.

## Symptoms

- `npx prisma migrate deploy` fails with `P3018`
- the database error says a column or object from the migration already exists
- `_prisma_migrations` shows failed or rolled-back rows for the same migration name

## Recovery steps

Run from `apps/api`:

```powershell
npx prisma migrate resolve --rolled-back 20260503000001_add_material_indexing
npx prisma migrate resolve --applied 20260503000001_add_material_indexing
npx prisma migrate deploy
```

## Verify before doing this

Only use the `--applied` step if the schema from that migration is already present in the target database.

Useful checks:

```sql
select migration_name, finished_at is not null, rolled_back_at is not null
from _prisma_migrations
order by started_at;
```

```sql
select column_name
from information_schema.columns
where table_name = 'materials'
  and column_name in ('indexStatus');
```

## Expected outcome

- migration history is unblocked
- later migrations can be applied normally
- no manual schema rollback is required
```
