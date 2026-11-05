import { forwardRef, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { captureLead, readTracking, type Answers } from '@/lib/api';
import { track } from '@/lib/pixel';
import { BUSINESS_PHONE, PHONE_PLACEHOLDER } from '@/lib/config';

// Same no-button flow as the M&M funnel:
// 1. Name, phone, ZIP. Once all three are valid the lead is saved to GoHighLevel and the questions start
//    (after a short typing pause, on Enter/"Next", or right away on autofill).
// 2. Three questions. Tapping an answer saves it and moves on.
// 3. Email (moves on once valid, or Skip). Nobody is disqualified.

type Question = { key: keyof Answers; title: string; options: string[] };

// Options must match QUESTIONS in api/lead.js exactly (the server drops anything else).
const QUESTIONS: Question[] = [
  {
    key: 'service_needed',
    title: 'What would you like painted?',
    options: ['Interior painting', 'Exterior painting', 'Cabinets', 'Fence or staining', 'Something else'],
  },
  {
    key: 'start_timeline',
    title: 'When are you hoping to start?',
    options: ['As soon as possible', 'Within a month', 'In 1 to 3 months', 'Just getting prices'],
  },
  { key: 'homeowner', title: 'Are you the homeowner?', options: ['Yes', 'No'] },
];

const EMAIL_STEP = QUESTIONS.length + 1;
const DONE_STEP = EMAIL_STEP + 1;
const IDLE_MS = 1500; // pause after the last keystroke before moving on

type ContactKey = 'full_name' | 'phone' | 'postal_code';
const CONTACT_FIELDS: { key: ContactKey; label: string; placeholder: string; type: string; autoComplete: string; inputMode?: 'tel' | 'numeric'; hint: string }[] = [
  { key: 'full_name', label: 'Full name', placeholder: 'Jane Doe', type: 'text', autoComplete: 'name', hint: 'Please enter your name.' },
  { key: 'phone', label: 'Mobile phone', placeholder: PHONE_PLACEHOLDER, type: 'tel', autoComplete: 'tel-national', inputMode: 'tel', hint: 'Please enter a 10-digit phone number.' },
  { key: 'postal_code', label: 'ZIP code', placeholder: '77840', type: 'text', autoComplete: 'postal-code', inputMode: 'numeric', hint: 'Please enter a 5-digit ZIP code.' },
];

const VALID: Record<ContactKey, (v: string) => boolean> = {
  full_name: (v) => v.trim().length >= 2,
  phone: (v) => v.replace(/\D/g, '').length >= 10,
  postal_code: (v) => /^\d{5}$/.test(v.trim()),
};
const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v.trim());

