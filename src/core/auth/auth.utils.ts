/**
 * Converts a JWT-style duration string (e.g. "7d", "15m", "1h") into an
 * actual Date, so the DB expiry always matches jwtRefreshExpiry exactly
 */
export function calculateExpiryDate(duration: string): Date {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];
  const msPerUnit: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return new Date(Date.now() + value * msPerUnit[unit]);
}
