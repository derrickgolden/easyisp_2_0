#!/bin/bash

# EasyISP Backend & Frontend Startup Script

echo "Starting EasyISP Application..."
echo ""

# Check if we're in the correct directory
if [ ! -f "easyisp-api/artisan" ]; then
  echo "❌ Error: Run this script from /code/easyisp2.0/"
  exit 1
fi

# Start the API server
echo "🚀 Starting API Backend on port 8000..."
cd easyisp-api
php artisan serve --host=0.0.0.0 --port=8000 &
API_PID=$!
sleep 2

# Start the frontend
echo "🚀 Starting Frontend on port 3002..."
cd ../easyisp-frontend
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ Application Started!"
echo ""
echo "📱 Frontend: http://localhost:3002"
echo "🔌 API: http://localhost:8000"
echo ""
echo "Test Credentials:"
echo "  Email: admin@easyisp.local"
echo "  Password: password123"
echo ""
echo "To stop the servers, press Ctrl+C or run: kill $API_PID $FRONTEND_PID"
echo ""

# Wait for both processes
wait