const InstantForm = forwardRef<HTMLDivElement, { offer: string }>(function InstantForm({ offer }, ref) {
  const [step, setStep] = useState(0); // 0 = contact, 1..3 = questions, 4 = email, 5 = done
  const [contact, setContact] = useState<Record<ContactKey, string>>({ full_name: '', phone: '', postal_code: '' });
  const [answers, setAnswers] = useState<Answers>({});
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState<Partial<Record<ContactKey | 'email', boolean>>>({});
  const honeypot = useRef<HTMLInputElement>(null);
  const savedContact = useRef(''); // contact as last saved, so Back doesn't bounce them forward again
  const tracking = useRef(readTracking());

  const allValid = CONTACT_FIELDS.every((f) => VALID[f.key](contact[f.key]));
  const contactKey = JSON.stringify(contact);
  const changed = contactKey !== savedContact.current;
  const pct = Math.round((step / DONE_STEP) * 100);

  function save(stage: 'lead' | 'complete', a: Answers, mail = '') {
    return captureLead({ ...contact, email: mail, answers: a, stage, offer, tracking: tracking.current, page_url: window.location.href, company_fax: honeypot.current?.value ?? '' });
  }

  function startQuestions() {
    if (step !== 0) return;
    if (changed) {
      if (!savedContact.current) track('Lead');
      savedContact.current = contactKey;
      save('lead', answers).catch(() => {}); // every later step resends everything, so a missed save recovers
    }
    setStep(1);
  }

  async function finish(mail: string) {
    if (step !== EMAIL_STEP) return;
    setStep(DONE_STEP);
    await save('complete', answers, mail).catch(() => {}); // never dead-end on a failed save
    track('CompleteRegistration');
  }

  // Auto-advance once name, phone and ZIP are all valid and they've stopped typing.
  useEffect(() => {
    if (step !== 0 || !allValid || !changed) return;
    const t = window.setTimeout(startQuestions, IDLE_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactKey, step, allValid, changed]);

  // Same for the email screen.
  useEffect(() => {
    if (step !== EMAIL_STEP || !validEmail(email)) return;
    const t = window.setTimeout(() => finish(email.trim()), IDLE_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, step]);

  function answer(q: Question, option: string) {
    const next = { ...answers, [q.key]: option };
    setAnswers(next);
    save('lead', next).catch(() => {});
    setStep((s) => s + 1);
  }

  const q = step > 0 && step <= QUESTIONS.length ? QUESTIONS[step - 1] : null;
  const firstName = contact.full_name.trim().split(/\s+/)[0];
  const backBtn = (
    <button type="button" onClick={() => setStep((s) => s - 1)} className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-pep-muted hover:text-pep-navy">
      <ArrowLeft className="w-4 h-4" /> Back
    </button>
  );

  return (
    <div ref={ref} className="bg-white text-pep-ink rounded-lg shadow-[0_6px_20px_rgba(10,20,40,.18)] overflow-hidden scroll-mt-4 text-left">
      <div className="h-1.5 bg-[#eef1f5]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`Progress ${pct} percent`}>
        <div className="h-full bg-pep-gold transition-[width] duration-300 ease-out" style={{ width: `${Math.max(pct, 6)}%` }} />
      </div>

      {/* Hidden from people; bots fill it. */}
      <input ref={honeypot} type="text" name="company_fax" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[10000px] h-0 w-0 opacity-0" />

      <div key={step} className="p-5 md:p-8 animate-fade-in">
        {step === 0 && (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault(); // Enter / "Next" on the phone keyboard
              if (allValid) startQuestions();
              else setTouched({ full_name: true, phone: true, postal_code: true });
            }}
          >
            <div className="space-y-3">
              {CONTACT_FIELDS.map((f) => {
                const bad = touched[f.key] && !VALID[f.key](contact[f.key]);
                return (
                  <div key={f.key}>
                    <label className="block text-sm font-semibold mb-1.5" htmlFor={f.key}>{f.label}</label>
                    <input
                      id={f.key}
                      name={f.key}
                      type={f.type}
                      inputMode={f.inputMode}
                      autoComplete={f.autoComplete}
                      enterKeyHint={f.key === 'postal_code' ? 'go' : 'next'}
                      maxLength={f.key === 'postal_code' ? 5 : undefined}
                      className={`input-pep ${bad ? 'border-pep-err' : ''}`}
                      placeholder={f.placeholder}
                      value={contact[f.key]}
                      aria-invalid={bad || undefined}
                      onChange={(e) => {
                        const v = f.key === 'postal_code' ? e.target.value.replace(/\D/g, '').slice(0, 5) : e.target.value;
                        setContact((c) => ({ ...c, [f.key]: v }));
                      }}
                      onBlur={() => setTouched((t) => ({ ...t, [f.key]: true }))}
                    />
                    {bad && <p className="mt-1 text-sm text-pep-err">{f.hint}</p>}
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs leading-snug text-pep-muted">
              By entering your info, you agree to receive calls and texts from Professional Edge Painting about your quote. Message and data
              rates may apply. Reply STOP to opt out. Consent is not a condition of purchase.
            </p>
            {/* Lets Enter submit without showing a button. */}
            <button type="submit" tabIndex={-1} aria-hidden className="absolute -left-[10000px] h-px w-px overflow-hidden" />
            <p className={`mt-3 flex items-center justify-center gap-2 text-sm font-semibold text-pep-ok transition-opacity ${allValid && changed ? 'opacity-100' : 'opacity-0'}`} aria-live="polite">
              <Check className="w-4 h-4" /> {allValid && changed ? 'Got it! Loading your questions...' : ''}
            </p>
          </form>
        )}

        {q && (
          <>
            <h2 className="text-lg md:text-xl font-bold text-pep-navy text-center">{q.title}</h2>
            <div className="mt-5 space-y-2.5">
              {q.options.map((o) => (
                <button key={o} type="button" onClick={() => answer(q, o)} className={`answer-pep ${answers[q.key] === o ? 'border-pep-gold bg-[#fdf3dc]' : ''}`}>
                  {o}
                </button>
              ))}
            </div>
            {backBtn}
          </>
        )}

        {step === EMAIL_STEP && (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (validEmail(email)) finish(email.trim());
              else setTouched((t) => ({ ...t, email: true }));
            }}
          >
            <h2 className="text-lg md:text-xl font-bold text-pep-navy text-center">Last step: where should we email your quote?</h2>
            <label className="block text-sm font-semibold mt-5 mb-1.5" htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              enterKeyHint="go"
              autoFocus
              className={`input-pep ${touched.email && !validEmail(email) ? 'border-pep-err' : ''}`}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            />
            {touched.email && email && !validEmail(email) && <p className="mt-1 text-sm text-pep-err">Please enter a valid email.</p>}
            <button type="submit" tabIndex={-1} aria-hidden className="absolute -left-[10000px] h-px w-px overflow-hidden" />
            <div className="flex items-center justify-between">
              {backBtn}
              <button type="button" onClick={() => finish('')} className="mt-5 text-sm font-semibold text-pep-muted underline hover:text-pep-navy">
                Skip
              </button>
            </div>
          </form>
        )}

        {step === DONE_STEP && (
          <div className="text-center py-2">
            <div className="mx-auto mb-3 grid h-[52px] w-[52px] place-items-center rounded-full bg-[#fdf3dc]">
              <Check className="w-7 h-7 text-pep-navy" strokeWidth={2.6} />
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-pep-navy">Thanks{firstName ? `, ${firstName}` : ''}. You're all set!</h2>
            <p className="mt-2 text-pep-muted">Devan will reach out shortly with your savings and to schedule your walkthrough.</p>
            <p className="mt-2 text-pep-muted">
              Need us sooner? Call or text <a href={`tel:${BUSINESS_PHONE}`} className="font-bold text-pep-navy whitespace-nowrap">{BUSINESS_PHONE}</a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
});

export default InstantForm;
