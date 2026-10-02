-- Caulong demo SQLite schema export.
-- Includes all initialized application tables and migration history; live application data is intentionally omitted.
-- Import into an empty SQLite database, then optionally run: php artisan db:seed --class=DemoCatalogSeeder

PRAGMA foreign_keys = OFF;
BEGIN TRANSACTION;

CREATE TABLE "brands" ("id" integer primary key autoincrement not null, "name" varchar not null, "slug" varchar not null, "created_at" datetime, "updated_at" datetime);

CREATE TABLE "cache" ("key" varchar not null, "value" text not null, "expiration" integer not null, primary key ("key"));

CREATE TABLE "cache_locks" ("key" varchar not null, "owner" varchar not null, "expiration" integer not null, primary key ("key"));

CREATE TABLE "categories" ("id" integer primary key autoincrement not null, "name" varchar not null, "slug" varchar not null, "created_at" datetime, "updated_at" datetime);

CREATE TABLE "failed_jobs" ("id" integer primary key autoincrement not null, "uuid" varchar not null, "connection" varchar not null, "queue" varchar not null, "payload" text not null, "exception" text not null, "failed_at" datetime not null default CURRENT_TIMESTAMP);

CREATE TABLE "job_batches" ("id" varchar not null, "name" varchar not null, "total_jobs" integer not null, "pending_jobs" integer not null, "failed_jobs" integer not null, "failed_job_ids" text not null, "options" text, "cancelled_at" integer, "created_at" integer not null, "finished_at" integer, primary key ("id"));

CREATE TABLE "jobs" ("id" integer primary key autoincrement not null, "queue" varchar not null, "payload" text not null, "attempts" integer not null, "reserved_at" integer, "available_at" integer not null, "created_at" integer not null);

CREATE TABLE "migrations" ("id" integer primary key autoincrement not null, "migration" varchar not null, "batch" integer not null);

CREATE TABLE "order_items" ("id" integer primary key autoincrement not null, "order_id" integer not null, "variant_id" integer, "product_name" varchar not null, "variant_name" varchar not null, "sku" varchar not null, "unit_price" integer not null, "quantity" integer not null, "line_total" integer not null, "created_at" datetime, "updated_at" datetime, "unit_cost" integer, foreign key("order_id") references "orders"("id") on delete cascade, foreign key("variant_id") references "product_variants"("id") on delete restrict);

CREATE TABLE "orders" ("id" integer primary key autoincrement not null, "public_id" varchar not null, "checkout_token" varchar not null, "user_id" integer, "name" varchar not null, "phone" varchar not null, "address" varchar not null, "email" varchar, "notes" text, "status" varchar not null default 'pending', "payment_method" varchar not null default 'cod', "payment_status" varchar not null default 'unpaid', "subtotal" integer not null, "shipping_fee" integer not null, "total" integer not null, "is_demo" tinyint(1) not null default '0', "created_at" datetime, "updated_at" datetime, "confirmed_at" datetime, "shipped_at" datetime, "delivered_at" datetime, "cancelled_at" datetime, "paid_at" datetime, foreign key("user_id") references "users"("id") on delete set null);

CREATE TABLE "passkeys" ("id" integer primary key autoincrement not null, "user_id" integer not null, "name" varchar not null, "credential_id" varchar not null, "credential" text not null, "last_used_at" datetime, "created_at" datetime, "updated_at" datetime, foreign key("user_id") references "users"("id") on delete cascade);

CREATE TABLE "password_reset_tokens" ("email" varchar not null, "token" varchar not null, "created_at" datetime, primary key ("email"));

CREATE TABLE "product_variants" ("id" integer primary key autoincrement not null, "product_id" integer not null, "sku" varchar not null, "name" varchar not null, "price" integer not null, "stock" integer not null, "is_active" tinyint(1) not null default '1', "created_at" datetime, "updated_at" datetime, "cost_price" integer, foreign key("product_id") references "products"("id") on delete restrict);

CREATE TABLE "products" ("id" integer primary key autoincrement not null, "brand_id" integer, "category_id" integer, "name" varchar not null, "slug" varchar not null, "description" text not null, "image_path" varchar, "specs" text, "play_style" varchar check ("play_style" in ('attack', 'speed', 'balanced')) not null, "skill_level" varchar check ("skill_level" in ('beginner', 'intermediate', 'advanced', 'all')) not null, "is_active" tinyint(1) not null default '0', "is_featured" tinyint(1) not null default '0', "is_demo" tinyint(1) not null default '0', "created_at" datetime, "updated_at" datetime, foreign key("brand_id") references "brands"("id") on delete set null, foreign key("category_id") references "categories"("id") on delete set null);

CREATE TABLE "sessions" ("id" varchar not null, "user_id" integer, "ip_address" varchar, "user_agent" text, "payload" text not null, "last_activity" integer not null, primary key ("id"));

CREATE TABLE "settings" ("key" varchar not null, "value" text not null, "created_at" datetime, "updated_at" datetime, primary key ("key"));

