import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";

import db from "./db.js";
import authRoutes from "./routes/auth.js";

import adminOverviewRoutes from "./routes/admin/overview.js";
import adminUsersRoutes from "./routes/admin/users.js";
import adminCommunitiesRoutes from "./routes/admin/community.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));
app.use("/api/auth", authRoutes);

app.use("/api/admin/overview", adminOverviewRoutes);
app.use("/api/admin/users", adminUsersRoutes);
app.use("/api/admin/community", adminCommunitiesRoutes);
app.get("/", (req, res) => res.send("TokenSphere API running"));
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});
db.connect()
  .then(() => {
    app.listen(PORT, () =>
      console.log(`Server running on http://localhost:${PORT}`),
    );
  })
  .catch((err) => {
    console.error("DB connect error:", err.message);
    process.exit(1);
  });
