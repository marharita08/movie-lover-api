# Movie Lover API

Backend service for the Movie Lover application — a platform for analyzing your IMDB lists with AI-powered movie and TV show recommendations.

## Features

- **Authentication & Authorization**
  - JWT-based authentication with access and refresh tokens
  - Session management
  - Email verification via OTP codes
  - Password reset flow
  - Google OAuth 2.0 login

- **IMDB List Import**
  - CSV file upload and parsing
  - Background processing of imported data
  - Enrichment with detailed metadata from TMDB API

- **AI Chat**
  - Movie and TV show recommendations powered by Google Gemini 2.5 Flash
  - Personalized suggestions based on your imported IMDB lists
  - Chat history persistence

- **List Analytics**
  - Genre, year, country, and production company breakdowns
  - Rating statistics
  - Top directors and actors from your lists
  - Upcoming episodes tracker for TV shows in your lists

- **Caching**
  - Redis-based caching for TMDB API responses

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript |
| Framework | NestJS |
| Database | PostgreSQL |
| ORM | TypeORM |
| Cache | Redis |
| Auth | JWT, Google OAuth 2.0 |
| AI | Google Gemini 2.5 Flash |
| External API | TMDB (The Movie Database) |
| Email | Brevo |
| File Storage | Google Cloud Storage |
| Testing | Jest |

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL
- Redis

### Installation
```bash
git clone https://github.com/marharita08/movie-lover-api.git
cd movie-lover-api
npm install
```

### Environment Variables

Create a `.env` file in the root directory:
```env
# App
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:5173

# JWT
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_jwt_refresh_secret
JWT_TTL=30m
JWT_REFRESH_TTL=15d

# Email (Brevo)
BREVO_API_KEY=your_brevo_api_key
BREVO_FROM_EMAIL=your_email@example.com
BREVO_FROM_NAME=Movie Lover App

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_NAME=movie-lover

# TMDB
TMDB_URL=https://api.themoviedb.org/3/
TMDB_TOKEN=your_tmdb_token

# Google Cloud Storage
GCP_PROJECT_ID=your_project_id
GCP_BUCKET_NAME=your_bucket_name
GCP_CLIENT_EMAIL=your_client_email
GCP_PRIVATE_KEY=your_private_key

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
CACHE_TTL=86400

# Gemini
GEMINI_API_KEY=your_gemini_api_key

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### Running the App
```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

### Database Migrations
```bash
# Generate migration
npm run migration:generate -- src/migrations/MigrationName

# Run migrations
npm run migration:run

# Revert last migration
npm run migration:revert
```

### Running with Docker
```bash
docker compose up --build
```

### Tests
```bash
# Unit tests
npm run test

# Test coverage
npm run test:cov
```

## Project Structure
```
src/
├── const/             # Application constants
├── entities/          # TypeORM entities
├── migrations/        # Database migrations
├── modules/
│   ├── ai/            # Gemini AI integration
│   ├── auth/          # Authentication & authorization
│   ├── chat/          # AI chat
│   ├── csv-parser/    # CSV parsing
│   ├── email/         # Email service
│   ├── file/          # File upload & storage
│   ├── hash/          # Password hashing
│   ├── list/          # IMDB list management & analytics
│   ├── list-media-item/
│   ├── media-item/    # Movie & TV show data
│   ├── media-person/  # Media cast & crew relations
│   ├── otp/           # One-time passwords
│   ├── person/        # People (actors, directors)
│   ├── reset-password-token/
│   ├── storage/       # Google Cloud Storage integration
│   ├── tmdb/          # TMDB API integration
│   ├── typeorm/       # Database configuration
│   └── user/          # User management
└── utils/
```
