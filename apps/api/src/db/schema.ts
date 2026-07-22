import { sql } from "drizzle-orm";
import {
	integer,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
	check,
	index,
	uniqueIndex,
} from "drizzle-orm/pg-core";

export const sessionStatusEnum = pgEnum("session_status", [
	"open",
	"booked",
	"completed",
	"cancelled",
]);

export const sessionRequestStatusEnum = pgEnum("session_request_status", [
	"pending",
	"approved",
	"declined",
	"cancelled",
]);

export const profiles = pgTable("profiles", {
	id: uuid("id").primaryKey(),
	displayName: text("display_name"),
	username: text("username").unique(),
	bio: text("bio"),
	avatarKey: text("avatar_key"),
	nativeLanguage: text("native_language"),
	learningLanguage: text("learning_language"),
	timezone: text("timezone"),
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

export const sessions = pgTable(
	"sessions",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		ownerId: uuid("owner_id")
			.notNull()
			.references(() => profiles.id, {
				onDelete: "restrict",
			}),
		title: text("title").notNull(),
		targetLanguage: text("target_language").notNull(),
		helpLanguage: text("help_language").notNull(),
		startsAt: timestamp("starts_at", {
			withTimezone: true,
		}).notNull(),
		durationMinutes: integer("duration_minutes").notNull(),
		status: sessionStatusEnum("status").default("open").notNull(),
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
	},
	(table) => [
		check(
			"sessions_duration_minutes_check",
			sql`${table.durationMinutes} BETWEEN 15 AND 120`,
		),
		uniqueIndex("sessions_owner_active_start_unique_idx")
			.on(table.ownerId, table.startsAt)
			.where(sql`${table.status} IN ('open', 'booked')`),
		index("sessions_open_starts_at_id_idx")
			.on(table.startsAt, table.id)
			.where(sql`${table.status} = 'open'`),

		index("sessions_owner_starts_at_id_idx").on(
			table.ownerId,
			table.startsAt,
			table.id,
		),
	],
);

export const sessionRequests = pgTable(
	"session_requests",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		sessionId: uuid("session_id")
			.notNull()
			.references(() => sessions.id, {
				onDelete: "cascade",
			}),
		requesterId: uuid("requester_id")
			.notNull()
			.references(() => profiles.id, {
				onDelete: "restrict",
			}),
		status: sessionRequestStatusEnum("status").default("pending").notNull(),
		message: text("message"),
		createdAt: timestamp("created_at", {
			withTimezone: true,
		})
			.defaultNow()
			.notNull(),
		respondedAt: timestamp("responded_at", {
			withTimezone: true,
		}),
		updatedAt: timestamp("updated_at", {
			withTimezone: true,
		})
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("session_requests_one_approved_idx")
			.on(table.sessionId)
			.where(sql`${table.status} = 'approved'`),

		uniqueIndex("session_requests_one_active_per_user_idx")
			.on(table.sessionId, table.requesterId)
			.where(sql`${table.status} IN ('pending', 'approved')`),

		index("session_requests_session_status_idx").on(
			table.sessionId,
			table.status,
		),

		index("session_requests_requester_status_idx").on(
			table.requesterId,
			table.status,
			table.createdAt,
		),
	],
);

export type InsertSession = typeof sessions.$inferInsert;
export type SelectSession = typeof sessions.$inferSelect;
export type InsertProfile = typeof profiles.$inferInsert;
export type SelectProfile = typeof profiles.$inferSelect;
export type InsertSessionRequest = typeof sessionRequests.$inferInsert;
export type SelectSessionRequest = typeof sessionRequests.$inferSelect;
