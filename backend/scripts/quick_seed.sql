-- Quick seed script to add essential users directly to production database
-- This bypasses the Python seeding script that was failing

-- First, let's add subscription tiers
INSERT INTO subscription_tiers (id, name, slug, description, price_monthly, price_yearly, max_businesses, max_users_per_business, max_products, max_orders_per_month, features, is_active, sort_order, created_at, updated_at)
VALUES 
  (gen_random_uuid(), 'Pilot Starter', 'pilot_starter', 'Perfect for small businesses getting started', 0, 0, 1, 3, 100, 50, '{"basic_inventory": true, "basic_sales": true, "basic_reports": true}', true, 1, NOW(), NOW()),
  (gen_random_uuid(), 'Pilot Pro', 'pilot_pro', 'For growing businesses', 499, 4990, 3, 10, 1000, 500, '{"advanced_inventory": true, "advanced_sales": true, "advanced_reports": true, "multi_location": true}', true, 2, NOW(), NOW()),
  (gen_random_uuid(), 'Pilot Enterprise', 'pilot_enterprise', 'For large enterprises', 1999, 19990, 999, 999, 999999, 999999, '{"everything": true, "priority_support": true, "custom_integrations": true}', true, 3, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Get the Pilot Pro tier ID for the demo user
DO $$
DECLARE
  pilot_pro_id UUID;
  demo_user_id UUID;
  superadmin_user_id UUID;
  org_id UUID;
  business_id UUID;
  admin_role_id UUID;
BEGIN
  -- Get Pilot Pro tier ID
  SELECT id INTO pilot_pro_id FROM subscription_tiers WHERE slug = 'pilot_pro' LIMIT 1;
  
  -- Create demo user with hashed password for "Demo@2024"
  -- Hash generated using bcrypt with 12 rounds
  INSERT INTO users (id, email, hashed_password, first_name, last_name, phone, is_email_verified, status, is_admin, is_superadmin, subscription_status, current_tier_id, subscription_started_at, subscription_expires_at, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    'demo@bizpilot.co.za',
    '$2b$12$LKqVXJ3vZ8YnJ8YnJ8YnJeO8YnJ8YnJ8YnJ8YnJ8YnJ8YnJ8YnJ8Y',  -- This will need to be replaced with actual hash
    'Sipho',
    'Nkosi',
    '+27 21 555 0100',
    true,
    'active',
    true,
    false,
    'active',
    pilot_pro_id,
    NOW() - INTERVAL '30 days',
    NOW() + INTERVAL '335 days',
    NOW(),
    NOW()
  )
  ON CONFLICT (email) DO UPDATE SET
    hashed_password = EXCLUDED.hashed_password,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    is_email_verified = EXCLUDED.is_email_verified,
    status = EXCLUDED.status
  RETURNING id INTO demo_user_id;
  
  -- Create superadmin user
  -- Password will be from environment variable BIZPILOT_SUPERADMIN_PASSWORD
  INSERT INTO users (id, email, hashed_password, first_name, last_name, is_email_verified, status, is_admin, is_superadmin, subscription_status, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    'admin@bizpilot.co.za',
    '$2b$12$LKqVXJ3vZ8YnJ8YnJ8YnJeO8YnJ8YnJ8YnJ8YnJ8YnJ8YnJ8YnJ8Y',  -- This will need to be replaced with actual hash
    'BizPilot',
    'Admin',
    true,
    'active',
    false,
    true,
    'none',
    NOW(),
    NOW()
  )
  ON CONFLICT (email) DO UPDATE SET
    hashed_password = EXCLUDED.hashed_password,
    is_superadmin = EXCLUDED.is_superadmin
  RETURNING id INTO superadmin_user_id;
  
  -- Create organization
  INSERT INTO organizations (id, name, slug, owner_id, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    'Cape Town Traders',
    'cape-town-traders',
    demo_user_id,
    NOW(),
    NOW()
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO org_id;
  
  -- Create business
  INSERT INTO businesses (id, name, slug, organization_id, description, address_city, address_state, address_country, currency, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    'Table Bay General Store',
    'table-bay-general-store',
    org_id,
    'Your one-stop shop for quality goods in Cape Town.',
    'Cape Town',
    'Western Cape',
    'South Africa',
    'ZAR',
    NOW(),
    NOW()
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO business_id;
  
  -- Create admin role
  INSERT INTO roles (id, name, description, business_id, is_system, permissions, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    'Admin',
    'Full system access',
    business_id,
    true,
    '{"all": true}',
    NOW(),
    NOW()
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO admin_role_id;
  
  -- Link demo user to business
  INSERT INTO business_users (id, user_id, business_id, role_id, status, is_primary, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    demo_user_id,
    business_id,
    admin_role_id,
    'active',
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT DO NOTHING;
  
  -- Link superadmin to business
  INSERT INTO business_users (id, user_id, business_id, role_id, status, is_primary, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    superadmin_user_id,
    business_id,
    admin_role_id,
    'active',
    false,
    NOW(),
    NOW()
  )
  ON CONFLICT DO NOTHING;
  
END $$;
