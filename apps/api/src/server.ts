import "dotenv/config";
import { app } from "./app.js";

const port = Number(process.env.PORT ?? 3001);

const server = app.listen(port, () => {
	console.log(`Tomowa API listening on port ${port}`);
});

const shutdown = (signal: string) => {
	console.log(`${signal} received. Shutting down.`);
	server.close((error) => {
		if (error) {
			console.error("Failed to close server cleanly.", error);
			process.exit(1);
		}
		process.exit(0);
	});
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
