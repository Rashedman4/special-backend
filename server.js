import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";

import db from "./db.js";
import authRoutes from "./routes/auth.js";
import usersRoutes from "./routes/users.js";
import walletRoutes from "./routes/wallet.js";
import postsRoutes from "./routes/posts.js";
import communitiesRoutes from "./routes/communities.js";
dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/posts", postsRoutes);
app.use("/api/communities", communitiesRoutes);
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
