import 'server-only';

import QRCode from 'qrcode';

/**
 * QR payload format for visitor gate passes.
 *
 * The QR carries an opaque token, never the visitor's personal details — a
 * photographed pass therefore leaks nothing, and the token is only meaningful
 * to the server (NFR: Data Privacy & Security).
 */
const PREFIX = 'SMARTSOCIETY:PASS:';

export function buildQrPayload(qrToken: string): string {
  return `${PREFIX}${qrToken}`;
}

/**
 * Accepts anything a scanner might hand us — the full payload, a bare token, a
 * pass code, or a 6-digit gate code — and returns the part to look up.
 */
export function parseScannedCode(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.toUpperCase().startsWith(PREFIX)) {
    return trimmed.slice(PREFIX.length).trim();
  }
  // Some scanners hand back a URL; take the last path segment or `token` query.
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      return url.searchParams.get('token') ?? url.pathname.split('/').filter(Boolean).pop() ?? trimmed;
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

/** Renders the pass QR as a data URI suitable for an <img src>. */
export function renderQrDataUrl(qrToken: string, size = 320): Promise<string> {
  return QRCode.toDataURL(buildQrPayload(qrToken), {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: size,
    color: { dark: '#0f2027', light: '#ffffff' },
  });
}

/** Compact SVG variant, used inside the generated PDF gate pass. */
export function renderQrSvg(qrToken: string): Promise<string> {
  return QRCode.toString(buildQrPayload(qrToken), {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 1,
  });
}
