# SQMCC Project

Sistema de Queues e Mensagens com Conteúdo Compartilhado (SQMCC) - A Node.js web application using Express, EJS, SQLite, and TailwindCSS.

## Features
- **Authentication**: Email/password e login com Google (Supabase Auth).
- **Posts & Topics**: Create and view content.
- **Comments**: Discuss on posts and topics.
- **Database**: SQLite with `better-sqlite3`.

## Prerequisites
- Node.js (v18+ recommended)
- npm
- Supabase project (tables created via `schema.sql`)

## Setup

1.  **Configure environment**:
    Create a `.env` file with:
    ```bash
    SUPABASE_URL=your_supabase_url
    SUPABASE_KEY=your_supabase_service_or_anon_key
    SESSION_SECRET=your_long_random_secret
    ```
    If using Google login, configure the Google provider in Supabase Auth
    and set the redirect URL to `http://localhost:3000/auth/callback`.

1.  **Install dependencies**:
    ```bash
    npm install
    ```

2.  **Initialize Database**:
    This project uses Supabase. Create the tables using `schema.sql` in your Supabase SQL editor.
    If the tables already exist, run the migration commands at the end of `schema.sql`.

    To seed the database with initial data:
    ```bash
    npm run seed
    ```

3.  **Run Development Server**:
    ```bash
    npm run dev
    ```
    The server will start at `http://localhost:3000`.

## Project Structure
- `src/server.js`: Main entry point.
- `src/db.js`: Database connection and schema.
- `src/routes/`: Route handlers.
- `views/`: EJS templates.
- `public/`: Static files (CSS, images).
- `data/`: SQLite database files.

## Skills (System Capabilities)
- **Backend**: Express.js, session management, helmet security.
- **Frontend**: EJS templates, TailwindCSS (via CDN).
- **Persistence**: SQLite (local file-based database).
