// api/extra-routes.js
// Using Node 18+ global fetch (no import needed)

import pg from 'pg';
import jwt from 'jsonwebtoken';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { require: true, rejectUnauthorized: false },
});

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token provided' });
  const token = auth.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export default function mountExtraRoutes(app) {
  // ---------------- Geocode helper ----------------
  app.post('/api/geocode', async (req, res) => {
    const address = req.body?.address;
    if (!address) return res.status(400).json({ error: 'Missing address' });

    const parts = [
      address.line1,
      address.line2,
      address.locality,
      address.admin1?.code || address.admin1?.name,
      address.postal,
      address.country?.code || address.country?.name,
    ].filter(Boolean);

    const KEY = process.env.GOOGLE_MAPS_API_KEY;
    if (!KEY) {
      return res
        .status(501)
        .json({ error: 'Geocode not configured (GOOGLE_MAPS_API_KEY missing)' });
    }

    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', parts.join(', '));
    url.searchParams.set('key', KEY);

    const r = await fetch(url.toString());
    const data = await r.json();

    if (data.status !== 'OK' || !data.results?.length) {
      return res.status(422).json({ error: 'Unable to geocode address' });
    }

    const best = data.results[0];
    const { lat, lng } = best.geometry.location;
    const placeId = best.place_id;
    const get = (type) =>
      (best.address_components || []).find((c) => (c.types || []).includes(type));
    const admin1 = get('administrative_area_level_1');
    const country = get('country');
    const locality = get('locality') || get('postal_town');

    res.json({
      lat,
      lng,
      placeId,
      normalized: {
        line1: address.line1,
        line2: address.line2 || '',
        locality: locality?.long_name || address.locality,
        admin1: {
          code: admin1?.short_name || '',
          name: admin1?.long_name || '',
        },
        postal: get('postal_code')?.long_name || address.postal,
        country: {
          code: country?.short_name || '',
          name: country?.long_name || '',
        },
      },
    });
  });

  // ---------------- Role-based dashboard layout ----------------
  // GET the layout for the current user's role
  app.get('/api/dashboard', authMiddleware, async (req, res) => {
    try {
      const role = (req.user?.role || 'ADMIN').toUpperCase();

      const { rows } = await pool.query(
        'select layout from dashboard_settings where id = $1 limit 1',
        [role]
      );

      if (!rows.length || !rows[0].layout) {
        return res.json({ layout: [] }); // no layout yet for this role
      }

      res.json({ layout: rows[0].layout });
    } catch (err) {
      console.error('[GET /api/dashboard]', err);
      res.status(500).json({ error: 'Failed to load dashboard layout' });
    }
  });

  // SAVE the layout for the current user's role
  app.post('/api/dashboard', authMiddleware, async (req, res) => {
    try {
      const role = (req.user?.role || 'ADMIN').toUpperCase();
      const layout = req.body?.layout || [];
      const json = JSON.stringify(layout);

      const { rows } = await pool.query(
        `
        insert into dashboard_settings (id, layout)
        values ($1, $2)
        on conflict (id) do update
          set layout = excluded.layout,
              updated_at = now()
        returning id, layout, updated_at
      `,
        [role, json]
      );

      res.json(rows[0]);
    } catch (err) {
      console.error('[POST /api/dashboard]', err);
      res.status(500).json({ error: 'Failed to save dashboard layout' });
    }
  });

  // (Add any future extra routes here, inside this function)
}
