-- Creates ScholarPath app user (run once as postgres superuser)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'scholarpath') THEN
    CREATE ROLE scholarpath WITH LOGIN PASSWORD 'scholarpath';
  END IF;
END
$$;
