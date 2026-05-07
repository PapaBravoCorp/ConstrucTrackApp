# ConstrucTrack App

ConstrucTrack is a web application built with React, Vite, and Supabase. This repository contains both the frontend application and the backend Deno Edge Functions.

## Prerequisites

Before you begin, ensure you have the following installed on your machine:
- **[Node.js](https://nodejs.org/)** (v18 or higher recommended)
- **[npm](https://www.npmjs.com/)** (comes with Node.js)
- **[Deno](https://deno.land/)** (required to run the Supabase Edge Functions server locally)

## Environment Setup

1. Create a `.env` file in the root directory if it doesn't already exist.
2. Add the following environment variables to it:

   ```env
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   ```
   *(Note: Obtain the actual development values from your team lead).*

## Running the Application

To run the application locally, you will need to start both the frontend development server and the backend edge functions server.

### 1. Install Dependencies
First, install the Node.js dependencies for the frontend application:
```bash
npm install
```

### 2. Start the Frontend Development Server
Start the Vite development server:
```bash
npm run dev
```
The application will be available at the URL provided in the terminal (usually `http://localhost:5173`).

### 3. Start the Backend / Edge Functions Server
The project uses Deno to run Supabase Edge Functions locally. In a **separate terminal window**, run:
```bash
deno task dev
```
This will start the local edge functions server on `http://localhost:8000/`.

## Common Issues

- **`deno: The term 'deno' is not recognized`**: This means Deno is not installed or not added to your system's PATH variable. Please [install Deno](https://deno.land/manual/getting_started/installation) and restart your terminal.

## Technologies Used
- **Frontend**: React, Vite, TailwindCSS, Radix UI, Framer Motion
- **Backend/Database**: Supabase, Deno Edge Functions