import { describe, expect, it, vi } from "vitest";

import { BadRequestError } from "../../../src/errors/index.js";
import {
	buildPaginatedResponse,
	decodeCursor,
	encodeCursor,
} from "../../../src/lib/pagination.js";

const firstId = "10000000-0000-4000-8000-000000000001";
const secondId = "10000000-0000-4000-8000-000000000002";
const thirdId = "10000000-0000-4000-8000-000000000003";

describe("pagination cursors", () => {
	it("round-trips a cursor through encoding and decoding", () => {
		const cursor = {
			sortValue: new Date("2027-01-15T18:00:00.000Z"),
			id: firstId,
		};

		const encoded = encodeCursor(cursor);

		expect(encoded).not.toContain(cursor.sortValue.toISOString());
		expect(decodeCursor(encoded)).toEqual(cursor);
	});

	it("rejects a malformed cursor", () => {
		expect(() => decodeCursor("not-a-valid-cursor")).toThrow(
			BadRequestError,
		);
		expect(() => decodeCursor("not-a-valid-cursor")).toThrow(
			"Invalid pagination cursor.",
		);
	});

	it("rejects a decoded cursor with an invalid payload", () => {
		const invalidPayload = Buffer.from(
			JSON.stringify({
				version: 2,
				sortValue: "2027-01-15T18:00:00.000Z",
				id: firstId,
			}),
			"utf8",
		).toString("base64url");

		expect(() => decodeCursor(invalidPayload)).toThrow(BadRequestError);
		expect(() => decodeCursor(invalidPayload)).toThrow(
			"Invalid pagination cursor.",
		);
	});
});

describe("buildPaginatedResponse", () => {
	const rows = [
		{
			id: firstId,
			createdAt: new Date("2027-01-01T00:00:00.000Z"),
			value: "first",
		},
		{
			id: secondId,
			createdAt: new Date("2027-01-02T00:00:00.000Z"),
			value: "second",
		},
		{
			id: thirdId,
			createdAt: new Date("2027-01-03T00:00:00.000Z"),
			value: "third",
		},
	];

	it("returns only the requested page and builds a cursor from its last row", () => {
		const mapItem = vi.fn((row: (typeof rows)[number]) => row.value);
		const getCursor = vi.fn((row: (typeof rows)[number]) => ({
			sortValue: row.createdAt,
			id: row.id,
		}));

		const page = buildPaginatedResponse(rows, 2, mapItem, getCursor);

		expect(page.items).toEqual(["first", "second"]);
		expect(page.nextCursor).toEqual(expect.any(String));
		expect(decodeCursor(page.nextCursor!)).toEqual({
			sortValue: rows[1].createdAt,
			id: secondId,
		});
		expect(mapItem).toHaveBeenCalledTimes(2);
		expect(getCursor).toHaveBeenCalledOnce();
		expect(getCursor).toHaveBeenCalledWith(rows[1]);
	});

	it("returns no next cursor when there is no extra row", () => {
		const page = buildPaginatedResponse(
			rows.slice(0, 2),
			2,
			(row) => row.value,
			(row) => ({
				sortValue: row.createdAt,
				id: row.id,
			}),
		);

		expect(page.items).toEqual(["first", "second"]);
		expect(page.nextCursor).toBeNull();
	});

	it("returns an empty page without constructing a cursor", () => {
		const mapItem = vi.fn();
		const getCursor = vi.fn();

		const page = buildPaginatedResponse([], 20, mapItem, getCursor);

		expect(page).toEqual({
			items: [],
			nextCursor: null,
		});
		expect(mapItem).not.toHaveBeenCalled();
		expect(getCursor).not.toHaveBeenCalled();
	});
});
