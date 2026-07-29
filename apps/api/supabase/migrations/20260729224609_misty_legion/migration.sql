CREATE INDEX "session_requests_session_created_at_id_idx" ON "session_requests" ("session_id","created_at","id");--> statement-breakpoint
CREATE INDEX "session_requests_requester_created_at_id_idx" ON "session_requests" ("requester_id","created_at","id");--> statement-breakpoint
CREATE INDEX "sessions_booked_starts_at_id_idx" ON "sessions" ("starts_at","id") WHERE "status" = 'booked';