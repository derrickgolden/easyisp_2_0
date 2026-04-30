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

