export function getVariantLimitForPlan(planName) {
    if (!planName) return 10;
    
    const lowerPlan = planName.toLowerCase();
    
    if (lowerPlan.includes('startup')) return 100;
    if (lowerPlan.includes('growth')) return 500;
    if (lowerPlan.includes('expand')) return null;
    
    return 10;
}

export const SUBSCRIPTION_TIERS = {
    FREE: { name: 'Free', limit: 10 },
    STARTUP: { name: 'Startup', limit: 100 },
    GROWTH: { name: 'Growth', limit: 500 },
    EXPAND: { name: 'Expand', limit: null }
};
