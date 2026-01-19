/**
 * Validation script for pricing utilities
 * 
 * This script validates that the pricing utility functions work correctly
 * with the pricing configuration data.
 */

import { PricingUtils } from './pricing-utils';
import { SUBSCRIPTION_TIERS } from './pricing-config';

console.log('🧪 Validating Pricing Utilities...\n');

// Test 1: Format pricing
console.log('1. Testing price formatting:');
console.log('   Free tier:', PricingUtils.formatPrice(0));
console.log('   Custom pricing:', PricingUtils.formatPrice(-1));
console.log('   Pilot Lite (R199):', PricingUtils.formatPrice(19900, 'ZAR'));
console.log('   Pilot Core (R799):', PricingUtils.formatPrice(79900, 'ZAR'));
console.log('   Pilot Pro (R1499):', PricingUtils.formatPrice(149900, 'ZAR'));

// Test 2: Format with cycles
console.log('\n2. Testing price formatting with cycles:');
console.log('   Monthly R199:', PricingUtils.formatPriceWithCycle(19900, 'monthly', 'ZAR'));
console.log('   Yearly R1910:', PricingUtils.formatPriceWithCycle(191040, 'yearly', 'ZAR'));
console.log('   Free monthly:', PricingUtils.formatPriceWithCycle(0, 'monthly', 'ZAR'));
console.log('   Custom monthly:', PricingUtils.formatPriceWithCycle(-1, 'monthly', 'ZAR'));

// Test 3: Calculate yearly savings
console.log('\n3. Testing yearly savings calculations:');
const pilotLiteSavings = PricingUtils.calculateYearlySavings(19900, 191040);
const pilotCoreSavings = PricingUtils.calculateYearlySavings(79900, 767040);
const pilotProSavings = PricingUtils.calculateYearlySavings(149900, 1439040);
console.log('   Pilot Lite savings:', pilotLiteSavings + '%');
console.log('   Pilot Core savings:', pilotCoreSavings + '%');
console.log('   Pilot Pro savings:', pilotProSavings + '%');

// Test 4: Tier lookup functions
console.log('\n4. Testing tier lookup functions:');
const pilotLite = PricingUtils.getTierById('pilot_lite');
const pilotCore = PricingUtils.getTierByName('pilot_core');
const defaultTier = PricingUtils.getDefaultTier();
const enterprise = PricingUtils.getTierById('enterprise');

console.log('   Pilot Lite by ID:', pilotLite?.display_name);
console.log('   Pilot Core by name:', pilotCore?.display_name);
console.log('   Default tier:', defaultTier?.display_name);
console.log('   Enterprise tier:', enterprise?.display_name);

// Test 5: Custom pricing detection
console.log('\n5. Testing custom pricing detection:');
console.log('   Pilot Lite has custom pricing:', PricingUtils.hasCustomPricing(pilotLite!));
console.log('   Enterprise has custom pricing:', PricingUtils.hasCustomPricing(enterprise!));

// Test 6: Free tier detection
console.log('\n6. Testing free tier detection:');
const pilotSolo = PricingUtils.getTierById('pilot_solo');
console.log('   Pilot Solo is free:', PricingUtils.isFree(pilotSolo!));
console.log('   Pilot Lite is free:', PricingUtils.isFree(pilotLite!));

// Test 7: Active tiers
console.log('\n7. Testing active tiers:');
const activeTiers = PricingUtils.getActiveTiers();
console.log('   Number of active tiers:', activeTiers.length);
console.log('   Tier order:', activeTiers.map(t => t.display_name).join(' → '));

// Test 8: Tier comparison
console.log('\n8. Testing tier comparison:');
if (pilotLite && pilotCore) {
  const comparison = PricingUtils.compareTiers(pilotCore, pilotLite, 'monthly');
  console.log('   Pilot Core vs Pilot Lite:');
  console.log('     Core is more expensive:', comparison.tier1IsMoreExpensive);
  console.log('     Price difference:', comparison.priceDifferenceFormatted);
}

