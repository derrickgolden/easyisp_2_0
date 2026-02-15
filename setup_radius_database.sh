#!/bin/bash

# RADIUS Database Population Script
# This script adds test customers to the FreeRADIUS database

MYSQL_HOST="${DB_RADIUS_HOST:-127.0.0.1}"
MYSQL_PORT="${DB_RADIUS_PORT:-3306}"
MYSQL_USER="${DB_RADIUS_USERNAME:-root}"
MYSQL_PASS="${DB_RADIUS_PASSWORD:-}"
MYSQL_DB="${DB_RADIUS_DATABASE:-radius}"

echo "🔧 RADIUS Database Setup"
echo "========================"
echo ""

# Check if MySQL is available
if ! command -v mysql &> /dev/null; then
  echo "❌ MySQL client not installed"
  exit 1
fi

# Test connection
mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASS" "$MYSQL_DB" -e "SELECT 1" > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "❌ Cannot connect to RADIUS database"
  echo "Check credentials:"
  echo "  Host: $MYSQL_HOST:$MYSQL_PORT"
  echo "  User: $MYSQL_USER"
  echo "  Database: $MYSQL_DB"
  exit 1
fi

echo "✅ Connected to RADIUS database"
echo ""

# Function to add user to RADIUS
add_radius_user() {
  local username=$1
  local password=$2
  local ip_address=$3
  
  echo "📝 Adding $username to RADIUS..."
  
  # Insert into radcheck (authentication)
  mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASS" "$MYSQL_DB" <<EOF
INSERT IGNORE INTO radcheck (username, attribute, op, value) VALUES
  ('$username', 'User-Password', ':=', '$password'),
  ('$username', 'Framed-IP-Address', '==', '$ip_address');
EOF

  # Insert into radreply (attributes to return)
  mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASS" "$MYSQL_DB" <<EOF
INSERT IGNORE INTO radreply (username, attribute, op, value) VALUES
  ('$username', 'Framed-IP-Address', ':=', '$ip_address'),
  ('$username', 'Framed-IP-Netmask', ':=', '255.255.255.0'),
  ('$username', 'Service-Type', ':=', 'Framed-User');
EOF

  echo "  ✓ $username added"
}

# Function to add group
add_radius_group() {
  local groupname=$1
  local session_timeout=$2
  local bandwidth=$3
  
  echo "📦 Adding group $groupname..."
  
  mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASS" "$MYSQL_DB" <<EOF
INSERT IGNORE INTO radgroupcheck (groupname, attribute, op, value) VALUES
  ('$groupname', 'Auth-Type', ':=', 'Local');

INSERT IGNORE INTO radgroupreply (groupname, attribute, op, value) VALUES
  ('$groupname', 'Session-Timeout', ':=', '$session_timeout'),
  ('$groupname', 'Framed-MTU', ':=', '1500');
EOF

  echo "  ✓ Group $groupname added"
}

# Function to assign user to group
assign_user_to_group() {
  local username=$1
  local groupname=$2
  local priority=$3
  
  mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASS" "$MYSQL_DB" <<EOF
INSERT IGNORE INTO radusergroup (username, groupname, priority) VALUES
  ('$username', '$groupname', $priority);
EOF
}

echo "➕ Creating Groups..."
add_radius_group "basic_package" "3600" "5Mbps"
add_radius_group "premium_package" "7200" "50Mbps"
echo ""

echo "➕ Creating Test Users..."
add_radius_user "johndoe" "securepass123" "10.0.0.1"
add_radius_user "janesmith" "securepass456" "10.0.0.2"
add_radius_user "bobjohnson" "securepass789" "10.0.0.3"
echo ""

echo "🔗 Assigning Users to Groups..."
assign_user_to_group "johndoe" "basic_package" 1
assign_user_to_group "janesmith" "premium_package" 1
assign_user_to_group "bobjohnson" "basic_package" 1
echo ""

echo "📊 RADIUS Database Status"
echo "=========================="

echo ""
echo "✓ Users in radcheck:"
mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASS" "$MYSQL_DB" -e "SELECT username, COUNT(*) as attributes FROM radcheck GROUP BY username;"

echo ""
echo "✓ User-Password entries:"
mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASS" "$MYSQL_DB" -e "SELECT username, password FROM users LIMIT 5;" 2>/dev/null || mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASS" "$MYSQL_DB" -e "SELECT username, value as 'password' FROM radcheck WHERE attribute='User-Password';"

echo ""
echo "✓ User Groups:"
mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASS" "$MYSQL_DB" -e "SELECT username, groupname FROM radusergroup;"

echo ""
echo "✓ Groups:"
mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASS" "$MYSQL_DB" -e "SELECT DISTINCT groupname FROM radgroupcheck;"

echo ""
echo "🎉 RADIUS database populated successfully!"
