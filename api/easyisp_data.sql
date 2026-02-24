-- MySQL dump 10.13  Distrib 8.0.45, for Linux (x86_64)
--
-- Host: localhost    Database: easyisp_2_0
-- ------------------------------------------------------
-- Server version	8.0.45-0ubuntu0.22.04.1

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Dumping data for table `customers`
--

LOCK TABLES `customers` WRITE;
/*!40000 ALTER TABLE `customers` DISABLE KEYS */;
INSERT INTO `customers` VALUES (1,1,NULL,1,NULL,'Vincent','Arika',NULL,'0727013733','Kwa malo','Kwa malo','B2','PPPoE',0.00,'active','2026-03-10 08:51:00',NULL,0.00,0,0,'Arika','arIka',NULL,NULL,'$2y$12$392jBtRbDzehiOWRrpSjDeyV6YG7/H/jewrwtr5OIojIocHqvN5HK',NULL,'2026-02-23 07:41:03','2026-02-23 08:51:45'),(2,1,NULL,1,NULL,'Darlingtone','Nyangira',NULL,'0769569862','Area 1','Kwa Malo','F3','PPPoE',0.00,'expired','2026-02-24 08:08:00',NULL,0.00,0,0,'Darlingtone22','daRlingtone',NULL,NULL,'$2y$12$tj2F5TDc/ajsrRErZlVr8u9Lu9S4HC2miFQjmdwvg9lT9CZxR8gqK',NULL,'2026-02-23 08:03:15','2026-02-24 08:32:27'),(3,1,NULL,1,NULL,'Derrick','Nyarangi',NULL,'0714475702','Naivas',NULL,'F3','PPPoE',0.00,'expired','2026-02-23 12:29:12',NULL,0.00,0,0,'derrick','deRrick',NULL,NULL,'$2y$12$QW29LssDuRLsb5sEml9SVuL6nIMucvJpEgW9v/jl/YYkzr1iLSFYu',NULL,'2026-02-23 11:59:12','2026-02-23 12:30:03'),(4,1,NULL,1,NULL,'Cyrus','Andera',NULL,'0792913908','Area 1','Posh mill','grd flr','PPPoE',0.00,'active','2026-03-02 12:30:00',NULL,0.00,0,0,'Cyrus','cyRus',NULL,NULL,'$2y$12$VE8ABRZ1t5AIDVw0UWYXsORpngsBqn/NQjVDHRpAC42p81t2MdzXS',NULL,'2026-02-23 12:27:29','2026-02-23 12:30:35'),(5,1,NULL,1,NULL,'Daudi','Dennis',NULL,'0793465138','Area 1',NULL,'B4','PPPoE',0.00,'active','2026-03-02 12:31:00',NULL,0.00,0,0,'Daudi','daUdi',NULL,NULL,'$2y$12$LYlTM6HZojdi.ImncNeZ/eBZwUXv36fk4x/WGqY9aY4nfFC62ZXSi',NULL,'2026-02-23 12:29:44','2026-02-23 12:31:22'),(6,1,NULL,1,NULL,'Gerald','Njogu',NULL,'0703846222','Area 1','Kwa Malo','C4','PPPoE',0.00,'active','2026-03-02 12:34:00',NULL,0.00,0,0,'Gerald','geRald',NULL,NULL,'$2y$12$8kuixL2REXFJ0OF42CM/aevV0g7B9XUoBgLsgHUY3KEjHnAEAMtFi',NULL,'2026-02-23 12:33:55','2026-02-23 12:34:24'),(7,1,NULL,1,NULL,'Brian','Kimani',NULL,'0716293974','Area 2','Kiamaiko','3rd flr','PPPoE',0.00,'active','2026-03-09 12:38:00',NULL,0.00,0,0,'Kimani','kiMani',NULL,NULL,'$2y$12$QszwLtYo48u0OLqzzBiQ9eqbHiZUm7JTI6T0ZvCX81KCxrt.OC2hG',NULL,'2026-02-23 12:38:15','2026-02-23 12:39:03'),(8,1,NULL,1,NULL,'Dan','Kirimi',NULL,'0746308358','Area 1','Kwa malo','F1','PPPoE',0.00,'active','2026-03-02 12:44:00',NULL,0.00,0,0,'Kirimi','kiRimi',NULL,NULL,'$2y$12$e49N55sLbpuR6t102nD7Mu.682BTMoysQh4iKZdoZ1wADC0691Bl.',NULL,'2026-02-23 12:43:27','2026-02-23 12:44:09'),(9,1,NULL,1,NULL,'Lukwili','Dennis',NULL,'0726661167','Area 1','Kwa Malo','H3','PPPoE',0.00,'active','2026-03-10 12:46:00',NULL,0.00,0,0,'Lukhwili','luKhwili',NULL,NULL,'$2y$12$rC7mB0YI5Ag885jx0k0RuOcjT3xrTUVvDj6XUY3RoUJQk/FlA/hUO',NULL,'2026-02-23 12:46:28','2026-02-23 12:47:00'),(10,1,NULL,3,NULL,'Maurice','Osiro',NULL,'0724660028','Area 2','Kiamaiko',NULL,'PPPoE',0.00,'active','2026-03-16 12:56:00',NULL,0.00,0,0,'Maurice','maUrice',NULL,NULL,'$2y$12$xx7ymW2ewvlEiS2ApfRRC.vxR2zcxkGgzC/DCd/ikSjYQrAepMzd.',NULL,'2026-02-23 12:56:19','2026-02-23 13:32:04'),(11,1,NULL,2,NULL,'Alvin','Mokaya',NULL,'0768244168','Area 1',NULL,NULL,'PPPoE',0.00,'active','2026-03-02 13:27:00',NULL,0.00,0,0,'Mokaya','moKaya',NULL,NULL,'$2y$12$nfPRaNaegwnIExpRVICIzOrfbT7rklxoMaBpOprThA94ENHMDDehm',NULL,'2026-02-23 13:01:01','2026-02-23 13:27:59'),(12,1,NULL,1,NULL,'Fredrick','Ouko',NULL,'0708148610','Naivas','Precision cyber',NULL,'PPPoE',0.00,'active','2026-03-22 13:06:00',NULL,0.00,0,0,'Ouko','ouKo',NULL,NULL,'$2y$12$Rb7LfXBsdJ/y0HjIaVV9EOb/p6Kx0k2hIROUZOj5hb6lEF2TfsQAy',NULL,'2026-02-23 13:04:52','2026-02-23 13:06:25'),(13,1,NULL,3,NULL,'Peter','Omondi',NULL,'0741513606','Hall',NULL,NULL,'PPPoE',0.00,'active','2026-03-03 13:26:00',NULL,0.00,0,0,'Peter','peTer',NULL,NULL,'$2y$12$dXFhtsl.d6z5/NWZXwwnReWzUiYwUoJsU.tMjwHY05ChnRsM70ve2',NULL,'2026-02-23 13:09:45','2026-02-23 13:27:03'),(14,1,NULL,1,NULL,'Brian','Sayo',NULL,'0790415854','Area 1','Kwa malo','E3','PPPoE',900.00,'active','2026-03-03 13:17:00',NULL,0.00,0,0,'Sayo','saYo',NULL,NULL,'$2y$12$BNg3UmiljNe6/rLY2q7sYOvH3uAlCnFeWUj8b8jEO0dhaFysbZOGu',NULL,'2026-02-23 13:17:00','2026-02-23 13:17:18'),(15,1,NULL,1,NULL,'Thomas','Everlyne',NULL,'0729493144','Area 1','24','grd flr','PPPoE',0.00,'active','2026-03-02 13:23:00',NULL,0.00,0,0,'Thomas','thOmas',NULL,NULL,'$2y$12$E0UkN3PGCvThIjLomrpvjONLcqAqHPAJLD3RtYdaFbLi5LWy29mAO',NULL,'2026-02-23 13:22:42','2026-02-23 13:26:17'),(16,1,NULL,1,NULL,'Easy','Tech',NULL,'0714475703','Naivas',NULL,NULL,'PPPoE',0.00,'expired','2026-02-23 17:50:45',NULL,0.00,0,0,'Easytech','Easytech',NULL,NULL,'$2y$12$Rk0pWzxxn7C1Ru8q1vT/gOenctXnE9.FUVylp2qbsnzHyhzi7syZ.',NULL,'2026-02-23 17:20:46','2026-02-23 17:51:02');
/*!40000 ALTER TABLE `customers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `expenses`
--

LOCK TABLES `expenses` WRITE;
/*!40000 ALTER TABLE `expenses` DISABLE KEYS */;
/*!40000 ALTER TABLE `expenses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `failed_jobs`
--

LOCK TABLES `failed_jobs` WRITE;
/*!40000 ALTER TABLE `failed_jobs` DISABLE KEYS */;
/*!40000 ALTER TABLE `failed_jobs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `invoices`
--

LOCK TABLES `invoices` WRITE;
/*!40000 ALTER TABLE `invoices` DISABLE KEYS */;
/*!40000 ALTER TABLE `invoices` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `jobs`
--

LOCK TABLES `jobs` WRITE;
/*!40000 ALTER TABLE `jobs` DISABLE KEYS */;
/*!40000 ALTER TABLE `jobs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `leads`
--

LOCK TABLES `leads` WRITE;
/*!40000 ALTER TABLE `leads` DISABLE KEYS */;
/*!40000 ALTER TABLE `leads` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `organizations`
--

LOCK TABLES `organizations` WRITE;
/*!40000 ALTER TABLE `organizations` DISABLE KEYS */;
INSERT INTO `organizations` VALUES (1,'Easy Tech Cloud','ETC','pro','active','{\"theme\": \"dark\", \"language\": \"en\"}','2026-02-23 07:28:55','2026-02-23 07:29:02');
/*!40000 ALTER TABLE `organizations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `packages`
--

LOCK TABLES `packages` WRITE;
/*!40000 ALTER TABLE `packages` DISABLE KEYS */;
INSERT INTO `packages` VALUES (1,1,'Silver','10M','10M',1000.00,31,'time',NULL,NULL,NULL,NULL,NULL,8,NULL,NULL,'2026-02-23 07:34:54','2026-02-23 07:34:54'),(2,1,'Bronze','6M','6M',800.00,31,'time',NULL,NULL,NULL,NULL,NULL,8,NULL,NULL,'2026-02-23 12:59:33','2026-02-23 12:59:33'),(3,1,'Gold','15M','15M',1500.00,31,'time',NULL,NULL,NULL,NULL,NULL,8,NULL,NULL,'2026-02-23 13:11:10','2026-02-23 13:11:10');
/*!40000 ALTER TABLE `packages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `password_reset_tokens`
--

LOCK TABLES `password_reset_tokens` WRITE;
/*!40000 ALTER TABLE `password_reset_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `password_reset_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `payments`
--

LOCK TABLES `payments` WRITE;
/*!40000 ALTER TABLE `payments` DISABLE KEYS */;
/*!40000 ALTER TABLE `payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `personal_access_tokens`
--

LOCK TABLES `personal_access_tokens` WRITE;
/*!40000 ALTER TABLE `personal_access_tokens` DISABLE KEYS */;
INSERT INTO `personal_access_tokens` VALUES (1,'App\\Models\\SystemAdmin',1,'sys-token','74a30bdec53a8ea45fffeba725e63ea7afad81696a434d53ddccac2cee34f749','[\"access-system\"]','2026-02-23 04:58:32',NULL,'2026-02-23 04:58:32','2026-02-23 04:58:32'),(2,'App\\Models\\SystemAdmin',1,'sys-token','1f97336b499dc3c15a6d40cf9a38db5b4724296fd04fe65a9acf127ba619c756','[\"access-system\"]','2026-02-23 08:44:10',NULL,'2026-02-23 07:27:42','2026-02-23 08:44:10'),(3,'App\\Models\\User',1,'admin-token','83b6e520fcbdb77937763e7c675595c02a5efc949f562351b1b7303a31eb6524','[\"access-admin\"]','2026-02-23 12:03:44',NULL,'2026-02-23 07:32:24','2026-02-23 12:03:44'),(5,'App\\Models\\SystemAdmin',1,'sys-token','89509bd99ed5e704202406329b5e62268e5e8b8d9c3177519cfc8062f88d5db2','[\"access-system\"]','2026-02-23 08:18:54',NULL,'2026-02-23 08:18:49','2026-02-23 08:18:54'),(6,'App\\Models\\User',1,'admin-token','0e1a40185bcdbea66845f15f06bf112a31dc0bd49bbf9e40d9627268ba37f5e7','[\"access-admin\"]','2026-02-23 19:18:11',NULL,'2026-02-23 08:19:41','2026-02-23 19:18:11'),(8,'App\\Models\\User',1,'admin-token','46efe6bf7a61f6a2aa9dd8c443a22981e7466f3e19dd1eb1bface4c9e9ac1691','[\"access-admin\"]','2026-02-23 10:47:27',NULL,'2026-02-23 09:00:43','2026-02-23 10:47:27'),(9,'App\\Models\\User',1,'admin-token','22d5ea30c2169e11a11e37450e5fac0c18f7d64f30f10dc7d886857508038e9e','[\"access-admin\"]','2026-02-23 13:34:40',NULL,'2026-02-23 11:46:07','2026-02-23 13:34:40'),(10,'App\\Models\\User',1,'admin-token','52e2a07f3deafbe53daae721f1306ffb9bdae96e8eb8f559adb0f0245091dff4','[\"access-admin\"]','2026-02-24 08:35:07',NULL,'2026-02-24 08:30:42','2026-02-24 08:35:07');
/*!40000 ALTER TABLE `personal_access_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES (1,NULL,'Super Admin','[\"p1\", \"p2\", \"p3\", \"p4\", \"p5\", \"p6\", \"p7\"]','2026-02-23 04:58:14','2026-02-23 04:58:14'),(2,1,'Super Admin','[]','2026-02-23 07:37:36','2026-02-23 07:37:36');
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `sites`
--

LOCK TABLES `sites` WRITE;
/*!40000 ALTER TABLE `sites` DISABLE KEYS */;
INSERT INTO `sites` VALUES (1,1,'First Site','Area 1','10.30.30.3',NULL,3799,1,'2026-02-24 09:16:03',1,NULL,'2026-02-23 07:33:56','2026-02-24 09:16:03');
/*!40000 ALTER TABLE `sites` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `sms_logs`
--

LOCK TABLES `sms_logs` WRITE;
/*!40000 ALTER TABLE `sms_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `sms_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `system_admins`
--

LOCK TABLES `system_admins` WRITE;
/*!40000 ALTER TABLE `system_admins` DISABLE KEYS */;
INSERT INTO `system_admins` VALUES (1,'System Admin','goldenderrick95@gmail.com','2026-02-23 04:58:14','+254714475702','$2y$12$PnSakKSbRaNmOnREBGs.3.EOA/nSRNARnZOy5aITT0DIPtRL.2Js2',1,NULL,'2026-02-23 04:58:14','2026-02-23 04:58:14');
/*!40000 ALTER TABLE `system_admins` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `tickets`
--

LOCK TABLES `tickets` WRITE;
/*!40000 ALTER TABLE `tickets` DISABLE KEYS */;
/*!40000 ALTER TABLE `tickets` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `transactions`
--

LOCK TABLES `transactions` WRITE;
/*!40000 ALTER TABLE `transactions` DISABLE KEYS */;
/*!40000 ALTER TABLE `transactions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,1,NULL,1,'Derrick Nyarangi','goldenderrick95@gmail.com','0714475702','$2y$12$/Zsdbn1Xhpg/d.bIIgoGPeCqXjGAsktIW9qXbj42.fSXsFqTzfJbm',1,'Active','2026-02-24 08:30:42',NULL,'2026-02-23 07:30:49','2026-02-24 08:30:42');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-02-24 12:16:45
