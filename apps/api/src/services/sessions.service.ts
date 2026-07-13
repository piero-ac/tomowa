import * as sessionRepository from "../repositories/sessions.repository.js";

export async function getSessions() {
	return sessionRepository.getSessions();
}
