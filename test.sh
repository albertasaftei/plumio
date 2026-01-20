#!/bin/bash

echo "🧪 Pluma Development Test"
echo "=========================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test backend files
echo "📦 Checking backend files..."
if [ -f "backend/package.json" ] && [ -f "backend/src/index.ts" ]; then
    echo -e "${GREEN}✓${NC} Backend files exist"
else
    echo -e "${RED}✗${NC} Backend files missing"
    exit 1
fi

# Test frontend files
echo "📦 Checking frontend files..."
if [ -f "frontend/package.json" ] && [ -f "frontend/src/app.tsx" ]; then
    echo -e "${GREEN}✓${NC} Frontend files exist"
else
    echo -e "${RED}✗${NC} Frontend files missing"
    exit 1
fi

# Test key components
echo "📦 Checking key components..."
FILES=(
    "frontend/src/routes/index.tsx"
    "frontend/src/routes/editor.tsx"
    "frontend/src/components/Editor.tsx"
    "frontend/src/components/Sidebar.tsx"
    "frontend/src/lib/api.ts"
    "backend/src/routes/auth.ts"
    "backend/src/routes/documents.ts"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file"
    else
        echo -e "${RED}✗${NC} $file missing"
        exit 1
    fi
done

# Test Docker files
echo "📦 Checking Docker files..."
if [ -f "frontend/Dockerfile" ] && [ -f "backend/Dockerfile" ] && [ -f "docker-compose.yml" ]; then
    echo -e "${GREEN}✓${NC} Docker configuration exists"
else
    echo -e "${RED}✗${NC} Docker files missing"
    exit 1
fi

# Test environment files
echo "📦 Checking environment files..."
if [ -f ".env" ] && [ -f "backend/.env" ]; then
    echo -e "${GREEN}✓${NC} Environment files exist"
else
    echo -e "${YELLOW}⚠${NC} Environment files missing (will use defaults)"
fi

# Test Node.js
echo "🔍 Checking Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}✓${NC} Node.js $NODE_VERSION"
    
    MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$MAJOR_VERSION" -lt 18 ]; then
        echo -e "${YELLOW}⚠${NC} Node.js version 18+ recommended, you have $NODE_VERSION"
    fi
else
    echo -e "${RED}✗${NC} Node.js not found"
    exit 1
fi

# Test pnpm
echo "🔍 Checking pnpm..."
if command -v pnpm &> /dev/null; then
    PNPM_VERSION=$(pnpm -v)
    echo -e "${GREEN}✓${NC} pnpm $PNPM_VERSION"
else
    echo -e "${YELLOW}⚠${NC} pnpm not found, install with: npm install -g pnpm"
fi

# Test Docker
echo "🔍 Checking Docker..."
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | cut -d',' -f1)
    echo -e "${GREEN}✓${NC} Docker $DOCKER_VERSION"
else
    echo -e "${YELLOW}⚠${NC} Docker not found (required for production deployment)"
fi

echo ""
echo -e "${GREEN}✅ All checks passed!${NC}"
echo ""
echo "🚀 Ready to start development:"
echo ""
echo "  Terminal 1 (Backend):"
echo "    cd backend"
echo "    npm install"
echo "    npm run dev"
echo ""
echo "  Terminal 2 (Frontend):"
echo "    cd frontend"
echo "    pnpm install"
echo "    pnpm dev"
echo ""
echo "Then open: http://localhost:3000"
echo ""
