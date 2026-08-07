export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initDB } = await import("./lib/db");
    await initDB().catch((err: unknown) => {
      console.error("[init-db] Failed to initialize database:", err);
    });
    // Losse import (niet vanuit initDB) om een kringverwijzing db <-> verkopers-db te vermijden.
    const { initVerkopersDB } = await import("./lib/verkopers-db");
    await initVerkopersDB().catch((err: unknown) => {
      console.error("[init-db] Failed to initialize verkopers tables:", err);
    });
  }
}
