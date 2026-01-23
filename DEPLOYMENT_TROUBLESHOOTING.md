# DigitalOcean App Platform Deployment Troubleshooting Guide

## Overview
This document outlines the successful troubleshooting steps for resolving deployment issues on DigitalOcean App Platform.

## Issue Encountered (January 21, 2026)

**Symptom:** API component showing as UNHEALTHY after deployment
**Root Cause:** Missing `_build_grounded_system_prompt` method in `AIService` class causing AttributeError

## Troubleshooting Steps

### 1. Check Deployment Status
```bash
doctl apps list
```
This shows the active and in-progress deployment IDs.

### 2. Get Detailed Deployment Information
```bash
# Using MCP tool
mcp_apps_apps_get_deployment_status --AppID <app-id>
```
This provides:
- Health status of all components
- Deployment phase (BUILDING, DEPLOYING, ACTIVE)
- Progress of build and deploy steps
- Timing information

### 3. Check Component Logs

**Build Logs:**
```bash
doctl apps logs <app-id> <component-name> --type build --deployment <deployment-id> --tail 100
```

**Runtime Logs:**
```bash
doctl apps logs <app-id> <component-name> --type run --tail 100
```

**Key Information to Look For:**
- Error messages and stack traces
- Missing imports or methods
- Database connection issues
- Health check failures

### 4. Verify Health Endpoint
```bash
curl -k https://<your-domain>/api/health
```
This confirms if the API is actually responding despite showing as UNHEALTHY in the dashboard.

### 5. Check Migration Job Status
```bash
doctl apps logs <app-id> release-migrate --type run --deployment <deployment-id> --tail 50
```
Ensures database migrations completed successfully.

## Resolution Steps

### For Missing Method/Import Errors:

1. **Identify the Error:**
   - Check runtime logs for AttributeError or ImportError
   - Note the exact method/class that's missing

2. **Verify Code in Repository:**
   - Check if the method exists in the current codebase
   - Confirm the deployment is using the correct commit hash

3. **Wait for New Deployment:**
   - If code is correct, wait for the in-progress deployment to complete
   - Monitor deployment progress using `mcp_apps_apps_get_deployment_status`

4. **Verify Deployment Completion:**
   - Check that deployment phase is "ACTIVE"
   - Verify all steps show "SUCCESS"
   - Confirm the active deployment ID matches the new deployment

5. **Test Health Endpoint:**
   - Use curl to verify the API responds correctly
   - Check that the response includes expected data

## Common Issues and Solutions

### Issue: API Shows UNHEALTHY but Responds Correctly
**Solution:** This can be a temporary caching issue. The API is likely healthy if:
- Health endpoint returns correct response
- No errors in runtime logs
- Application startup completed successfully

### Issue: Deployment Stuck in BUILDING Phase
**Solution:**
- Check build logs for errors
- Verify Dockerfile and dependencies are correct
- Check for network issues or registry problems

### Issue: Migration Job Fails
**Solution:**
- Check migration logs for SQL errors
- Verify DATABASE_URL environment variable is correct
- Check for conflicting migration versions

### Issue: Health Check Timeout
**Solution:**
- Increase `initial_delay_seconds` in health check config
- Verify health endpoint path is correct
- Check if app takes longer to start up

## Monitoring Commands

### Quick Status Check
```bash
doctl apps list
```

### Detailed Health Check
```bash
mcp_apps_apps_get_deployment_status --AppID <app-id>
```

### Live Log Streaming
```bash
doctl apps logs <app-id> <component-name> --type run --follow
```

## Best Practices

1. **Always check logs first** - Runtime logs reveal the actual errors
2. **Verify commit hash** - Ensure deployment is using the correct code version
3. **Test health endpoint directly** - Dashboard status may lag behind actual state
4. **Monitor deployment progress** - Don't assume failure until all steps complete
5. **Check migration logs** - Database issues often cause deployment failures

## Key Takeaways

- The deployment system may show components as UNHEALTHY temporarily during rollout
- Always verify actual functionality by testing endpoints directly
- Runtime logs are the most reliable source of truth for errors
- Deployment completion doesn't always mean immediate health status update
- Migration jobs must complete before services can start successfully

## Related Files
- `backend/app/services/ai_service.py` - AI service implementation
- `backend/app/main.py` - Health endpoint definition
- `.do/app.yaml` - App Platform configuration

## Tools Used
- `doctl` CLI - DigitalOcean command-line tool
- MCP Apps tools - Model Context Protocol for app management
- `curl` - HTTP endpoint testing
