# SGC ERP System - Installation Guide

This guide will help you set up and run the SGC ERP System on your local machine.

## Prerequisites

Before you begin, make sure you have the following installed:

- **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
- **MongoDB** (v5 or higher) - [Download here](https://www.mongodb.com/try/download/community)
- **Git** (for version control) - [Download here](https://git-scm.com/)

## Installation Steps

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd SGC_ERP
```

### 2. Install Dependencies

Install both backend and frontend dependencies:

```bash
npm run install-all
```

This command will install:
- Backend dependencies (Node.js packages)
- Frontend dependencies (React packages)

### 3. Environment Configuration

1. Copy the environment template:
   ```bash
   cp env.example .env
   ```

2. Edit the `.env` file with your configuration:
   ```env
   # Server Configuration
   PORT=5000
   NODE_ENV=development

   # MongoDB Configuration
   MONGODB_URI=mongodb://localhost:27017/sgc_erp

   # JWT Configuration
   JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
   JWT_EXPIRE=24h

   # CORS Configuration
   CORS_ORIGIN=http://localhost:3000
   ```

### 4. Start MongoDB

Make sure MongoDB is running on your system:

**Windows:**
```bash
# Start MongoDB service
net start MongoDB
```

**macOS/Linux:**
```bash
# Start MongoDB service
sudo systemctl start mongod
# or
brew services start mongodb-community
```

### 5. Initialize Database

Run the setup script to create initial data:

```bash
npm run setup
```

This will create:
- Sample departments
- Admin user and sample users
- Initial database structure

### 6. Start the Application

Start both backend and frontend servers:

```bash
npm run dev
```

This will start:
- Backend server on `http://localhost:5000`
- Frontend application on `http://localhost:3000`

## Default Login Credentials

After running the setup script, you can log in with these credentials:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@sgc.com | admin123 |
| HR Manager | john.smith@sgc.com | password123 |
| Finance Manager | sarah.johnson@sgc.com | password123 |
| Procurement Manager | michael.brown@sgc.com | password123 |
| Sales Manager | emily.davis@sgc.com | password123 |
| CRM Manager | david.wilson@sgc.com | password123 |

## Project Structure

```
SGC_ERP/
├── server/                 # Backend Node.js server
│   ├── config/            # Database and app configuration
│   ├── controllers/       # Route controllers
│   ├── middleware/        # Custom middleware
│   ├── models/           # MongoDB models
│   │   ├── hr/           # HR module models
│   │   ├── finance/      # Finance module models
│   │   └── ...
│   ├── routes/           # API routes
│   ├── utils/            # Utility functions
│   └── index.js          # Server entry point
├── client/               # Frontend React application
│   ├── public/           # Static files
│   ├── src/              # React source code
│   │   ├── components/   # Reusable components
│   │   ├── pages/        # Page components
│   │   ├── services/     # API services
│   │   ├── contexts/     # React contexts
│   │   └── App.js        # Main App component
│   └── package.json      # Frontend dependencies
├── setup.js              # Database initialization script
├── package.json          # Backend dependencies
└── README.md             # Project documentation
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start both backend and frontend in development mode |
| `npm run server` | Start only the backend server |
| `npm run client` | Start only the frontend application |
| `npm run build` | Build the frontend for production |
| `npm run install-all` | Install all dependencies |
| `npm run setup` | Initialize database with sample data |
| `npm start` | Start the production server |

## Development Workflow

1. **Backend Development:**
   - Server runs on `http://localhost:5000`
   - API endpoints available at `http://localhost:5000/api`
   - Auto-restart on file changes (nodemon)

2. **Frontend Development:**
   - React app runs on `http://localhost:3000`
   - Hot reload enabled
   - Proxy configured to backend API

3. **Database:**
   - MongoDB connection string: `mongodb://localhost:27017/sgc_erp`
   - Models organized by module (HR, Finance, etc.)

## Troubleshooting

### Common Issues

1. **MongoDB Connection Error:**
   - Ensure MongoDB is running
   - Check connection string in `.env`
   - Verify MongoDB port (default: 27017)

2. **Port Already in Use:**
   - Change PORT in `.env` file
   - Kill processes using the ports

3. **Dependencies Installation Issues:**
   - Clear npm cache: `npm cache clean --force`
   - Delete node_modules and reinstall

4. **Frontend Build Issues:**
   - Check Node.js version compatibility
   - Clear build cache: `npm run build -- --reset-cache`

### Getting Help

If you encounter issues:

1. Check the console for error messages
2. Verify all prerequisites are installed
3. Ensure MongoDB is running
4. Check environment variables
5. Review the README.md for additional information

## Next Steps

After successful installation:

1. **Explore the Modules:**
   - HR Module: Employee management, payroll
   - Finance Module: Accounting, reporting
   - Procurement Module: Purchase orders, vendors
   - Sales Module: Sales orders, customers
   - CRM Module: Leads, contacts, opportunities

2. **Customize the System:**
   - Modify user roles and permissions
   - Add custom fields to models
   - Implement additional features

3. **Production Deployment:**
   - Set up production environment variables
   - Configure MongoDB for production
   - Set up reverse proxy (nginx)
   - Enable SSL/TLS

## Support

For support and questions:
- Check the documentation in README.md
- Review the code comments
- Create an issue in the repository

---

**Happy coding! 🚀** 