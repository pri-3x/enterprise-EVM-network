CREATE TABLE "accounts" (
	"address" text PRIMARY KEY NOT NULL,
	"is_contract" boolean DEFAULT false NOT NULL,
	"first_seen_block" bigint NOT NULL,
	"last_seen_block" bigint NOT NULL,
	"transaction_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"asset_id" bigint NOT NULL,
	"event_type" text NOT NULL,
	"tx_hash" text NOT NULL,
	"log_index" integer NOT NULL,
	"block_number" bigint NOT NULL,
	"from_address" text,
	"to_address" text,
	"actor" text,
	"data" jsonb NOT NULL,
	"timestamp" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" bigint PRIMARY KEY NOT NULL,
	"registry_address" text NOT NULL,
	"name" text NOT NULL,
	"asset_type" text NOT NULL,
	"value" numeric(78, 0) NOT NULL,
	"owner" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"registered_block" bigint NOT NULL,
	"registered_tx_hash" text NOT NULL,
	"updated_block" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blocks" (
	"number" bigint PRIMARY KEY NOT NULL,
	"hash" text NOT NULL,
	"parent_hash" text NOT NULL,
	"timestamp" bigint NOT NULL,
	"miner" text NOT NULL,
	"gas_used" bigint NOT NULL,
	"gas_limit" bigint NOT NULL,
	"base_fee_per_gas" numeric(78, 0),
	"transaction_count" integer NOT NULL,
	"size" integer,
	"extra_data" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "indexer_checkpoints" (
	"id" text PRIMARY KEY NOT NULL,
	"last_indexed_block" bigint NOT NULL,
	"last_indexed_hash" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "network_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"contract_address" text NOT NULL,
	"contract_name" text NOT NULL,
	"tx_hash" text NOT NULL,
	"log_index" integer NOT NULL,
	"block_number" bigint NOT NULL,
	"data" jsonb NOT NULL,
	"timestamp" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submitted_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"idempotency_key" text,
	"operation" text NOT NULL,
	"payload" jsonb NOT NULL,
	"tx_hash" text,
	"status" text NOT NULL,
	"block_number" bigint,
	"gas_used" bigint,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "token_balances" (
	"token_address" text NOT NULL,
	"address" text NOT NULL,
	"balance" numeric(78, 0) NOT NULL,
	"updated_block" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "token_balances_token_address_address_pk" PRIMARY KEY("token_address","address")
);
--> statement-breakpoint
CREATE TABLE "token_transfers" (
	"id" serial PRIMARY KEY NOT NULL,
	"tx_hash" text NOT NULL,
	"log_index" integer NOT NULL,
	"block_number" bigint NOT NULL,
	"token_address" text NOT NULL,
	"from_address" text NOT NULL,
	"to_address" text NOT NULL,
	"value" numeric(78, 0) NOT NULL,
	"timestamp" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaction_receipts" (
	"tx_hash" text PRIMARY KEY NOT NULL,
	"status" integer NOT NULL,
	"gas_used" bigint NOT NULL,
	"cumulative_gas_used" bigint NOT NULL,
	"effective_gas_price" numeric(78, 0),
	"contract_address" text,
	"logs_count" integer NOT NULL,
	"revert_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"hash" text PRIMARY KEY NOT NULL,
	"block_number" bigint NOT NULL,
	"block_hash" text NOT NULL,
	"transaction_index" integer NOT NULL,
	"from_address" text NOT NULL,
	"to_address" text,
	"value" numeric(78, 0) NOT NULL,
	"gas_limit" bigint NOT NULL,
	"gas_price" numeric(78, 0),
	"nonce" bigint NOT NULL,
	"input" text NOT NULL,
	"method_selector" text,
	"method_name" text,
	"timestamp" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "asset_events" ADD CONSTRAINT "asset_events_tx_hash_transactions_hash_fk" FOREIGN KEY ("tx_hash") REFERENCES "public"."transactions"("hash") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "network_events" ADD CONSTRAINT "network_events_tx_hash_transactions_hash_fk" FOREIGN KEY ("tx_hash") REFERENCES "public"."transactions"("hash") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_transfers" ADD CONSTRAINT "token_transfers_tx_hash_transactions_hash_fk" FOREIGN KEY ("tx_hash") REFERENCES "public"."transactions"("hash") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_receipts" ADD CONSTRAINT "transaction_receipts_tx_hash_transactions_hash_fk" FOREIGN KEY ("tx_hash") REFERENCES "public"."transactions"("hash") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_block_number_blocks_number_fk" FOREIGN KEY ("block_number") REFERENCES "public"."blocks"("number") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_tx_count_idx" ON "accounts" USING btree ("transaction_count");--> statement-breakpoint
CREATE UNIQUE INDEX "asset_events_tx_log_idx" ON "asset_events" USING btree ("tx_hash","log_index");--> statement-breakpoint
CREATE INDEX "asset_events_asset_idx" ON "asset_events" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "asset_events_block_idx" ON "asset_events" USING btree ("block_number");--> statement-breakpoint
CREATE INDEX "assets_owner_idx" ON "assets" USING btree ("owner");--> statement-breakpoint
CREATE INDEX "assets_type_idx" ON "assets" USING btree ("asset_type");--> statement-breakpoint
CREATE UNIQUE INDEX "blocks_hash_idx" ON "blocks" USING btree ("hash");--> statement-breakpoint
CREATE INDEX "blocks_timestamp_idx" ON "blocks" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "blocks_miner_idx" ON "blocks" USING btree ("miner");--> statement-breakpoint
CREATE UNIQUE INDEX "network_events_tx_log_idx" ON "network_events" USING btree ("tx_hash","log_index");--> statement-breakpoint
CREATE INDEX "network_events_type_idx" ON "network_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "network_events_block_idx" ON "network_events" USING btree ("block_number");--> statement-breakpoint
CREATE UNIQUE INDEX "submitted_tx_idempotency_idx" ON "submitted_transactions" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "submitted_tx_hash_idx" ON "submitted_transactions" USING btree ("tx_hash");--> statement-breakpoint
CREATE INDEX "submitted_tx_status_idx" ON "submitted_transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "token_balances_balance_idx" ON "token_balances" USING btree ("balance");--> statement-breakpoint
CREATE UNIQUE INDEX "token_transfers_tx_log_idx" ON "token_transfers" USING btree ("tx_hash","log_index");--> statement-breakpoint
CREATE INDEX "token_transfers_from_idx" ON "token_transfers" USING btree ("from_address");--> statement-breakpoint
CREATE INDEX "token_transfers_to_idx" ON "token_transfers" USING btree ("to_address");--> statement-breakpoint
CREATE INDEX "token_transfers_block_idx" ON "token_transfers" USING btree ("block_number");--> statement-breakpoint
CREATE INDEX "transactions_block_idx" ON "transactions" USING btree ("block_number","transaction_index");--> statement-breakpoint
CREATE INDEX "transactions_from_idx" ON "transactions" USING btree ("from_address");--> statement-breakpoint
CREATE INDEX "transactions_to_idx" ON "transactions" USING btree ("to_address");--> statement-breakpoint
CREATE INDEX "transactions_timestamp_idx" ON "transactions" USING btree ("timestamp");