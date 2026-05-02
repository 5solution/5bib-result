# 5BIB SaaS / White-Label Strategy — Phân tích kiến trúc triển khai riêng cho BTC

> **Bối cảnh:** BTC VietJungle (và có thể nhiều BTC khác) muốn hệ thống riêng biệt hoàn toàn với 5BIB, có domain riêng, branding riêng, để bán vé và quản lý giải của họ theo series. 5BIB đã có sẵn toàn bộ logic cần thiết.

> **Ngày:** 26/04/2026

---

## 1. Yêu cầu từ BTC

### Frontend (public — cho end-user/VĐV)
- Trang riêng hiển thị thông tin giải (series giải của BTC)
- Bán vé + thanh toán qua cổng thanh toán
- Đăng ký / đăng nhập cho end-user
- Domain riêng (vd: `vietjungle.vn`, `dalat-ultra.com`)
- Branding riêng (logo, màu sắc, font — KHÔNG hiển thị 5BIB)

### Admin (cho BTC)
- Quản lý đơn hàng
- Quản lý danh sách vé
- Quản lý voucher khuyến mại
- Check-in VĐV tại sự kiện
- Ký miễn trừ (waiver) cho VĐV

### Yêu cầu phi chức năng
- **Tách biệt hoàn toàn** với 5BIB platform hiện tại
- Một số BTC có **custom logic riêng**
- BTC trả phí SaaS cho 5BIB (monthly hoặc per-transaction)

---

## 2. Thị trường White-Label Ticketing — Đối thủ đang làm gì?

### 2.1. RunSignup (US — Gold Standard cho Race)
- BTC tạo giải → được 1 website riêng với custom domain (free SSL)
- Hỗ trợ root domain (`myrace.com`) và subdomain (`race.myorg.com`)
- Branding: logo BTC, color scheme, custom pages — **không hiện RunSignup logo**
- Cùng 1 codebase, cùng 1 database — phân biệt bằng `raceId`
- BTC tự quản lý mọi thứ qua dashboard
- **Model:** Platform multi-tenant, KHÔNG phải deploy riêng

### 2.2. Ticketsauce (US — White-Label Leader)
- "Your brand, your platform" — không hiện Ticketsauce bất cứ đâu
- Custom domain, custom email sender, custom checkout
- Mỗi organizer = 1 "storefront" riêng biệt
- **Model:** Shared infrastructure, tenant isolation qua config

### 2.3. vivenu (EU — Enterprise)
- Headless ticketing API — BTC build frontend riêng trên API của vivenu
- Open REST API, multi-tenant architecture
- **Model:** API-first, BTC tự build UI hoặc dùng template

### 2.4. DistantRace (EU — Virtual Race White-Label)
- White-label hoàn toàn cho organizer
- API-first, automation
- **Model:** Shared backend, branded frontend per tenant

### Kết luận từ thị trường:
> **KHÔNG AI deploy codebase riêng cho mỗi BTC.** Tất cả đều dùng **multi-tenant architecture** — 1 codebase, 1 deployment, phân biệt tenant qua domain/config. Đây là chuẩn ngành vì lý do chi phí vận hành và bảo trì.

---

## 3. Ba Approach — So sánh chi tiết

### Approach A: Separate Deployment (Fork & Deploy)
```
BTC VietJungle → deploy riêng backend + frontend + DB
BTC Dalat Ultra → deploy riêng backend + frontend + DB
BTC XYZ → deploy riêng backend + frontend + DB
```

| Ưu điểm | Nhược điểm |
|----------|-----------|
| ✅ Isolation tuyệt đối | ❌ Mỗi BTC = 1 VPS hoặc container set → chi phí server ×N |
| ✅ Custom logic thoải mái | ❌ Bug fix phải patch từng deployment → maintenance nightmare |
| ✅ BTC yên tâm "data riêng" | ❌ Upgrade feature mới = deploy N lần |
| | ❌ CI/CD phức tạp cấp số nhân |
| | ❌ Không scale được — 10 BTC = 10 lần effort |

**Verdict:** ❌ **KHÔNG khuyến khích.** Chỉ phù hợp nếu chỉ có 1-2 BTC và họ trả phí RẤT CAO (>50M/tháng). Không ai trong ngành làm cách này.

