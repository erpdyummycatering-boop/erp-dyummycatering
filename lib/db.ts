import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

// Required when running in Node.js (next dev / server)
if (typeof WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
});

export default pool;
