CREATE TYPE "public"."identity_provider" AS ENUM('google');--> statement-breakpoint
CREATE TABLE "auth_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state_hash" text NOT NULL,
	"code_verifier" text NOT NULL,
	"nonce" text NOT NULL,
	"redirect_path" text DEFAULT '/' NOT NULL,
	"session_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"draft" jsonb NOT NULL,
	"restored_from_revision" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "identity_provider" NOT NULL,
	"subject" text NOT NULL,
	"email" text,
	"display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "browser_sessions" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "auth_requests" ADD CONSTRAINT "auth_requests_session_id_browser_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."browser_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_revisions" ADD CONSTRAINT "case_revisions_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_requests_state_hash_idx" ON "auth_requests" USING btree ("state_hash");--> statement-breakpoint
CREATE INDEX "auth_requests_expires_at_idx" ON "auth_requests" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "case_revisions_case_id_idx" ON "case_revisions" USING btree ("case_id");--> statement-breakpoint
CREATE UNIQUE INDEX "case_revisions_case_id_revision_idx" ON "case_revisions" USING btree ("case_id","revision");--> statement-breakpoint
CREATE UNIQUE INDEX "users_provider_subject_idx" ON "users" USING btree ("provider","subject");--> statement-breakpoint
ALTER TABLE "browser_sessions" ADD CONSTRAINT "browser_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "browser_sessions_user_id_idx" ON "browser_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cases_user_id_idx" ON "cases" USING btree ("user_id");