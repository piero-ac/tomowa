export class AppError extends Error {
	constructor(
		message: string,
		public readonly statusCode: number,
		public readonly errors?: unknown,
	) {
		super(message);
		this.name = new.target.name;
	}
}
