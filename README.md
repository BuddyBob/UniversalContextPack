# UCPv6 - User Content Processing Platform

A secure, multi-user platform for file processing and analysis with AI integration.

## Features

- **User Authentication**: Google OAuth integration with JWT sessions
- **Secure API Key Management**: Per-user API key storage in Supabase database
- **File Processing**: Upload and analyze files with AI
- **Cloud Storage**: Cloudflare R2 integration for file storage
- **Multi-user Support**: Complete user isolation and session management

## Tech Stack

- **Backend**: FastAPI (Python)
- **Frontend**: Next.js 14 (TypeScript/React)
- **Database**: Supabase (PostgreSQL)
- **Storage**: Cloudflare R2
- **Authentication**: Google OAuth + JWT

## Setup Instructions

### 1. Environment Configuration

1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```

2. Fill in your configuration values in `.env`:
   - **Supabase**: Create a project at [supabase.com](https://supabase.com)
   - **Google OAuth**: Set up OAuth credentials in [Google Cloud Console](https://console.cloud.google.com)
   - **Cloudflare R2**: Configure R2 storage in Cloudflare dashboard
   - **PostgreSQL**: Use Supabase PostgreSQL connection details

3. For the frontend, copy the environment file:
   ```bash
   cd frontend
   cp ../.env frontend/.env.local
   ```

### 2. Database Setup

1. Run the database schema in your Supabase project:
   ```sql
   -- Execute the contents of supabase_schema_clean.sql in your Supabase SQL editor
   ```

### 3. Backend Setup

1. Create a Python virtual environment:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Start the backend server:
   ```bash
   python simple_backend.py
   ```

   The API will be available at `http://localhost:8000`

### 4. Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

   The application will be available at `http://localhost:3000`

## API Endpoints

### Authentication
- `POST /api/auth/google` - Google OAuth login
- `GET /api/auth/verify` - Verify JWT token

### User Profiles
- `GET /api/profile` - Get user profile
- `POST /api/profile` - Create/update user profile
- `POST /api/profile/openai-key` - Save OpenAI API key
- `DELETE /api/profile/openai-key` - Remove OpenAI API key

### File Processing
- `POST /api/analyze` - Analyze uploaded file
- `GET /api/packs` - Get user's file packs
- `GET /api/packs/{pack_id}` - Get specific pack details

## Security Features

- **Per-user API Key Storage**: API keys stored securely in database, not localStorage
- **JWT Authentication**: Stateless authentication with secure token validation
- **Row Level Security**: Database policies ensure user data isolation
- **Environment Variables**: All sensitive data in environment variables
- **CORS Protection**: Configured for frontend domain only

## Development

### Project Structure
```
├── simple_backend.py          # FastAPI backend server
├── requirements.txt           # Python dependencies
├── supabase_schema_clean.sql  # Database schema
├── .env.example              # Environment template
└── frontend/
    ├── app/                  # Next.js app directory
    ├── components/           # React components
    ├── lib/                  # Utility libraries
    └── package.json          # Node.js dependencies
```

### Environment Variables

See `.env.example` for all required environment variables.

**Important**: Never commit `.env` or `.env.local` files to version control. They contain sensitive credentials.

## Deployment

1. Ensure all environment variables are set in your production environment
2. Build the frontend: `npm run build`
3. Deploy backend and frontend to your hosting platform
4. Configure domain and SSL certificates
5. Update CORS settings for production domain

## Support

For issues or questions, please check the existing documentation or create an issue in the repository.# UniversalContextPack
