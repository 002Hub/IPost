start transaction;

drop database if exists ipost;
CREATE DATABASE `ipost` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

use ipost;

CREATE TABLE `application` (
  `application_id` int NOT NULL AUTO_INCREMENT,
  `application_secret` varchar(45) NOT NULL,
  PRIMARY KEY (`application_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `users` (
  `User_ID` int NOT NULL AUTO_INCREMENT,
  `User_Name` varchar(250) NOT NULL,
  `User_PW` varchar(45) NOT NULL,
  `User_CreationStamp` varchar(1000) NOT NULL DEFAULT 'None',
  `User_CreationIP` varchar(45) NOT NULL DEFAULT 'None',
  `User_LastIP` varchar(45) NOT NULL DEFAULT 'None',
  `User_Bio` varchar(100) DEFAULT 'wow such empty',
  `User_Avatar` varchar(100) DEFAULT NULL,
  `User_Settings` json NOT NULL,
  PRIMARY KEY (`User_ID`),
  UNIQUE KEY `User_Name_UNIQUE` (`User_Name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `auth_tokens` (
  `auth_token` varchar(45) NOT NULL,
  `auth_token_u_id` int NOT NULL,
  `auth_token_isfrom_application_id` int NOT NULL,
  PRIMARY KEY (`auth_token`,`auth_token_u_id`,`auth_token_isfrom_application_id`),
  KEY `auth_tokens_ibfk_1` (`auth_token_isfrom_application_id`),
  KEY `auth_token_u_username` (`auth_token_u_id`),
  CONSTRAINT `auth_tokens_ibfk_1` FOREIGN KEY (`auth_token_isfrom_application_id`) REFERENCES `application` (`application_id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `auth_tokens_ibfk_2` FOREIGN KEY (`auth_token_u_id`) REFERENCES `users` (`User_ID`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `dms` (
  `dms_id` bigint NOT NULL AUTO_INCREMENT,
  `dms_user_name` varchar(100) NOT NULL,
  `dms_text` varchar(4000) NOT NULL,
  `dms_time` bigint NOT NULL,
  `dms_special_text` varchar(100) DEFAULT NULL,
  `dms_receiver` varchar(100) DEFAULT NULL,
  `dms_is_private` tinyint DEFAULT '0',
  `dms_from_bot` tinyint DEFAULT '0',
  `dms_reply_id` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`dms_id`)
) ENGINE=InnoDB AUTO_INCREMENT=180805 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `posts` (
  `post_id` bigint NOT NULL AUTO_INCREMENT,
  `post_user_name` varchar(100) NOT NULL,
  `post_text` varchar(4000) NOT NULL,
  `post_time` bigint NOT NULL,
  `post_special_text` varchar(100) DEFAULT NULL,
  `post_receiver_name` varchar(100) DEFAULT NULL,
  `post_from_bot` tinyint DEFAULT '0',
  `post_reply_id` bigint unsigned DEFAULT NULL,
  `post_is_private` tinyint DEFAULT '0',
  `file_0` varchar(52) DEFAULT NULL,
  `file_1` varchar(52) DEFAULT NULL,
  `file_2` varchar(52) DEFAULT NULL,
  `file_3` varchar(52) DEFAULT NULL,
  `file_4` varchar(52) DEFAULT NULL,
  PRIMARY KEY (`post_id`)
) ENGINE=InnoDB AUTO_INCREMENT=994 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

commit;
