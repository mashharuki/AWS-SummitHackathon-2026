import { handle } from "hono/aws-lambda";
import app from ".";

// Lambda handlerとしてラップ
export const handler = handle(app);
