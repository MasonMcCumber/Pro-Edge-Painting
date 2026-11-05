import { useState, type CSSProperties } from 'react';
import InstantForm from '@/components/InstantForm';
import type { Offer } from '@/lib/offers';

const SITE = 'https://professionaledgepainting.com';
const LOGO = `${SITE}/photos/web/logo_mark.png`;

// Before/after pairs from the main site.
const RESULTS = [
  { after: 'After_IMG_1873', before: 'Before_IMG_1872', caption: 'Full exterior repaint, color change' },
  { after: 'After_IMG_3281', before: 'Before_IMG_3280', caption: 'Full paint exterior, remodel' },
  { after: 'After_IMG_3276', before: 'Before_IMG_3275', caption: 'Backyard pergola refinished' },
  { after: 'After_IMG_3266', before: 'Before_IMG_3267', caption: 'Refinished double entry doors, stain and clear' },
  { after: 'After_IMG_3270', before: 'Before_IMG_3269', caption: 'Front door finished in red' },
  { after: 'After_IMG_3273', before: 'Before_IMG_3271', caption: 'Weathered garage door refinished' },
];

function Logo({ small }: { small?: boolean }) {
  return (
    <a href={SITE} className="flex items-center gap-3" aria-label="Professional Edge Painting home">
      <img src={LOGO} alt="" className={small ? 'w-10' : 'w-11'} />
      <span className="grid text-left font-logo leading-tight">
        <span className={`font-bold text-pep-navy ${small ? 'text-lg' : 'text-xl md:text-2xl'}`}>Professional Edge Painting</span>
        <span className="text-sm font-medium text-pep-muted">Brazos Valley, TX</span>
      </span>
    </a>
  );
}

function BeforeAfter({ before, after, caption }: (typeof RESULTS)[number]) {
  const [pos, setPos] = useState(50);
  return (
    <figure className="m-0 overflow-hidden rounded-[10px] border border-pep-line bg-white">
      <div className="ba relative aspect-[4/5] select-none overflow-hidden" style={{ '--pos': `${pos}%` } as CSSProperties}>
        <img src={`${SITE}/photos/web/${after}.jpg`} alt={`After: ${caption}`} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        <img src={`${SITE}/photos/web/${before}.jpg`} alt={`Before: ${caption}`} loading="lazy" className="ba-before absolute inset-0 h-full w-full object-cover" />
        <span className="ba-tag left-2.5 bg-pep-navy/85">Before</span>
        <span className="ba-tag right-2.5 bg-[#1f6fd1]">After</span>
        <span className="ba-handle" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="#1c2b45" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
            <path d="M9 7l-5 5 5 5M15 7l5 5-5 5" />
          </svg>
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={pos}
          onChange={(e) => setPos(+e.target.value)}
          aria-label={`Compare before and after: ${caption}`}
          className="absolute inset-0 z-[3] m-0 h-full w-full cursor-ew-resize appearance-none opacity-0 [touch-action:pan-y]"
        />
      </div>
      <figcaption className="px-3.5 py-3 text-sm font-medium">{caption}</figcaption>
    </figure>
  );
}

export default function OptInPage({ slug, offer }: { slug: string; offer: Offer }) {
  return (
    <div className="mx-auto grid max-w-[880px] justify-items-center gap-4 px-4 pb-8 pt-4">
      <header>
        <Logo />
      </header>

      <main className="w-full rounded-[10px] border-[3px] border-pep-gold bg-pep-panel px-3.5 pb-8 pt-6 text-center text-white md:px-8">
        <h1 className="text-[1.65rem] md:text-[2.4rem] font-extrabold leading-[1.1] tracking-[-0.01em]">{offer.headline}</h1>
        <p className="mx-auto mb-5 mt-2 max-w-xl text-[15px] md:text-base font-semibold text-[#d9e0ec]">{offer.sub}</p>
        <div className="mx-auto max-w-[600px]">
          <InstantForm offer={slug} />
        </div>
      </main>

      <section className="w-full pt-4" aria-labelledby="results-title">
        <p className="mb-1.5 text-xs font-extrabold uppercase tracking-[.14em] text-[#1f5fa8]">Real results</p>
        <h2 id="results-title" className="mb-4 font-display text-[1.4rem] md:text-3xl font-extrabold leading-tight text-pep-navy">
          Before &amp; After: Real Painting Projects in the Brazos Valley
        </h2>
        <div className="grid grid-cols-1 gap-4 min-[481px]:grid-cols-2 md:grid-cols-3">
          {RESULTS.map((r) => (
            <BeforeAfter key={r.after} {...r} />
          ))}
        </div>
      </section>

      <footer className="grid justify-items-center gap-2.5 pt-5 text-center">
        <Logo small />
        <a className="text-sm text-[#1f6fd1] hover:underline" href={`${SITE}/privacy-page/`} target="_blank" rel="noopener">
          Privacy policy
        </a>
        <p className="text-[13px] font-bold">Copyright {new Date().getFullYear()} Professional Edge Painting LLC. All Rights Reserved.</p>
        <p className="max-w-xl text-xs text-pep-muted">
          This site is not a part of the Facebook website or Facebook Inc. Additionally, this site is NOT endorsed by Facebook in any way.
          FACEBOOK is a trademark of FACEBOOK, Inc.
        </p>
      </footer>
    </div>
  );
}
