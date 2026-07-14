import { db } from "../db/index.js";
import { sessions } from "../db/schema.js";

export async function getSessions() {
	return db.select().from(sessions);
}
