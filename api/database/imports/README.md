Place the CSV named 180126Apr2026_customers.csv in this folder before running migrations.

Expected path when running migrations: database/imports/180126Apr2026_customers.csv

The migration `2026_06_11_120000_add_f_identity_to_customers_table.php` will look for that file and
attempt to populate the `f_identity` column on `customers` by matching the `Phone` column.

Notes:
- Ensure phone formats in the CSV exactly match the `phone` values in the `customers` table.
- Back up your database before running the migration.

cp /home/japtech/Desktop/180126Apr2026_customers.csv api/database/imports/180126Apr2026_customers.csv
cd api
php artisan migrate