# Context Pack - Database Schema Documentation

## Overview
This document describes the Supabase PostgreSQL database schema for the Universal Context Pack platform. The schema supports multi-source context pack creation, credit-based payments, user management, and comprehensive audit logging.

## Database: Supabase PostgreSQL

### Schema Organization
- **Authentication**: Managed by Supabase Auth (`auth.users`)
- **Application Tables**: All in `public` schema
- **Security**: Row-Level Security (RLS) enabled on all user-facing tables
- **Storage**: Cloudflare R2 for file storage (paths stored in DB)

---

## Tables

### 1. `user_profiles`
**Purpose**: Extended user information and account settings

**Columns**:

- **id** (uuid, PRIMARY KEY) - Links to `auth.users(id)`
- **email** (text, NOT NULL) - User email address
- **full_name** (text, nullable) - User's display name
- **avatar_url** (text, nullable) - Profile picture URL
- **r2_user_directory** (text, NOT NULL) - User's R2 storage path
- **payment_plan** (text, DEFAULT 'credits') - Plan type: `credits` or `unlimited`
- **chunks_analyzed** (integer, DEFAULT 0) - Total chunks processed lifetime
- **credits_balance** (integer, DEFAULT 10) - Current credit balance
- **subscription_id** (text, nullable) - Stripe subscription ID
- **subscription_status** (text, nullable) - Stripe subscription status
- **plan_start_date** (timestamptz, nullable) - Subscription start date
- **plan_end_date** (timestamptz, nullable) - Subscription end date
- **created_at** (timestamptz, DEFAULT now()) - Account creation timestamp
- **updated_at** (timestamptz, DEFAULT now()) - Last profile update

**Indexes**:
- PRIMARY KEY on `id`
- Foreign key to `auth.users(id)`

**RLS**: Enabled - users can only access their own profile

---

### 2. `packs_v2`
**Purpose**: Context pack metadata and organization

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PRIMARY KEY | Internal pack ID |
| `user_id` | uuid | NOT NULL, FK | Owner of the pack |
| `pack_id` | text | UNIQUE, NOT NULL | Public pack identifier |
| `pack_name` | text | NOT NULL | User-defined pack name |
| `description` | text | nullable | Pack description |
| `total_sources` | integer | DEFAULT 0 | Number of sources in pack |
| `total_tokens` | bigint | DEFAULT 0 | Total tokens across all sources |
| `last_updated` | timestamptz | DEFAULT now() | Last modification time |
| `r2_pack_directory` | text | NOT NULL | R2 storage path for pack files |
| `custom_system_prompt` | text | nullable | Custom analysis prompt |
| `created_at` | timestamptz | DEFAULT now() | Pack creation time |
| `updated_at` | timestamptz | DEFAULT now() | Last update time |

**Indexes**:
- PRIMARY KEY on `id`
- UNIQUE on `pack_id`
- Foreign key to `auth.users(id)` via `user_id`

**RLS**: Enabled - users can only access their own packs

---

### 3. `pack_sources`
**Purpose**: Individual data sources within a pack (files, URLs, text)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PRIMARY KEY | Internal source ID |
| `pack_id` | text | NOT NULL, FK | Parent pack identifier |
| `user_id` | uuid | NOT NULL, FK | Owner of the source |
| `source_id` | text | UNIQUE, NOT NULL | Public source identifier |
| `source_name` | text | NOT NULL | Display name for source |
| `source_type` | text | NOT NULL | Type: `chat_export`, `document`, `url`, `text` |
| `status` | text | DEFAULT 'pending' | Processing status |
| `progress` | integer | DEFAULT 0 | Processing progress (0-100) |
| `error_message` | text | nullable | Error details if failed |
| `file_name` | text | nullable | Original filename |
| `file_size` | bigint | nullable | File size in bytes |
| `mime_type` | text | nullable | MIME type |
| `extracted_count` | integer | DEFAULT 0 | Number of messages extracted |
| `total_chunks` | integer | DEFAULT 0 | Total chunks created |
| `processed_chunks` | integer | DEFAULT 0 | Chunks analyzed |
| `total_input_tokens` | bigint | DEFAULT 0 | Total input tokens used |
| `total_output_tokens` | bigint | DEFAULT 0 | Total output tokens used |
| `total_cost` | numeric | DEFAULT 0.0000 | Total processing cost ($) |
| `r2_raw_path` | text | nullable | R2 path to raw uploaded file |
| `r2_extracted_path` | text | nullable | R2 path to extracted content |
| `r2_chunked_path` | text | nullable | R2 path to chunked data |
| `r2_analyzed_path` | text | nullable | R2 path to analysis results |
| `created_at` | timestamptz | DEFAULT now() | Source creation time |
| `completed_at` | timestamptz | nullable | Processing completion time |
| `updated_at` | timestamptz | DEFAULT now() | Last update time |

