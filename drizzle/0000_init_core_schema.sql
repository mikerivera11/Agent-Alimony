CREATE TYPE "public"."document_storage_provider" AS ENUM('local', 'azure');--> statement-breakpoint
CREATE TYPE "public"."extraction_proposal_status" AS ENUM('proposed', 'confirmed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."extraction_run_status" AS ENUM('pending', 'completed', 'failed', 'not_processed');--> statement-breakpoint
CREATE TYPE "public"."participant_role" AS ENUM('petitioner', 'respondent');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid,
	"case_id" uuid,
	"action" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "browser_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"rotated_from_id" uuid,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "calculation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"case_revision" integer NOT NULL,
	"engine_version" text NOT NULL,
	"inputs" jsonb NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_children" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"display_name" text,
	"date_of_birth" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"role" "participant_role" NOT NULL,
	"display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"draft" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"storage_provider" "document_storage_provider" NOT NULL,
	"object_key" text NOT NULL,
	"display_filename" text NOT NULL,
	"declared_mime_type" text NOT NULL,
	"detected_mime_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"sha256" text NOT NULL,
	"source_expires_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extraction_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"extraction_run_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"field_key" text NOT NULL,
	"value" jsonb NOT NULL,
	"confirmed_value" jsonb,
	"source_document_id" uuid NOT NULL,
	"source_page" integer,
	"source_location" jsonb,
	"confidence" numeric(4, 3) NOT NULL,
	"status" "extraction_proposal_status" DEFAULT 'proposed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "extraction_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"adapter" text NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"status" "extraction_run_status" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "generated_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"case_revision" integer NOT NULL,
	"storage_provider" "document_storage_provider" NOT NULL,
	"object_key" text NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_session_id_browser_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."browser_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calculation_runs" ADD CONSTRAINT "calculation_runs_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_children" ADD CONSTRAINT "case_children_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_participants" ADD CONSTRAINT "case_participants_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_session_id_browser_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."browser_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_session_id_browser_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."browser_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_proposals" ADD CONSTRAINT "extraction_proposals_extraction_run_id_extraction_runs_id_fk" FOREIGN KEY ("extraction_run_id") REFERENCES "public"."extraction_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_proposals" ADD CONSTRAINT "extraction_proposals_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_proposals" ADD CONSTRAINT "extraction_proposals_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_runs" ADD CONSTRAINT "extraction_runs_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_runs" ADD CONSTRAINT "extraction_runs_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_packages" ADD CONSTRAINT "generated_packages_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_session_id_idx" ON "audit_log" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "audit_log_case_id_idx" ON "audit_log" USING btree ("case_id");--> statement-breakpoint
CREATE UNIQUE INDEX "browser_sessions_token_hash_idx" ON "browser_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "browser_sessions_expires_at_idx" ON "browser_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "calculation_runs_case_id_idx" ON "calculation_runs" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "case_children_case_id_idx" ON "case_children" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "case_participants_case_id_idx" ON "case_participants" USING btree ("case_id");--> statement-breakpoint
CREATE UNIQUE INDEX "case_participants_case_id_role_idx" ON "case_participants" USING btree ("case_id","role");--> statement-breakpoint
CREATE INDEX "cases_session_id_idx" ON "cases" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "documents_case_id_idx" ON "documents" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "documents_session_id_idx" ON "documents" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_object_key_idx" ON "documents" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "documents_source_expires_at_idx" ON "documents" USING btree ("source_expires_at");--> statement-breakpoint
CREATE INDEX "extraction_proposals_case_id_idx" ON "extraction_proposals" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "extraction_proposals_run_id_idx" ON "extraction_proposals" USING btree ("extraction_run_id");--> statement-breakpoint
CREATE INDEX "extraction_proposals_status_idx" ON "extraction_proposals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "extraction_runs_case_id_idx" ON "extraction_runs" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "extraction_runs_document_id_idx" ON "extraction_runs" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "generated_packages_case_id_idx" ON "generated_packages" USING btree ("case_id");--> statement-breakpoint
CREATE UNIQUE INDEX "generated_packages_object_key_idx" ON "generated_packages" USING btree ("object_key");