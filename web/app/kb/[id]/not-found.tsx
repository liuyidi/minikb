import Link from "next/link";

export default function KbNotFound() {
  return (
    <div style={{ padding: 48, textAlign: "center" }}>
      <h1 style={{ fontSize: 24, fontWeight: 600 }}>404</h1>
      <p style={{ marginTop: 12, color: "var(--mini-color-muted)" }}>Knowledge base not found.</p>
      <Link href="/kbs" style={{ display: "inline-block", marginTop: 24, textDecoration: "underline" }}>
        ← Back to knowledge bases
      </Link>
    </div>
  );
}
