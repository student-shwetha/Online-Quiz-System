# Online Quiz System

Software Engineering Mini-Project - Team 13.

## Requirements

- Node.js and npm
- MySQL

## Local setup

1. In MySQL Workbench (or the MySQL command-line client), run [`database/schema.sql`](./database/schema.sql). It creates the `online_quiz_system` database and its tables with foreign-key constraints. It does not drop existing tables or records.
2. Install backend dependencies:

   ```powershell
   cd backend
   npm install
   ```

3. Create `backend/.env` from `backend/.env.example` if you do not already have a `.env` file. Set the MySQL connection values. Set `ADMIN_SESSION_SECRET` to a private random value of at least 32 characters; for example, generate one with:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Do not commit `.env` or share its contents.
4. Create an admin account. The password is entered without being echoed and is stored only as a bcrypt hash:

   ```powershell
   npm run create-admin
   ```

5. Start the server:

   ```powershell
   npm run dev
   ```

6. Open [http://localhost:5000](http://localhost:5000) for the participant quiz or [http://localhost:5000/admin.html](http://localhost:5000/admin.html) for admin login.

The admin session cookie is HttpOnly, SameSite=Strict, and Secure when `NODE_ENV=production`. The app serves the frontend and API from the same origin. Quiz question deletion is restricted when saved responses refer to that question, preserving historical results.

## API endpoints

- `GET /api/quiz/questions` - list participant-visible questions.
- `POST /api/quiz/submit` - validate and save a complete quiz attempt and its responses.
- `POST /api/admin/login` and `POST /api/admin/logout` - sign in and out.
- `GET /api/admin/me` - check the current admin session.
- `GET /api/admin/questions`, `POST /api/admin/questions`, `PUT /api/admin/questions/:id`, `DELETE /api/admin/questions/:id` - protected question management.
- `GET /api/health` - application health check.
