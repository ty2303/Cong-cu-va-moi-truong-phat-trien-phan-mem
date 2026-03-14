import { app } from "./app.js";
import { connectToDatabase } from "./data/store.js";

const port = Number(process.env.PORT ?? 8080);

connectToDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`Backend server listening on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to connect to MongoDB");
    console.error(error);
    process.exit(1);
  });