**Status Values**:
- `pending`: Awaiting processing
- `processing`: Currently processing
- `ready_for_analysis`: Extracted and chunked, ready for AI analysis
- `analyzing`: AI analysis in progress
- `completed`: Fully processed
- `failed`: Processing failed

**Source Types**:
- `chat_export`: ChatGPT/Claude JSON exports
- `document`: PDF, DOCX, TXT files
- `url`: Shared conversation URLs
- `text`: Direct text paste

**Indexes**:
- PRIMARY KEY on `id`
- UNIQUE on `source_id`
- Foreign key to `packs_v2(pack_id)` via `pack_id`
- Foreign key to `auth.users(id)` via `user_id`

**RLS**: Enabled - users can only access their own sources

---

### 4. `pack_exports`
**Purpose**: Generated export files for packs (different formats)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PRIMARY KEY | Internal export ID |
| `pack_id` | text | NOT NULL, FK | Parent pack identifier |
| `user_id` | uuid | NOT NULL, FK | Owner of the export |
| `export_type` | text | NOT NULL | Export format: `compact`, `standard`, `complete` |
| `export_version` | integer | DEFAULT 1 | Export format version |
| `file_size` | bigint | nullable | Generated file size (bytes) |
| `token_count` | bigint | nullable | Total tokens in export |
| `r2_path` | text | NOT NULL | R2 storage path for export file |
| `status` | text | DEFAULT 'generating' | Generation status |
| `error_message` | text | nullable | Error details if failed |
| `created_at` | timestamptz | DEFAULT now() | Export generation start |
| `updated_at` | timestamptz | DEFAULT now() | Last update time |

**Export Types**:
- `compact`: Minimal format, most concise
- `standard`: Standard format with full context
- `complete`: Full format with all metadata

**Status Values**:
- `generating`: Export being created
- `ready`: Export available for download
- `failed`: Export generation failed

**Indexes**:
- PRIMARY KEY on `id`
- Foreign key to `packs_v2(pack_id)` via `pack_id`
- Foreign key to `auth.users(id)` via `user_id`

**RLS**: Enabled - users can only access their own exports

---

### 5. `credit_transactions`
**Purpose**: Credit purchase, usage, and refund tracking

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PRIMARY KEY | Transaction ID |
| `user_id` | uuid | NOT NULL, FK | User who made transaction |
| `transaction_type` | text | NOT NULL | Transaction type (see below) |
| `credits` | integer | NOT NULL | Credits affected (positive or negative) |
| `amount` | numeric | nullable | Dollar amount (if applicable) |
| `package_id` | text | nullable | Credit package purchased |
| `job_id` | text | nullable | Associated job (for usage) |
| `stripe_payment_id` | text | nullable | Stripe payment intent ID |
| `description` | text | nullable | Transaction description |
| `metadata` | jsonb | nullable | Additional transaction data |
| `created_at` | timestamptz | DEFAULT now() | Transaction timestamp |