---

### Approach B: Multi-Tenant Shared Database (tenantId pattern)
```
1 Backend (NestJS) → 1 MongoDB → mọi collection có field tenantId
1 Frontend (Next.js) → dynamic theming theo domain
```

| Ưu điểm | Nhược điểm |
|----------|-----------|
| ✅ 1 codebase, 1 deployment | ⚠️ Mọi query PHẢI có filter `tenantId` — quên 1 chỗ = data leak |
| ✅ Chi phí server thấp nhất | ⚠️ Performance: index cần compound với tenantId |
| ✅ Deploy feature mới = tất cả BTC có ngay | ⚠️ BTC lo ngại "data chung 1 DB" (tâm lý) |
| ✅ Monitoring/debugging tập trung | ⚠️ Migration phức tạp khi 1 BTC muốn schema riêng |
| ✅ Scale ngang dễ (thêm BTC = thêm config) | |

**Cách hoạt động:**
```typescript
// Middleware extract tenant từ domain
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const host = req.headers.host; // vietjungle.vn
    const tenant = await this.tenantService.findByDomain(host);
    req['tenant'] = tenant; // { id, name, config, theme }
    next();
  }
}

// Mọi query tự động filter theo tenant
const orders = await this.orderModel.find({ 
  tenantId: req.tenant.id, // BẮT BUỘC
  ...filters 
});
```

**Verdict:** ✅ **Tốt cho scale lớn (50+ BTC).** Nhưng cần discipline cao — 1 query thiếu tenantId = disaster.

---

### Approach C: Multi-Tenant Database-Per-Tenant (⭐ RECOMMENDED)
```
1 Backend (NestJS) → N MongoDB databases (1 per BTC)
1 Frontend (Next.js) → dynamic theming theo domain
1 Platform DB (MongoDB/MySQL) → tenant configs, billing, super admin
```

| Ưu điểm | Nhược điểm |
|----------|-----------|
| ✅ Data isolation thực sự — mỗi BTC 1 database | ⚠️ Connection pooling cần quản lý (N databases = N connections) |
| ✅ 1 codebase, 1 deployment | ⚠️ Cross-tenant analytics phức tạp hơn |
| ✅ Custom schema per BTC dễ dàng | ⚠️ Backup/restore per tenant |
| ✅ BTC yên tâm "DB riêng" (selling point) | ⚠️ MongoDB Atlas cost tăng theo số DB (nếu dùng Atlas) |
| ✅ Migrate/export data 1 BTC dễ (dump 1 DB) | |
| ✅ Performance tốt (không cần compound index tenantId) | |
| ✅ Drop 1 BTC = drop 1 DB (clean) | |
| ✅ Deploy feature mới = tất cả BTC có ngay | |

