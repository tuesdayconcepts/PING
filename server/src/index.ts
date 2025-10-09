import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// Health check endpoint for Railway monitoring
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "ping-server" });
});

// Example CRUD placeholder - replace with actual business logic
app.get("/api/v1/items", (_req, res) => {
  res.json([{ id: 1, name: "example" }]);
});

// Start server on configured port
const port = process.env.PORT ? Number(process.env.PORT) : 8080;
app.listen(port, () => {
  console.log(`API listening on :${port}`);
});

