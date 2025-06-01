#!/bin/bash

# BassNotion Development Environment Manager

case "$1" in
    start)
        echo "🚀 Starting BassNotion development servers..."
        pm2 start ecosystem.config.json
        echo "✅ Servers started!"
        echo "Backend: http://localhost:3000"
        echo "Frontend: http://localhost:3001"
        ;;
    stop)
        echo "🛑 Stopping BassNotion development servers..."
        pm2 stop bassnotion-backend bassnotion-frontend
        echo "✅ Servers stopped!"
        ;;
    restart)
        echo "🔄 Restarting BassNotion development servers..."
        pm2 restart bassnotion-backend bassnotion-frontend
        echo "✅ Servers restarted!"
        ;;
    status)
        echo "📊 BassNotion Development Status:"
        pm2 status
        ;;
    logs)
        echo "📄 Showing logs (Press Ctrl+C to exit):"
        pm2 logs --lines 50
        ;;
    logs-backend)
        echo "📄 Backend logs:"
        pm2 logs bassnotion-backend --lines 50
        ;;
    logs-frontend)
        echo "📄 Frontend logs:"
        pm2 logs bassnotion-frontend --lines 50
        ;;
    clean)
        echo "🧹 Cleaning up PM2 processes..."
        pm2 delete bassnotion-backend bassnotion-frontend
        echo "✅ Cleanup complete!"
        ;;
    *)
        echo "🎵 BassNotion Development Environment Manager"
        echo ""
        echo "Usage: $0 {start|stop|restart|status|logs|logs-backend|logs-frontend|clean}"
        echo ""
        echo "Commands:"
        echo "  start         - Start both backend and frontend servers"
        echo "  stop          - Stop both servers"
        echo "  restart       - Restart both servers"
        echo "  status        - Show server status"
        echo "  logs          - Show logs from both servers"
        echo "  logs-backend  - Show only backend logs"
        echo "  logs-frontend - Show only frontend logs"
        echo "  clean         - Remove all PM2 processes"
        echo ""
        echo "Servers will run on:"
        echo "  Backend:  http://localhost:3000"
        echo "  Frontend: http://localhost:3001"
        ;;
esac 