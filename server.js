import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";

import db from "./db.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

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
