import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom';
import OptInPage from '@/pages/OptInPage';
import { DEFAULT_OFFER, OFFERS } from '@/lib/offers';
import { track } from '@/lib/pixel';

// "/" and unknown slugs show the default offer; "/<slug>" shows that offer from src/lib/offers.ts.
function OfferRoute() {
  const { offer = DEFAULT_OFFER } = useParams();
  const slug = offer.toLowerCase() in OFFERS ? offer.toLowerCase() : DEFAULT_OFFER;
  useEffect(() => {
    track('PageView'); // no-op until the pixel ID is set
  }, [slug]);
  return <OptInPage key={slug} slug={slug} offer={OFFERS[slug]} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<OfferRoute />} />
        <Route path="/:offer" element={<OfferRoute />} />
      </Routes>
    </BrowserRouter>
  );
}
