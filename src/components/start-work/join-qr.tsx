"use client";

import { useEffect, useState } from "react";

/** QR code for a join link, drawn in the browser (the qrcode library is loaded only when this is shown). */
export function JoinQr({ url, label }: { url: string; label: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import("qrcode")
      .then((QRCode) => QRCode.toDataURL(url, { margin: 1, width: 480, errorCorrectionLevel: "M" }))
      .then((dataUrl) => !cancelled && setSrc(dataUrl))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (failed) return <p className="text-sm text-muted-foreground">Couldn&apos;t draw the QR code. Share the link or code instead.</p>;
  if (!src) return <div className="size-56 animate-pulse rounded-xl bg-muted" role="status" aria-label="Drawing QR code" />;
  // eslint-disable-next-line @next/next/no-img-element -- a generated data URL, nothing for next/image to optimise
  return <img src={src} alt={label} width={224} height={224} className="size-56 rounded-xl border bg-white p-2" />;
}
