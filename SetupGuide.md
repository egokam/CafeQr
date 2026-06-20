# ☕ Cafe QR - Smart Ordering & Management System

A full-stack Next.js web application for cafes and restaurants. It features a digital QR menu for clients, a real-time live dashboard for cashiers, and a secure management panel for admins.

---

## 🚀 1. Prerequisites

Before you begin, ensure you have the following:
* [Node.js](https://nodejs.org/) installed (v18 or higher recommended).
* A [Supabase](https://supabase.com/) account for the database, authentication, and storage.
* A [Vercel](https://vercel.com/) account for deployment.
* A GitHub account to host your repository.

---

## 🔐 2. Environment Variables (Environment Setup)

You must never expose your real keys to the public. We use environment variables to keep them secure.

1. Create a file named `.env.local` in the root of your project.
2. Add the following keys (get these from your Supabase Project Settings -> API):

```env
# Supabase Keys
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here