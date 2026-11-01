import { defineApp } from "convex/server";
import emails from "../../convex-emails/src/component/convex.config.js";

const app = defineApp();
app.use(emails);
export default app;
