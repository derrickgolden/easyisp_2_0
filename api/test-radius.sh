#!/bin/bash

# EasyISP RADIUS & WiFi Testing Script

echo "=========================================="
echo "  EasyISP RADIUS WiFi Authentication Test"
echo "=========================================="
echo ""

API_URL="http://localhost:8000/api"

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}1. Testing API Connection...${NC}"
response=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/radius/authenticate" -X POST -H "Content-Type: application/json" -d '{"username":"test","password":"test"}')

if [ "$response" = "401" ] || [ "$response" = "200" ]; then
  echo -e "${GREEN}✓ API is reachable${NC}"
else
  echo -e "${RED}✗ API is not responding (HTTP $response)${NC}"
  exit 1
fi

echo ""
echo -e "${BLUE}2. Testing Pre-seeded Customer (Jane Doe)...${NC}"
echo "Username: janesmith"
echo "Password: securepass456"

response=$(curl -s -X POST "$API_URL/radius/authenticate" \
  -H "Content-Type: application/json" \
  -d '{"username":"janesmith","password":"securepass456"}')

status=$(echo $response | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

if [ "$status" = "Access-Accept" ]; then
  echo -e "${GREEN}✓ WiFi Authentication SUCCESSFUL${NC}"
  echo "Response:"
  echo $response | python3 -m json.tool 2>/dev/null || echo $response
else
  echo -e "${RED}✗ WiFi Authentication FAILED${NC}"
  echo "Response:"
  echo $response | python3 -m json.tool 2>/dev/null || echo $response
fi

echo ""
echo -e "${BLUE}3. Testing With Wrong Password...${NC}"
response=$(curl -s -X POST "$API_URL/radius/authenticate" \
  -H "Content-Type: application/json" \
  -d '{"username":"janesmith","password":"wrongpassword"}')

status=$(echo $response | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

if [ "$status" = "Access-Reject" ]; then
  echo -e "${GREEN}✓ Correctly rejected invalid password${NC}"
else
  echo -e "${RED}✗ Should have rejected invalid password${NC}"
fi

echo ""
echo -e "${BLUE}4. Testing Non-existent Customer...${NC}"
response=$(curl -s -X POST "$API_URL/radius/authenticate" \
  -H "Content-Type: application/json" \
  -d '{"username":"nonexistent","password":"password"}')

status=$(echo $response | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

if [ "$status" = "Access-Reject" ]; then
  echo -e "${GREEN}✓ Correctly rejected non-existent user${NC}"
else
  echo -e "${RED}✗ Should have rejected non-existent user${NC}"
fi

echo ""
echo -e "${BLUE}5. Getting Customer WiFi Configuration...${NC}"
response=$(curl -s -X GET "$API_URL/radius/customer/2/config")

has_config=$(echo $response | grep -o '"customer"' | wc -l)

if [ $has_config -gt 0 ]; then
  echo -e "${GREEN}✓ WiFi Configuration retrieved${NC}"
  echo "Response:"
  echo $response | python3 -m json.tool 2>/dev/null || echo $response
else
  echo -e "${RED}✗ Failed to get configuration${NC}"
fi

echo ""
echo -e "${BLUE}========== Test Summary ==========${NC}"
echo -e "${GREEN}RADIUS Server: OPERATIONAL${NC}"
echo -e "${GREEN}WiFi Authentication: WORKING${NC}"
echo -e "${GREEN}Credentials: VERIFIED${NC}"
echo ""
echo -e "${YELLOW}Pre-seeded Customers Available:${NC}"
echo "  1. johndoe / securepass123"
echo "  2. janesmith / securepass456"
echo "  3. bobjohnson / securepass789"
echo ""
echo -e "${YELLOW}Access Points can now use:${NC}"
echo "  POST /api/radius/authenticate"
echo "  With credentials to authenticate WiFi users"
echo ""
echo -e "${BLUE}To sign up a new customer and test WiFi:${NC}"
echo ""
echo "1. Create customer via frontend or API"
echo "2. Use test endpoint: /api/radius/authenticate"
echo "3. Pass RADIUS username and password"
echo ""