**Transaction Types**:
- `purchase`: Credit purchase via Stripe
- `usage`: Credits deducted for processing
- `refund`: Credits refunded
- `bonus`: Free credits awarded
- `unlimited_usage`: Usage tracking for unlimited plan users

**Indexes**:
- PRIMARY KEY on `id`
- Foreign key to `auth.users(id)` via `user_id`
- Index on `user_id` for transaction history queries
- Index on `created_at` for time-based queries

**RLS**: Enabled - users can only see their own transactions

---

### 6. `jobs` (Legacy - V1 System)
**Purpose**: Single-file processing jobs from Pack V1

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PRIMARY KEY | Internal job ID |
| `user_id` | uuid | NOT NULL, FK | Job owner |
| `job_id` | text | UNIQUE, NOT NULL | Public job identifier |
| `status` | text | DEFAULT 'created' | Processing status |
| `file_name` | text | NOT NULL | Original filename |
| `file_size` | bigint | NOT NULL | File size in bytes |
| `r2_path` | text | NOT NULL | R2 storage path |
| `extracted_count` | integer | DEFAULT 0 | Messages extracted |
| `total_chunks` | integer | DEFAULT 0 | Total chunks |
| `processed_chunks` | integer | DEFAULT 0 | Chunks analyzed |
| `failed_chunks` | integer[] | DEFAULT '{}' | Failed chunk indexes |
| `total_input_tokens` | bigint | DEFAULT 0 | Input tokens used |
| `total_output_tokens` | bigint | DEFAULT 0 | Output tokens used |
| `total_cost` | numeric | DEFAULT 0.0000 | Total cost ($) |
| `progress` | integer | DEFAULT 0 | Progress percentage (0-100) |
| `error_message` | text | nullable | Error details |
| `created_at` | timestamptz | DEFAULT now() | Job creation time |
| `completed_at` | timestamptz | nullable | Job completion time |
| `updated_at` | timestamptz | DEFAULT now() | Last update time |

**Note**: This table is maintained for backward compatibility with Pack V1. New packs use `packs_v2` and `pack_sources`.

**Indexes**:
- PRIMARY KEY on `id`
- UNIQUE on `job_id`
- Foreign key to `auth.users(id)` via `user_id`

**RLS**: Enabled - users can only access their own jobs

---

### 7. `packs_legacy` (Legacy - V1 System)
**Purpose**: Pack metadata from V1 system

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PRIMARY KEY | Internal pack ID |
| `user_id` | uuid | NOT NULL, FK | Pack owner |
| `job_id` | text | NOT NULL, FK | Associated job |
| `pack_name` | text | NOT NULL | Pack display name |
| `r2_pack_path` | text | NOT NULL | R2 storage path |
| `extraction_stats` | jsonb | nullable | Extraction statistics |
| `chunk_stats` | jsonb | nullable | Chunking statistics |
| `analysis_stats` | jsonb | nullable | Analysis statistics |
| `file_size` | bigint | nullable | Pack file size |
| `created_at` | timestamptz | DEFAULT now() | Pack creation time |

**Note**: Legacy table for Pack V1. New packs use `packs_v2`.

**Indexes**:
- PRIMARY KEY on `id`
- Foreign key to `auth.users(id)` via `user_id`
- Foreign key to `jobs(job_id)` via `job_id`

**RLS**: Enabled - users can only access their own packs

---

### 8. `webhook_logs`
**Purpose**: Stripe webhook event logging and debugging

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PRIMARY KEY | Log entry ID |
| `webhook_id` | text | NOT NULL | Stripe webhook event ID |
| `event_type` | text | NOT NULL | General event category |
| `stripe_event_type` | text | nullable | Specific Stripe event type |
| `payload_size` | integer | nullable | Webhook payload size (bytes) |
| `signature_present` | boolean | DEFAULT false | Stripe signature validation flag |
| `status` | text | DEFAULT 'processing' | Processing status |
| `error_message` | text | nullable | Error details if failed |
| `processed_data` | jsonb | nullable | Processed webhook data |
| `created_at` | timestamptz | DEFAULT now() | Webhook received time |
| `updated_at` | timestamptz | DEFAULT now() | Last processing update |

