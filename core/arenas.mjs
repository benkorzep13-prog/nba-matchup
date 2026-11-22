/** Static arena table. Altitude is feet. Travel uses haversine on these coordinates. */
export const ARENAS = {
  ATL: { name: "State Farm Arena", lat: 33.757, lon: -84.396, alt: 1050, tz: "America/New_York" },
  BOS: { name: "TD Garden", lat: 42.366, lon: -71.062, alt: 20, tz: "America/New_York" },
  BKN: { name: "Barclays Center", lat: 40.683, lon: -73.975, alt: 30, tz: "America/New_York" },
  CHA: { name: "Spectrum Center", lat: 35.225, lon: -80.839, alt: 750, tz: "America/New_York" },
  CHI: { name: "United Center", lat: 41.881, lon: -87.674, alt: 594, tz: "America/Chicago" },
  CLE: { name: "Rocket Arena", lat: 41.496, lon: -81.688, alt: 653, tz: "America/New_York" },
  DAL: { name: "American Airlines Center", lat: 32.79, lon: -96.81, alt: 430, tz: "America/Chicago" },
  DEN: { name: "Ball Arena", lat: 39.749, lon: -105.008, alt: 5280, tz: "America/Denver" },
  DET: { name: "Little Caesars Arena", lat: 42.341, lon: -83.055, alt: 600, tz: "America/New_York" },
  GSW: { name: "Chase Center", lat: 37.768, lon: -122.388, alt: 10, tz: "America/Los_Angeles" },
  HOU: { name: "Toyota Center", lat: 29.751, lon: -95.362, alt: 50, tz: "America/Chicago" },
  IND: { name: "Gainbridge Fieldhouse", lat: 39.764, lon: -86.156, alt: 715, tz: "America/Indiana/Indianapolis" },
  LAC: { name: "Intuit Dome", lat: 33.945, lon: -118.343, alt: 100, tz: "America/Los_Angeles" },
  LAL: { name: "Crypto.com Arena", lat: 34.043, lon: -118.267, alt: 270, tz: "America/Los_Angeles" },
  MEM: { name: "FedExForum", lat: 35.138, lon: -90.051, alt: 280, tz: "America/Chicago" },
  MIA: { name: "Kaseya Center", lat: 25.781, lon: -80.188, alt: 10, tz: "America/New_York" },
  MIL: { name: "Fiserv Forum", lat: 43.045, lon: -87.917, alt: 617, tz: "America/Chicago" },
  MIN: { name: "Target Center", lat: 44.98, lon: -93.276, alt: 840, tz: "America/Chicago" },
  NOP: { name: "Smoothie King Center", lat: 29.949, lon: -90.082, alt: 5, tz: "America/Chicago" },
  NYK: { name: "Madison Square Garden", lat: 40.75, lon: -73.993, alt: 30, tz: "America/New_York" },
  OKC: { name: "Paycom Center", lat: 35.463, lon: -97.515, alt: 1200, tz: "America/Chicago" },
  ORL: { name: "Kia Center", lat: 28.539, lon: -81.384, alt: 80, tz: "America/New_York" },
  PHI: { name: "Xfinity Mobile Arena", lat: 39.901, lon: -75.172, alt: 40, tz: "America/New_York" },
  PHX: { name: "Mortgage Matchup Center", lat: 33.446, lon: -112.071, alt: 1086, tz: "America/Phoenix" },
  POR: { name: "Moda Center", lat: 45.532, lon: -122.667, alt: 50, tz: "America/Los_Angeles" },
  SAC: { name: "Golden 1 Center", lat: 38.58, lon: -121.5, alt: 30, tz: "America/Los_Angeles" },
  SAS: { name: "Frost Bank Center", lat: 29.427, lon: -98.438, alt: 650, tz: "America/Chicago" },
  TOR: { name: "Scotiabank Arena", lat: 43.643, lon: -79.379, alt: 250, tz: "America/Toronto" },
  UTA: { name: "Delta Center", lat: 40.768, lon: -111.901, alt: 4226, tz: "America/Denver" },
  WAS: { name: "Capital One Arena", lat: 38.898, lon: -77.021, alt: 25, tz: "America/New_York" },
};

export function haversineMiles(a, b) {
  if (!a || !b) return null;
  const R = 3958.8;
  const r = (d) => (d * Math.PI) / 180;
  const dLat = r(b.lat - a.lat);
  const dLon = r(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

const TZ_OFFSET = {
  "America/New_York": -5,
  "America/Toronto": -5,
  "America/Indiana/Indianapolis": -5,
  "America/Chicago": -6,
  "America/Denver": -7,
  "America/Phoenix": -7,
  "America/Los_Angeles": -8,
};

export function tzShiftHours(fromTz, toTz) {
  if (!fromTz || !toTz) return null;
  const a = TZ_OFFSET[fromTz];
  const b = TZ_OFFSET[toTz];
  if (a == null || b == null) return null;
  return b - a;
}
