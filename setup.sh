#!/bin/bash

echo "🚀 Pluma Setup Script"
echo "===================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "✅ Docker and Docker Compose found"
echo ""

# Generate secure keys
echo "🔑 Generating secure keys..."
JWT_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)

# Create .env file
cat > .env << EOF
JWT_SECRET=${JWT_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
EOF

echo "✅ Environment file created with secure keys"
echo ""

# Ask about SSL
read -p "Do you want to set up SSL/HTTPS? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    mkdir -p ssl
    echo "Generating self-signed SSL certificate..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout ssl/key.pem -out ssl/cert.pem \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
    echo "✅ SSL certificate generated"
    echo ""
    USE_NGINX=true
else
    USE_NGINX=false
fi

# Build and start containers
echo "🐳 Building and starting Docker containers..."
if [ "$USE_NGINX" = true ]; then
    docker-compose up -d --build
    echo ""
    echo "✅ Pluma is now running!"
    echo ""
    echo "📝 Access your markdown editor at:"
    echo "   HTTPS: https://localhost"
    echo "   HTTP:  http://localhost"
else
    docker-compose up -d --build frontend backend
    echo ""
    echo "✅ Pluma is now running!"
    echo ""
    echo "📝 Access your markdown editor at:"
    echo "   http://localhost:3000"
fi

echo ""
echo "🔐 On first access, you'll be prompted to create an admin account."
echo ""
echo "📊 Useful commands:"
echo "   View logs:     docker-compose logs -f"
echo "   Stop:          docker-compose down"
echo "   Restart:       docker-compose restart"
echo "   Backup data:   docker run --rm -v pluma_pluma-data:/data -v \$(pwd):/backup alpine tar czf /backup/backup.tar.gz /data"
echo ""