**Cách hoạt động:**
```typescript
// Middleware resolve tenant → switch database connection
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const host = req.headers.host; // vietjungle.vn
    const tenant = await this.tenantService.findByDomain(host);
    req['tenantDbName'] = `5bib_tenant_${tenant.slug}`; // 5bib_tenant_vietjungle
    next();
  }
}

// Dynamic Mongoose connection per request
const tenantConnection = mongoose.createConnection(
  `mongodb://host:27018/${req.tenantDbName}`
);
const OrderModel = tenantConnection.model('Order', OrderSchema);
const orders = await OrderModel.find(filters); // KHÔNG CẦN tenantId filter
```

**Verdict:** ✅⭐ **RECOMMENDED.** Cân bằng tốt nhất giữa isolation (BTC yên tâm), maintenance (1 codebase), và cost (1 deployment). Đây là pattern mà hầu hết SaaS ticketing platform dùng.

---

## 4. Kiến trúc đề xuất — Database-Per-Tenant

### 4.1. Tổng quan

```
                    ┌─────────────────────────┐
                    │      DNS / Cloudflare     │
                    │  vietjungle.vn → VPS IP   │
                    │  dalat-ultra.com → VPS IP  │
                    │  admin.5bib.com → VPS IP   │
                    └──────────┬──────────────┘
                               │
                    ┌──────────▼──────────────┐
                    │     nginx reverse proxy   │
                    │  Route by domain/SNI      │
                    └──────────┬──────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
    ┌─────────▼──────┐ ┌──────▼───────┐ ┌──────▼───────┐
    │  Frontend (SSR) │ │ Admin Panel  │ │   Backend    │
    │  Next.js 16     │ │ Next.js 16   │ │  NestJS 10   │
    │  Port 3002      │ │ Port 3000    │ │  Port 8081   │
    │                 │ │              │ │              │
    │ Dynamic theme   │ │ Tenant-aware │ │ Tenant       │
    │ per domain      │ │ dashboard    │ │ middleware   │
    └─────────────────┘ └──────────────┘ └──────┬───────┘
                                                │
                         ┌──────────────────────┼──────────────────┐
                         │                      │                  │
              ┌──────────▼────────┐  ┌──────────▼────┐  ┌─────────▼──────┐
              │  Platform DB      │  │ Tenant DBs    │  │     Redis      │
              │  (MongoDB/MySQL)  │  │ (MongoDB)     │  │                │
              │                   │  │               │  │ Session cache  │
              │ • tenants config  │  │ 5bib_vietjungle│ │ Tenant config  │
              │ • billing         │  │ 5bib_dalatultra│ │ Rate limiting  │
              │ • super admin     │  │ 5bib_xyz      │  │                │
              │ • feature flags   │  │               │  │                │
              └───────────────────┘  │ Mỗi DB chứa: │  └────────────────┘
                                     │ • orders      │
                                     │ • tickets     │
                                     │ • vouchers    │
                                     │ • users       │
                                     │ • events      │
                                     │ • checkins    │
                                     │ • waivers     │
                                     └───────────────┘
```

### 4.2. Platform Database (shared) — `5bib_platform`

Chứa metadata về tenants, KHÔNG chứa business data:

```
tenants                 — Danh sách BTC đã đăng ký SaaS
├── _id
├── slug                — "vietjungle" (unique, dùng làm DB name suffix)
├── name                — "VietJungle Trail Series"
├── domains[]           — ["vietjungle.vn", "www.vietjungle.vn"]
├── adminDomains[]      — ["admin.vietjungle.vn"]
├── status              — "active" | "suspended" | "trial"
├── plan                — "basic" | "pro" | "enterprise"
├── config
│   ├── theme
│   │   ├── primaryColor    — "#2B5329"
│   │   ├── logoUrl         — "https://s3.../vietjungle/logo.png"
│   │   ├── faviconUrl
│   │   ├── coverImageUrl
│   │   └── fontFamily      — "Be Vietnam Pro" (hoặc custom)
│   ├── payment
│   │   ├── vnpayMerchantId — VNPay merchant riêng của BTC
│   │   ├── vnpaySecretKey
│   │   ├── momoPartnerCode
│   │   └── bankTransferInfo
│   ├── features            — Feature flags per tenant
│   │   ├── enableWaiver    — true/false
│   │   ├── enableResale    — true/false
│   │   ├── enableCheckin   — true/false
│   │   ├── enableVoucher   — true/false
│   │   ├── enable5BIBResults — true/false (kết nối kết quả 5BIB)
│   │   └── customFields[]  — fields riêng BTC muốn thêm
│   ├── email
│   │   ├── senderName      — "VietJungle"
│   │   ├── senderEmail     — "no-reply@vietjungle.vn"
│   │   └── replyTo
│   └── seo
│       ├── title
│       ├── description
│       └── ogImage
├── billing
│   ├── plan
│   ├── monthlyFee
│   ├── transactionFeeRate  — % per transaction
│   └── billingEmail
├── dbName              — "5bib_tenant_vietjungle" (auto-generated)
├── createdAt
└── updatedAt

tenant_billing_logs     — Lịch sử billing/payment từ BTC
tenant_audit_logs       — Audit log cho super admin
```

### 4.3. Tenant Database (per BTC) — `5bib_tenant_{slug}`

Mỗi BTC có 1 database riêng, schema GIỐNG NHAU (trừ custom fields):

```
events                  — Giải/sự kiện của BTC
├── (reuse schema từ 5BIB races, bỏ tenantId vì đã tách DB)

tickets                 — Loại vé
├── (reuse từ 5Ticket ticket_types)

orders                  — Đơn hàng
├── (reuse từ 5Ticket orders)

