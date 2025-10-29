# Go Redirect - User-Based URL Redirection Service

A user-based URL redirection service with authentication and user-specific redirects.

## Features

- **User Authentication**: Secure login system with session management
- **User-Specific Redirects**: Each user has their own set of redirects
- **Password Encryption**: Passwords are hashed using bcrypt
- **Session Management**: Secure cookie-based sessions stored in MongoDB
- **CLI Management**: Command-line interface for managing redirects
- **User Management**: Utility script for creating users

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set environment variables:
```bash
export MONGODB_URI="mongodb://localhost:27017/go-redirect"
export SESSION_SECRET="your-secure-session-secret"
```

3. Create your first user:
```bash
npm run create-user
# or
node utils/create-user.js
```

4. Start the server:
```bash
npm start
```

## Usage

### Web Interface

1. Visit `https://go` (or your domain)
2. Sign in with your email and password
3. View your personal redirects dashboard
4. Use redirects like `https://go/netflix` (user-specific)

### CLI Management

Manage your redirects using the CLI:

```bash
npm run cli
# or
node cli.js
```

The CLI will prompt you to:
1. Select which user you want to manage redirects for
2. Choose from add, edit, delete, or list redirects

### User Management

Create new users and manage their status using the utility script:

```bash
npm run create-user
# or
node utils/create-user.js
```

The user management utility allows you to:
- Create new users (with option to activate immediately)
- List all users with their active status
- Toggle user active/inactive status

**Note**: Users are created as inactive by default and must be explicitly activated to login.

## Security Features

- **Password Hashing**: All passwords are hashed with bcrypt (12 rounds)
- **Session Security**: HTTP-only cookies with secure session management
- **User Isolation**: Each user can only see and manage their own redirects
- **Authentication Required**: All redirect access requires valid login
- **User Activation**: Users must be explicitly activated to login or use redirects (default: inactive)

## Environment Variables

- `MONGODB_URI`: MongoDB connection string
- `SESSION_SECRET`: Secret key for session encryption (change this!)
- `PORT`: Server port (default: 3000)

## Database Schema

### Users
- `email`: Unique email address (login identifier)
- `password`: Bcrypt hashed password
- `name`: User's full name
- `isActive`: Boolean flag to enable/disable user access (default: false)
- `createdAt`: Account creation timestamp

### Redirects
- `slug`: URL slug (unique per user)
- `url`: Target URL for redirection
- `userId`: Reference to the user who owns this redirect
- `createdAt`: Redirect creation timestamp

## API Endpoints

- `GET /`: Dashboard (requires authentication)
- `GET /login`: Login page
- `POST /login`: Process login
- `POST /logout`: Logout user
- `GET /:slug`: Redirect to user's configured URL (requires authentication)

## Logging

All actions are logged using Winston with the following information:
- User authentication events
- Redirect access attempts
- CLI operations
- Error tracking

Logs are stored in the `logs/` directory with daily rotation.