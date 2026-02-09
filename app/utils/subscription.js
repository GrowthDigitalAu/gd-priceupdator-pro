export function getVariantLimitForPlan(planName) {
    if (!planName) return 5;
    
    const lowerPlan = planName.toLowerCase();
    
    if (lowerPlan.includes('startup')) return 10;
    if (lowerPlan.includes('growth')) return 15;
    if (lowerPlan.includes('expand')) return null;
    
    return 5;
}

export const SUBSCRIPTION_TIERS = {
    FREE: { name: 'Free', limit: 5 },
    STARTUP: { name: 'Startup', limit: 10 },
    GROWTH: { name: 'Growth', limit: 15 },
    EXPAND: { name: 'Expand', limit: null }
};