order_items             — Chi tiết đơn hàng
vouchers                — Mã khuyến mại
users                   — End-user (VĐV) — CHỈ user của BTC này
checkins                — Lịch sử check-in
waivers                 — Biểu mẫu miễn trừ + chữ ký VĐV
waiver_templates        — Template miễn trừ do BTC tạo
staff                   — Staff/nhân viên BTC (phân quyền)
```

### 4.4. Tenant Resolution Flow

```
Request: GET https://vietjungle.vn/events/dalat-ultra-2026
                          │
                          ▼
              nginx: route tới Frontend container
                          │
                          ▼
              Next.js middleware: extract host "vietjungle.vn"
                          │
                          ▼
              API call: GET /api/tenant/resolve?domain=vietjungle.vn
                          │
                          ▼
              NestJS TenantMiddleware:
              1. Check Redis cache: tenant:domain:vietjungle.vn
              2. If miss → query Platform DB: tenants.findOne({ domains: "vietjungle.vn" })
              3. Cache result in Redis (TTL: 5 min)
              4. Inject tenant config vào request context
              5. Create/reuse MongoDB connection tới "5bib_tenant_vietjungle"
                          │
                          ▼
              Controller xử lý request bình thường
              (query trên tenant DB, KHÔNG CẦN filter tenantId)
```

---

## 5. Implementation Plan — Tận dụng code 5BIB hiện tại

### 5.1. Những gì REUSE được ngay (>80% logic)

| Module hiện tại | Reuse cho SaaS | Thay đổi cần thiết |
|----------------|----------------|---------------------|
| Order management (5Ticket) | ✅ 100% logic | Bỏ tenantId, thêm tenant DB resolver |
| Ticket types CRUD | ✅ 100% | Bỏ merchant context, dùng tenant context |
| Voucher/Promo codes | ✅ 100% | Minimal changes |
| Check-in (QR scan) | ✅ 90% | Thêm staff auth per tenant |
| Payment (VNPay/MoMo) | ✅ 80% | Mỗi BTC có merchant credentials riêng |
| User auth (JWT) | ✅ 70% | Thêm tenant-scoped user registration |
| S3 upload | ✅ 90% | Prefix key với tenant slug |
| Email notifications | ✅ 70% | Custom sender per tenant |

### 5.2. Những gì cần BUILD MỚI

| Component | Mô tả | Effort |
|-----------|-------|--------|
| **TenantModule** (NestJS) | Middleware resolve tenant từ domain, switch DB connection, cache config | 1 tuần |
| **Tenant Admin Panel** | Super admin: CRUD tenants, billing, feature flags, monitor | 1.5 tuần |
| **Dynamic Theme Engine** (Next.js) | Load theme (colors, logo, fonts) từ tenant config, apply CSS variables | 1 tuần |
| **Tenant Frontend Template** | Next.js app template: homepage, event list, event detail, checkout, my tickets | 2 tuần (reuse 5Ticket UI) |
| **Tenant Admin Dashboard** | Dashboard cho BTC: orders, tickets, vouchers, checkin, waivers | 2 tuần (reuse 5BIB admin) |
| **Waiver Module** | Template builder, e-signature, storage | 1 tuần |
| **Domain Management** | Auto SSL (Let's Encrypt), nginx config generation per tenant | 1 tuần |
| **Billing Module** | Track usage per tenant, generate invoices | 1 tuần (Phase 2) |

### 5.3. Phân pha

**Phase 1: MVP cho VietJungle (5-6 tuần)**
- TenantModule + middleware
- Fork frontend template từ 5Ticket UI
- Fork admin dashboard từ 5BIB admin
- VietJungle-specific: domain setup, theme, payment credentials
- Core: orders, tickets, vouchers, checkin
- Manual tenant provisioning (5BIB team tạo DB + config)

**Phase 2: Self-Service + Scale (4-6 tuần)**
- Waiver module (e-signature)
- Tenant admin panel (super admin CRUD tenants)
- Auto domain + SSL provisioning
- Billing module
- Feature flags per tenant
- Custom fields per tenant

**Phase 3: Marketplace (3+ tháng)**
- BTC tự đăng ký → auto provision
- Template gallery (nhiều theme)
- Plugin system (BTC chọn modules cần)
- API cho BTC tự build frontend
- Kết nối 5BIB Results + 5Pix per tenant

---

## 6. Technical Deep-Dive — NestJS Multi-Tenant

### 6.1. TenantModule Structure

```
backend/src/modules/tenant/
├── tenant.module.ts
├── tenant.service.ts           — CRUD tenants trong Platform DB
├── tenant.resolver.ts          — Resolve domain → tenant config
├── tenant.middleware.ts        — Inject tenant context vào mọi request
├── tenant-connection.service.ts — Manage MongoDB connections per tenant
├── tenant.guard.ts             — Verify request has valid tenant
├── dto/
│   ├── create-tenant.dto.ts
│   └── tenant-config.dto.ts
├── schemas/
│   └── tenant.schema.ts       — Mongoose schema cho Platform DB
└── decorators/
    └── current-tenant.decorator.ts — @CurrentTenant() param decorator
