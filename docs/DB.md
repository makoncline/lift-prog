turso db with prisma ORM

https://docs.turso.tech/sdk/ts/orm/prisma
https://www.prisma.io/docs/orm/overview/databases/turso

to run migration on turso db
prisma push does not work on turso db so we need to use the following commands

```
npx prisma migrate dev --name <name>
turso db shell turso-prisma-db < ./<path to migration.sql>
```
