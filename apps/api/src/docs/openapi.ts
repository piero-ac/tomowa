import { readFileSync } from "node:fs";

import { parse } from "yaml";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

const openapiFile = new URL("../../openapi.yaml", import.meta.url);
const parsedDocument: unknown = parse(readFileSync(openapiFile, "utf8"));

if (!isRecord(parsedDocument)) {
	throw new Error("OpenAPI document must be an object.");
}

export const openapiDocument = parsedDocument;
