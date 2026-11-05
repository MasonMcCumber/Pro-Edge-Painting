// Run: node tests/lead.test.mjs
import assert from 'node:assert/strict';
import { normalizePhone, buildContact, cleanOffer, tagsFor, noteFor, webhookBody } from '../api/lead.js';

assert.equal(normalizePhone('(979) 555-0123'), '+19795550123');
assert.equal(normalizePhone('1-979-555-0123'), '+19795550123');
assert.equal(normalizePhone('555-0123'), '');

assert.equal(buildContact({ phone: '123' }, 'L').error, 'A valid phone number is required');
assert.equal(buildContact({ phone: '9795550123', email: 'nope' }, 'L').error, 'Please enter a valid email');

const { contact, answers, offer, tracking } = buildContact(
  {
    phone: '9795550123',
    full_name: 'Jane  Q Doe',
    postal_code: '77840',
    email: ' Jane@Home.com ',
    offer: 'Qualify',
    answers: { service_needed: 'Exterior painting', start_timeline: 'hacked', homeowner: 'Yes' },
    tracking: { utm_source: 'fb', evil: 'x' },
  },
  'LOC',
);
assert.equal(contact.locationId, 'LOC');
assert.equal(contact.firstName, 'Jane');
assert.equal(contact.lastName, 'Q Doe');
assert.equal(contact.postalCode, '77840');
assert.equal(contact.email, 'jane@home.com');
assert.equal(offer, 'qualify');
// Answers map to PEP's existing custom fields; homeowner goes into Property type.
assert.deepEqual(contact.customFields, [
  { id: 'ou2rHBHJbnvNZbuWlbgS', field_value: 'Exterior painting' },
  { id: 'ReDStk2oFDyVToo9C8K9', field_value: 'Homeowner' },
]);
// Unknown answers and tracking keys are dropped.
assert.deepEqual(answers, { service_needed: 'Exterior painting', homeowner: 'Yes' });
assert.deepEqual(tracking, { utm_source: 'fb' });

// Contact-only step: no blank email/answers keys that would wipe existing data.
const partial = buildContact({ phone: '9795550123', postal_code: '7784' }, 'LOC').contact;
assert.deepEqual(Object.keys(partial).sort(), ['locationId', 'phone', 'source']);

// Offer slugs from the URL can't inject odd tags.
assert.equal(cleanOffer('10-off'), '10-off');
assert.equal(cleanOffer('a b<script>'), 'unknown');
assert.deepEqual(tagsFor('qualify', false), ['pep-test-funnel', 'offer-qualify']);
assert.deepEqual(tagsFor('qualify', true), ['pep-test-funnel', 'offer-qualify', 'funnel-completed']);
assert.match(noteFor('qualify', answers, tracking), /Service needed: Exterior painting\nStart timeline: -\nHomeowner: Yes\nutm_source: fb/);

// Webhook payload uses the original page's field names so the GHL workflow mappings still apply.
const hook = webhookBody(contact, answers, offer, tracking, 'https://x.test/qualify');
assert.equal(hook.get('first_name'), 'Jane');
assert.equal(hook.get('phone'), '+19795550123');
assert.equal(hook.get('postal_code'), '77840');
assert.equal(hook.get('services'), 'Exterior painting');
assert.equal(hook.get('timeline'), '');
assert.equal(hook.get('lead_source'), 'Website quote funnel');
assert.equal(hook.get('lead_offer'), 'qualify');
assert.equal(hook.get('property_type'), 'Homeowner');
assert.equal(hook.get('utm_source'), 'fb');

console.log('lead tests passed');
