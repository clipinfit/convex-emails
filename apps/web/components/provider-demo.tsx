"use client";
import {
  ArrowRight,
  Check,
  Clock3,
  Copy,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
export function ProviderDemo() {
  const [provider, setProvider] = useState<"plunk" | "resend">("plunk");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle",
  );
  const code = `import { Emails } from "@clipin/convex-emails";
import { ${provider} } from "@clipin/convex-emails/${provider}";

const email = new Emails(components.emails, {
  adapter: ${provider}({ route: "${provider}-primary" }),
});

export const deliver = email.worker();`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }
  return (
    <div className="demo" id="providers">
      <div className="demo-top">
        <span className="mono">01 / CHOOSE YOUR PROVIDER</span>
        <fieldset aria-label="Email provider">
          {(["plunk", "resend"] as const).map((p) => (
            <button
              type="button"
              aria-pressed={provider === p}
              key={p}
              onClick={() => {
                setProvider(p);
                setCopyState("idle");
              }}
            >
              {p === "plunk" ? "Plunk" : "Resend"}
            </button>
          ))}
        </fieldset>
      </div>
      <div className="demo-flow">
        <div>
          <span className="flow-icon">
            <Mail size={21} />
          </span>
          <strong>Your app</strong>
          <small>Queue a message</small>
        </div>
        <ArrowRight size={18} />
        <div className="flow-core">
          <span className="flow-icon">
            <span className="mini-grid">▦</span>
          </span>
          <strong>convex-emails</strong>
          <small>Schedule · pace · record</small>
        </div>
        <ArrowRight size={18} />
        <div>
          <span className="flow-icon provider-letter">
            {provider === "plunk" ? "P" : "R"}
          </span>
          <strong>{provider === "plunk" ? "Plunk" : "Resend"}</strong>
          <small>Deliver the email</small>
        </div>
      </div>
      <div className="demo-bottom">
        <div className="code-pane">
          <div className="code-top">
            <span>convex/emails.ts</span>
            <button type="button" onClick={copy} aria-label="Copy setup code">
              {copyState === "copied" ? (
                <Check size={16} />
              ) : (
                <Copy size={16} />
              )}
            </button>
          </div>
          <pre>
            <code>{code}</code>
          </pre>
          <span className="copy-status" aria-live="polite">
            {copyState === "copied"
              ? "Copied"
              : copyState === "error"
                ? "Select the code to copy it"
                : "Test mode is enabled by default."}
          </span>
        </div>
        <div className="policy-pane">
          <span className="mono">ADAPTER BEHAVIOR</span>
          <h3>
            {provider === "plunk"
              ? "Stop when the result is unclear."
              : "Retry with the same request key."}
          </h3>
          <p aria-live="polite">
            {provider === "plunk"
              ? "Plunk timeouts, conflicts, and server errors pause for review. A rate limit can safely schedule another attempt."
              : "Resend can replay the same keyed request. Transient errors retry inside the adapter’s bounded window."}
          </p>
          <div className="policy-detail">
            <Clock3 size={15} /> Automatic scheduling
          </div>
          <div className="policy-detail">
            <ShieldCheck size={15} /> The same persistent queue
          </div>
          <small>
            Architecture illustration. No email is sent from this page.
          </small>
        </div>
      </div>
    </div>
  );
}
