CREATE TYPE "session_request_status" AS ENUM('pending', 'approved', 'declined', 'cancelled');--> statement-breakpoint
CREATE TYPE "session_status" AS ENUM('open', 'booked', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY,
	"display_name" text,
	"username" text UNIQUE,
	"bio" text,
	"avatar_key" text,
	"native_language" text,
	"learning_language" text,
	"timezone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "public"."profiles" ("id")
SELECT "id"
FROM "auth"."users"
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "public"."profiles"
ADD CONSTRAINT "profiles_id_auth_users_id_fkey"
FOREIGN KEY ("id")
REFERENCES "auth"."users"("id")
ON DELETE CASCADE;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."handle_new_user_profile"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
	INSERT INTO "public"."profiles" (
		"id",
		"display_name"
	)
	VALUES (
		NEW."id",
		NULLIF(
			BTRIM(NEW."raw_user_meta_data" ->> 'display_name'),
			''
		)
	)
	ON CONFLICT ("id") DO NOTHING;

	RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "on_auth_user_created_profile"
ON "auth"."users";
--> statement-breakpoint
CREATE TRIGGER "on_auth_user_created_profile"
AFTER INSERT ON "auth"."users"
FOR EACH ROW
EXECUTE FUNCTION "public"."handle_new_user_profile"();
--> statement-breakpoint
CREATE TABLE "session_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"session_id" uuid NOT NULL,
	"requester_id" uuid NOT NULL,
	"status" "session_request_status" DEFAULT 'pending'::"session_request_status" NOT NULL,
	"message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" RENAME COLUMN "organizer_id" TO "owner_id";--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "duration_minutes" integer DEFAULT 30 NOT NULL; --> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "duration_minutes" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "status" "session_status" DEFAULT 'open'::"session_status" NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" DROP COLUMN "capacity";--> statement-breakpoint
CREATE UNIQUE INDEX "session_requests_one_approved_idx" ON "session_requests" ("session_id") WHERE "status" = 'approved';--> statement-breakpoint
CREATE UNIQUE INDEX "session_requests_one_active_per_user_idx" ON "session_requests" ("session_id","requester_id") WHERE "status" IN ('pending', 'approved');--> statement-breakpoint
CREATE INDEX "session_requests_session_status_idx" ON "session_requests" ("session_id","status");--> statement-breakpoint
CREATE INDEX "session_requests_requester_status_idx" ON "session_requests" ("requester_id","status","created_at");--> statement-breakpoint
CREATE INDEX "sessions_open_starts_at_id_idx" ON "sessions" ("starts_at","id") WHERE "status" = 'open';--> statement-breakpoint
CREATE INDEX "sessions_owner_starts_at_id_idx" ON "sessions" ("owner_id","starts_at","id");--> statement-breakpoint
ALTER TABLE "session_requests" ADD CONSTRAINT "session_requests_session_id_sessions_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "session_requests" ADD CONSTRAINT "session_requests_requester_id_profiles_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "profiles"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_owner_id_profiles_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_duration_minutes_check" CHECK ("duration_minutes" BETWEEN 15 AND 120);--> statement-breakpoint
ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."session_requests" ENABLE ROW LEVEL SECURITY;