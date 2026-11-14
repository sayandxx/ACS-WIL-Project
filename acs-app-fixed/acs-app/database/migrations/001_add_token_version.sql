-- Run this once on an existing acs_app database that was created before the logout fix (FB-01).
-- A fresh import of schema.sql already includes this column, so you don't need it then.
USE acs_app;
ALTER TABLE USER ADD COLUMN token_version INT NOT NULL DEFAULT 0 AFTER account_type;
