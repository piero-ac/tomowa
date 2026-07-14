import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const sessions = pgTable("sessions", {
	id: uuid("id").defaultRandom().primaryKey(),
	organizerId: uuid("organizer_id").notNull(),
	title: text("title").notNull(),
	targetLanguage: text("target_language").notNull(),
	helpLanguage: text("help_language").notNull(),
	startsAt: timestamp("starts_at", {
		withTimezone: true,
	}).notNull(),
	capacity: integer("capacity").notNull(),
	meetingLink: text("meeting_link").notNull(),
	imageKey: text("image_key"),
	description: text("description").notNull(),
	createdAt: timestamp("created_at", {
		withTimezone: true,
	})
		.defaultNow()
		.notNull(),
	updatedAt: timestamp("updated_at", {
		withTimezone: true,
	})
		.defaultNow()
		.notNull(),
});

export type InsertSession = typeof sessions.$inferInsert;
export type SelectSession = typeof sessions.$inferSelect;
