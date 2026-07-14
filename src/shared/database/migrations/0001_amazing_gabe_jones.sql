CREATE TABLE "email_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text,
	"from" text NOT NULL,
	"to" jsonb NOT NULL,
	"subject" text NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"message_id" text,
	"error_message" text,
	"entity_type" text,
	"entity_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "email_log_tenant_idx" ON "email_log" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "email_log_status_idx" ON "email_log" USING btree ("status");--> statement-breakpoint
CREATE INDEX "email_log_created_idx" ON "email_log" USING btree ("created_at");