import mongoose from "mongoose";

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://admin:admin123@animepro.68usjeq.mongodb.net/?appName=AnimePro";

export async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
}

export default mongoose;