```

### 6.2. Key Pattern: Connection Pool Manager

```typescript
// tenant-connection.service.ts
@Injectable()
export class TenantConnectionService {
  private connections = new Map<string, mongoose.Connection>();
  
  async getConnection(tenantSlug: string): Promise<mongoose.Connection> {
    if (this.connections.has(tenantSlug)) {
      return this.connections.get(tenantSlug);
    }
    
    const dbName = `5bib_tenant_${tenantSlug}`;
    const conn = await mongoose.createConnection(
      `${process.env.MONGODB_URL}/${dbName}`
    );
    
    // Register all schemas on this connection
    conn.model('Order', OrderSchema);
    conn.model('Ticket', TicketSchema);
    conn.model('Voucher', VoucherSchema);
    conn.model('User', UserSchema);
    conn.model('Checkin', CheckinSchema);
    conn.model('Waiver', WaiverSchema);
    
    this.connections.set(tenantSlug, conn);
    return conn;
  }
}
```

### 6.3. Key Pattern: Tenant-Scoped Repository

```typescript
// Thay vì inject model trực tiếp, inject qua tenant context
@Injectable()
export class OrderService {
  async findOrders(tenant: TenantContext, filters: any) {
    const conn = await this.tenantConnectionService.getConnection(tenant.slug);
    const OrderModel = conn.model('Order');
    return OrderModel.find(filters); // KHÔNG CẦN tenantId filter
  }
}
```

### 6.4. Frontend Dynamic Theme

```typescript
// Next.js middleware.ts
export async function middleware(request: NextRequest) {
  const host = request.headers.get('host');
  
  // Fetch tenant config from API (cached)
  const tenant = await fetch(`${BACKEND_URL}/api/tenant/resolve?domain=${host}`)
    .then(r => r.json());
  
  // Inject tenant config vào headers cho SSR components
  const response = NextResponse.next();
  response.headers.set('x-tenant-slug', tenant.slug);
  response.headers.set('x-tenant-theme', JSON.stringify(tenant.config.theme));
  return response;
}

// layout.tsx — apply CSS variables
export default async function RootLayout({ children }) {
  const tenant = await getTenantFromHeaders();
  return (
    <html style={{
      '--primary': tenant.theme.primaryColor,
      '--logo-url': `url(${tenant.theme.logoUrl})`,
    }}>
      <body>{children}</body>
    </html>
  );
}
```

---

## 7. nginx Multi-Domain Config

```nginx
# /etc/nginx/sites-enabled/tenant-proxy.conf
# Catch-all server block cho tất cả tenant domains

