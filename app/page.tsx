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

function Page() {
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
        <Quiz />
      </Popup>
    </>
  );
}

export default Page;
