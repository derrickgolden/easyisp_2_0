# easyisp_2_0

# to start clone jobs
crontab -e
# add
* * * * * cd /var/www/easyisp_2_0/api && php artisan schedule:run >> /dev/null 2>&1

# enable restart on reboot
# Web & Database
systemctl enable mysql
systemctl enable php8.1-fpm
systemctl enable caddy

# Radius & VPN
systemctl enable freeradius
systemctl enable wg-quick@wg0

# set to local time
sudo timedatectl set-timezone Africa/Nairobi
# inside mysql
SET time_zone = '+03:00';
nano /etc/mysql/my.cnf
# add
[mysqld]
default-time-zone = '+03:00'
# finally
sudo systemctl restart mysql

# install spatie
# 1. drop role table
ALTER TABLE users DROP FOREIGN KEY users_role_id_foreign;
DROP TABLE roles;
# 2. install
composer require spatie/laravel-permission
php artisan vendor:publish --provider="Spatie\Permission\PermissionServiceProvider"


# implement mikrotik API 
composer require evilfreelancer/routeros-api-php
# install reverb
composer require laravel/reverb
php artisan reverb:install
# after config start reverb
php artisan reverb:start

# how to insert new permissions
Put app in maintenance mode (optional but safest for auth/role changes during peak usage).
php artisan down

Run only the permission seeder with force.
php artisan db:seed --class=PermissionSeeder --force

Clear Spatie permission cache explicitly.
php artisan permission:cache-reset

If you use queue workers or Horizon, restart workers so long-lived processes reload permissions.
php artisan queue:restart
php artisan horizon:terminate

Bring app back up.
php artisan up

# restarting wireguard
systemctl restart wg-quick@wg0
systemctl status wg-quick@wg0

# giving wireguard client permission to the server
/etc/freeradius/3.0/clients.conf
# after changes
systemctl restart freeradius

