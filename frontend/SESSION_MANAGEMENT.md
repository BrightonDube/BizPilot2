# Session Management Implementation

## Overview

This document describes the automatic session management system implemented for BizPilot. The system provides:

- **Automatic token refresh** before expiry when user is active
- **Automatic logout** on idle timeout (no activity + token near expiry)
- **Activity tracking** to detect user interaction
- **Session expiration notifications** on the login page
- **Graceful handling** of token expiry without page refresh

## Architecture

### Components

1. **SessionManager** (`frontend/src/lib/session-manager.ts`)
   - Core session management logic
   - Tracks user activity (mouse, keyboard, scroll, touch)
   - Monitors token expiry time
   - Automatically refreshes tokens before expiry
   - Emits events for session state changes

2. **useSessionManager Hook** (`frontend/src/hooks/useSessionManager.ts`)
   - React integration for SessionManager
   - Handles session events and triggers logout/redirect
   - Configurable idle timeout and refresh timing

3. **AuthInitializer** (`frontend/src/components/auth/AuthInitializer.tsx`)
   - Initializes session management on app mount
   - Integrates with auth store

4. **Login Page** (`frontend/src/app/auth/login/page.tsx`)
   - Displays session expiration messages
   - Shows idle timeout notifications

## Configuration

Default settings (can be customized in `AuthInitializer.tsx`):

```typescript
{
  idleTimeout: 30 * 60 * 1000,        // 30 minutes of inactivity
  refreshBeforeExpiry: 5 * 60 * 1000, // Refresh 5 minutes before expiry
  checkInterval: 60 * 1000,           // Check every 1 minute
}
```

Backend token expiry settings (in `backend/app/core/config.py`):

```python
ACCESS_TOKEN_EXPIRE_MINUTES = 30  # Access token expires in 30 minutes
REFRESH_TOKEN_EXPIRE_DAYS = 7     # Refresh token expires in 7 days
```

## How It Works

### 1. Activity Tracking

The SessionManager tracks user activity by listening to:
- `mousedown` - Mouse clicks
- `keydown` - Keyboard input
- `scroll` - Page scrolling
- `touchstart` - Touch interactions

When activity is detected, the `lastActivity` timestamp is updated.

### 2. Token Expiry Monitoring

Every minute (configurable), the SessionManager:
1. Extracts the access token from cookies
2. Decodes the JWT to get the expiry time
3. Calculates time until expiry
4. Takes action based on user activity and time remaining

### 3. Automatic Token Refresh

When the user is **active** and the token is within 5 minutes of expiry:
- Automatically calls `/auth/refresh` endpoint
- Backend sets new access token cookie
- User continues working without interruption

### 4. Idle Timeout Logout

When the user is **idle** (no activity for 30 minutes) and the token is near expiry:
- Emits `session:idle` event
- Triggers logout in auth store
- Redirects to login page with idle timeout message
- Message stored in sessionStorage for display

### 5. Token Expiry Logout

When the token has expired:
- Emits `session:expired` event
- Triggers logout in auth store
- Redirects to login page with expiration message

## Event System

The SessionManager emits the following events:

| Event | Description | When Emitted |
|-------|-------------|--------------|
| `session:activity` | User became active after being idle | User interacts after idle period |
| `session:idle` | User is idle and session will expire | No activity + token near expiry |
| `session:refreshed` | Token was successfully refreshed | After successful token refresh |
| `session:expired` | Session has expired | Token expired or refresh failed |
| `session:logout` | User manually logged out | User clicks logout |

## User Experience

### Active User
- Token automatically refreshes every ~25 minutes (5 minutes before 30-minute expiry)
- User never sees interruptions
- Can work indefinitely as long as they're active

### Idle User
- After 30 minutes of no activity, if token is near expiry:
  - Automatically logged out
  - Redirected to login page
  - Sees message: "You were logged out due to inactivity (30 minutes)."

