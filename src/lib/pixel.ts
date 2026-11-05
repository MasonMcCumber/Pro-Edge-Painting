import { META_PIXEL_ID } from './config';

// Meta (Facebook) Pixel. Does nothing until META_PIXEL_ID is set in src/lib/config.ts.

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push: Fbq;
  loaded: boolean;
  version: string;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

let initialised = false;

function initPixel() {
  if (initialised || !META_PIXEL_ID || typeof window === 'undefined') return;
  initialised = true;

  if (!window.fbq) {
    const fbq = function (...args: unknown[]) {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue.push(args);
    } as Fbq;
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = '2.0';
    fbq.queue = [];
    window.fbq = fbq;
    window._fbq = fbq;

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(script);
  }

  window.fbq?.('init', META_PIXEL_ID);
}

/** Track a standard Meta event, e.g. 'PageView', 'Lead', 'CompleteRegistration', 'Schedule'. */
export function track(event: string, params?: Record<string, unknown>) {
  if (!META_PIXEL_ID) return;
  initPixel();
  if (params) window.fbq?.('track', event, params);
  else window.fbq?.('track', event);
}
