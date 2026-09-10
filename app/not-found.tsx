import Link from "next/link";

export default function NotFound() {
  return (
    <main className="app-container" style={{ textAlign: "center", paddingTop: "5rem" }}>
      <div className="hud-card" style={{ maxWidth: "500px", margin: "0 auto" }}>
        <h1 className="font-display" style={{ fontSize: "3rem", color: "var(--accent-cyan)", marginBottom: "1rem" }}>
          404
        </h1>
        <h2 style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>SECTOR NOT FOUND</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
          The requested operational vector does not exist in the O.D.I.N. network.
        </p>
        <Link href="/" className="hud-button">
          RETURN TO HUD
        </Link>
      </div>
    </main>
  );
}