# moving files for god admin
cp -r /var/www/easyisp_2_0/admin/dist/* /var/www/easyisp_god_admin/

# Generating CALLBACK ULRS token using artisan command
artisan org:generate-callback-tokens <organizationAcronym> only generates if org <organizationAcronym> has no token, otherwise no change

Generated token for organization 3 (JapTech Technologies).
Callback URL: /payments/c2b/7rRByGKTqQgs2UPa2Xni/validation
Callback URL: /payments/c2b/7rRByGKTqQgs2UPa2Xni/confirmation
Callback URL: /payments/payhero/7rRByGKTqQgs2UPa2Xni/stk/callback

Generated token for organization 1 (Easy Tech Cloud).
Callback URL: /payments/c2b/gDfe1cLVv91bPeSys9J6/validation
Callback URL: /payments/c2b/gDfe1cLVv91bPeSys9J6/confirmation
Callback URL: /payments/payhero/gDfe1cLVv91bPeSys9J6/stk/callback

Generated token for organization 7 (BRU-TECH FIBRE SOLUTIONS).
Callback URL: /payments/c2b/hNnF5iJJPR71uYGRtgt6/validation
Callback URL: /payments/c2b/hNnF5iJJPR71uYGRtgt6/confirmation
Callback URL: /payments/payhero/hNnF5iJJPR71uYGRtgt6/stk/callback
Callback URL: /payments/daraja/hNnF5iJJPR71uYGRtgt6/stk/callback

Generated token for organization 2 (Shinetech Networks).
Callback URL: /payments/c2b/ENNXfWa8JwrjLcvfg42x/validation
Callback URL: /payments/c2b/ENNXfWa8JwrjLcvfg42x/confirmation
Callback URL: /payments/payhero/ENNXfWa8JwrjLcvfg42x/stk/callback
Callback URL: /payments/daraja/ENNXfWa8JwrjLcvfg42x/stk/callback

Generated token for organization 9 (Trika kenya  Global).
Callback URL: /payments/c2b/azAVf52VENWZCWZA2lCn/validation
Callback URL: /payments/c2b/azAVf52VENWZCWZA2lCn/confirmation
Callback URL: /payments/payhero/azAVf52VENWZCWZA2lCn/stk/callback
Callback URL: /payments/daraja/azAVf52VENWZCWZA2lCn/stk/callback



#reversing wrongly closed sessions


##### when adding hotspot, mapping customers to right NAS-IP
sudo nano /etc/freeradius/3.0/mods-config/sql/main/mysql/queries.conf
# then add
authorize_check_query = " \
  SELECT rc.id, rc.username, rc.attribute, rc.value, rc.op \
  FROM radcheck rc \
  JOIN ( \
    SELECT radius_username, organization_id FROM easyisp_2_0.customers \
    UNION ALL \
    SELECT mac_address AS radius_username, organization_id FROM easyisp_2_0.hotspot_customers \
  ) c ON rc.username = c.radius_username \
  LEFT JOIN easyisp_2_0.sites s ON s.ip_address = '%{NAS-IP-Address}' \
  WHERE rc.username = '%{User-Name}' \
  AND (s.organization_id = c.organization_id OR c.organization_id = 1)"

authorize_check_query = " \
  SELECT rc.id, rc.username, rc.attribute, rc.value, rc.op \
  FROM radcheck rc \
  JOIN easyisp_2_0.customers c ON rc.username = c.radius_username \
  LEFT JOIN easyisp_2_0.sites s ON s.ip_address = '%{NAS-IP-Address}' \
  WHERE rc.username = '%{User-Name}' \
  AND (s.organization_id = c.organization_id OR c.organization_id = 1)"

# no org bybass
authorize_check_query = " \
  SELECT rc.id, rc.username, rc.attribute, rc.value rc.op \
  FROM radcheck rc \
  JOIN easyisp_2_0.customers c ON rc.username = c.radius_username \
  JOIN easyisp_2_0.sites s ON s.ip_address = '%{NAS-IP-Address}' \
  WHERE rc.username = '%{User-Name}' \
  AND s.organization_id = c.organization_id"


  ### when updating new code
git pull origin main
# for supervisor(sms) to use the new code
php artisan queue:restart

# roll customers back
php artisan migrate:rollback --path=/database/migrations/2026_06_10_000003_create_hotspot_customers_table.php

## Implementing PPPoE PCQ -->

/ppp profile
add name=ppp-JTS-pcq \
    local-address=10.254.255.1 \
    remote-address=pppoe-pool-pcq \
    dns-server=8.8.8.8,8.8.4.4


INSERT INTO radreply
(username, attribute, op, value)
VALUES
('Mutugi', 'Mikrotik-Group', ':=', 'ppp-pcq'),
('muTugi', 'Mikrotik-Address-List', ':=', 'PCQ-JTS-20M-10M');


## download = 10M upload   = 20M
/queue type
add name=pcq-10M-download \
    kind=pcq \
    pcq-rate=10M \
    pcq-classifier=dst-address

add name=pcq-20M-upload \
    kind=pcq \
    pcq-rate=20M \
    pcq-classifier=src-address


## 10M download / 20M upload package
/ip firewall mangle
add chain=forward \
    src-address-list=PCQ-JTS-20M-10M \
    action=mark-packet \
    new-packet-mark=pcq-20M-10M-upload \
    passthrough=no

add chain=forward \
    dst-address-list=PCQ-JTS-20M-10M \
    action=mark-packet \
    new-packet-mark=pcq-20M-10M-download \
    passthrough=no

# tree PCQ
/queue tree
add name=PCQ-10M-20M-DOWNLOAD \
    parent=global \
    packet-mark=pcq-20M-10M-download \
    queue=pcq-10M-download

add name=PCQ-10M-20M-UPLOAD \
    parent=global \
    packet-mark=pcq-20M-10M-upload \
    queue=pcq-20M-upload

# mpesa daraja testing
  {
    "passkey": "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919",
    "paybill": "174379",
    "provider": "mpesa",
    "environment": "Sandbox (Testing)",
    "consumer_key": "CGJ1NkFOaz18cfm481m3Z3nixxskpUmQoj3CzPDCdgoet6Uw",
    "validation_url": null,
    "consumer_secret": "v5swlxa8MOogv9uzPqnGgagGDRmeGinMvTNLekpKcgxbIfB3KB4GaYBBy18dtEFV",
    "confirmation_url": null,
    "stk_callback_url": null
}