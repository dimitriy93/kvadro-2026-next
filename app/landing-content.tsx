'use client';
import { useState } from 'react';
import { Services } from '@/widgets/services';
import { Stats } from '@/widgets/stats';
import { Clients } from '@/widgets/clients';
import { CTA } from '@/widgets/cta';
import { Footer } from '@/widgets/footer';
import { Popup } from '@/components/popup';
import { Hero } from '@/widgets/hero';
import { Quiz } from '@/widgets/quiz';
import '@/styles/landing.scss';

interface LandingContentProps {
  turnstileSiteKey: string;
}

export function LandingContent({ turnstileSiteKey }: LandingContentProps) {
  const [isQuizOpen, setQuizOpen] = useState(false);

  return (
    <>
      <Hero onOpenQuiz={() => setQuizOpen(true)} />
      <Services />
      <Stats />
      <Clients />
      <CTA onOpenQuiz={() => setQuizOpen(true)} />
      <Footer />

      <Popup isOpen={isQuizOpen} onClose={() => setQuizOpen(false)}>
        <Quiz onClose={() => setQuizOpen(false)} turnstileSiteKey={turnstileSiteKey} />
      </Popup>
    </>
  );
}