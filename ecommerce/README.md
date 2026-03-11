# E-Commerce Storefront

Customer-facing storefront module for the accounting-ecommerce platform. Shares the same PostgreSQL database (`erp_system`) with the accounting backend and leverages the existing IntegrationService for order-to-journal sync.

## Architecture

```
ecommerce/
├── backend/          # Go Fiber API (port 8090)
│   ├── cmd/server/   # Entry point
│   └── internal/
│       ├── auth/         # JWT auth, register, login, password
│       ├── cart/         # Shopping cart CRUD
│       ├── checkout/     # Order placement, stock decrement
│       ├── config/       # Env config loader
│       ├── customer/     # Profile, addresses, wishlist
│       ├── database/     # GORM connection + migrations
│       ├── middleware/    # CORS, secure headers, rate limiting, JWT guard
│       ├── models/       # store_* GORM models
│       ├── orders/       # Order history (read-only)
│       ├── storefront/   # Public products, categories, search
│       └── utils/        # Response helpers, pagination
└── frontend/         # React + Vite + Tailwind (port 5174)
    └── src/
        ├── api/          # Axios client with JWT interceptor
        ├── components/   # Header, Footer
        ├── lib/          # cn(), formatCurrency, formatDate
        ├── pages/        # Home, Products, Detail, Cart, Login, Register, Account
        ├── store/        # Zustand (auth, cart)
        └── types/        # TypeScript interfaces
```

## Getting Started

### Prerequisites
- Go 1.21+
- Node.js 18+
- PostgreSQL with `erp_system` database (shared with accounting app)

### Backend

```bash
cd ecommerce/backend

# Copy and configure environment
cp .env.example .env
# Edit .env with your DB credentials and JWT secret

# Install dependencies & build
go mod tidy
go build ./cmd/server

# Run
go run ./cmd/server/main.go
```

The API starts on `http://localhost:8090`.

### Frontend

```bash
cd ecommerce/frontend
npm install
npm run dev
```

The dev server starts on `http://localhost:5174` with API proxy to `:8090`.

## API Endpoints

### Public (no auth)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/store/products` | List products (paginated, filterable) |
| GET | `/api/store/products/:slug` | Product detail + review summary |
| GET | `/api/store/categories` | Category tree |
| GET | `/api/store/search?q=` | Full-text product search |
| GET | `/api/store/featured` | Featured products |
| GET | `/api/store/new-arrivals` | Newest products |
| GET | `/api/health` | Health check |

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/store/auth/register` | Create account |
| POST | `/api/store/auth/login` | Sign in |
| POST | `/api/store/auth/refresh` | Refresh JWT |
| POST | `/api/store/auth/forgot-password` | Request reset token |
| POST | `/api/store/auth/reset-password` | Reset password |

### Protected (Bearer token)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/store/profile` | Get customer profile |
| PUT | `/api/store/profile` | Update profile |
| GET/POST | `/api/store/addresses` | List / create address |
| PUT/DELETE | `/api/store/addresses/:id` | Update / delete address |
| GET | `/api/store/cart` | Get cart with enriched items |
| POST | `/api/store/cart/items` | Add item to cart |
| PUT | `/api/store/cart/items/:id` | Update item quantity |
| DELETE | `/api/store/cart/items/:id` | Remove item |
| DELETE | `/api/store/cart` | Clear cart |
| POST | `/api/store/checkout` | Place order |
| GET | `/api/store/orders` | Order history (paginated) |
| GET | `/api/store/orders/:id` | Order detail |
| GET/POST/DELETE | `/api/store/wishlist` | Wishlist CRUD |

## Database

New storefront-specific tables (auto-migrated):
- `store_customers` — customer accounts
- `store_addresses` — shipping/billing addresses
- `store_carts` / `store_cart_items` — persistent carts
- `store_wishlists` — saved products
- `store_reviews` — product reviews

Reads from existing shared tables: `products`, `product_variants`, `categories`, `orders`, `order_items`, `companies`.

## Security
- JWT access + refresh tokens with configurable expiry
- bcrypt password hashing (cost 12)
- Rate limiting on auth endpoints (10 req/min)
- Secure headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection)
- CORS restricted to storefront URL
- Token refresh with automatic retry via Axios interceptor
