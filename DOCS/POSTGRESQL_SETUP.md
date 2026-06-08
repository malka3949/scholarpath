# PostgreSQL Setup — ScholarPath

## מה צריך

| דבר | פרטים |
|-----|--------|
| **PostgreSQL** | מותקן אצלך (גרסה 17 ב-`C:\Program Files\PostgreSQL\17`) |
| **שירות** | `postgresql-x64-17` — חייב להיות **Running** |
| **פורט** | `5432` |
| **DB name** | `scholarpath` |
| **App user** | `scholarpath` / סיסמה: `scholarpath` |
| **Superuser** | `postgres` + **הסיסמה שהגדרת בהתקנה** |

---

## שלב 1 — הוסף סיסמה ל-`.env`

פתח `c:\Users\user1\Desktop\scholar\.env` ועדכן:

```env
POSTGRES_SUPERUSER_PASSWORD=YOUR_POSTGRES_PASSWORD
DATABASE_URL="postgresql://scholarpath:scholarpath@localhost:5432/scholarpath?schema=public"
```

`YOUR_POSTGRES_PASSWORD` = הסיסמה שבחרת כשהתקנת PostgreSQL 17.

**לא זוכר?**
1. פתח **pgAdmin 4** (מותקן עם PostgreSQL)
2. או: Services → PostgreSQL 17 → Properties → Log On (לא עוזר לסיסמה)
3. אפשרות: איפוס סיסמה דרך `pg_hba.conf` (מתקדם)

---

## שלב 2 — הרץ פקודות (מהתיקייה `scholar`)

```powershell
cd c:\Users\user1\Desktop\scholar

npm run db:setup      # יוצר user + database scholarpath
npm run db:migrate    # מריץ migrations
npm run db:seed       # 50 מלגות + משתמשי demo
npm run dev           # מפעיל את האתר
```

---

## שלב 3 — בדיקה

| בדיקה | צפוי |
|--------|------|
| http://localhost:3000 | דף בית |
| http://localhost:3001/api/scholarships | JSON עם מלגות |
| Login | `student@scholarpath.local` / `student123` |

---

## אם `db:setup` נכשל

**"password authentication failed for user postgres"**
→ סיסמה שגויה ב-`POSTGRES_SUPERUSER_PASSWORD`

**"database scholarpath does not exist"**
→ הרץ `npm run db:setup` שוב

**"relation does not exist"**
→ הרץ `npm run db:migrate` ואז `npm run db:seed`

---

## Docker (חלופה)

אם מעדיפים Docker Desktop:

```bash
docker compose up -d
npm run db:migrate
npm run db:seed
```

(אין צורך ב-`db:setup` — Docker יוצר user/db מה-`docker-compose.yml`)

---

## קבצים רלוונטיים

| קובץ | תפקיד |
|------|--------|
| `.env` | `DATABASE_URL` + `POSTGRES_SUPERUSER_PASSWORD` |
| `docker-compose.yml` | PostgreSQL ב-Docker |
| `scripts/setup-postgres.ps1` | יצירת DB מקומי |
| `packages/database/prisma/migrations/` | schema migrations |
