#!/usr/bin/env bash
set -e

# Target .env file
ENV_FILE=".env"
EXAMPLE_FILE=".env.example"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Configuring Kanban environment...${NC}"

if [ ! -f "$ENV_FILE" ]; then
  if [ -f "$EXAMPLE_FILE" ]; then
    cp "$EXAMPLE_FILE" "$ENV_FILE"
    echo -e "${GREEN}✅ Created $ENV_FILE from $EXAMPLE_FILE${NC}"
  else
    echo "❌ $EXAMPLE_FILE not found. Cannot initialize environment."
    exit 1
  fi
fi

generate_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    # Fallback if openssl is missing
    LC_ALL=C tr -dc 'a-f0-9' < /dev/urandom | head -c 64
  fi
}

update_env() {
  local key=$1
  local value=$2
  
  # Detect OS for sed compatibility
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS sed
    sed -i '' "s|^$key=.*|$key=$value|g" "$ENV_FILE"
  else
    # Linux sed
    sed -i "s|^$key=.*|$key=$value|g" "$ENV_FILE"
  fi
}

# Update JWT secrets if they are still defaults
if grep -q "super-secret-change-me" "$ENV_FILE"; then
  NEW_JWT=$(generate_secret)
  update_env "JWT_SECRET" "$NEW_JWT"
  echo -e "${GREEN}✅ Generated secure JWT_SECRET${NC}"
fi

if grep -q "another-secret-change-me" "$ENV_FILE"; then
  NEW_REFRESH=$(generate_secret)
  update_env "REFRESH_SECRET" "$NEW_REFRESH"
  echo -e "${GREEN}✅ Generated secure REFRESH_SECRET${NC}"
fi

echo -e "${BLUE}🚀 Environment is ready!${NC}"
echo -e "You can now run ${BLUE}docker compose up -d${NC} or ${BLUE}pnpm dev${NC}"
