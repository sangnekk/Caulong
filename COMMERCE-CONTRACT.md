# Commerce implementation contract

Laravel 13 / Inertia React 3; use existing dependencies, integer VND. UI Vietnamese, plain wording. No fabricated inventory/prices for real brands. Seed demo products explicitly is_demo=true (fictional names, existing generic poster) and label demo orders. Public / remains landing; /products is store. No payments/AI claimed live without configured provider.

## Ownership

Catalog worker: migrations 2026_09_25_100000_create_catalog_tables.php; models Brand, Category, Product, ProductVariant; CatalogController; routes/catalog.php; DemoCatalogSeeder; catalog tests.
Admin worker: migration 2026_09_25_100100_add_is_admin_to_users.php, User.php, EnsureAdmin middleware (class referenced directly in routes), app/Http/Controllers/Admin/_, routes/admin.php, resources/js/pages/admin/_, resources/js/layouts/admin-layout.tsx, resources/css/admin.css, app/Console/Commands/MakeAdmin.php, admin tests. NO other shared files.
Checkout worker: migration 2026_09_25_100200_create_order_tables.php; Order/OrderItem; CartController, CheckoutController; app/Services/CartService.php + OrderService.php; routes/checkout.php; config/shop.php; checkout tests. No frontend.
Storefront worker: resources/js/pages/shop/* EXCEPT advisor.tsx, resources/js/layouts/shop-layout.tsx; resources/css/shop.css; resources/js/types/commerce.ts. No PHP or app.tsx. Own public product/cart/checkout/order UI, use plain paths from below.
Parent: require routes in web.php, app.tsx layout mapping, shared props, landing links, advisor backend/UI and integration tests/docs.

## Catalog schema

brands/categories: id, name(120), slug unique(160), timestamps.
products: id, brand_id nullable FK nullOnDelete, category_id nullable FK nullOnDelete, name(160), slug unique(180), description text, image_path nullable string (relative public disk path or /models/hyper-core-poster.png), specs JSON nullable, play_style(attack|speed|balanced), skill_level(beginner|intermediate|advanced|all), is_active boolean default false, is_featured boolean false, is_demo boolean false, timestamps.
product_variants: id, product_id FK restrictOnDelete, sku unique(80), name(120), price unsignedBigInteger VND, stock unsignedInteger, is_active boolean true, timestamps.
Product relations brand/category/variants. Price/stock stored ONLY variants. Product image_url accessor: safe local Storage public URL, static poster fallback. Specs fields weight, balance, stiffness, material, max_tension strings (not unverified medical claims). Product catalog scopes active and variants active. Order item restrict deletion purchased variant; deactivate instead.

## Public HTTP / props

GET /products named products.index -> shop/products {products: Laravel pagination 12 incl data/links, filters:{q,category,brand,style,sort}, categories:[{id,name,slug}], brands:[...]}.
GET /products/{product:slug} products.show -> shop/product {product} active or 404.
Product serialized {id,name,slug,description,image_url,play_style,skill_level,specs,is_demo,is_featured,brand:{id,name,slug}|null,category:...|null,variants:[{id,sku,name,price,stock,is_active}]} (public only active variants).
Filters q<=100, slug category/brand <=160, style enum, sort featured|price_asc|price_desc|newest. GET unknown validation errors handled normal Laravel.

Cart session key shopping_cart = {variantId:quantity}. CartService exposes summary(Request):array and count(Request):int. summary = {items:[{variant_id,product_id,slug,name,variant_name,sku,image_url,price,quantity,stock,line_total,is_demo}],subtotal,shipping_fee,total,count}. Resolve live product/variant activity and stock, never trust client money. Do not silently fulfill removed/unavailable items.
GET /cart cart.index -> shop/cart {cart}.
POST /cart/items cart.store {variant_id,quantity integer1..20}; PATCH /cart/items/{variant} cart.update {quantity1..20}; DELETE /cart/items/{variant} cart.destroy. Redirect back with flash.success or field errors. Recheck stock. Users may buy as guest.
GET /checkout checkout.index -> shop/checkout {cart,checkoutToken UUID (session persisted),paymentMethods:[{id:'cod',label:'Thanh toán khi nhận hàng'}]}.
POST /checkout checkout.store fields checkout_token,name<=120,phone Vietnamese format,address<=500,email nullable email<=190,notes<=1000,payment_method='cod',accept_terms accepted. Fresh empty cart fails; duplicate same token for same session reuses order even after cart cleared. Invalid token fails. total computed server. lock sorted variants + transaction, conditional stock decrement >=requested to prevent oversell, not negative. Store immutable item snapshots. Price changed since GET checkout: reject and ask review instead of surprise charge. config/shop.php flat shipping_fee=30000, free_shipping_threshold=1000000; public notices read actual calculated fee.
GET /orders/{order:public_id} orders.show -> shop/order {order,trackingUrl}; only same session order allowlist OR owning authenticated user, 404 otherwise. Public id UUID not sequential. order serialized id EXCLUDED, public_id,name,phone,address,email,notes,status,payment_status,payment_method,subtotal,shipping_fee,total,is_demo,created_at,items[{product_name,variant_name,sku,unit_price,quantity,line_total}]. trackingUrl same path. Do not expose customer info outside own order page.

## Orders schema

orders: id, public_id unique UUID, checkout_token unique UUID, user_id nullable FK nullOnDelete, name,phone,address,email nullable,notes nullable,status string default pending,payment_method string cod,payment_status string unpaid,subtotal/shipping_fee/total unsignedBigInteger,is_demo boolean false, timestamps.
order_items: id,order_id cascade,variant_id nullable FK restrictOnDelete,product_name,variant_name,sku,unit_price unsignedBigInteger,quantity unsignedInteger,line_total unsignedBigInteger,timestamps.
Order relationships items,user. No payment provider secrets or fake callback. COD marked paid only via explicit admin confirmation money collected, not merely delivered.
OrderService admin transitions uses transaction/lock: pending->confirmed|cancelled; confirmed->shipped|cancelled; shipped->delivered; delivered terminal. Cancel restocks exactly once, sorted variant lock; do not restore orders already cancelled. Admin calls OrderService.transition(Order,string) and markCodPaid(Order); worker implement.

## Admin endpoints/props

Admin routes prefix /admin with auth, verified, EnsureAdmin using user.is_admin boolean false. Public signup cannot assign is_admin (NOT fillable). Safe command shop:make-admin email promotes EXISTING verified account, no default secret/password; confirm prompt optional --force. No public admin elevation.
GET /admin -> admin/dashboard counts stats + latest orders (worker choose props UI matches).
GET /admin/products -> admin/products {products pagination all,brands,categories}; GET /admin/products/create and /admin/products/{product}/edit -> admin/product-form {product|null,brands,categories}.
POST /admin/products, PUT/PATCH /admin/products/{product}; multipart upload JPEG/PNG/WebP<=5MB validated, no SVG, image stored generated filename; file replacement safe after DB commit (or retain old files until cleanup if simpler). Product fields from schema, variants array id nullable/sku/name/price/stock/is_active. Never update stock while checkout without row lock; validate unique variants/sku + ownership; omissions do NOT delete existing variants. No hard delete needed; deactivate.
POST /admin/brands {name,slug}, POST /admin/categories {name,slug} from forms on product list. Name/slug validation unique.
GET /admin/orders -> admin/orders; GET /admin/orders/{order} -> admin/order; PATCH /admin/orders/{order} {status}; POST /admin/orders/{order}/collected mark COD received through OrderService; auth+CSRF. State allowlist server and UI.

## Shared props parent provides

shop:{cart_count:number,is_admin:boolean}; flash:{success:string|null,error:string|null}; auth existing. Frontend use explicit types, never assume logged in. app.tsx returns ShopLayout for shop/* and AdminLayout for admin/*, no extra default dashboard layout. Existing auth/settings unaffected. Shared CSS scope .storefront and .commerce-admin, light UI cobalt accents; keyboard, errors, labels, mobile.

## Tests

Use installed PHPUnit for PHP feature tests; tests RefreshDatabase, no external service calls; APP_KEY test env from local exists. New migrations additive only. Do not migrate or seed shared DB workers; parent does after code review. No install deps, no git push/commit, no background servers workers. Parent runs final build/type/browser. Each worker returns exact files, API mismatches, tests and remaining limitations.
