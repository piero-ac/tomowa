import { z } from "zod";

import { BadRequestError } from "../errors/index.js";
import type { PageCursor, PaginatedResponse } from "../types/pagination.js";

const cursorPayloadSchema = z
	.object({
		version: z.literal(1),
		sortValue: z.iso.datetime(),
		id: z.uuid(),
	})
	.strict();

export function encodeCursor(cursor: PageCursor) {
	const payload = JSON.stringify({
		version: 1,
		sortValue: cursor.sortValue.toISOString(),
		id: cursor.id,
	});

	return Buffer.from(payload, "utf8").toString("base64url");
}

export function decodeCursor(value: string): PageCursor {
	try {
		const decoded = Buffer.from(value, "base64url").toString("utf8");

		const result = cursorPayloadSchema.safeParse(JSON.parse(decoded));

		if (!result.success) {
			throw new Error("Invalid cursor payload.");
		}

		return {
			sortValue: new Date(result.data.sortValue),
			id: result.data.id,
		};
	} catch {
		throw new BadRequestError("Invalid pagination cursor.");
	}
}

export function buildPaginatedResponse<TRow, TItem>(
	rows: TRow[],
	limit: number,
	mapItem: (row: TRow) => TItem,
	getCursor: (row: TRow) => PageCursor,
): PaginatedResponse<TItem> {
	const hasMore = rows.length > limit;
	const pageRows = rows.slice(0, limit);
	const lastRow = pageRows.at(-1);

	return {
		items: pageRows.map(mapItem),
		nextCursor: hasMore && lastRow ? encodeCursor(getCursor(lastRow)) : null,
	};
}
