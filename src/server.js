import app from "./app.js";
import { connectDB, disconnectDB } from "./configs/connectDB.js";
import { PORT } from "./configs/settings.js";
import { logger } from "./lib/logger.js";

if (!process.env.VERCEL) {
    const start = async () => {
        await connectDB();
        const server = app.listen(PORT, () => logger.info(`Server listening on port ${PORT}`));

        // Must outlive the load balancer's idle timeout (ALB default 60 s).
        server.keepAliveTimeout = 65_000;
        server.headersTimeout = 66_000;

        let shuttingDown = false;
        const shutdown = (signal) => {
            if (shuttingDown) return;
            shuttingDown = true;
            logger.info(`${signal} received, draining connections`);
            setTimeout(() => {
                logger.error("Forced shutdown after timeout");
                process.exit(1);
            }, 10_000).unref();
            server.close(async () => {
                await disconnectDB().catch(() => {});
                process.exit(0);
            });
        };
        process.on("SIGTERM", () => shutdown("SIGTERM"));
        process.on("SIGINT", () => shutdown("SIGINT"));
    };
    start().catch((err) => {
        logger.error("Failed to start server", { err });
        process.exit(1);
    });
}

process.on("unhandledRejection", (reason) => logger.error("Unhandled promise rejection", { err: reason }));

export default app;
