-- Function that returns a 10-char lowercase alphanumeric string (0-9, a-z).
-- Used as the DEFAULT for tasks.ticket_number.
CREATE OR REPLACE FUNCTION gen_ticket_number() RETURNS text
LANGUAGE sql
VOLATILE
AS $$
  SELECT string_agg(
    substr('0123456789abcdefghijklmnopqrstuvwxyz', floor(random() * 36 + 1)::int, 1),
    ''
  )
  FROM generate_series(1, 10);
$$;
--> statement-breakpoint

-- Add column nullable so existing rows can be backfilled.
ALTER TABLE "tasks" ADD COLUMN "ticket_number" text;--> statement-breakpoint

-- Backfill every existing row with a unique random ticket.
-- (Collision probability over thousands of rows in 36^10 space is negligible;
--  the UNIQUE constraint added below will catch the astronomically-unlikely case.)
UPDATE "tasks" SET "ticket_number" = gen_ticket_number() WHERE "ticket_number" IS NULL;--> statement-breakpoint

-- Lock down the column.
ALTER TABLE "tasks" ALTER COLUMN "ticket_number" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "ticket_number" SET DEFAULT gen_ticket_number();--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_ticket_number_unique" UNIQUE("ticket_number");