server {
    listen 443 ssl;
    server_name ~^(?<tenant_domain>.+)$;
    
    # Wildcard SSL hoặc per-domain cert (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/$tenant_domain/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$tenant_domain/privkey.pem;
    
    # Proxy tới frontend (Next.js SSR)
    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Tenant-Domain $host;
    }
    
    # Proxy API requests tới backend
    location /api/ {
        proxy_pass http://127.0.0.1:8081;
        proxy_set_header Host $host;
        proxy_set_header X-Tenant-Domain $host;
    }
}
```

---

## 8. Pricing Model đề xuất cho BTC

| Plan | Monthly Fee | Transaction Fee | Bao gồm |
|------|------------|-----------------|----------|
| **Basic** | 2.000.000 VNĐ | 3% per transaction | 1 domain, 5 events/năm, basic support |
| **Pro** | 5.000.000 VNĐ | 2% per transaction | Custom domain, unlimited events, vouchers, checkin, email support |
| **Enterprise** | Thỏa thuận | 1-1.5% per transaction | Whitelabel hoàn toàn, custom features, dedicated support, SLA |

**So sánh:** Ticketsauce (US) charge $0.99/ticket + 2.5% — tương đương ~4-5% total. 5BIB pricing cạnh tranh hơn cho thị trường VN.

---

## 9. Competitive Score — 5BIB SaaS vs Market

| Dimension | Ticketbox | CTicket | RunSignup | Ticketsauce | 5BIB SaaS |
|-----------|-----------|---------|-----------|-------------|-----------|
| White-label (ẩn brand platform) | ❌ | ❌ | ⚠️ partial | ✅ | ✅ |
| Custom domain | ❌ | ❌ | ✅ | ✅ | ✅ |
| Data isolation | ❌ shared | ❌ shared | ❌ shared | ⚠️ | ✅ DB riêng |
| Custom payment credentials | ❌ | ❌ | ✅ | ✅ | ✅ |
| Organizer dashboard | ⚠️ | ❌ | ✅ | ✅ | ✅ |
| Waiver/E-signature | ❌ | ❌ | ✅ | ❌ | ✅ |
| Race results integration | ❌ | ❌ | ✅ | ❌ | ✅ ⭐ via 5BIB |
| Vietnamese market fit | ✅ | ✅ | ❌ | ❌ | ✅ |
| VNPay/MoMo support | ✅ | ✅ | ❌ | ❌ | ✅ |

**5BIB SaaS sẽ là sản phẩm white-label duy nhất ở VN cho BTC giải chạy, với lợi thế kết nối race results + race photos mà KHÔNG đối thủ nào có.**

---

## 10. PAUSE Items — Danny cần quyết định

| # | Câu hỏi | Ảnh hưởng |
|---|---------|-----------|
| 1 | **Approach confirm?** Database-per-tenant (recommended) hay shared DB? | Toàn bộ architecture |
| 2 | **VietJungle timeline?** Họ cần khi nào? | MVP deadline |
| 3 | **VietJungle domain?** Họ đã có domain chưa? | nginx + SSL setup |
| 4 | **Payment:** VietJungle có VNPay/MoMo merchant riêng không? Hay dùng qua 5BIB? | Payment flow |
| 5 | **Repo:** Monorepo với 5BIB hay repo riêng? | CI/CD strategy |
| 6 | **VPS:** Deploy trên cùng VPS 157.10.42.171 hay VPS riêng? | Infra cost |
| 7 | **User sharing:** VĐV đăng ký trên VietJungle có dùng được trên 5BIB không? (SSO) | Auth architecture |
| 8 | **Pricing cho VietJungle?** Họ trả bao nhiêu/tháng + %/giao dịch? | Business model |
| 9 | **Custom logic VietJungle cần gì cụ thể?** | Feature flags design |
| 10 | **Waiver:** Phase 1 hay Phase 2? | MVP scope |

---

## Sources

- [RunSignup Custom Domain](https://help.runsignup.com/support/solutions/articles/17000088624-make-your-own-domain-point-to-your-race-website)
- [Ticketsauce White-Label Platform](https://www.ticketsauce.com/)
- [vivenu Headless Ticketing API](https://www.capterra.com/p/252372/vivenu/)
- [Eventtia White-Label Platforms 2026](https://www.eventtia.com/en/best-white-label-event-management-platforms/)
- [NestJS Multi-Tenant MongoDB](https://medium.com/@thisha.me/implementing-multi-tenant-architecture-with-nestjs-and-mongodb-d488c8760143)
- [NestJS Multi-Tenant SaaS Starter (GitHub)](https://github.com/milad-zai/nestjs-multi-tenant-saas-starter)
- [MongoDB Multi-Tenant Architecture](https://www.mongodb.com/docs/atlas/build-multi-tenant-arch/)
- [White-Label SaaS Architecture Guide 2026](https://developex.com/blog/building-scalable-white-label-saas/)
- [Multi-Tenant Architecture Guide (WorkOS)](https://workos.com/blog/developers-guide-saas-multi-tenant-architecture)