**Common Stripe Event Types**:
- `checkout.session.completed`: Payment completed
- `customer.subscription.created`: Subscription started
- `customer.subscription.updated`: Subscription modified
- `customer.subscription.deleted`: Subscription cancelled
- `invoice.payment_succeeded`: Recurring payment succeeded
- `invoice.payment_failed`: Recurring payment failed

**Indexes**:
- PRIMARY KEY on `id`
- Index on `webhook_id` for deduplication
- Index on `created_at` for debugging recent events

**RLS**: Disabled - admin/system table

---

### 9. `payment_attempts`
**Purpose**: Payment attempt logging for fraud detection and debugging

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PRIMARY KEY | Attempt ID |
| `user_id` | uuid | NOT NULL, FK | User making payment |
| `attempt_type` | text | NOT NULL | Payment type attempted |
| `credits_requested` | integer | nullable | Credits requested |
| `amount_requested` | numeric | nullable | Dollar amount requested |
| `ip_address` | inet | nullable | User's IP address |
| `user_agent` | text | nullable | Browser user agent |
| `status` | text | NOT NULL | Attempt outcome |
| `error_message` | text | nullable | Error details if failed |
| `created_at` | timestamptz | DEFAULT now() | Attempt timestamp |

**Status Values**:
- `initiated`: Payment flow started
- `processing`: Payment processing
- `succeeded`: Payment completed successfully
- `failed`: Payment failed
- `cancelled`: User cancelled payment

**Indexes**:
- PRIMARY KEY on `id`
- Foreign key to `auth.users(id)` via `user_id`
- Index on `ip_address` for fraud detection
- Index on `created_at` for recent attempts

**RLS**: Enabled - users can only see their own attempts

---

### 10. `admin_actions`
**Purpose**: Audit log for admin actions on user accounts

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PRIMARY KEY | Action ID |
| `admin_user_id` | uuid | nullable | Admin who performed action |
| `action_type` | text | NOT NULL | Type of admin action |
| `target_user_id` | uuid | NOT NULL, FK | User affected by action |
| `credits_affected` | integer | nullable | Credits added/removed |
| `amount_affected` | numeric | nullable | Dollar amount affected |
| `reason` | text | NOT NULL | Reason for action |
| `details` | jsonb | nullable | Additional action details |
| `created_at` | timestamptz | DEFAULT now() | Action timestamp |

**Common Action Types**:
- `credit_adjustment`: Manual credit balance change
- `refund_issued`: Refund processed
- `account_suspended`: Account suspended
- `account_unsuspended`: Account restored
- `plan_override`: Subscription manually changed
- `support_credit`: Bonus credits for support issues

**Indexes**:
- PRIMARY KEY on `id`
- Foreign key to `auth.users(id)` via `target_user_id`
- Index on `admin_user_id` for admin activity tracking
- Index on `target_user_id` for user audit history

**RLS**: Disabled - admin-only table

---

## Relationships

### User-Centric Relationships
```
auth.users
  ├── user_profiles (1:1)
  ├── packs_v2 (1:many)
  ├── pack_sources (1:many)
  ├── pack_exports (1:many)
  ├── credit_transactions (1:many)
  ├── payment_attempts (1:many)
  ├── jobs (1:many) [legacy]
  ├── packs_legacy (1:many) [legacy]
  └── admin_actions (1:many as target)
```

### Pack Hierarchy
```
packs_v2
  ├── pack_sources (1:many)
  └── pack_exports (1:many)

pack_sources
  └── No children (leaf node)
```

### Legacy System
```
jobs
  └── packs_legacy (1:1)
```

---

## Security (Row-Level Security)

### Enabled Tables
All user-facing tables have RLS enabled with policies:

