import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Clock3,
  GitBranch,
  Mail,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import Link from "next/link";
import { ProviderDemo } from "@/components/provider-demo";

const github = "https://github.com/clipinfit/convex-emails";
export default function Home() {
  return (
    <div className="site">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <Link className="brand" href="/">
          <span className="brand-icon">
            <Mail size={18} />
          </span>
          convex-emails
        </Link>
        <nav aria-label="Main navigation">
          <Link href="/docs">Docs</Link>
          <a href="#providers" className="nav-extra">
            Providers
          </a>
          <a href={github}>
            GitHub <ArrowUpRight size={14} />
          </a>
        </nav>
        <Link href="/docs/getting-started" className="nav-cta">
          Get started <ArrowRight size={14} />
        </Link>
      </header>
      <main id="main">
        <section className="hero">
          <div className="hero-grid" aria-hidden="true" />
          <Link href="/docs/release-status" className="release-pill">
            <span />
            Built for Convex <span className="release-version">v0.0.1</span>
            <ArrowRight size={12} />
          </Link>
          <p className="eyebrow">YOUR BACKEND. YOUR PROVIDER.</p>
          <h1>
            Email delivery.
            <br />
            <span>On your terms.</span>
          </h1>
          <p className="hero-description">
            A persistent email queue for Convex.
            <br />
            Plug in Plunk or Resend. Keep the delivery logic in one place.
          </p>
          <div className="hero-actions">
            <Link href="/docs/getting-started" className="button primary">
              Start building <ArrowRight size={17} />
            </Link>
            <a href={github} className="button secondary">
              Explore the code <ArrowUpRight size={16} />
            </a>
          </div>
          <p className="hero-note">
            Open source · Apache-2.0 · Provider adapters included
          </p>
          <div className="signal-strip">
            <span>
              <span className="tiny-dot" />
              PERSISTENT BY DESIGN
            </span>
            <span>QUEUE → DISPATCH → TRACK</span>
            <span className="signal-end">CONVEX NATIVE</span>
          </div>
        </section>
        <section className="provider-section">
          <div className="section-intro">
            <div>
              <p className="eyebrow">ONE QUEUE. TWO WAYS TO SEND.</p>
              <h2>
                Pick the provider.
                <br />
                Keep the architecture.
              </h2>
            </div>
            <p>
              Scheduling, recipient restrictions, and message records stay in
              Convex. Each adapter handles its provider’s API and retry rules.
            </p>
          </div>
          <ProviderDemo />
        </section>
        <section className="features-section">
          <div className="section-intro">
            <div>
              <p className="eyebrow">THE WORK AFTER “SEND”</p>
              <h2>
                Built for what
                <br />
                happens next.
              </h2>
            </div>
            <Link href="/docs/delivery" className="text-link">
              Understand delivery <ArrowRight size={16} />
            </Link>
          </div>
          <div className="features-grid">
            {[
              {
                icon: Clock3,
                n: "01",
                title: "Set a time. Keep the job.",
                text: "Queue now or schedule ahead. Convex persists the job. Cancel it before the worker starts.",
                href: "/docs/scheduling",
              },
              {
                icon: GitBranch,
                n: "02",
                title: "Different providers. Clear rules.",
                text: "Each adapter classifies failures. Safe retries stay on the same route with the same request key.",
                href: "/docs/adapters",
              },
              {
                icon: ShieldCheck,
                n: "03",
                title: "Carry restrictions forward.",
                text: "Keep hard bounces and complaints blocked. Preserve marketing opt-outs across provider changes.",
                href: "/docs/suppression",
              },
              {
                icon: Activity,
                n: "04",
                title: "Know where every message stands.",
                text: "Inspect queued, accepted, delivered, and uncertain outcomes. Review ambiguous sends before taking action.",
                href: "/docs/delivery",
              },
            ].map((f) => (
              <Link className="feature" key={f.n} href={f.href}>
                <div className="feature-head">
                  <f.icon size={22} />
                  <span>{f.n}</span>
                </div>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
                <ArrowUpRight className="feature-arrow" size={18} />
              </Link>
            ))}
          </div>
        </section>
        <section className="template-section">
          <div
            className="template-visual"
            role="img"
            aria-label="Illustration of a React Email template rendered to HTML"
          >
            <div className="terminal-caption">
              <Terminal size={14} /> YOUR TEMPLATE
            </div>
            <pre>
              <code>{`<WelcomeEmail
  name="Alex"
  workspace="Studio"
/>`}</code>
            </pre>
            <div className="render-divider">
              <span />
              render to HTML
              <ArrowRight size={14} />
              <span />
            </div>
            <div className="email-preview">
              <div className="email-avatar">
                <Mail size={20} />
              </div>
              <span className="mono">STUDIO</span>
              <h3>Welcome aboard, Alex.</h3>
              <p>
                Your workspace is ready.
                <br />
                Let’s make something worth sending.
              </p>
              <span className="preview-button">
                Open your workspace <ArrowUpRight size={12} />
              </span>
            </div>
            <small>Template illustration</small>
          </div>
          <div>
            <p className="eyebrow">BRING YOUR OWN HTML</p>
            <h2>
              Your templates
              <br />
              come with you.
            </h2>
            <p>
              Keep React Email and your local preview workflow. Render your
              template once, then pass the HTML to the queue.
            </p>
            <p>
              Choose your provider independently of the way you build your
              emails.
            </p>
            <Link href="/docs/react-email" className="text-link">
              Use React Email <ArrowRight size={16} />
            </Link>
          </div>
        </section>
        <section className="closing">
          <div>
            <p className="eyebrow">SMALL API. EXPLICIT BEHAVIOR.</p>
            <h2>
              Make email part
              <br />
              of your backend.
            </h2>
            <p>Start with the local example. No provider account required.</p>
          </div>
          <div className="closing-actions">
            <Link href="/docs/getting-started" className="button primary">
              Read the setup guide <ArrowRight size={17} />
            </Link>
            <Link href="/docs/release-status">
              Version 0.0.1 · validation and release status{" "}
              <ArrowUpRight size={13} />
            </Link>
          </div>
        </section>
      </main>
      <footer>
        <Link className="brand" href="/">
          <span className="brand-icon">
            <Mail size={16} />
          </span>
          convex-emails
        </Link>
        <span>Built by Clipin. Open to everyone.</span>
        <div>
          <Link href="/docs">Documentation</Link>
          <a href={github}>
            GitHub <ArrowUpRight size={13} />
          </a>
        </div>
        <p>
          Independent open-source component. Provider accounts and usage are
          billed separately.
        </p>
      </footer>
    </div>
  );
}
