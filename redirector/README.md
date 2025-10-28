# Go Redirect App

A simple URL redirection service built with Node.js, Express, and MongoDB.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Make sure MongoDB is running locally or set MONGODB_URI environment variable

3. Start the server:
```bash
npm start
```

## Usage

### Web Server
- Visit `http://localhost:3000/netflix` to redirect to netflix.com
- Server runs on port 3000 by default

### CLI Management
Run the interactive CLI to manage redirects:
```bash
npm run cli
```

The CLI allows you to:
- Add new redirects
- Edit existing redirects  
- Delete redirects
- List all redirects

## Logging

The application includes comprehensive logging with daily rotation:

- **Log Location**: `logs/` directory
- **Log Files**: 
  - `app-YYYY-MM-DD.log` - All application logs
  - `error-YYYY-MM-DD.log` - Error logs only
- **Rotation**: Daily with 30-day retention
- **Timestamps**: UTC format
- **Logged Events**:
  - All HTTP requests (with response times, status codes, IP addresses)
  - Successful and failed redirects
  - CLI operations (add/edit/delete/list)
  - Database connections
  - Server startup/shutdown

## Environment Variables
- `PORT`: Server port (default: 3000)
- `MONGODB_URI`: MongoDB connection string (default: mongodb://localhost:27017/go_redirect)

## Examples
- `go/netflix` → `netflix.com`
- `go/github` → `github.com`
- `go/docs` → `company-docs.internal.com`