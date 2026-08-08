const UNIQUE_VIOLATION_CODE = "23505";

interface ErrorLike {
	code?: unknown;
	constraint_name?: unknown;
	cause?: unknown;
}

export function isPostgresUniqueViolation(
	error: unknown,
	constraintName: string,
): boolean {
	let currentError: unknown = error;
	const visitedErrors = new Set<object>();

	while (
		typeof currentError === "object" &&
		currentError !== null &&
		!visitedErrors.has(currentError)
	) {
		visitedErrors.add(currentError);

		const errorLike = currentError as ErrorLike;

		if (
			errorLike.code === UNIQUE_VIOLATION_CODE &&
			errorLike.constraint_name === constraintName
		) {
			return true;
		}

		currentError = errorLike.cause;
	}

	return false;
}
