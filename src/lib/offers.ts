// One entry per test page. The key is the URL: /qualify, /10-off, ...
// Point each Meta ad at its own URL; leads get tagged offer-<key> in GoHighLevel.
// Keep keys short, lowercase, letters/numbers/dashes (api/lead.js rejects anything else).

export type Offer = { headline: string; sub: string };

export const OFFERS: Record<string, Offer> = {
  qualify: {
    headline: 'See If You Qualify For Big Painting Savings',
    sub: 'A 30-second survey shows how much you could save on painting. No commitment required.',
  },
};

export const DEFAULT_OFFER = 'qualify';