**User Tables**:
- `user_profiles`: Users can SELECT/UPDATE their own profile
- `packs_v2`: Users can SELECT/INSERT/UPDATE/DELETE their own packs
- `pack_sources`: Users can SELECT/INSERT/UPDATE/DELETE their own sources
- `pack_exports`: Users can SELECT/INSERT their own exports
- `credit_transactions`: Users can SELECT their own transactions
- `payment_attempts`: Users can SELECT their own attempts
- `jobs`: Users can SELECT/UPDATE their own jobs
- `packs_legacy`: Users can SELECT their own legacy packs

### Admin-Only Tables
- `webhook_logs`: No RLS (system/admin access only)
- `admin_actions`: No RLS (admin access only)

### Policy Examples
```sql
-- Users can only see their own packs
CREATE POLICY "Users can view own packs" ON packs_v2
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create packs
CREATE POLICY "Users can create packs" ON packs_v2
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own packs
CREATE POLICY "Users can update own packs" ON packs_v2
  FOR UPDATE USING (auth.uid() = user_id);
```

---

## Indexes & Performance

### Critical Indexes
- **user_id indexes**: On all user-owned tables for filtering
- **status indexes**: On `pack_sources`, `jobs` for status queries
- **timestamp indexes**: On `created_at`, `updated_at` for sorting
- **unique constraints**: On `pack_id`, `source_id`, `job_id` for lookups

### Common Query Patterns
```sql
-- Get user's packs with source counts
SELECT p.*, COUNT(s.id) as source_count
FROM packs_v2 p
LEFT JOIN pack_sources s ON p.pack_id = s.pack_id
WHERE p.user_id = $1
GROUP BY p.id
ORDER BY p.updated_at DESC;

-- Get pack processing status
SELECT 
  pack_id,
  COUNT(*) as total_sources,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_sources,
  SUM(total_tokens) as total_tokens
FROM pack_sources
WHERE user_id = $1 AND pack_id = $2
GROUP BY pack_id;

-- Get user credit balance and transactions
SELECT 
  up.credits_balance,
  ct.transaction_type,
  ct.credits,
  ct.created_at
FROM user_profiles up
LEFT JOIN credit_transactions ct ON up.id = ct.user_id
WHERE up.id = $1
ORDER BY ct.created_at DESC
LIMIT 10;
```

---

## Migration Notes

### V1 to V2 Migration
- **Legacy tables maintained**: `jobs` and `packs_legacy` remain for backward compatibility
- **New system**: `packs_v2` + `pack_sources` support multi-source packs
- **No automatic migration**: Users keep V1 packs, create new V2 packs separately
- **API compatibility**: Backend supports both V1 and V2 endpoints

### Future Considerations
- Archive old webhook logs (retention policy)
- Partition large tables by user_id if scaling issues arise
- Consider materialized views for analytics dashboards
- Add indexes on `pack_sources.status` for filtering

---

## Data Types & Sizes

### Storage Estimates
- **user_profiles**: ~1KB per user
- **packs_v2**: ~500 bytes per pack
- **pack_sources**: ~2KB per source (excluding R2 files)
- **credit_transactions**: ~300 bytes per transaction
- **webhook_logs**: ~1KB per webhook (with JSON payload)

### Expected Growth
- Users: 10K-100K
- Packs: 50K-500K
- Pack sources: 200K-2M
- Transactions: 500K-5M
- Webhook logs: 1M+ (with cleanup)

---

## Backup & Recovery

### Supabase Built-in
- **Point-in-time recovery**: Available for paid plans
- **Daily backups**: Automatic
- **Retention**: 7-30 days depending on plan

### Recommended Additional Backups
- **Weekly R2 snapshots**: Backup file storage separately
- **Monthly archive**: Export credit_transactions and admin_actions
- **Webhook log cleanup**: Archive logs older than 90 days

---

**Last Updated**: December 7, 2025
**Schema Version**: 2.0
**Maintainer**: Context Pack Team
