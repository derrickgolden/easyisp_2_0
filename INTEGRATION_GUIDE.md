# Frontend-Backend Integration Guide

## Setup Complete! ✅

Your EasyISP application is now fully integrated with the API backend.

## Architecture

### Frontend (React + TypeScript + Vite)
- **Location**: `/code/easyisp2.0/easyisp-frontend`
- **Port**: 3002 (or next available)
- **API Client**: `src/services/apiService.ts`

### Backend (Laravel 10)
- **Location**: `/code/easyisp2.0/easyisp-api`
- **Port**: 8000
- **Database**: SQLite

## Starting the Application

### Option 1: Automated Start Script
```bash
cd /code/easyisp2.0
chmod +x start.sh
./start.sh
```

### Option 2: Manual Start

**Terminal 1 - Start Backend:**
```bash
cd /code/easyisp2.0/easyisp-api
php artisan serve --host=0.0.0.0 --port=8000
```

**Terminal 2 - Start Frontend:**
```bash
cd /code/easyisp2.0/easyisp-frontend
npm run dev
```

## Accessing the Application

- **Frontend**: http://localhost:3002
- **API**: http://localhost:8000/api

## Test Credentials

```
Email: admin@easyisp.local
Password: password123
```

## API Integration Features

### Authentication
- ✅ Register new organizations
- ✅ User login with JWT tokens
- ✅ Token-based API authentication
- ✅ Logout and token revocation

### Data Syncing
- ✅ Auto-load customers, packages, sites
- ✅ Auto-load users, roles, permissions
- ✅ Auto-load payments, transactions, tickets
- ✅ Real-time data updates

### API Service Functions

All API endpoints are wrapped in `apiService.ts`:

```typescript
// Authentication
authApi.login(email, password)
authApi.register(orgName, name, email, password)
authApi.logout()

// Customers
customersApi.getAll(page)
customersApi.getById(id)
customersApi.create(data)
customersApi.update(id, data)
customersApi.delete(id)

// Packages
packagesApi.getAll(page)
packagesApi.create(data)
packagesApi.update(id, data)
packagesApi.delete(id)

// Sites
sitesApi.getAll(page)
sitesApi.create(data)
sitesApi.update(id, data)
sitesApi.delete(id)

// Payments
paymentsApi.getAll(page)
paymentsApi.getByCustomer(customerId)
paymentsApi.create(data)

// Transactions
transactionsApi.getAll(page)
transactionsApi.getByCustomer(customerId)

// Tickets
ticketsApi.getAll(page)
ticketsApi.getByCustomer(customerId)
ticketsApi.create(data)
ticketsApi.update(id, data)

// Users & Roles
usersApi.getAll(page)
rolesApi.getAll(page)

// Organization
organizationApi.get()
organizationApi.update(data)
```

## How It Works

### Login Flow
1. User enters email and password on login page
2. Frontend calls `authApi.login(email, password)`
3. Backend validates credentials and returns JWT token
4. Token is stored in localStorage as `auth_token`
5. Token is automatically included in all subsequent API requests
6. Initial data is loaded for the user's organization
7. Dashboard is displayed

### Data Loading
After successful login, the app loads:
- Customers for the organization
- Packages offered by the organization
- Network sites
- Support tickets
- Payment records
- Transaction ledger
- User accounts and roles

### API Request Headers
All authenticated requests include:
```
Authorization: Bearer {token}
Content-Type: application/json
```

## CORS Configuration

CORS is already enabled in the backend (`config/cors.php`):
- ✅ All methods allowed
- ✅ All origins allowed
- ✅ All headers allowed

This allows the frontend to communicate with the backend API.

## Error Handling

The API service includes error handling:
- Validation errors return 422 with error details
- Not found errors return 404
- Server errors return 500
- Network errors are caught and displayed as toasts

## Local Storage

The app maintains local state using localStorage for:
- Authentication tokens
- Theme preferences
- User session data

## Next Steps

### To Add More API Integration:
1. Add endpoint to `apiService.ts` if it doesn't exist
2. Call the endpoint in your component
3. Update component state with the response
4. Display the data in your UI

### To Modify API Behavior:
1. Edit endpoints in `/code/easyisp2.0/easyisp-api/routes/api.php`
2. Modify controllers in `/code/easyisp2.0/easyisp-api/app/Http/Controllers/Api/`
3. Update validation and business logic as needed

### To Add New Database Tables:
1. Create migration: `php artisan make:migration create_table_name`
2. Create model: `php artisan make:model ModelName`
3. Create controller: `php artisan make:controller Api/ModelController`
4. Add routes in `routes/api.php`
5. Add API methods to `apiService.ts`

## Troubleshooting

### Frontend can't reach API
- Ensure backend is running on port 8000
- Check CORS settings in `config/cors.php`
- Verify API_BASE_URL in `apiService.ts` matches backend

### Login fails
- Verify test credentials: `admin@easyisp.local` / `password123`
- Check backend logs for errors
- Ensure database migrations have run

### Port conflicts
- Change backend port: `php artisan serve --port=9000`
- Update API_BASE_URL in frontend accordingly
- Or use: `npm run dev -- --port 5173` for frontend

## Database Seeding

To reset and seed test data:
```bash
cd easyisp-api
php artisan migrate:fresh --seed
```

This creates:
- 1 organization
- 3 users (admin, manager, staff)
- 3 packages
- 2 sites
- 3 customers
- Sample payments and transactions
- Sample support tickets

## Database Access

To access the database directly:
```bash
cd easyisp-api
php artisan tinker
>>> User::all()
>>> Customer::with('package', 'site')->first()
```

## Deployment

For production deployment:
1. Set `APP_ENV=production` in `.env`
2. Run `php artisan config:cache`
3. Build frontend: `npm run build`
4. Serve static files from `dist/` directory
5. Configure proper domain and SSL

## Support

For more information, see:
- [API_DOCUMENTATION.md](easyisp-api/API_DOCUMENTATION.md) - Complete API reference
- [README.md](easyisp-api/README.md) - Backend setup guide
- [React Documentation](https://react.dev)
- [Laravel Documentation](https://laravel.com/docs)
