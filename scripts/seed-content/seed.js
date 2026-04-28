/**
 * 5BIB content seed script — paste vào DevTools Console khi đang ở
 * http://localhost:3010 (admin) và đã đăng nhập.
 *
 * Cookies session sẽ tự inject Bearer token qua admin proxy.
 * Idempotent: nếu category/article đã tồn tại (slug clash) → skip.
 */
(async function seedContent() {
  const log = (...args) => console.log("%c[SEED]", "color:#1D49FF;font-weight:bold", ...args);
  const ok = (...args) => console.log("%c[OK]", "color:#16A34A;font-weight:bold", ...args);
  const warn = (...args) => console.warn("%c[WARN]", "color:#D97706;font-weight:bold", ...args);
  const fail = (...args) => console.error("%c[FAIL]", "color:#DC2626;font-weight:bold", ...args);

  // Detect env — must be on admin
  if (!location.host.includes("3010") && !location.host.includes("admin.5bib.com")) {
    fail("Phải chạy ở http://localhost:3010 (admin) — đang ở", location.host);
    return;
  }

  // ── Load JSON files (must be served at /seed-data/* — see instructions) ──
  // For browser console paste-and-run convenience, we inline the data below.
  // (If files become huge, switch to await fetch('/scripts/seed-content/categories.json').)

  const CATEGORIES = SEED_CATEGORIES_INLINE;
  const ARTICLES = SEED_ARTICLES_INLINE;

  log(`Loaded ${CATEGORIES.length} categories + ${ARTICLES.length} articles`);

  const api = async (method, path, body) => {
    const res = await fetch(path, {
      method,
      credentials: "include",
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!res.ok) {
      const err = new Error(`${method} ${path} → ${res.status}`);
      err.status = res.status;
      err.body = data;
      throw err;
    }
    return data;
  };

  // ── 1. Seed categories ────────────────────────────────────────
  log("─── Step 1: Categories ───");
  const existingCats = await api("GET", "/api/admin/article-categories");
  const existingCatSlugs = new Set(existingCats.map((c) => c.slug));
  log(`Found ${existingCats.length} existing categories`);

  let catCreated = 0;
  let catSkipped = 0;
  for (const cat of CATEGORIES) {
    if (existingCatSlugs.has(cat.slug)) {
      warn(`Category "${cat.slug}" exists — skip`);
      catSkipped++;
      continue;
    }
    try {
      await api("POST", "/api/admin/article-categories", cat);
      ok(`Created category: ${cat.icon} ${cat.name} (${cat.slug})`);
      catCreated++;
    } catch (err) {
      fail(`Failed category "${cat.slug}": ${err.body?.message ?? err.message}`);
    }
  }
  log(`Categories: ${catCreated} created, ${catSkipped} skipped`);

  // ── 2. Seed articles ──────────────────────────────────────────
  log("─── Step 2: Articles ───");
  const { items: existingArticles } = await api(
    "GET",
    "/api/admin/articles?status=all&includeDeleted=true&limit=50",
  );
  const existingArtSlugs = new Set(existingArticles.map((a) => a.slug));
  log(`Found ${existingArticles.length} existing articles`);

  let artCreated = 0;
  let artPublished = 0;
  let artSkipped = 0;
  for (const art of ARTICLES) {
    if (existingArtSlugs.has(art.slug)) {
      warn(`Article "${art.slug}" exists — skip create, will try publish`);
      const existing = existingArticles.find((a) => a.slug === art.slug);
      if (existing && existing.status !== "published") {
        try {
          await api("POST", `/api/admin/articles/${existing.id}/publish`);
          ok(`Published existing article: ${existing.title}`);
          artPublished++;
        } catch (err) {
          fail(`Publish "${art.slug}" failed: ${err.body?.message ?? err.message}`);
        }
      }
      artSkipped++;
      continue;
    }
    try {
      const created = await api("POST", "/api/admin/articles", {
        title: art.title,
        slug: art.slug,
        type: art.type,
        products: art.products,
        category: art.category,
        excerpt: art.excerpt,
        coverImageUrl: art.coverImageUrl,
        seoTitle: art.seoTitle,
        seoDescription: art.seoDescription,
        featured: art.featured,
        content: art.content,
      });
      ok(`Created article: ${art.title}`);
      artCreated++;

      // Publish immediately
      try {
        await api("POST", `/api/admin/articles/${created.id}/publish`);
        ok(`  → Published`);
        artPublished++;
      } catch (err) {
        if (err.status === 422) {
          fail(`  → Publish 422 (missing fields): ${JSON.stringify(err.body?.missing ?? [])}`);
        } else {
          fail(`  → Publish failed: ${err.body?.message ?? err.message}`);
        }
      }
    } catch (err) {
      fail(`Failed article "${art.slug}": ${err.body?.message ?? err.message}`);
    }
  }

  // ── Summary ──────────────────────────────────────────────────
  console.log(
    "%c═══ DONE ═══",
    "color:#1D49FF;font-weight:bold;font-size:14px",
  );
  console.table({
    "Categories created": catCreated,
    "Categories skipped (existing)": catSkipped,
    "Articles created": artCreated,
    "Articles published": artPublished,
    "Articles skipped (existing)": artSkipped,
  });

  console.log("%cNext steps:", "color:#1D49FF;font-weight:bold");
  console.log(
    "1. Vào http://localhost:3010/articles để xem list bài đã tạo",
  );
  console.log(
    "2. Nếu chưa tạo API key cho content-web: vào /api-keys → tạo key 'content-web local dev'",
  );
  console.log(
    "3. Paste key vào content-web/.env.local: ARTICLES_API_KEY=ak_xxx",
  );
  console.log(
    "4. Restart content-web (kill + restart preview)",
  );
  console.log(
    "5. Mở http://localhost:3015 → thấy 5 categories + featured article + grid",
  );
})();
