import { LandingContent } from './landing-content';

export default function Page() {
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

  console.log(
    'TURNSTILE SERVER SITE KEY:',
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? 'present' : 'missing'
  );

  return <LandingContent turnstileSiteKey={turnstileSiteKey} />;
}
