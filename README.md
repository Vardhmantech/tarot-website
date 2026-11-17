# 🔮 Krushnalaya - Complete Spiritual Services Website

A modern, full-stack website for spiritual services including Tarot Reading, Reiki Healing, and Water Divination with integrated Razorpay payment system.

## ✨ Features

### 🎨 Frontend Features
- **Modern UI/UX**: Mystical design with deep purple, midnight blue, gold accents
- **Bilingual Support**: Auto-translation from English to Hindi with preserved fonts
- **Responsive Design**: Mobile-first approach, fully responsive
- **Smooth Animations**: Framer Motion animations and transitions
- **Interactive Components**: Service cards, booking forms, contact forms
- **Form Validation**: React Hook Form with autofill support
- **Payment Integration**: Complete Razorpay payment flow

### 🚀 Backend Features
- **RESTful API**: Clean API endpoints for bookings, contact, and payments
- **Auto-Translation**: Automatic English to Hindi translation for content
- **Payment Processing**: Complete Razorpay integration with webhooks
- **Data Validation**: Comprehensive input validation and sanitization
- **Rate Limiting**: Protection against spam and abuse
- **Security**: Helmet, CORS, XSS protection, NoSQL injection prevention
- **Admin Dashboard**: Complete booking and message management

### 💳 Payment Features
- **Razorpay Integration**: Test and production ready
- **Multiple Payment Methods**: Cards, UPI, Net Banking, Wallets
- **Secure Processing**: Signature verification and webhook handling
- **Error Handling**: Comprehensive payment failure management
- **Access Codes**: Skip payment for special bookings

## 🏗 Tech Stack

### Frontend
- **React 18** with Vite
- **Tailwind CSS** for styling
- **Framer Motion** for animations
- **React Hook Form** for form handling
- **React Router** for navigation
- **Axios** for API calls

### Backend
- **Node.js** with Express.js
- **MySQL** with mysql2
- **Razorpay SDK** for payments
- **Express Validator** for validation
- **Rate Limiting** and security middleware
- **JWT** authentication for admin

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- MySQL 8+
- Razorpay account (test mode)

> Deploying to Hostinger? See [HOSTINGER_DEPLOYMENT.md](HOSTINGER_DEPLOYMENT.md) for the single-domain setup.

### 1. Clone and Setup
```bash
git clone <repository-url>
cd tarot-website

# Run setup script
# Windows:
setup.bat

# Linux/Mac:
chmod +x setup.sh
./setup.sh
```

