// Leads go to our own /api/lead function (api/lead.js), which saves them into Professional Edge Painting's GoHighLevel.

export type Answers = {
  service_needed?: string;
  start_timeline?: string;
  homeowner?: string;
};

export interface LeadPayload {
  full_name: string;
  phone: string;
  postal_code: string;
  email?: string;
  answers: Answers;
  stage: 'lead' | 'complete';
  offer: string;
  tracking: Record<string, string>;
  company_fax?: string; // honeypot
}

const TRACKING_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_placement', 'fbclid'];

export function readTracking(): Record<string, string> {
  const p = new URLSearchParams(window.location.search);
  const out: Record<string, string> = {};
  for (const k of TRACKING_KEYS) {
    const v = p.get(k);
    if (v) out[k] = v;
  }
  return out;
}

export async function captureLead(body: LeadPayload) {
  const res = await fetch('/api/lead', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive: true, // finishes the save even if they close the tab right after
  });
  if (!res.ok) throw new Error(`Lead save failed (${res.status})`);
}
