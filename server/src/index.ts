import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import { env } from "./env";
import { router } from "./routes";
import { ratelimit } from "./ratelimit";

const app = express();
app.use(helmet());
app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("tiny"));

app.use(ratelimit);
app.use(router);

app.listen(env.port, () => console.log(`Cringe server on :${env.port}`));
