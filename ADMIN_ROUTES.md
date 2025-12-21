# 🔐 Admin Routes Documentation

## Admin Dashboard Access

### Primary Admin Route
- **URL:** `/admin` (main admin dashboard)
- **Access:** After admin login via `/admin/login` or direct access if already authenticated
- **Description:** Main admin dashboard showing all documents (receipts and contracts)

### Admin Sub-routes
- `/admin/create` - Template library for creating new documents
- `/admin/editor` - Document editor (create/edit)
- `/admin/users` - User management page

## Admin Login
- **URL:** `/admin/login`
- **Method:** POST to `/api/auth/login`
- **Credentials:** `ADMIN_PASSWORD` from environment variables
- **Redirect:** After successful login, redirects to `/admin`

## Security
All admin routes are protected by middleware and require:
1. Valid JWT token in HttpOnly cookie
2. Token role must be `'admin'`
3. Token must not be expired

## Logout
- **URL:** `/api/auth/logout`
- **Method:** POST
- **Redirect:** After logout, redirects to `/` (home page)

## User Routes (Separate)
- `/user/login` - User login
- `/user/register` - User registration
- `/user/dashboard` - User dashboard (only their own documents)
- `/user/create` - User template library
- `/user/editor` - User document editor

