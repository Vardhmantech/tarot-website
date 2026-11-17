@echo off
REM 🚀 Krushnalaya Website Setup Script for Windows
REM This script sets up the complete website with Razorpay integration

echo 🔮 Setting up Krushnalaya Website...

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js 20+ first.
    pause
    exit /b 1
)

echo ℹ️  Installing root dependencies...
call npm install

echo ℹ️  Setting up backend...

REM Backend setup
cd backend

REM Install backend dependencies
echo ℹ️  Installing backend dependencies...
call npm install

REM Check if .env exists
if not exist ".env" (
    echo ⚠️  .env file not found. Creating from example...
    if exist ".env.example" (
        copy ".env.example" ".env"
        echo ℹ️  Please update .env file with your Razorpay credentials
    ) else (
        echo ❌ .env.example not found. Please create .env manually.
    )
) else (
    echo ✅ .env file exists
)

cd ..

echo ℹ️  Setting up frontend...

REM Frontend setup
cd frontend

REM Install frontend dependencies
echo ℹ️  Installing frontend dependencies...
call npm install

REM Check if .env exists
if not exist ".env" (
    echo ℹ️  Creating frontend .env file...
    (
        echo # Frontend Environment Variables
        echo VITE_API_URL=
        echo VITE_RAZORPAY_KEY_ID=rzp_test_your_key_here
        echo VITE_APP_NAME=Krushnalaya
        echo VITE_APP_DESCRIPTION=Spiritual Services - Tarot, Reiki ^& Water Divination
        echo GENERATE_SOURCEMAP=false
    ) > .env
    echo ✅ Frontend .env file created
) else (
    echo ✅ Frontend .env file exists
)

cd ..

echo ✅ Setup completed!
echo.
echo 🎉 Krushnalaya Website is ready!
echo.
echo 📋 Next steps:
echo 1. Update backend\.env with your MySQL and Razorpay credentials
echo 2. Create the database tables: cd backend ^&^& npm run db:create
echo 3. Start both apps: npm run dev
echo 4. Open the frontend: http://localhost:5174
echo 5. Test integration: open razorpay-test.html in browser
echo.
echo 🔗 URLs:
echo    Frontend: http://localhost:5174
echo    Backend:  http://localhost:5000
echo    Test:     %cd%\razorpay-test.html
echo.
echo 💳 Test Cards:
echo    Success: 4111 1111 1111 1111
echo    Failure: 4000 0000 0000 0002
echo    CVV: Any 3 digits, Expiry: Any future date
echo.
echo ✅ Happy coding! 🚀

pause