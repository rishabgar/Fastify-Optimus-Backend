# AGENTS.md

## Project and non-negotiables

This is the Fastify backend for the Optimuskart e-commerce platform.

- Use plain JavaScript and existing module conventions. Never add TypeScript, `.ts` files, interfaces, types, generics, or enums.
- Every API must be production-ready.
- Before changing an API, inspect its implementation, models and relationships, routes, controllers, services, repositories, schemas, and utilities.
- Use actual model fields and existing patterns; never invent fields, relationships, indexes, states, or abstractions.
- Preserve public behavior unless explicitly asked to change it. Make the smallest complete change and touch no unrelated code.
- Reuse `schemaFactory` for database models where applicable.
- Completely omit absent optional fields instead of storing or returning `null`.

## Architecture and ownership

Use feature-first modules under `src/modules/<feature>/`; keep only genuinely reusable global code under `src/shared/`. A feature owns its routes, controllers, services, repositories, schemas, validators, and helpers. Prefer service interfaces over reaching into another module's internals, and avoid circular dependencies.

Start a feature simply:

```text
src/modules/<feature>/
  index.js
  <feature>.routes.js
  <feature>.controller.js
  <feature>.service.js
  <feature>.repository.js
  <feature>.schema.js
```

Create folders only when the capability exists or growth justifies them. Review files around 150-250 lines for mixed responsibilities; strongly consider splitting above 250, and expect multiple responsibilities above 400. These are guidelines, not hard limits. Split by use case or responsibility (for example create/update/get services, read/write repositories, or focused schemas), never merely by line count.

Layer responsibilities:

- Routes define endpoints, schemas, and hooks, then map to controllers; no business logic.
- Controllers read request data, call services, and respond with `success()`; no database access, complex logic, or duplicated error handling.
- Services own business rules, workflows, transactions, coordination, and meaningful errors; they must not depend on Fastify `reply`.
- Repositories own database access and hide ORM/query details; no HTTP logic.
- Schemas own request/response validation and should remain feature-specific and navigable.

`app.js` is the composition root and registers global handlers once. `server.js` only starts/listens to the server.

## Fastify, responses, and errors

Use Fastify patterns, never Express-style `asyncHandler`. Let async errors propagate. Use centralized `setErrorHandler()` and `setNotFoundHandler()`, `request.log` for request logging, existing custom errors, and appropriate status codes.

Every success must use `success()`:

```json
{ "status": "success", "message": "Request successful", "data": {} }
```

Every validation, authentication, business, not-found, and unexpected error must use `fail()`:

```json
{ "status": "fail", "message": "Safe client-facing message", "data": null }
```

Error responses contain only `status`, `message`, and `data`. Never expose `error`, `details`, field metadata, stack traces, database errors, or internal 5xx messages. Safe validation information may appear only in `message`. Log unexpected 5xx errors; unknown routes use the standard envelope with HTTP 404. Prefer throwing errors over controller `try/catch`.

Return only client-required fields. Mongoose `createdAt` and `updatedAt` must not appear in any API response unless the API contract explicitly requests them.

## Authentication and public reads

Catalog/discovery GET APIs are public unless authentication is explicitly necessary: product/category/shop discovery, product detail, and shop types normally require no JWT. User-specific reads such as favourites, wishlist, cart, orders, addresses, wallet, assigned coupons, and account data require authentication.

## Data integrity and transactions

Treat every mutation as one atomic business operation.

- Prefer single-document atomic writes and operators such as `$set`, `$inc`, `$push`, `$pull`, and `$addToSet`; embedded updates in one document are atomic and normally need no transaction.
- Put race-sensitive conditions in atomic update filters. Avoid read-then-write when one conditional operation can enforce the rule.
- Use a MongoDB/Mongoose session and transaction only when multiple dependent documents or collections must all succeed or fail together.
- Keep transaction boundaries in services; repositories accept/pass sessions. Perform race-sensitive validation inside the transaction, commit only after all writes succeed, and abort on failure.
- Use database constraints/indexes as well as application checks. Prevent partial writes, especially for inventory, checkout, orders, payments, refunds, coupons, rewards, and reservations.
- Test rollback and consistency for critical multi-write workflows.

## Queries and code quality

- Avoid N+1 queries and large in-memory filtering/deduplication; use database filtering, grouping, aggregation, population, batching, and projections appropriately.
- Add indexes for actual query patterns, not speculation. Paginate lists that can grow large.
- Keep public catalog projections minimal.
- Prefer small focused functions, cohesive modules, clear domain names, and existing utilities.
- Avoid duplicated logic, premature abstraction, unnecessary dependencies, unused imports, and dead code.
- Production code and tests must run without avoidable deprecation warnings. Use APIs supported by the installed dependency versions; with current Mongoose, use `returnDocument: "after"` instead of deprecated `new: true` for `findOneAndUpdate()`, `findByIdAndUpdate()`, and `findOneAndReplace()`.
- When behavior changes, update affected imports/usages and tests; run relevant tests and lint when available.

## Domain rules

Keep major business domains independent.

### Auth

