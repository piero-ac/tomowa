import { describe, expect, it } from "vitest";

import { isPostgresUniqueViolation } from "../../../src/db/postgres-error.js";

const constraintName = "sessions_owner_active_start_unique_idx";

describe("isPostgresUniqueViolation", () => {
	it("recognizes a matching unique violation", () => {
		const error = {
			code: "23505",
			constraint_name: constraintName,
		};

		expect(isPostgresUniqueViolation(error, constraintName)).toBe(true);
	});

	it("recognizes a matching violation nested in a cause chain", () => {
		const error = {
			cause: {
				cause: {
					code: "23505",
					constraint_name: constraintName,
				},
			},
		};

		expect(isPostgresUniqueViolation(error, constraintName)).toBe(true);
	});

	it("rejects an error with a non-unique PostgreSQL code", () => {
		const error = {
			code: "23503",
			constraint_name: constraintName,
		};

		expect(isPostgresUniqueViolation(error, constraintName)).toBe(false);
	});

	it("rejects a unique violation for a different constraint", () => {
		const error = {
			code: "23505",
			constraint_name: "different_constraint",
		};

		expect(isPostgresUniqueViolation(error, constraintName)).toBe(false);
	});

	it.each([null, undefined, "database error", 23505])(
		"returns false for the non-object value %s",
		(error) => {
			expect(isPostgresUniqueViolation(error, constraintName)).toBe(false);
		},
	);

	it("terminates safely when the cause chain contains a cycle", () => {
		interface ErrorNode {
			cause?: ErrorNode;
		}

		const firstError: ErrorNode = {};
		const secondError: ErrorNode = {
			cause: firstError,
		};

		firstError.cause = secondError;

		expect(isPostgresUniqueViolation(firstError, constraintName)).toBe(false);
	});
});
