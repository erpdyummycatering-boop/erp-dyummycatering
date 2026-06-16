import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

// Required when running in Node.js (next dev / server)
if (typeof WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

const rawPool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
});

export function formatDbError(err: any): Error {
  if (!err) return err;
  
  const message = err.message || String(err);
  let friendlyMessage = message;

  if (message.includes("duplicate key value violates unique constraint")) {
    if (message.includes("customers_phone_key")) {
      friendlyMessage = "Data telah ada: Nomor WhatsApp/telepon ini sudah terdaftar untuk customer lain.";
    } else if (message.includes("customers_email_key")) {
      friendlyMessage = "Data telah ada: Email ini sudah terdaftar untuk customer lain.";
    } else if (message.includes("users_email_key")) {
      friendlyMessage = "Data telah ada: Email ini sudah terdaftar untuk user lain.";
    } else if (message.includes("users_username_key")) {
      friendlyMessage = "Data telah ada: Username ini sudah terdaftar.";
    } else if (message.includes("products_name_key")) {
      friendlyMessage = "Data telah ada: Nama produk ini sudah terdaftar.";
    } else if (message.includes("recipes_name_key")) {
      friendlyMessage = "Data telah ada: Nama resep ini sudah terdaftar.";
    } else if (message.includes("orders_pkey")) {
      friendlyMessage = "Data telah ada: ID Order ini sudah terdaftar.";
    } else {
      const detail = err.detail || "";
      friendlyMessage = `Data telah ada di sistem (Duplikat). ${detail}`;
    }
    
    const newErr = new Error(friendlyMessage);
    (newErr as any).originalError = err;
    (newErr as any).code = err.code;
    (newErr as any).detail = err.detail;
    return newErr;
  }

  if (message.includes("violates foreign key constraint")) {
    friendlyMessage = "Gagal menyimpan karena melanggar referensi data (data relasi tidak ditemukan atau masih digunakan).";
    const newErr = new Error(friendlyMessage);
    (newErr as any).originalError = err;
    (newErr as any).code = err.code;
    return newErr;
  }

  if (message.includes("violates not-null constraint")) {
    const columnMatch = message.match(/column "([^"]+)"/);
    const columnName = columnMatch ? columnMatch[1] : "wajib";
    friendlyMessage = `Gagal menyimpan: Kolom '${columnName}' wajib diisi dan tidak boleh kosong.`;
    const newErr = new Error(friendlyMessage);
    (newErr as any).originalError = err;
    (newErr as any).code = err.code;
    return newErr;
  }

  return err;
}

const wrapQuery = (originalQuery: any, context: any) => {
  return async function(this: any, ...args: any[]) {
    try {
      return await originalQuery.apply(this === context ? rawPool : this, args);
    } catch (err) {
      throw formatDbError(err);
    }
  };
};

const pool = new Proxy(rawPool, {
  get(target, prop, receiver) {
    if (prop === "query") {
      return wrapQuery(target.query, receiver);
    }
    if (prop === "connect") {
      return async function() {
        const client = await target.connect();
        return new Proxy(client, {
          get(clientTarget, clientProp) {
            if (clientProp === "query") {
              return wrapQuery(clientTarget.query, clientTarget);
            }
            return Reflect.get(clientTarget, clientProp);
          }
        });
      };
    }
    return Reflect.get(target, prop);
  }
}) as Pool;

export default pool;
