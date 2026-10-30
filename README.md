# Modular Fastify API

The application uses a feature-first structure. Each feature lives in its own
folder under `src/modules` and owns its routes, controller, service, and schemas.

```text
.
|-- app.js                         # Composes the application modules
|-- server.js                      # Starts the HTTP server
|-- app.test.js                    # Application integration tests
`-- src/
    `-- modules/
        |-- health/
            |-- index.js           # Module entry point
            |-- health.routes.js
            |-- health.controller.js
            |-- health.service.js
            `-- health.schema.js
        `-- user/
            |-- index.js           # Module entry point
            `-- user.model.js      # Mongoose model and indexes
```

To add functionality, create another folder in `src/modules` and register its
entry point in `app.js`. Keep feature-specific logic inside that module.

Use `success()` and `fail()` from `src/shared/http/response.js` in controllers
so every endpoint returns the same `status`, `message`, and `data` or `error`
response fields.

Global error and not-found handlers are registered once in `app.js`. Let errors
propagate to them instead of adding controller-level `try/catch` blocks unless a
controller can meaningfully recover from an error.

## Commands

- `npm start` starts the server on port `3000` (or `PORT`).
- `npm test` runs the tests.

Set `MONGODB_URI` before starting the server. The application opens the Mongoose
connection during startup and closes it during Fastify shutdown.
Set `JWT_SECRET` to a long random value used to sign authentication tokens.

## Authentication

`POST /auth/admin/signup` registers an administrator with an email and password.
Passwords are hashed before they are stored and are never included in responses.

`POST /auth/admin/login` accepts `email` and `password` and returns a JWT containing
the administrator's `user_id` and `role` claims.

`POST /auth/delivery-partner/verify-phone` verifies a Firebase phone-auth ID token
and returns its normalized phone number. `POST /auth/delivery-partner/signup`
re-verifies the token and creates a delivery-partner account using that phone.
Configure `FIREBASE_PROJECT_ID`; the backend never generates or sends an OTP.

<!-- -------------------------------------------------------- -->

The prompt instructs you to build a complete, production-grade multi-shop order and fulfilment system on top of this backend, without redesigning existing architecture or breaking current APIs.

In practical terms, it asks for:

- New order-domain records and modules: parent Order, per-shop ShopOrder, shipment, payment, inventory reservations, coupon redemption, cash collection, seller income, audit events, and outbox events.
- A transactional, idempotent POST /orders flow that:
  - loads and validates the customer cart/address;
  - re-checks authoritative product availability and prices;
  - atomically reserves stock;
  - reserves coupons;
  - creates one parent order plus one shop order per shop;
  - creates payment and outbox records;
  - clears the cart only if all writes succeed.
- Strict state machines for order, shop-order, payment, shipment, and seller-income lifecycle.
- Seller actions to accept, prepare, pack, reject, and expire shop orders, with ownership checks, atomic transitions, stock release exactly once, and parent-order reconciliation.
- One authoritative reconcileOrder(orderId) function to determine whether the combined order is cancelled or ready for pickup after shops resolve.
- Two-stage pricing:
  - quoted_pricing on creation;
  - final_pricing after all shop decisions, based only on packed shops.
- Integer-paise pricing and coupon revalidation after shop resolution.
- A crucial accounting rule: platform/order coupons reduce the customer’s payable total, but must not reduce a seller’s income unless a promotion is explicitly seller-funded.
- Shipment assignment, per-shop pickup OTPs, delivery OTPs, and delivery-partner authorization.
- Online payment session creation via workers/outbox, Cashfree webhook verification, server-side payment verification, and strict idempotency.
- Cash-payment locking and confirmation by the assigned delivery partner.
- Safe handling of online-versus-cash payment races, including refund handling for a late duplicate online charge.
- Final delivery logic that consumes OTPs, commits inventory reservations, redeems coupons, creates seller-income entries, and emits audit/outbox events in one transaction.
- Return-to-origin and cancellation logic that releases inventory only when stock physically returns to the shop.
- Durable, retry-safe workers for expiry, payments, refunds, inventory reconciliation, notifications, income availability, and monitoring.
- Comprehensive authorization: customer owns order, seller owns shop order, rider is assigned to shipment.
- A large integration and concurrency test suite, especially for last-item overselling, transaction rollback, duplicate requests/actions/webhooks, payment races, OTP security, and seller-income correctness.
  It also imposes implementation constraints:
- Reuse the existing Fastify controller → service → repository architecture and current shared utilities.
- Use conditional atomic Mongo updates for race-sensitive state/stock changes.
- Use transactions only for multi-document operations that must succeed or fail together.
- Never call payment gateways or notification providers inside a Mongo transaction; use outbox events and workers.
- Treat database values—not client values—as authoritative for stock, pricing, discounts, payable amount, payment state, and seller earnings.
- Production deployment must use a MongoDB replica set because transactions are required.
  In short: it is not asking for a single endpoint. It is asking for an end-to-end order, fulfilment, payment, inventory, returns, accounting, background-worker, auditing, and test system for a multi-shop marketplace.
