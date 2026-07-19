import { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

export const IconDesign = (props: IconProps) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden {...props}>
        <path
            d="M4 18V6l8-3 8 3v12l-8 3-8-3Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
        />
        <path d="M12 3v18M4 6l8 3 8-3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
);

export const IconInstall = (props: IconProps) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden {...props}>
        <path
            d="M14 4h6v6M10 20H4v-6M20 4 9 15M9 15h4v4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

export const IconCommission = (props: IconProps) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden {...props}>
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 8v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

export const IconService = (props: IconProps) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden {...props}>
        <path
            d="M12 3 4 7v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V7l-8-4Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
        />
        <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

export const IconDocument = (props: IconProps) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden {...props}>
        <path
            d="M8 4h8l4 4v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
        />
        <path d="M16 4v4h4M9 13h6M9 17h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

export const IconCheck = (props: IconProps) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden {...props}>
        <path
            d="M20 6 9 17l-5-5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

const workIcons = [IconDesign, IconInstall, IconCommission, IconService] as const;

export const getWorkIcon = (index: number) => workIcons[index] ?? IconDesign;
