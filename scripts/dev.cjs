/**
 * `pnpm dev`: arranca el API y, si DB_URI apunta a un Mongo local que no está
 * corriendo, levanta uno con mongodb-memory-server en el mismo puerto.
 *
 * Así cualquiera puede ver el proyecto con un solo comando, sin instalar Mongo
 * ni Docker. Los datos quedan en .mongo-data/ y sobreviven a los reinicios.
 * Con un DB_URI de Atlas este script no hace nada extra.
 */
require("dotenv/config");
const net = require("net");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const uri = process.env.DB_URI || "";
const local = uri.match(/^mongodb:\/\/(localhost|127\.0\.0\.1)(?::(\d+))?\//);

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect(port, "127.0.0.1");
    socket.once("connect", () => (socket.end(), resolve(true)));
    socket.once("error", () => resolve(false));
  });
}

async function main() {
  let mongo = null;

  if (local) {
    const port = Number(local[2] || 27017);
    if (!(await portOpen(port))) {
      const { MongoMemoryServer } = require("mongodb-memory-server");
      const dbPath = path.join(__dirname, "..", ".mongo-data");
      fs.mkdirSync(dbPath, { recursive: true });
      console.log(`[dev] levantando Mongo local en :${port} (la primera vez descarga el binario)`);
      mongo = await MongoMemoryServer.create({
        instance: { port, dbPath, storageEngine: "wiredTiger" },
      });
    }
  }

  const api = spawn("pnpm", ["exec", "ts-node-dev", "--respawn", "--transpile-only", "src/index.ts"], {
    stdio: "inherit",
    shell: true,
  });

  const stop = async () => {
    api.kill();
    if (mongo) await mongo.stop({ doCleanup: false });
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  api.on("exit", stop);
}

main().catch((error) => {
  console.error("[dev] no se pudo arrancar:", error);
  process.exit(1);
});
