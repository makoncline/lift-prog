# Database Notes

Turso db with Prisma ORM.

https://docs.turso.tech/sdk/ts/orm/prisma
https://www.prisma.io/docs/orm/overview/databases/turso

## Manual Turso Migrations

`prisma push` does not work on the Turso db, and Prisma Migrate is only used
locally to generate migration SQL. Do not apply a production migration until the
same SQL has passed a local rehearsal.

1. Create a Turso backup branch first.
2. Export or copy production to a disposable local SQLite rehearsal database.
3. Apply `prisma/migrations/<timestamp>_<name>/migration.sql` to that local
   rehearsal database.
4. Verify pre/post row counts for `Workout`, `WorkoutExercise`, and
   `WorkoutExerciseSet`.
5. Run `PRAGMA foreign_key_check;` and confirm it returns no rows.
6. Apply the same migration SQL to production only after the backup and local
   rehearsal checks pass.

Generate and apply the SQL manually:

```
npx prisma migrate dev --name <name>
turso db shell turso-prisma-db < ./<path to migration.sql>
```
