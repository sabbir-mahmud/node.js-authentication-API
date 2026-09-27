// JSON lines in production, readable lines in dev, silent in tests.
// Never pass request bodies, tokens or passwords in `meta`.
const NODE_ENV = process.env.NODE_ENV || "development";
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };
const threshold = LEVELS[process.env.LOG_LEVEL] ?? (NODE_ENV === "test" ? LEVELS.silent : LEVELS.info);
const json = NODE_ENV === "production";

const serialize = (meta) => {
    if (!meta?.err) return meta;
    const { err, ...rest } = meta;
    return { ...rest, err: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : err };
};

const write = (level, msg, meta) => {
    if (LEVELS[level] < threshold) return;
    const data = serialize(meta);
    const out = level === "error" || level === "warn" ? process.stderr : process.stdout;
    if (json) {
        out.write(`${JSON.stringify({ level, time: new Date().toISOString(), msg, ...data })}\n`);
    } else {
        out.write(`${new Date().toISOString()} ${level.toUpperCase()} ${msg}${data ? ` ${JSON.stringify(data)}` : ""}\n`);
    }
};

export const logger = {
    debug: (msg, meta) => write("debug", msg, meta),
    info: (msg, meta) => write("info", msg, meta),
    warn: (msg, meta) => write("warn", msg, meta),
    error: (msg, meta) => write("error", msg, meta),
};
