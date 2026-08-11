import {LandingContent} from './landing-content';

export default function Page() {
    const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

    return <LandingContent turnstileSiteKey={turnstileSiteKey}/>;
}
