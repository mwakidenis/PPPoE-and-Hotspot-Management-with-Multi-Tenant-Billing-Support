-- Fix radacct groupname field to have default value
-- This prevents FreeRADIUS accounting errors

ALTER TABLE radacct MODIFY groupname varchar(64) NOT NULL DEFAULT '';
