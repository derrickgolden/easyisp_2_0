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

# giving wireguard client permission to the server
/etc/freeradius/3.0/clients.conf

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