- `POST /auth/customer/signup`: phone is required, email optional, backend sets `user_type = customer`, and clients cannot set system-controlled fields.
- `POST /auth/seller/signup`: create the seller and first shop in one transaction; backend sets `user_type = seller`, and the new seller supplies `shop.seller_id`.
- Never reference `is_logged_in`; it does not exist.

### Products

There are two product concepts:

- Master `product`: admin-managed canonical catalog identity/metadata (name, brand, description, category, images, variants, quantity/unit and normalized quantity/unit metadata). Sellers cannot create it, and it must contain no seller price or inventory.
- `seller_product`: the sellable entity queried by customer-facing APIs.
  - `common` references a master product and stores supported overrides plus seller price, MRP, SKU, stock, discount, and availability.
  - `individual` is seller-created, stores full identity directly, and creates no master product.

For common products, resolve every supported field as seller override first, master fallback second; for images, use a non-empty override before master images. Never expose `*_override` keys—return resolved normal names. Variant identity comes from the referenced master variant; seller price/inventory comes from `seller_product`.

In customer responses, `product_id` means `seller_product._id` unless an explicit contract says otherwise. Do not expose master product IDs or internal inventory bookkeeping such as reserved quantities unless required. Common and individual products should share one customer-facing shape where possible.

### Inventory

Inventory may live in `seller_product` variants (`product_quantity`, `available_quantity`, `reserved_quantity`), but mutation rules belong to the inventory/service layer, not product CRUD. Use atomic updates where possible; prevent negative stock, inconsistent reservations, and overselling. Use transactions only for operations spanning dependent documents. Cart changes must not permanently reserve stock.

### Product categories

`product_category` is admin-managed master data. Only admins create, update, activate, deactivate, or delete categories; sellers only select existing categories. Public reads require no JWT unless explicitly needed, return only active/non-deleted categories, and belong in the category/product-category module. Current public lookups:

```text
GET /categories/shop_id/:shop_id
GET /categories/shop_type_id/:shop_type_id
```

### Shops and shop types

Shop ownership is `shop.seller_id`; seller mutations must verify the authenticated seller owns the shop. Shops own identity, type, address/location, operating hours, and temporary open/closed state:

- `is_closed`: temporarily closed/open.
- `is_active`: platform/business enabled.
- `is_deleted`: soft deleted.

GeoJSON Point coordinates are always `[longitude, latitude]`. Do not expose standalone test/development seller shop-creation routes in production when seller signup already creates the first shop.

`shop_type` is admin-managed master data referenced by `shop_type_id`. Sellers select existing active types and never create them through seller APIs.

### Shop favourites

`shop_favourite` means a user favourited a shop. Enforce unique `{ user_id, shop_id }`, derive `user_id` from authentication, and allow physical removal unless analytics requires history.

### Cart and checkout

Cart owns items, quantities, pricing snapshots, and state. Reference the sellable seller product where supported and never trust client prices.

Checkout coordinates validation, authoritative current pricing, stock checks, coupon validation, delivery/shipping preparation, and payment preparation. Re-fetch product/pricing data from the database; simple cart operations must not permanently reserve stock.

### Orders

Orders own creation, state, cancellation, and fulfilment rules. Preserve historical product, shop, variant, and pricing snapshots. Multi-shop orders may have independent shop-level fulfilment states.

### Payments and shipping

Payments own provider integration, status, refunds, and webhooks. Keep provider-specific code out of order controllers and never trust client-reported payment success or amount. Shipping owns methods, rates, tracking, and shipment logic.

### Coupons

`coupon` defines campaign configuration; `user_coupon` is the per-user assignment/usage source of truth. Lifecycle:

```text
assigned -> reserved -> used
assigned/reserved -> expired
```

- Never mark a coupon used during validation or checkout preview.
- `coupon.assigned_count` is only a campaign counter.
- Assignment/reservation must be concurrency-safe. Transactionally increment campaign assignment and create `user_coupon`; use atomic conditional transitions for `assigned -> reserved` and `reserved -> used`.
- First-order coupons must check both `user_coupon` state and qualifying order history.
- Keep pricing/discount logic reusable and centralized where appropriate.

### Rewards

Rewards are user-level tokens earned after eligible successful orders. Maintain an auditable transaction ledger (`earned`, `redeemed`, `refunded`) rather than only a user balance. Never award an order twice. Balance-plus-ledger mutations must be transactional; redemption/refund must be idempotent.

### Reviews

Tie reviews to authenticated users and eligible purchased products/orders under existing model rules. Use existing database constraints to prevent duplicates.

### Webhooks

Webhook handling must verify provider signatures where applicable, persist provider event IDs, ignore already processed events, remain idempotent, hide internals from clients, and keep provider-specific logic out of unrelated modules.

## New features and completion

Create or extend the correct feature module. Start simple and introduce `controllers/`, `services/`, `repositories/`, or `schemas/` directories only when growth warrants them. Before completion, confirm the smallest necessary files changed, optional fields are omitted rather than null, public behavior is preserved unless requested, and relevant tests/lint pass.
