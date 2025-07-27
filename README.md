# SGC ERP System

A comprehensive Enterprise Resource Planning (ERP) system built with Node.js, React.js, and MongoDB.

## 🚀 Features

### Core Modules
- **HR Module**: Employee management, payroll, attendance, performance tracking
- **Finance Module**: Accounting, budgeting, financial reporting, expense management
- **Procurement Module**: Purchase orders, vendor management, inventory tracking
- **Sales Module**: Sales orders, customer management, sales analytics
- **CRM Module**: Customer relationship management, lead tracking, communication

### Technical Stack
- **Backend**: Node.js with Express.js
- **Frontend**: React.js with Material-UI
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT tokens
- **File Upload**: Multer
- **Email**: Nodemailer

## 📁 Project Structure

```
SGC_ERP/
├── server/                 # Backend Node.js server
│   ├── config/            # Database and app configuration
│   ├── controllers/       # Route controllers
│   ├── middleware/        # Custom middleware
│   ├── models/           # MongoDB models
│   ├── routes/           # API routes
│   ├── utils/            # Utility functions
│   └── index.js          # Server entry point
├── client/               # Frontend React application
│   ├── public/           # Static files
│   ├── src/              # React source code
│   │   ├── components/   # Reusable components
│   │   ├── pages/        # Page components
│   │   ├── services/     # API services
│   │   ├── utils/        # Utility functions
│   │   └── App.js        # Main App component
│   └── package.json      # Frontend dependencies
├── .env.example          # Environment variables template
└── package.json          # Backend dependencies
```

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd SGC_ERP
   ```

2. **Install dependencies**
   ```bash
   npm run install-all
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start development servers**
   ```bash
   npm run dev
   ```

## 🔧 Configuration

Create a `.env` file in the root directory with the following variables:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/sgc_erp

# JWT Configuration
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRE=24h

# Email Configuration (Optional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_email_password

# File Upload Configuration
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=5242880
```

## 📊 Database Models

### HR Module
- Employee
- Department
- Position
- Attendance
- Payroll
- Performance

### Finance Module
- Account
- Transaction
- Budget
- Expense
- Invoice

### Procurement Module
- PurchaseOrder
- Vendor
- Product
- Inventory
- Supplier

### Sales Module
- SalesOrder
- Customer
- Product
- SalesReport

### CRM Module
- Lead
- Contact
- Opportunity
- Communication

## 🚀 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/logout` - User logout

### HR Module
- `GET /api/hr/employees` - Get all employees
- `POST /api/hr/employees` - Create employee
- `PUT /api/hr/employees/:id` - Update employee
- `DELETE /api/hr/employees/:id` - Delete employee

### Finance Module
- `GET /api/finance/accounts` - Get all accounts
- `POST /api/finance/transactions` - Create transaction
- `GET /api/finance/reports` - Get financial reports

### Procurement Module
- `GET /api/procurement/purchase-orders` - Get purchase orders
- `POST /api/procurement/purchase-orders` - Create purchase order
- `GET /api/procurement/vendors` - Get vendors

### Sales Module
- `GET /api/sales/orders` - Get sales orders
- `POST /api/sales/orders` - Create sales order
- `GET /api/sales/customers` - Get customers

### CRM Module
- `GET /api/crm/leads` - Get leads
- `POST /api/crm/leads` - Create lead
- `GET /api/crm/opportunities` - Get opportunities

## 🎨 Frontend Features

- **Responsive Design**: Mobile-first approach
- **Material-UI**: Modern and clean UI components
- **Dashboard**: Real-time analytics and metrics
- **Data Tables**: Sortable and filterable data
- **Forms**: Validation and error handling
- **Charts**: Visual data representation
- **Notifications**: Real-time alerts and messages

## 🔒 Security Features

- JWT authentication
- Password hashing with bcrypt
- Input validation
- Rate limiting
- CORS protection
- Helmet security headers
- File upload validation

## 📈 Future Enhancements

- Advanced reporting and analytics
- Mobile application
- Third-party integrations
- Workflow automation
- Advanced permissions system
- Multi-language support
- Cloud deployment

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 👥 Team

- Backend Development
- Frontend Development
- Database Design
- UI/UX Design

---

**SGC ERP System** - Streamlining business operations with modern technology. 