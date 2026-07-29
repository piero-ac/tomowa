export interface PageCursor {
	sortValue: Date;
	id: string;
}

export interface PaginationInput {
	limit: number;
	cursor?: PageCursor;
}

export interface PaginatedResponse<T> {
	items: T[];
	nextCursor: string | null;
}
