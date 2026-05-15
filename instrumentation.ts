export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initDB } = await import("./lib/db");
    await initDB().catch((err: unknown) => {
      console.error("[init-db] Failed to initialize database:", err);
    });
  }
}
