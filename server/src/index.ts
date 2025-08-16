import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import { env } from "./env.js";
import { router } from "./routes.js";
import { ratelimit } from "./ratelimit.js";

const app = express();

app.set("trust proxy", true);
app.use(helmet());
app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("tiny"));

app.use(ratelimit);
app.use(router);

app.listen(env.port, () => console.log(`Cringe server on :${env.port}`));
