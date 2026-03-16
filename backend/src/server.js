import http from "node:http";
import { app } from "./app.js";
import { connectDB } from "./data/mongodb.js";
import { seedCatalogIfNeeded } from "./data/seedCatalog.js";
import { attachRealtimeServer } from "./lib/realtime.js";

const port = Number(process.env.PORT ?? 8080);

async function start() {
  await connectDB();
  await seedCatalogIfNeeded();

  const server = http.createServer(app);
  attachRealtimeServer(server);

  server.listen(port, () => {
    console.log(`Backend server listening on http://localhost:${port}`);
  });
}

start();