### Expired Session
- If token expires (e.g., user left tab open overnight):
  - Automatically logged out on next activity
  - Redirected to login page
  - Sees message: "Your session has expired. Please log in again."

## Testing

### Manual Testing

1. **Test Automatic Refresh**
   - Log in to the application
   - Stay active (click around, scroll, etc.)
   - Open browser DevTools → Network tab
   - Wait ~25 minutes
   - You should see a POST request to `/auth/refresh`
   - Session continues without interruption

2. **Test Idle Timeout**
   - Log in to the application
   - Don't interact with the page for 30 minutes
   - After 30 minutes, you should be redirected to login
   - Login page shows: "You were logged out due to inactivity"

3. **Test Token Expiry**
   - Log in to the application
   - In browser DevTools → Application → Cookies
   - Delete the `access_token` cookie
   - Try to navigate or make an API call
   - You should be redirected to login
   - Login page shows: "Your session has expired"

### Debugging

Enable debug logging by checking the browser console:
- `[Session] Session idle timeout: X minutes` - Idle logout triggered
- `[Session] Session expired: reason` - Token expiry detected
- `[Session] Token refreshed successfully` - Automatic refresh succeeded

## Security Considerations

1. **HttpOnly Cookies**: Access tokens are stored in HttpOnly cookies, preventing XSS attacks
2. **Automatic Refresh**: Tokens are refreshed proactively, reducing the window for token theft
3. **Idle Timeout**: Inactive sessions are terminated, reducing risk of unauthorized access
4. **Activity Tracking**: Only tracks interaction events, no sensitive data is logged

## Backend Integration

The session management system integrates with existing backend endpoints:

- `POST /auth/login` - Sets access_token and refresh_token cookies
- `POST /auth/refresh` - Refreshes access token using refresh_token cookie
- `POST /auth/logout` - Clears authentication cookies
- `GET /auth/me` - Validates current session

No backend changes are required for this implementation.

## Customization

### Adjust Idle Timeout

In `frontend/src/components/auth/AuthInitializer.tsx`:

```typescript
useSessionManager({
  enabled: true,
  idleTimeout: 60 * 60 * 1000, // 60 minutes instead of 30
  refreshBeforeExpiry: 5 * 60 * 1000,
});
```

### Adjust Refresh Timing

```typescript
useSessionManager({
  enabled: true,
  idleTimeout: 30 * 60 * 1000,
  refreshBeforeExpiry: 10 * 60 * 1000, // Refresh 10 minutes before expiry
});
```

### Disable Session Management

```typescript
useSessionManager({
  enabled: false, // Disable automatic session management
});
```

## Best Practices (2025)

This implementation follows modern best practices:

1. **Proactive Token Refresh**: Refresh before expiry, not after (prevents interruptions)
2. **Activity-Based Sessions**: Don't logout active users (better UX)
3. **Event-Driven Architecture**: Decouple session logic from UI components
4. **Graceful Degradation**: Handle edge cases like tab visibility, network errors
5. **Security First**: HttpOnly cookies, automatic timeout, no token exposure

## Troubleshooting

### Session expires too quickly
- Check `ACCESS_TOKEN_EXPIRE_MINUTES` in backend config
- Ensure `refreshBeforeExpiry` is less than token expiry time

### User not logged out on idle
- Check browser console for session events
- Verify activity tracking is working (move mouse, should see activity)
- Check `idleTimeout` configuration

### Token refresh fails
- Check backend `/auth/refresh` endpoint is working
- Verify refresh_token cookie is present and valid
- Check backend logs for refresh errors

## Future Enhancements

Potential improvements for future iterations:

1. **Tab Visibility API**: Pause session checks when tab is hidden
2. **Warning Before Logout**: Show modal 5 minutes before idle timeout
3. **Remember Me**: Extend session for users who opt in
4. **Session Analytics**: Track session duration, refresh frequency
5. **Multi-Tab Sync**: Coordinate session state across browser tabs
