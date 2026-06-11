import {AREA_PRICING, SERVICE_MULTIPLIERS} from "../model/pricing.constants";

export function calculatePrice(area?: string, systems?: string[]) {
    if (!area) return { min: 0, max: 0 };

    const base = AREA_PRICING[area as keyof typeof AREA_PRICING] || 0;

    if (!systems?.length) {
        return { min: base, max: base };
    }

    const maxMultiplier = Math.max(
        ...systems.map((s) => SERVICE_MULTIPLIERS[s] || 1)
    );

    return {
        min: base,
        max: Math.round(base * maxMultiplier),
    };
}