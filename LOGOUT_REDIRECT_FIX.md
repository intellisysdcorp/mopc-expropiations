# Logout Redirect Fix Documentation

## Problem
Users were being redirected to `http://localhost:3001/login` instead of `http://localhost:3000/login` after logging out, causing a port mismatch issue.

## Root Cause
The environment variables in `.env.local` were configured for port 3001 while the development server was running on port 3000.

## Solution Implemented

### 1. Fixed Environment Variables
Updated `.env.local` to use port 3000:
```env
# Before
NEXTAUTH_URL="http://localhost:3001"
APP_URL="http://localhost:3001"

# After
NEXTAUTH_URL="http://localhost:3000"
APP_URL="http://localhost:3000"
```

### 2. Enhanced NextAuth Configuration
Added explicit signOut page configuration in `src/lib/auth.ts`:
```typescript
pages: {
  signIn: '/login',
  error: '/login?error=true',
  signOut: '/login',  // Added explicit logout redirect
},
```

### 3. Verified Logout Implementation
The `useAuth` hook in `src/hooks/use-auth.ts` correctly uses a relative URL:
```typescript
const signOut = useCallback(async () => {
  await nextAuthSignOut({ callbackUrl: '/login' });
}, []);
```

## Testing Steps

1. **Start Server**: Ensure server runs on port 3000
   ```bash
   npm run dev
   ```

2. **Test Login**: Navigate to `http://localhost:3000/login`

3. **Test Logout**:
   - Login with valid credentials
   - Click "Cerrar sesión" (logout button)
   - Verify redirect to `http://localhost:3000/login` (not port 3001)

## Prevention Measures

### 1. Port Consistency
Always ensure these values match:
- Development server port (default: 3000)
- `NEXTAUTH_URL` environment variable
- `APP_URL` environment variable

### 2. Documentation Updates
All documentation files now reference port 3000:
- `AUTHENTICATION.md`
- `SETUP.md` (with notes about port configuration)

### 3. Server Restart Protocol
When changing ports:
1. Kill existing processes on the target port
2. Update environment variables
3. Restart the development server

## Files Modified

1. `.env.local` - Fixed NEXTAUTH_URL and APP_URL
2. `src/lib/auth.ts` - Added signOut page configuration
3. `AUTHENTICATION.md` - Updated documentation URLs
4. `SETUP.md` - Added port configuration notes

## Troubleshooting

If logout redirect issues persist:

1. **Check Environment Variables**:
   ```bash
   grep -E "NEXTAUTH_URL|APP_URL" .env.local
   ```

2. **Verify Server Port**:
   ```bash
   lsof -i :3000
   ```

3. **Clear Browser Cache**:
   - Clear cookies and cache for localhost
   - Test in incognito/private mode

4. **Restart Services**:
   ```bash
   # Kill all processes on ports 3000-3001
   lsof -ti:3000,3001 | xargs kill -9
   npm run dev
   ```

## Key Learning

NextAuth.js uses the `NEXTAUTH_URL` environment variable to construct absolute URLs for redirects, callbacks, and other operations. Any mismatch between this value and the actual server port will cause redirect issues during login, logout, and other authentication flows.