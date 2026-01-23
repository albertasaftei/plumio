#!/bin/bash
# Setup Docker secrets for Pluma

set -e

echo "🔐 Setting up Docker secrets for Pluma..."

# Create secrets directory
mkdir -p secrets

# Generate JWT secret (32 bytes = 64 hex chars)
if [ ! -f secrets/jwt_secret.txt ]; then
    echo "Generating JWT secret..."
    openssl rand -hex 32 > secrets/jwt_secret.txt
    echo "✓ JWT secret generated"
else
    echo "ℹ JWT secret already exists"
fi

# Generate encryption key (32 bytes = 64 hex chars for AES-256)
if [ ! -f secrets/encryption_key.txt ]; then
    echo "Generating encryption key..."
    openssl rand -hex 32 > secrets/encryption_key.txt
    echo "✓ Encryption key generated"
else
    echo "ℹ Encryption key already exists"
fi

# Set proper permissions
chmod 600 secrets/*.txt

echo ""
echo "✅ Secrets setup complete!"
echo ""
echo "⚠️  IMPORTANT: Keep the secrets/ directory secure!"
echo "   - Do NOT commit it to git"
echo "   - Back it up securely"
echo "   - If you lose these files, you won't be able to decrypt your documents"
echo ""
