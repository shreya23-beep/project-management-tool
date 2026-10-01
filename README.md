# Project Management Tool

A modern, full-stack Project Management Tool designed to manage projects, assign and track tasks, and collaborate seamlessly across teams. Built with a React + Vite TypeScript frontend and a Node.js + Express TypeScript backend powered by Prisma ORM.

---

## 🚀 Features

- **Project Management**: Create, view, update, and manage multiple projects with customizable metadata.
- **Task Tracking**: Assign tasks, set priorities, track status changes, and define deadlines.
- **Modern User Interface**: Responsive dashboard built with React, TypeScript, and Tailwind CSS.
- **RESTful API**: Fast and modular backend endpoints built with Express.js and TypeScript.
- **Database Modeling with Prisma**: Type-safe database queries and automated schema migrations using Prisma ORM.
- **Secure Architecture**: Environment-based configuration with input validation and security practices.

---

## 🛠️ Tech Stack

### Frontend (`client/`)
- **Framework**: [React](https://react.dev/) (with TypeScript)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) / PostCSS
- **Linting**: Oxlint

### Backend (`server/`)
- **Runtime**: [Node.js](https://nodejs.org/)
- **Framework**: [Express.js](https://expressjs.com/)
- **Language**: TypeScript (`ts-node`, `tsc`)
- **ORM / Database**: [Prisma ORM](https://www.prisma.io/)
- **Utilities**: `dotenv`, `bcrypt`, `cors`

---

## 📁 Repository Structure

```text
project-management-tool/
├── client/                     # Frontend client (Vite + React + TS)
│   ├── public/                 # Static assets (favicons, icons)
│   ├── src/                    # UI source code
│   │   ├── assets/             # Images and design assets
│   │   ├── api.ts              # API service client
│   │   ├── App.tsx             # Root React component
│   │   ├── main.tsx            # React entry point
│   │   └── ...
│   ├── package.json            # Frontend dependencies and scripts
│   ├── tailwind.config.js      # Tailwind CSS configuration
│   ├── tsconfig.json           # Frontend TypeScript configuration
│   └── vite.config.ts          # Vite build configuration
│
├── server/                     # Backend API server (Express + Prisma + TS)
│   ├── prisma/                 # Prisma database schema and migrations
│   │   └── schema.prisma       # Database model definitions
│   ├── src/                    # Backend API source code
│   │   ├── routes/             # Route handlers
│   │   ├── controllers/        # Request handling logic
│   │   └── ...
│   ├── .env                    # Server environment configuration
│   ├── package.json            # Server dependencies and scripts
│   └── tsconfig.json           # Server TypeScript configuration
│
└── README.md                   # Project documentation
