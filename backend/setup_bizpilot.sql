-- BizPilot Database Setup Script
-- Run with: psql -U postgres -f setup_bizpilot.sql

-- Create database
DROP DATABASE IF EXISTS bizpilot;
CREATE DATABASE bizpilot;

-- Create user
DROP USER IF EXISTS bizpilot_user;
CREATE USER bizpilot_user WITH 
    LOGIN 
    PASSWORD 'btXZ6v71UVjzTCnaFWqe9oY4';

-- Grant database privileges
GRANT ALL PRIVILEGES ON DATABASE bizpilot TO bizpilot_user;

-- Connect to bizpilot database
\c bizpilot

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO bizpilot_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO bizpilot_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO bizpilot_user;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO bizpilot_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO bizpilot_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO bizpilot_user;

-- Verify setup
SELECT 
    current_database() as database,
    current_user as user,
    version() as postgres_version;

-- Show success message
\echo '✅ Database setup complete!'
\echo 'Database: bizpilot'
\echo 'User: bizpilot_user'
\echo 'Password: btXZ6v71UVjzTCnaFWqe9oY4'
