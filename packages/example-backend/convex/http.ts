import { httpRouter } from "convex/server";
import { resendWebhook, webhook } from "./emails.js";

const http = httpRouter();
http.route({ path: "/plunk-webhook", method: "POST", handler: webhook });
http.route({ path: "/resend-webhook", method: "POST", handler: resendWebhook });
export default http;