### 2. Configure Razorpay
1. Get your keys from [Razorpay Dashboard](https://dashboard.razorpay.com/app/keys)
2. Copy `backend/.env.example` to `backend/.env` and fill in your MySQL details and Razorpay keys.

### 3. Start Services
```bash
# Create the MySQL tables
cd backend
npm run db:create
cd ..

# Run backend and frontend together
npm run dev
# Frontend: http://localhost:5174
# Backend:  http://localhost:5000
```

You can also run them separately with `npm run dev:backend` and `npm run dev:frontend`.

### 4. Test Integration
Open `razorpay-test.html` in your browser to test the payment flow.

## 📁 Project Structure

```
tarot-website/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── PaymentButton.jsx     # Reusable payment component
│   │   │   ├── Navbar.jsx
│   │   │   ├── Footer.jsx
│   │   │   └── ...
│   │   ├── pages/
│   │   │   ├── Landing.jsx           # Main page with booking
│   │   │   ├── AdminDashboard.jsx    # Admin panel
│   │   │   └── ...
│   │   ├── utils/
│   │   │   └── razorpayHandler.js    # Payment flow logic
│   │   ├── config/
│   │   │   └── api.js                # API configuration
│   │   └── ...
│   ├── .env                          # Frontend environment
│   └── package.json
├── backend/
│   ├── config/
│   │   └── database.js               # MySQL connection pool
│   ├── routes/
│   │   ├── payments.js               # Enhanced payment routes
│   │   ├── bookings.js
│   │   └── ...
│   ├── scripts/
│   │   ├── createTables.js           # Creates missing tables
│   │   ├── schema.sql                # phpMyAdmin import
│   │   └── seed*.js                  # Seed scripts
│   ├── utils/
│   │   ├── pricing.js                # Authoritative pricing
│   │   └── serialize.js              # MySQL -> camelCase responses
│   ├── .env                          # Backend environment
│   └── server.js                     # Express server + frontend hosting
├── razorpay-test.html                # Payment testing tool
├── setup.bat / setup.sh              # Setup scripts
├── HOSTINGER_DEPLOYMENT.md           # Deployment guide
└── README.md
```

## 💳 Payment Flow

1. **User fills booking form** → Form validation
2. **Submit booking** → Create booking in database
3. **Payment required** → Create Razorpay order
4. **Open payment modal** → User completes payment
5. **Verify signature** → Update booking status
6. **Confirmation** → Show success message

## 🧪 Testing

### Test Cards
- **Success**: 4111 1111 1111 1111
- **Failure**: 4000 0000 0000 0002
- **CVV**: Any 3 digits
- **Expiry**: Any future date

### Testing Steps
1. Open `razorpay-test.html`
2. Click "Check SDK" → Should be green
3. Click "Test Backend" → Should connect
4. Click "Create Order" → Should create order
5. Click "Start Payment" → Modal should open
6. Use test card → Payment should complete

## 🔧 Configuration

### Environment Variables

**Backend (.env)**
```env
PORT=5000
NODE_ENV=development
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=
DB_NAME=tarot_website
FRONTEND_URL=http://localhost:5174

# Razorpay
RAZORPAY_KEY_ID=rzp_test_your_key_here
RAZORPAY_KEY_SECRET=your_secret_here
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here

# Admin
ADMIN_KEY=your_admin_key
JWT_SECRET=your_jwt_secret
```

**Frontend (.env)**
```env
# Empty = same origin (Vite proxies /api in development)
VITE_API_URL=
VITE_RAZORPAY_KEY_ID=rzp_test_your_key_here
VITE_APP_NAME=Krushnalaya
```

## 🛡️ Security Features

- **Rate Limiting**: 100 requests per 15 minutes
- **Input Validation**: Express Validator with sanitization
- **XSS Protection**: Custom XSS filtering
- **SQL Injection Protection**: Parameterized mysql2 queries
- **CORS**: Configured for specific origins
- **Helmet**: Security headers
- **Payment Security**: Signature verification

## 📊 API Endpoints

### Payments
- `POST /api/payments/create-order` - Create Razorpay order
- `POST /api/payments/verify` - Verify payment signature
- `POST /api/payments/failure` - Handle payment failures
- `POST /api/payments/webhook` - Razorpay webhook handler
- `GET /api/payments/config` - Get public key

### Bookings
- `POST /api/bookings` - Create booking
- `GET /api/bookings` - Get all bookings (Admin)
- `GET /api/bookings/available-slots/:date` - Get time slots
- `PUT /api/bookings/cancel-all` - Cancel all bookings (Admin)
- `DELETE /api/bookings/delete-cancelled` - Delete cancelled bookings (Admin)

### Contact
- `POST /api/contact` - Submit contact form
- `GET /api/contact` - Get all messages (Admin)

## 🚀 Production Deployment

See [HOSTINGER_DEPLOYMENT.md](HOSTINGER_DEPLOYMENT.md) for the complete single-domain Hostinger setup.

### Before Going Live
1. Switch to live Razorpay keys
2. Set `NODE_ENV=production`
3. Configure the webhook URL in the Razorpay dashboard
4. Generate strong `ADMIN_KEY` and `JWT_SECRET` values
5. Create the MySQL database and tables
6. Point `FRONTEND_URL` and `APP_URL` at your real domain
7. Confirm `/api/health`, `/`, and `/admin` work after deployment

### Deployment Checklist
- [ ] Environment variables configured
- [ ] Database connected
- [ ] Razorpay webhooks configured
- [ ] SSL certificate installed
- [ ] Domain configured
- [ ] Monitoring set up
- [ ] Backup strategy in place

## 🐛 Troubleshooting

### Common Issues

**Razorpay Modal Not Opening**
- Check if script is loaded: `console.log(window.Razorpay)`
- Verify order creation in backend logs
- Check browser console for errors

**Payment Verification Failed**
- Verify Razorpay secret key
- Check signature format
- Ensure all three values (order_id, payment_id, signature) are received

**CORS Errors**
- Update CORS configuration in server.js
- Check frontend API base URL

### Debug Mode
Set `NODE_ENV=development` for detailed logging.

## 📞 Support

For issues and questions:
- Check the troubleshooting section
- Review browser console and backend logs
- Test with `razorpay-test.html`
- Verify Razorpay dashboard for payment status

## 🎉 Features Completed

✅ **Complete payment integration**  
✅ **Form validation with autofill support**  
✅ **Admin dashboard with booking management**  
✅ **Responsive design**  
✅ **Security hardening**  
✅ **Error handling**  
✅ **Testing tools**  
✅ **Setup automation**  

## 📝 License

MIT License - Built for spiritual seekers and healing practitioners.

---

**🔮 Ready to serve spiritual seekers with modern technology! ✨**