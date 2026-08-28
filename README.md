# 🔴 SAFT Church Media Management System

<p align="center">
  <strong>A modern, full-stack management platform built for the SAFT Church Media Team.</strong>
</p>

<p align="center">
  <em>Serving God with Excellence through Media.</em>
</p>

<p align="center">
  <a href="https://saftmedia.com">🌐 Live Website</a>
  •
  <a href="https://saftmediaroaster.lovable.app">🚀 Lovable Preview</a>
  •
  <a href="https://github.com/Sanjaykumar0924/saftmediaroaster">💻 GitHub</a>
</p>

---

## 📌 About the Project

The **SAFT Church Media Management System** is a professional web application designed to simplify and modernize the management of a church media team.

The platform helps administrators and media volunteers manage:

- 👥 Team Members
- 📅 Service Availability
- 🎥 Weekly Rosters
- ✅ Attendance
- 📊 Performance Analytics
- 🔔 Notifications
- 📢 Announcements
- 📋 Activity Logs
- 📄 Reports
- 👤 Member Profiles

The system is designed with a modern SaaS-style interface while maintaining the identity and professionalism of the SAFT Church Media Team.

---

## ✨ Key Features

### 🔐 Authentication & Role Management

- Secure member authentication
- Admin authentication
- Protected admin routes
- Role-based access control
- Admin account creation
- Member account management
- Password reset functionality
- User activation/deactivation

### 👥 Member Management

Administrators can:

- Add members
- Edit member information
- Remove members
- Reset member passwords
- View member profiles
- Track volunteer history
- View service assignments
- Monitor attendance

### 📅 Availability Management

Members can submit their availability for upcoming services.

Supported services:

- 🕘 Sunday Morning
- 🌆 Sunday Evening
- 🌙 Tuesday Evening

Availability states:

- 🟢 Available
- 🔴 Unavailable
- ⚪ Pending

Availability updates are synchronized with the admin dashboard.

### 🎥 Smart Roster Generator

Administrators can create service rosters based on member availability.

Available roles include:

| Role | Description |
|---|---|
| 🎥 Camera 1 | Primary Camera |
| 🎥 Camera 2 | Secondary Camera |
| 🎥 Camera 3 | Side / Crowd Camera |
| 📹 4K Camera | High Resolution Camera |
| 🎛️ Streaming Director | Live Stream Control |
| 🎚️ Audio Engineer | Audio Management |
| 🚁 Drone Operator | Optional Drone Coverage |

Only available volunteers are shown during roster assignment.

### 📋 Roster Management

Admins can:

- Create rosters
- Edit assignments
- Publish rosters
- View upcoming rosters
- Print rosters
- Export rosters
- Assign members to specific media roles
- Add frame / shot notes

Example:

```text
Service: Sunday Morning

Camera 1       → David
Camera 2       → Sanjay
Camera 3       → Kingston
4K Camera      → Samuel
Streaming      → Akash
Audio          → Vishal
```
✅ Attendance Management

Administrators can record attendance after every service.

Attendance states:

✅ Present
❌ Absent
🟡 Late
🔵 Excused

The system automatically calculates:

Weekly Attendance
Monthly Attendance
Yearly Attendance
Overall Attendance Percentage
📊 Analytics Dashboard

The admin dashboard provides insights into team performance.

Includes:

📈 Attendance trends
📊 Weekly statistics
🥇 Attendance leaderboard
👑 Member of the Month
🎥 Volunteer participation
📅 Service participation
📋 Availability statistics
🔔 Notifications

Members can receive notifications for:

📢 New announcements
🎥 Roster published
✅ Attendance updated
📅 New services
⏰ Service reminders
📢 Announcements

Admins can publish announcements that appear on member dashboards.

Useful for:

Important media team updates
Special services
Training sessions
Schedule changes
Equipment information
👤 Member Profiles

Each member profile can contain:

Name
Profile Photo
Phone Number
Role
Experience
Attendance %
Assigned Services
Availability History
Volunteer History
Preferred Roles
📄 Reports & Exports

Administrators can generate reports for:

Attendance
Rosters
Availability
Volunteer participation

Supported formats:

PDF
Excel
CSV
🔎 Search & Filters

Administrators can search and filter:

Members
Services
Attendance
Availability
Rosters
Activity Logs
🌙 Modern UI

The application includes:

Responsive design
Dark / Light mode
Modern dashboard
Sidebar navigation
Animated statistics
Toast notifications
Loading skeletons
Confirmation dialogs
Responsive tables
Mobile-friendly layouts
Smooth transitions
Glassmorphism elements
Modern SaaS-style cards
🏗️ System Architecture
```
                         ┌──────────────────────┐
                         │      SAFT USERS      │
                         │ Members & Admins     │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │    SAFT MEDIA HUB    │
                         │      React App       │
                         └──────────┬───────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
              Authentication    Database         Storage
                    │               │               │
                    └───────────────┼───────────────┘
                                    ▼
                         ┌──────────────────────┐
                         │      SUPABASE        │
                         │ PostgreSQL + Auth    │
                         │ Realtime + Storage   │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │       VERCEL         │
                         │   Production Hosting │
                         └──────────────────────┘
```
🛠️ Technology Stack
Frontend
React
TypeScript
Vite
Tailwind CSS
shadcn/ui
Lucide Icons
Framer Motion
React Hook Form
Zod
Backend & Database
Supabase
PostgreSQL
Supabase Authentication
Supabase Realtime
Supabase Storage
Deployment
GitHub
Vercel
Custom Domain
🗄️ Database

