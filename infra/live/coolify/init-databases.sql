-- Postgres init — runs once on the first boot of the Coolify Postgres
-- resource (Coolify mounts this under /docker-entrypoint-initdb.d/).
-- One database per iedora product; cada produto corre as suas
-- migrations (drizzle-kit) contra a sua DB no deploy.
CREATE DATABASE menu;
CREATE DATABASE core;
CREATE DATABASE imopush;
