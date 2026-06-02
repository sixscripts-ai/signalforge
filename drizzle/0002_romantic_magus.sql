CREATE TABLE "import_template" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"schema_profile_id" text,
	"config" jsonb NOT NULL,
	"sample_headers" jsonb,
	"is_default" text DEFAULT 'false' NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "import_job" ADD COLUMN "import_template_id" text;--> statement-breakpoint
ALTER TABLE "import_job" ADD COLUMN "import_template_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "import_template" ADD CONSTRAINT "import_template_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_template" ADD CONSTRAINT "import_template_schema_profile_id_schema_profile_id_fk" FOREIGN KEY ("schema_profile_id") REFERENCES "public"."schema_profile"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_import_template_workspace_id" ON "import_template" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_import_template_is_default" ON "import_template" USING btree ("workspace_id","is_default");--> statement-breakpoint
ALTER TABLE "import_job" ADD CONSTRAINT "import_job_import_template_id_import_template_id_fk" FOREIGN KEY ("import_template_id") REFERENCES "public"."import_template"("id") ON DELETE set null ON UPDATE no action;