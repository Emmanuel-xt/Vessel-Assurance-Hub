"use client";

// Last resort: the root layout itself failed, so globals.css and the app shell may be missing. Inline styles only.
export default function GlobalError({ reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#f8fafd",
          color: "#14233a",
          padding: 16,
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 360 }}>
          <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: "#5b6577" }}>
            Vessel Assurance Hub
          </p>
          <h1 style={{ fontSize: 22, margin: "8px 0" }}>Something went wrong</h1>
          <p style={{ fontSize: 14, color: "#5b6577" }}>The app couldn&apos;t load. Check your connection and try again.</p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 12,
              minHeight: 44,
              padding: "0 20px",
              borderRadius: 10,
              border: 0,
              background: "#0d2b50",
              color: "#fff",
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
