// Vercel serverless function: instant lead capture into Professional Edge Painting's GoHighLevel.
// The page calls this as soon as name/phone/ZIP are in, then after every answer, so partial leads are kept.
// Contacts are matched by phone, so each call updates the same contact. Nobody is disqualified.
// Needs Vercel env vars:
//   GHL_PRIVATE_TOKEN  - GHL Private Integration token (Contacts read/write) for the PEP sub-account
//   GHL_LOCATION_ID    - PEP sub-account (location) ID

const GHL_API = 'https://services.leadconnectorhq.com';
const GHL_VERSION = '2021-07-28';

// Quiz answers -> PEP contact custom fields (Settings → Custom Fields).
// ponytail: fieldId '' = not created yet; the answer still lands in the completion note.
export const QUESTIONS = {
  service_needed: {
    label: 'Service needed',
    fieldId: '',
    answers: ['Interior painting', 'Exterior painting', 'Cabinets', 'Fence or staining', 'Something else'],
  },
  start_timeline: {
    label: 'Start timeline',
    fieldId: '',
    answers: ['As soon as possible', 'Within a month', 'In 1 to 3 months', 'Just getting prices'],
  },
  homeowner: { label: 'Homeowner', fieldId: '', answers: ['Yes', 'No'] },
};
export const OFFER_FIELD_ID = ''; // "Lead Offer" custom field, optional

const TRACKING_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_placement', 'fbclid'];

function clean(value, max = 200) {
  if (value === undefined || value === null) return '';
  return String(value).trim().slice(0, max);
}

// US-first phone normalizer: returns +1XXXXXXXXXX (or +<intl>) or '' if not a real number.
export function normalizePhone(raw) {
  const digits = clean(raw, 40).replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length > 11 && digits.length <= 15) return `+${digits}`;
  return '';
}

export function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Offer slugs come from the URL, so only accept a safe shape before turning one into a tag.
export function cleanOffer(raw) {
  const slug = clean(raw, 40).toLowerCase();
  return /^[a-z0-9-]+$/.test(slug) ? slug : 'unknown';
}

// Builds the GHL upsert body from the request. Returns { error } on bad input.
export function buildContact(body, locationId) {
  const phone = normalizePhone(body.phone);
  if (!phone) return { error: 'A valid phone number is required' };

  const offer = cleanOffer(body.offer);
  const contact = { locationId, phone, source: `PEP Test Page (${offer})` };

  const email = clean(body.email, 254).toLowerCase();
  if (email) {
    if (!validEmail(email)) return { error: 'Please enter a valid email' };
    contact.email = email;
  }

  const zip = clean(body.postal_code, 10);
  if (/^\d{5}$/.test(zip)) contact.postalCode = zip;

  const fullName = clean(body.full_name, 120);
  if (fullName) {
    const [firstName, ...rest] = fullName.split(/\s+/);
    contact.firstName = firstName;
    if (rest.length) contact.lastName = rest.join(' ');
  }

  const raw = body.answers && typeof body.answers === 'object' ? body.answers : {};
  const answers = {};
  const customFields = [];
  for (const [key, q] of Object.entries(QUESTIONS)) {
    if (!q.answers.includes(raw[key])) continue; // unknown answers are dropped
    answers[key] = raw[key];
    if (q.fieldId) customFields.push({ id: q.fieldId, field_value: raw[key] });
  }
  if (OFFER_FIELD_ID) customFields.push({ id: OFFER_FIELD_ID, field_value: offer });
  if (customFields.length) contact.customFields = customFields;

  const t = body.tracking && typeof body.tracking === 'object' ? body.tracking : {};
  const tracking = {};
  for (const k of TRACKING_KEYS) if (clean(t[k])) tracking[k] = clean(t[k]);

  return { contact, answers, offer, tracking };
}

export function tagsFor(offer, completed) {
  const tags = ['pep-test-funnel', `offer-${offer}`];
  if (completed) tags.push('funnel-completed');
  return tags;
}

export function noteFor(offer, answers, tracking) {
  return [
    `PEP test page - completed (offer: ${offer})`,
    ...Object.entries(QUESTIONS).map(([k, q]) => `${q.label}: ${answers[k] || '-'}`),
    ...Object.entries(tracking).map(([k, v]) => `${k}: ${v}`),
  ].join('\n');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.GHL_PRIVATE_TOKEN;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!token || !locationId) {
    console.error('Missing GHL_PRIVATE_TOKEN or GHL_LOCATION_ID');
    return res.status(500).json({ error: 'Lead capture is not configured yet' });
  }

  let body = req.body || {};
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body || '{}');
    } catch {
      return res.status(400).json({ error: 'Invalid request' });
    }
  }

  // Honeypot: bots fill the hidden field. Pretend it worked, save nothing.
  if (clean(body.company_fax)) return res.status(200).json({ ok: true });

  const built = buildContact(body, locationId);
  if (built.error) return res.status(400).json({ error: built.error });
  const { contact, answers, offer, tracking } = built;
  const completed = body.stage === 'complete';

  const headers = {
    Authorization: `Bearer ${token}`,
    Version: GHL_VERSION,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  try {
    const upsert = await fetch(`${GHL_API}/contacts/upsert`, { method: 'POST', headers, body: JSON.stringify(contact) });
    const upsertData = await upsert.json().catch(() => ({}));
    if (!upsert.ok) {
      console.error('GHL upsert failed', upsert.status, upsertData);
      return res.status(502).json({ error: 'Could not save lead' });
    }
    const contactId = upsertData && upsertData.contact && upsertData.contact.id;

    if (contactId) {
      // Adds tags without removing existing ones.
      const tagRes = await fetch(`${GHL_API}/contacts/${contactId}/tags`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ tags: tagsFor(offer, completed) }),
      });
      if (!tagRes.ok) console.error('GHL tags failed', tagRes.status, await tagRes.text());

      // One summary note when they finish (not on every step, to avoid duplicates).
      if (completed) {
        const noteRes = await fetch(`${GHL_API}/contacts/${contactId}/notes`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ body: noteFor(offer, answers, tracking) }),
        });
        if (!noteRes.ok) console.error('GHL note failed', noteRes.status, await noteRes.text());
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('GHL request error', err);
    return res.status(502).json({ error: 'Could not save lead' });
  }
}
