CREATE TABLE "api_key" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"key_prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_job" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"filename" text NOT NULL,
	"source_type" text NOT NULL,
	"status" text NOT NULL,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"valid_rows" integer DEFAULT 0 NOT NULL,
	"auto_fixed_rows" integer DEFAULT 0 NOT NULL,
	"needs_review_rows" integer DEFAULT 0 NOT NULL,
	"duplicate_rows" integer DEFAULT 0 NOT NULL,
	"rejected_rows" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"error_message" text,
	"schema_profile_snapshot" jsonb
);
--> statement-breakpoint
CREATE TABLE "import_row" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"import_job_id" text NOT NULL,
	"row_index" integer NOT NULL,
	"status" text NOT NULL,
	"original_data" text NOT NULL,
	"cleaned_data" text,
	"issues" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "normalized_record" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"import_job_id" text NOT NULL,
	"external_id" text,
	"name" text,
	"email" text,
	"company" text,
	"category" text,
	"amount" double precision,
	"status" text,
	"dedupe_key" text NOT NULL,
	"source_row_index" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schema_profile" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"required_fields" jsonb NOT NULL,
	"field_mappings" jsonb NOT NULL,
	"cleanup_rules" jsonb NOT NULL,
	"validation_rules" jsonb NOT NULL,
	"dedupe_strategy" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"signing_secret" text NOT NULL,
	"events" jsonb NOT NULL,
	"active" text DEFAULT 'true' NOT NULL,
	"last_sent_at" timestamp with time zone,
	"last_status" text,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"token" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"invited_by_user_id" text NOT NULL,
	"accepted_by_user_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_invitation_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "workspace_member" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_job" ADD CONSTRAINT "import_job_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_row" ADD CONSTRAINT "import_row_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_row" ADD CONSTRAINT "import_row_import_job_id_import_job_id_fk" FOREIGN KEY ("import_job_id") REFERENCES "public"."import_job"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "normalized_record" ADD CONSTRAINT "normalized_record_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "normalized_record" ADD CONSTRAINT "normalized_record_import_job_id_import_job_id_fk" FOREIGN KEY ("import_job_id") REFERENCES "public"."import_job"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schema_profile" ADD CONSTRAINT "schema_profile_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook" ADD CONSTRAINT "webhook_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invitation" ADD CONSTRAINT "workspace_invitation_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_member" ADD CONSTRAINT "workspace_member_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_api_key_workspace_id" ON "api_key" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_import_job_workspace_id" ON "import_job" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_import_job_created_at" ON "import_job" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_import_job_status" ON "import_job" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_import_row_workspace_id" ON "import_row" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_import_row_import_job_id" ON "import_row" USING btree ("import_job_id");--> statement-breakpoint
CREATE INDEX "idx_import_row_status" ON "import_row" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_normalized_record_workspace_id" ON "normalized_record" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_normalized_record_dedupe_key" ON "normalized_record" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "idx_normalized_record_import_job_id" ON "normalized_record" USING btree ("import_job_id");--> statement-breakpoint
CREATE INDEX "idx_normalized_record_email" ON "normalized_record" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_normalized_record_created_at" ON "normalized_record" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_webhook_workspace_id" ON "webhook" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_workspace_invitation_workspace_id" ON "workspace_invitation" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_workspace_invitation_email" ON "workspace_invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_workspace_invitation_token" ON "workspace_invitation" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_workspace_member_user_id" ON "workspace_member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_workspace_member_workspace_id" ON "workspace_member" USING btree ("workspace_id");