The application uses Supabase PostgreSQL as its primary database.

Core data includes:

Users
Admins
Members
Availability
Attendance
Roster
Services
Notifications
Announcements
Activity Logs

The application uses Row Level Security (RLS) to protect database access.

🔒 Security

Security is an important part of the application.

Implemented security concepts include:

🔐 Authentication
👮 Role-based authorization
🛡️ Protected admin routes
🔒 Supabase Row Level Security
🔑 Environment variables
🚫 Restricted admin functionality
🔐 Secure database access policies

Never commit private API keys, service-role keys, passwords, or other secrets to GitHub.

📱 Responsive Design

The application is designed to work across:

💻 Desktop
💻 Laptop
📱 Mobile
📱 Tablet

The dashboard automatically adapts to different screen sizes.

🚀 Getting Started
Prerequisites

Make sure you have installed:

Node.js
npm
Git
Clone the Repository
git clone https://github.com/Sanjaykumar0924/saftmediaroaster.git
Navigate to the Project
cd saftmediaroaster
Install Dependencies
npm install
Start Development Server
npm run dev

The application will be available at:

http://localhost:5173
⚙️ Environment Variables

Create a .env file in the project root.

Example:

VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key

Never upload your .env file to GitHub.

Make sure .env is included in .gitignore.

🌐 Deployment

The application is deployed using Vercel.

Production flow:

Developer
    │
    ▼
GitHub
    │
    ▼
Vercel
    │
    ▼
Production Build
    │
    ▼
saftmedia.com

Every update pushed to the production branch can be automatically deployed through Vercel.

📂 Project Structure
```
saftmediaroaster/
│
├── public/
│   ├── assets/
│   └── ...
│
├── src/
│   ├── components/
│   ├── pages/
│   ├── hooks/
│   ├── lib/
│   ├── integrations/
│   ├── types/
│   └── ...
│
├── .gitignore
├── package.json
├── package-lock.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── README.md
📊 Core Workflow
Member Workflow
Login
  ↓
Member Dashboard
  ↓
Check Upcoming Services
  ↓
Submit Availability
  ↓
View Published Roster
  ↓
Attend Service
  ↓
Attendance Updated
Admin Workflow
Admin Login
  ↓
Admin Dashboard
  ↓
Check Member Availability
  ↓
Generate Roster
  ↓
Publish Roster
  ↓
Members Receive Notification
  ↓
Service
  ↓
Mark Attendance
  ↓
View Analytics
  ↓
Generate Reports
```
💡 Future Enhancements

Planned improvements include:

🤖 AI-powered roster recommendations
⚖️ Automatic workload balancing
📊 Advanced volunteer analytics
🎯 Role recommendation system
📱 Push notifications
⏰ Automated service reminders
📆 Advanced scheduling
📈 Long-term performance analytics
🔄 Advanced realtime synchronization
📲 Progressive Web App improvements
☁️ Advanced cloud storage integration
🎯 Project Goals

The main goals of SAFT Media Hub are:

Reduce manual roster management
Improve volunteer coordination
Simplify availability tracking
Improve attendance monitoring
Provide transparent team analytics
Centralize media team information
Improve communication between admins and volunteers
Create a professional digital workflow for the SAFT Media Team
🏆 Project Highlights
✓ Full-Stack Web Application
✓ React + TypeScript
✓ Supabase PostgreSQL
✓ Authentication & Authorization
✓ Role-Based Access Control
✓ Realtime Data Synchronization
✓ Responsive Dashboard
✓ Roster Management
✓ Attendance Analytics
✓ Availability Tracking
✓ Notifications
✓ Reports & Exports
✓ Vercel Deployment
✓ Custom Domain
👨‍💻 Developer
Sanjay Kumar H

Computer Science Engineering
Saveetha Engineering College, Chennai

Interested in:

Artificial Intelligence
Machine Learning
Computer Vision
Full-Stack Development
Cloud Technologies
Automotive Technology
🔗 Links

🌐 Live Website

https://saftmedia.com

🚀 Lovable Preview

https://saftmediaroaster.lovable.app

💻 GitHub Repository

https://github.com/Sanjaykumar0924/saftmediaroaster

🙏 Acknowledgement

Built for the SAFT Church Media Team with the goal of serving the church through technology, organization, and excellence.

"Serving God with Excellence through Media."

<p align="center"> <strong>SAFT Church Media Team</strong> <br> Built with ❤️, technology, and a passion for serving. </p> ```
