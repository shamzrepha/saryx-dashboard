import Link from "next/link";

export default function Home() {
  return (
    <div style={{
      fontFamily: "sans-serif", background: "#0d1117", color: "#eee",
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center"
    }}>
      <h1 style={{ fontSize: 42, marginBottom: 8 }}>SARYX</h1>
      <p style={{ fontSize: 18, opacity: 0.8, maxWidth: 480, marginBottom: 8 }}>
        Autonomous last-mile delivery for FUTO campus. A self-driving cart carries
        your parcel between pickup stations, so you don't have to.
      </p>
      <p style={{ fontSize: 13, opacity: 0.5, maxWidth: 480, marginBottom: 40 }}>
        Currently serving Federal University of Technology, Owerri and the
        immediate surrounding area.
      </p>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
        <Link href="/book" style={{
          padding: "16px 32px", background: "#2E7D32", color: "#fff", borderRadius: 8,
          textDecoration: "none", fontSize: 18, fontWeight: "bold"
        }}>
          Book a Ride
        </Link>
        <Link href="/receive" style={{
          padding: "16px 32px", background: "#1565C0", color: "#fff", borderRadius: 8,
          textDecoration: "none", fontSize: 18, fontWeight: "bold"
        }}>
          Track an Order
        </Link>
      </div>

      <Link href="/admin" style={{ marginTop: 48, fontSize: 12, opacity: 0.4, color: "#eee" }}>
        Admin login →
      </Link>
    </div>
  );
}