CREATE TABLE "support_conversations" ("id" integer primary key autoincrement not null, "session_key" varchar not null, "status" varchar not null default ('open'), "last_message_at" datetime, "created_at" datetime, "updated_at" datetime, "needs_human" tinyint(1) not null default '0', "assigned_to" integer, foreign key("assigned_to") references "users"("id") on delete set null);

CREATE TABLE "support_messages" ("id" integer primary key autoincrement not null, "conversation_id" integer not null, "sender" varchar not null, "body" text not null, "action_url" text, "action_label" varchar, "read_at" datetime, "created_at" datetime, "updated_at" datetime, foreign key("conversation_id") references "support_conversations"("id") on delete cascade);

CREATE TABLE "users" ("id" integer primary key autoincrement not null, "name" varchar not null, "email" varchar not null, "email_verified_at" datetime, "password" varchar not null, "remember_token" varchar, "created_at" datetime, "updated_at" datetime, "two_factor_secret" text, "two_factor_recovery_codes" text, "two_factor_confirmed_at" datetime, "is_admin" tinyint(1) not null default '0');

CREATE UNIQUE INDEX "brands_slug_unique" on "brands" ("slug");

CREATE INDEX "cache_expiration_index" on "cache" ("expiration");

CREATE INDEX "cache_locks_expiration_index" on "cache_locks" ("expiration");

CREATE UNIQUE INDEX "categories_slug_unique" on "categories" ("slug");

CREATE INDEX "failed_jobs_connection_queue_failed_at_index" on "failed_jobs" ("connection", "queue", "failed_at");

CREATE UNIQUE INDEX "failed_jobs_uuid_unique" on "failed_jobs" ("uuid");

CREATE INDEX "jobs_queue_index" on "jobs" ("queue");

CREATE UNIQUE INDEX "orders_checkout_token_unique" on "orders" ("checkout_token");

CREATE INDEX "orders_created_at_index" on "orders" ("created_at");

CREATE INDEX "orders_paid_at_index" on "orders" ("paid_at");

CREATE UNIQUE INDEX "orders_public_id_unique" on "orders" ("public_id");

CREATE UNIQUE INDEX "passkeys_credential_id_unique" on "passkeys" ("credential_id");

CREATE INDEX "passkeys_user_id_index" on "passkeys" ("user_id");

CREATE INDEX "product_variants_product_id_is_active_price_index" on "product_variants" ("product_id", "is_active", "price");

CREATE UNIQUE INDEX "product_variants_sku_unique" on "product_variants" ("sku");

CREATE INDEX "products_is_active_index" on "products" ("is_active");

CREATE UNIQUE INDEX "products_slug_unique" on "products" ("slug");

CREATE INDEX "sessions_last_activity_index" on "sessions" ("last_activity");

CREATE INDEX "sessions_user_id_index" on "sessions" ("user_id");

CREATE INDEX "support_conversations_last_message_at_index" on "support_conversations" ("last_message_at");

CREATE INDEX "support_conversations_needs_human_index" on "support_conversations" ("needs_human");

CREATE INDEX "support_conversations_session_key_index" on "support_conversations" ("session_key");

CREATE INDEX "support_conversations_status_index" on "support_conversations" ("status");

CREATE INDEX "support_messages_conversation_id_id_index" on "support_messages" ("conversation_id", "id");

CREATE INDEX "support_messages_sender_read_at_index" on "support_messages" ("sender", "read_at");

CREATE UNIQUE INDEX "users_email_unique" on "users" ("email");

INSERT INTO migrations (migration, batch) VALUES ('0001_01_01_000000_create_users_table', 1);
INSERT INTO migrations (migration, batch) VALUES ('0001_01_01_000001_create_cache_table', 1);
INSERT INTO migrations (migration, batch) VALUES ('0001_01_01_000002_create_jobs_table', 1);
INSERT INTO migrations (migration, batch) VALUES ('2024_01_01_000000_create_passkeys_table', 1);
INSERT INTO migrations (migration, batch) VALUES ('2025_08_14_170933_add_two_factor_columns_to_users_table', 1);
INSERT INTO migrations (migration, batch) VALUES ('2026_09_25_100000_create_catalog_tables', 2);
INSERT INTO migrations (migration, batch) VALUES ('2026_09_25_100100_add_is_admin_to_users', 2);
INSERT INTO migrations (migration, batch) VALUES ('2026_09_25_100200_create_order_tables', 2);
INSERT INTO migrations (migration, batch) VALUES ('2026_09_28_100000_add_status_timestamps_to_orders', 3);
INSERT INTO migrations (migration, batch) VALUES ('2026_09_28_100100_create_settings_table', 3);
INSERT INTO migrations (migration, batch) VALUES ('2026_09_28_110000_add_cost_prices', 4);
INSERT INTO migrations (migration, batch) VALUES ('2026_09_30_120000_create_support_chat_tables', 5);
INSERT INTO migrations (migration, batch) VALUES ('2026_09_30_120100_add_handoff_and_assignment_to_support_conversations', 6);

COMMIT;
PRAGMA foreign_keys = ON;
