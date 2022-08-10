drop schema if exists ipost;

create schema ipost;
use ipost;

CREATE TABLE `users` (
  `User_ID` bigint NOT NULL AUTO_INCREMENT,
  `User_Name` varchar(250) NOT NULL,
  `User_PW` varchar(45) NOT NULL,
  `User_CreationStamp` varchar(1000) NOT NULL DEFAULT 'None',
  `User_CreationIP` varchar(45) NOT NULL DEFAULT 'None',
  `User_LastIP` varchar(45) NOT NULL DEFAULT 'None',
  `User_Bio` varchar(100) DEFAULT 'wow such empty',
  `User_Avatar` varchar(100) DEFAULT NULL,
  `User_PublicKey` varchar(830) DEFAULT NULL,
  `User_PrivateKey` text,
  `User_Settings` json NOT NULL,
  PRIMARY KEY (`User_ID`,`User_Name`),
  UNIQUE KEY `User_Name_UNIQUE` (`User_Name`)
);



CREATE TABLE `posts` (
  `post_id` bigint NOT NULL AUTO_INCREMENT,
  `post_user_name` varchar(100) NOT NULL,
  `post_text` varchar(4000) NOT NULL,
  `post_time` bigint NOT NULL,
  `post_special_text` varchar(100) DEFAULT NULL,
  `post_receiver_name` varchar(100) DEFAULT NULL,
  `post_is_private` tinyint DEFAULT '0',
  `post_from_bot` tinyint DEFAULT '0',
  `post_reply_id` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`post_id`)
);

CREATE TABLE `dms` (
  `dms_id` bigint NOT NULL AUTO_INCREMENT,
  `dms_user_name` varchar(100) NOT NULL,
  `dms_text` varchar(4000) NOT NULL,
  `dms_time` bigint NOT NULL,
  `dms_special_text` varchar(100) DEFAULT NULL,
  `dms_receiver` varchar(100) DEFAULT NULL,
  `dms_is_encrypted` tinyint DEFAULT '0',
  `dms_from_bot` tinyint DEFAULT '0',
  `dms_reply_id` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`dms_id`)
);
