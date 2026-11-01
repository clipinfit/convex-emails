import Link from "next/link";
export default function NotFound() {
  return (
    <main className="not-found">
      <p className="eyebrow">404 / CONVEX-EMAILS</p>
      <h1>Page not found.</h1>
      <p>This page does not exist. Start with the documentation.</p>
      <Link href="/docs">Read the docs →</Link>
      <Link href="/">Back to home</Link>
    </main>
  );
}