// Test 9: Contact sales info
console.log('\n9. Testing contact sales info:');
if (enterprise) {
  const contactInfo = PricingUtils.getContactSalesInfo(enterprise);
  console.log('   Enterprise contact sales:', contactInfo.shouldShowContactSales);
  console.log('   Contact method:', contactInfo.contactMethod);
  console.log('   Contact value:', contactInfo.contactValue);
}

// Test 10: Tier change info
console.log('\n10. Testing tier change info:');
if (pilotLite && pilotCore) {
  const upgradeInfo = PricingUtils.getTierChangeInfo(pilotLite, pilotCore);
  console.log('    Lite → Core is upgrade:', upgradeInfo.isUpgrade);
  console.log('    Change type:', upgradeInfo.changeType);
  console.log('    Requires contact sales:', upgradeInfo.requiresContactSales);
}

// Test 11: Tier validation
console.log('\n11. Testing tier validation:');
const allValidation = PricingUtils.validateAllTiers();
console.log('    All tiers valid:', allValidation.isValid);
console.log('    Global errors:', allValidation.globalErrors.length);
console.log('    Global warnings:', allValidation.globalWarnings.length);

// Test 12: Tier recommendation
console.log('\n12. Testing tier recommendation:');
const recommendation = PricingUtils.getRecommendedTier({
  maxUsers: 3,
  maxOrdersPerMonth: 100,
  maxTerminals: 1,
  requiredFeatures: ['basic_reports']
});
console.log('    Recommended tier:', recommendation.recommendedTier?.display_name);
console.log('    Reasons:', recommendation.reasons.join(', '));

// Test 13: Format tier prices
console.log('\n13. Testing tier price formatting:');
activeTiers.forEach(tier => {
  const monthlyPrice = PricingUtils.formatTierPrice(tier, 'monthly');
  const yearlyPrice = PricingUtils.formatTierPrice(tier, 'yearly');
  console.log(`    ${tier.display_name}: ${monthlyPrice} | ${yearlyPrice}`);
});

console.log('\n✅ All pricing utility validations completed!');

// Verify all tiers are present
console.log('\n📊 Tier Summary:');
console.log('Expected tiers: Pilot Solo, Pilot Lite, Pilot Core, Pilot Pro, Enterprise');
console.log('Actual tiers:', activeTiers.map(t => t.display_name).join(', '));

if (activeTiers.length === 5) {
  console.log('✅ All 5 tiers are present and active');
} else {
  console.log('❌ Expected 5 tiers, found', activeTiers.length);
}

// Verify pricing values match requirements
console.log('\n💰 Pricing Verification:');
const expectedPrices = {
  'pilot_solo': { monthly: 0, yearly: 0 },
  'pilot_lite': { monthly: 19900, yearly: 191040 },
  'pilot_core': { monthly: 79900, yearly: 767040 },
  'pilot_pro': { monthly: 149900, yearly: 1439040 },
  'enterprise': { monthly: -1, yearly: -1 }
};

let pricingCorrect = true;
for (const [tierId, expectedPrice] of Object.entries(expectedPrices)) {
  const tier = PricingUtils.getTierById(tierId);
  if (tier) {
    const monthlyMatch = tier.price_monthly_cents === expectedPrice.monthly;
    const yearlyMatch = tier.price_yearly_cents === expectedPrice.yearly;
    
    if (monthlyMatch && yearlyMatch) {
      console.log(`✅ ${tier.display_name}: Pricing correct`);
    } else {
      console.log(`❌ ${tier.display_name}: Pricing mismatch`);
      console.log(`   Expected: ${expectedPrice.monthly}/${expectedPrice.yearly}`);
      console.log(`   Actual: ${tier.price_monthly_cents}/${tier.price_yearly_cents}`);
      pricingCorrect = false;
    }
  } else {
    console.log(`❌ Tier ${tierId} not found`);
    pricingCorrect = false;
  }
}

if (pricingCorrect) {
  console.log('\n🎉 All pricing values match requirements!');
} else {
  console.log('\n⚠️  Some pricing values do not match requirements');
}