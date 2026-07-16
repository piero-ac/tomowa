import type {
	CreateSessionBody,
	UpdateSessionBody,
} from "../validation/session.schema.js";

export type CreateSessionInput = CreateSessionBody & {
	organizerId: string;
};

export type UpdateSessionInput = UpdateSessionBody;
