// Using Node 18+ global fetch (no import needed)
// api/extra-routes.js
export default function mountExtraRoutes(app) {
  app.post('/api/geocode', async (req, res) => {
    const address = req.body?.address;
    if (!address) return res.status(400).json({ error: 'Missing address' });
    const parts = [
      address.line1, address.line2, address.locality,
      address.admin1?.code || address.admin1?.name, address.postal,
      address.country?.code || address.country?.name
    ].filter(Boolean);
    const KEY = process.env.GOOGLE_MAPS_API_KEY;
    if (!KEY) return res.status(501).json({ error: 'Geocode not configured (GOOGLE_MAPS_API_KEY missing)' });
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', parts.join(', '));
    url.searchParams.set('key', KEY);
    const r = await fetch(url.toString());
    const data = await r.json();
    if (data.status !== 'OK' || !data.results?.length) return res.status(422).json({ error: 'Unable to geocode address' });
    const best = data.results[0];
    const { lat, lng } = best.geometry.location;
    const placeId = best.place_id;
    const get = (type) => (best.address_components || []).find(c => (c.types||[]).includes(type));
    const admin1 = get('administrative_area_level_1');
    const country = get('country');
    const locality = get('locality') || get('postal_town');
    res.json({
      lat, lng, placeId,
      normalized: {
        line1: address.line1,
        line2: address.line2 || '',
        locality: locality?.long_name || address.locality,
        admin1: { code: admin1?.short_name || '', name: admin1?.long_name || '' },
        postal: get('postal_code')?.long_name || address.postal,
        country: { code: country?.short_name || '', name: country?.long_name || '' }
      }
    });
  });
}
