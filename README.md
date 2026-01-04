# 📚 AI-Integrated University Library Management System

![Library System Banner](https://img.shields.io/badge/University-Library%20System-0D9488?style=for-the-badge&logo=book&logoColor=white)

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?style=flat-square&logo=nestjs)](https://nestjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

A modern, full-stack university library management system with role-based access control, real-time notifications, and AI-powered study assistance.

[Features](#-features) • [Tech Stack](#-tech-stack) • [Installation](#-installation) • [API Documentation](#-api-documentation) • [Screenshots](#-screenshots)

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Installation](#-installation)
- [Environment Variables](#-environment-variables)
- [Running the Application](#-running-the-application)
- [API Documentation](#-api-documentation)
- [User Roles & Permissions](#-user-roles--permissions)
- [Database Schema](#-database-schema)
- [Screenshots](#-screenshots)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 Overview

The **AI-Integrated University Library Management System** is a comprehensive web-based platform designed to manage all aspects of university library operations. Built for Üsküdar University, the system supports physical book management, digital resources, borrowing workflows, research material sharing, and administrative oversight.

### Key Highlights

- 🔐 **Role-Based Access Control** - Four distinct user roles with tailored experiences
- 📖 **Complete Borrowing Lifecycle** - From reservation to return with automated fine calculation
- 📚 **Research Materials Hub** - Instructors can share publications and course materials
- 📊 **Analytics Dashboard** - Real-time statistics and borrowing trends
- 🌙 **Dark Mode Support** - Eye-friendly interface for extended use
- 🤖 **AI Assistant Ready** - Foundation for intelligent book recommendations (Phase 2)

---

## ✨ Features

### For Students

- Browse and search book catalog with advanced filters
- Create and track book reservations
- View borrowed books and due dates
- Access research materials and e-books
- Receive notifications for due dates and reservation updates
- AI-powered study assistance (coming soon)

### For Instructors

- All student features plus:
- Submit research materials for library approval
- Create and manage course reading lists
- Track material submission status
- Extended borrowing periods (30 days)

### For Staff

- All student features plus:
- Personalized book recommendations based on interests
- Extended borrowing limits

### For Administrators

- **Book Management**: Add, edit, delete books and manage copies across branches
- **User Management**: View, activate/deactivate user accounts
- **Reservation Processing**: Approve, reject, and manage pickup workflows
- **Borrow Management**: Process returns, calculate fines, track overdue items
- **Materials Approval**: Review and approve instructor submissions
- **Statistics Dashboard**: View borrowing trends, popular books, and system metrics
- **System Configuration**: Manage branches, policies, and settings

---

## 🛠 Tech Stack

### Frontend

| Technology          | Purpose                                  |
| ------------------- | ---------------------------------------- |
| **Next.js 14**      | React framework with App Router, SSR/SSG |
| **TypeScript**      | Type-safe JavaScript                     |
| **Tailwind CSS**    | Utility-first styling                    |
| **Lucide React**    | Icon library                             |
| **React Hook Form** | Form management                          |
| **Zod**             | Schema validation                        |

### Backend

| Technology          | Purpose                                  |
| ------------------- | ---------------------------------------- |
| **NestJS 10**       | Node.js framework with decorators and DI |
| **TypeScript**      | Type-safe backend code                   |
| **Prisma ORM**      | Database access and migrations           |
| **Passport.js**     | Authentication strategies                |
| **JWT**             | Stateless authentication tokens          |
| **class-validator** | Request validation                       |

### Database & Infrastructure

| Technology         | Purpose                       |
| ------------------ | ----------------------------- |
| **PostgreSQL 16**  | Primary relational database   |
| **Docker**         | Containerized development     |
| **Docker Compose** | Multi-container orchestration |

---

## 📁 Project Structure

```
library-system/
├── apps/
│   ├── api/                    # NestJS Backend
│   │   ├── src/
│   │   │   ├── auth/           # Authentication module
│   │   │   ├── users/          # User management
│   │   │   ├── books/          # Book catalog & copies
│   │   │   ├── reservations/   # Reservation workflows
│   │   │   ├── borrows/        # Borrow management & fines
│   │   │   ├── materials/      # Research materials
│   │   │   ├── notifications/  # Notification system
│   │   │   ├── branches/       # Library branches
│   │   │   ├── prisma/         # Database client
│   │   │   └── main.ts         # Application entry
│   │   ├── prisma/
│   │   │   ├── schema.prisma   # Database schema
│   │   │   └── seed.ts         # Seed data
│   │   └── package.json
│   │
│   └── web/                    # Next.js Frontend
│       ├── app/
│       │   ├── (auth)/         # Auth pages (login)
│       │   ├── dashboard/      # Protected dashboard routes
│       │   │   ├── admin/      # Admin-only pages
│       │   │   ├── instructor/ # Instructor pages
│       │   │   └── ...         # Shared pages
│       │   ├── layout.tsx      # Root layout
│       │   └── page.tsx        # Landing page
│       ├── components/         # Reusable components
│       ├── lib/                # Utilities & API client
│       └── package.json
│
├── docker-compose.yml          # Docker configuration
├── package.json                # Root package.json
└── README.md
```

---

## 🚀 Installation

### Prerequisites

- **Node.js** >= 20.x
- **pnpm** >= 8.x (recommended) or npm
- **Docker** & **Docker Compose**
- **Git**

### Step 1: Clone the Repository

```bash
git clone https://github.com/yourusername/library-system.git
cd library-system
```

### Step 2: Install Dependencies

```bash
# Using pnpm (recommended)
pnpm install

# Or using npm
npm install
```

### Step 3: Set Up Environment Variables

```bash
# Copy environment templates
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

### Step 4: Start the Database

```bash
docker-compose up -d
```

### Step 5: Run Database Migrations

```bash
cd  apps/api
npx prisma migrate dev
npx prisma db seed
```

### Step 6: Start the Development Servers

```bash
# Terminal 1 - Backend (from root)
cd apps/api && pnpm dev

# Terminal 2 - Frontend (from root)
cd apps/web && pnpm dev
```

The application will be available at:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000
- **API Documentation**: http://localhost:4000/api

---

## 🔐 Environment Variables

### Backend (`apps/api/.env`)

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/library_db?schema=public"

# JWT Configuration
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_EXPIRATION="7d"

# Server
PORT=4000
NODE_ENV=development

# File Upload
MAX_FILE_SIZE=52428800  # 50MB in bytes
UPLOAD_DIR="./uploads"
```

### Frontend (`apps/web/.env`)

```env
# API URL
NEXT_PUBLIC_API_URL=http://localhost:4000

# App Configuration
NEXT_PUBLIC_APP_NAME="Library System"
```

---

## 🏃 Running the Application

### Development Mode

```bash
# Start all services
docker-compose up -d          # Database
cd apps/api && pnpm dev       # Backend on :4000
cd apps/web && pnpm dev       # Frontend on :3000
```

### Production Build

```bash
# Build backend
cd apps/api && pnpm build

# Build frontend
cd apps/web && pnpm build

# Start production servers
cd apps/api && pnpm start:prod
cd apps/web && pnpm start
```

### Demo Accounts

The seed script creates demo accounts for testing:

| Role       | Email                     | Password    |
| ---------- | ------------------------- | ----------- |
| Admin      | admin@uskudar.edu.tr      | password123 |
| Instructor | instructor@uskudar.edu.tr | password123 |
| Staff      | staff@uskudar.edu.tr      | password123 |
| Student    | student@uskudar.edu.tr    | password123 |

---

## 📡 API Documentation

### Base URL

```
http://localhost:4000/api
```

### Authentication

All protected endpoints require a JWT token sent via HttpOnly cookie.

### Endpoints Overview

| Module            | Endpoints | Description                           |
| ----------------- | --------- | ------------------------------------- |
| **Auth**          | 4         | Login, logout, refresh, current user  |
| **Users**         | 6         | CRUD, activate/deactivate             |
| **Books**         | 8         | Catalog, search, copies management    |
| **Reservations**  | 7         | Create, approve, reject, collect      |
| **Borrows**       | 10        | Checkout, return, history, statistics |
| **Materials**     | 6         | Upload, approve, list                 |
| **Notifications** | 4         | List, mark read                       |
| **Branches**      | 2         | List branches                         |

### Example Requests

#### Login

```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "student@uskudar.edu.tr",
  "password": "password123"
}
```

#### Get Book Catalog

```bash
GET /api/books?page=1&pageSize=12&faculty=FENS&category=Textbook
Authorization: Cookie (access_token)
```

#### Create Reservation

```bash
POST /api/reservations
Content-Type: application/json
Authorization: Cookie (access_token)

{
  "bookId": "book-uuid",
  "branchId": "branch-uuid"
}
```

---

## 👥 User Roles & Permissions

| Permission           | Student | Instructor | Staff | Admin |
| -------------------- | ------- | ---------- | ----- | ----- |
| Browse Catalog       | ✅      | ✅         | ✅    | ✅    |
| Create Reservations  | ✅      | ✅         | ✅    | ✅    |
| View Own Borrows     | ✅      | ✅         | ✅    | ✅    |
| Submit Materials     | ❌      | ✅         | ❌    | ✅    |
| Create Reading Lists | ❌      | ✅         | ❌    | ❌    |
| Approve Reservations | ❌      | ❌         | ❌    | ✅    |
| Process Returns      | ❌      | ❌         | ❌    | ✅    |
| Manage Books         | ❌      | ❌         | ❌    | ✅    |
| Manage Users         | ❌      | ❌         | ❌    | ✅    |
| View Statistics      | ❌      | ❌         | ❌    | ✅    |

### Borrow Limits by Role

| Role       | Max Active Borrows | Borrow Period | Max Extensions |
| ---------- | ------------------ | ------------- | -------------- |
| Student    | 5                  | 14 days       | 2              |
| Instructor | 10                 | 30 days       | 3              |
| Staff      | 7                  | 14 days       | 2              |
| Admin      | Unlimited          | 60 days       | Unlimited      |

---

## 🗄 Database Schema

### Core Entities

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│     User     │     │     Book     │     │    Branch    │
├──────────────┤     ├──────────────┤     ├──────────────┤
│ id           │     │ id           │     │ id           │
│ email        │     │ title        │     │ name         │
│ password     │     │ authors      │     │ address      │
│ name         │     │ isbn         │     │ isActive     │
│ role         │     │ category     │     └──────────────┘
│ studentId    │     │ faculty      │            │
│ faculty      │     │ ebookUrl     │            │
└──────────────┘     └──────────────┘            │
       │                    │                    │
       │              ┌─────┴───────────┐        │
       │              │                 │        │
       ▼              ▼                 ▼        ▼
┌────────────────┐  ┌──────────────┐  ┌──────────────┐
│ Reservation    │  │   BookCopy   │──│   Borrow     │
├────────────────┤  ├──────────────┤  ├──────────────┤
│ id             │  │ id           │  │ id           │
│ userId         │  │ bookId       │  │ userId       │
│ bookId         │  │ branchId     │  │ bookCopyId   │
│ branchId       │  │ barcode      │  │ borrowDate   │
│ status         │  │ status       │  │ dueDate      │
│ pickupDeadline │  └──────────────┘  │ returnDate   │
└────────────────┘                    │ fine         │
                                      └──────────────┘
```

### Additional Entities

- **Material** : Research papers, publications, course materials
- **Notification**: User notifications for system events
- **ReadingList** : Instructor-curated book collections

---

## 🗺 Roadmap

### ✅ Phase 1: Core System (Completed)

- [x] Authentication & Authorization
- [x] Book Catalog with Search & Filters
- [x] Reservation System
- [x] Borrow Management with Fine Calculation
- [x] Materials Upload & Approval
- [x] Notification System
- [x] Admin Statistics Dashboard
- [x] Dark Mode

### 🔄 Phase 2: User Features (In Progress)

- [ ] User Self-Registration with Admin Approval
- [ ] Password Reset via Email
- [ ] Edit User Profile
- [ ] Instructor Follower System
- [ ] Reading Lists CRUD

### 📋 Phase 3: AI Integration (Planned)

- [ ] AI Chatbot for Study Assistance
- [ ] Intelligent Book Recommendations
- [ ] Natural Language Search
- [ ] Personalized Learning Paths

### 📋 Phase 4: Production Readiness (Planned)

- [ ] Email Service (SMTP)
- [ ] Cloud File Storage (AWS S3)
- [ ] Error Logging & Monitoring
- [ ] Security Hardening
- [ ] Performance Optimization

### 📋 Phase 5: Admin Enhancements (Planned)

- [ ] Branch Management
- [ ] Configurable Borrow Policies
- [ ] Fine Payment Tracking
- [ ] Report Generation (PDF/Excel)

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed
- Follow the existing code style

---

## 📄 License

This project is developed as a graduation project for Üsküdar University, Faculty of Engineering and Natural Sciences, Software Engineering Department.

**© 2025-2026 Üsküdar University**

---

## 🙏 Acknowledgments

- **Thesis Advisor**: Dr. Kristin Surpuhi BENLİ
- **Department**: Software Engineering, Üsküdar University
- **Icons**: [Lucide Icons](https://lucide.dev/)
- **UI Inspiration**: Modern library management systems

---

**Built with ❤️ for Üsküdar University**

[⬆ Back to Top](#-ai-integrated-university-library-management-system)
