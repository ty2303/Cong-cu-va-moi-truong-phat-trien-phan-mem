import { app } from "./app.js";
import { connectDB } from "./data/mongodb.js";

const port = Number(process.env.PORT ?? 8080);

async function start() {
  await connectDB();
  
  app.listen(port, () => {
    console.log(`Backend server listening on http://localhost:${port}`);
  });
}

start();
