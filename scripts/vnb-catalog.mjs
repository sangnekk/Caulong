// Crawls VNB's badminton racket catalog (used by Shop Cầu Lông with VNB's permission) into the
// catalog importer's CSV format plus a folder of product photos.
//
//   node scripts/vnb-catalog.mjs [--out=storage/app/private/vnb] [--limit=N] [--brands=yonex,lining] [--refresh] [--upgrade]
//   php artisan shop:import-catalog storage/app/private/vnb/vnb-vot-cau-long-01.csv --images=storage/app/private/vnb/anh
//   (one command per numbered CSV)
//
// Polite by design: one request at a time with a pause, no /ajax/ (robots.txt), cached per
// product so a rerun only fetches what is new (--refresh refetches every page; --upgrade only
// those read before the script kept a page's whole gallery and its list price). Stock is
// always 0: VNB does not publish counts and the shop enters its own. To refresh prices later,
// rerun this and import with --keep-stock so counts entered by the shop are not reset.
//
// vnb/product.mjs reads a product page into the cache; vnb/rows.mjs turns the cache into rows.
import {
    access,
    mkdir,
    readdir,
    readFile,
    unlink,
    writeFile,
} from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { all, attr, parseHtml } from './vnb/html.mjs';
import { PARSER, readProduct } from './vnb/product.mjs';
import {
    COLUMNS,
    csvLine,
    dropsColours,
    keptSkus,
    nameBrands,
    rows,
    understand,
    unpriced,
    unwanted,
} from './vnb/rows.mjs';

const SITE = 'https://shopvnb.com/';
const USER_AGENT = 'ShopCauLong-catalog-sync/1.0 (with permission from VNB)';
const PAUSE_MS = 450;
/** Photos kept per product besides its main one (the shop takes up to 12). */
const GALLERY = 8;
const args = Object.fromEntries(
    process.argv.slice(2).map((arg) => {
        const [key, value = 'true'] = arg.replace(/^--/, '').split('=');
        return [key, value];
    }),
);
const out = resolve(args.out ?? 'storage/app/private/vnb');
const limit = args.limit ? Number(args.limit) : Infinity;
const onlyBrands = args.brands ? args.brands.split(',') : null;

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const exists = (path) =>
    access(path).then(
        () => true,
        () => false,
    );
let lastRequest = 0;

async function get(url, as = 'text') {
    for (let attempt = 1; ; attempt++) {
        const wait = lastRequest + PAUSE_MS - Date.now();
        if (wait > 0) await sleep(wait);
        lastRequest = Date.now();
        try {
            const response = await fetch(url, {
                headers: { 'User-Agent': USER_AGENT },
                redirect: 'follow',
                signal: AbortSignal.timeout(45000),
            });
            if (response.status === 404) return null;
            // Await the body here, so a stalled download is retried rather than thrown.
            if (response.ok)
                return as === 'bytes'
                    ? Buffer.from(await response.arrayBuffer())
                    : await response.text();
            if (
                attempt >= 4 ||
                (response.status < 500 && response.status !== 429)
            )
                throw new Error('HTTP ' + response.status + ' ' + url);
        } catch (error) {
            if (attempt >= 4) throw error;
        }
        await sleep(2000 * attempt ** 2);
    }
}

/** Brand racket categories from VNB's own sitemap; "giá rẻ" is a price band, not a brand. */
async function categories() {
    const xml = await get(SITE + 'sitemap/danh-muc.xml');
    return [
        ...xml.matchAll(
            /<loc>(https:\/\/shopvnb\.com\/vot-cau-long-([a-z0-9-]+)\.html)<\/loc>/g,
        ),
    ]
        .filter(([, , brand]) => brand !== 'gia-re')
        .filter(([, , brand]) => !onlyBrands || onlyBrands.includes(brand))
        .map(([, url]) => url);
}

/** Product pages a category lists, over all its pages. */
async function productLinks(category) {
    const links = [];
    for (let page = 1; page < 100; page++) {
        const html = await get(category + (page > 1 ? '?page=' + page : ''));
        const found = all(parseHtml(html ?? ''), '.product-name a[href]')
            .map((link) => attr(link, 'href'))
            .filter((href) => /^[a-z0-9-]+\.html$/.test(href));
        const fresh = [...new Set(found)].filter(
            (href) => !links.includes(href),
        );
        if (!fresh.length) break;
        links.push(...fresh);
    }
    return links;
}

/** Product page → the category that lists it. Cached, so rebuilding the CSV needs no request. */
async function listing() {
    const file = join(out, 'links.json');
    const seen = new Map(
        !args.relist && !args.refresh && (await exists(file))
            ? JSON.parse(await readFile(file, 'utf8'))
            : [],
    );
    if (seen.size) return seen;
    for (const category of await categories()) {
        for (const href of await productLinks(category))
            seen.set(href, category);
        console.log(
            'danh mục',
            category.replace(SITE, ''),
            '→',
            seen.size,
            'sản phẩm',
        );
        if (seen.size >= limit) break;
    }
    if (!Number.isFinite(limit))
        await writeFile(file, JSON.stringify([...seen]));
    return seen;
}

/** A product from the cache, or read from its page and cached; null when the page is gone. */
async function load(href) {
    const file = join(out, 'products', href.replace(/\.html$/, '.json'));
    // Pages cached before text was normalised may spell "Vợt" with combining marks.
    const cached = (await exists(file))
        ? JSON.parse((await readFile(file, 'utf8')).normalize('NFC'))
        : null;
    // The first parser could not read an article outside a multi-product page, and until
    // the third only the first option group of a page with several was kept.
    const complete =
        cached &&
        ((cached.parser ?? 1) >= 2 || cached.description) &&
        (cached.options ||
            (cached.groups ?? []).filter((group) => group !== 'Size').length <
                2) &&
        (!args.upgrade || (cached.parser ?? 1) >= PARSER);
    if (complete && !args.refresh) {
        // A page read before the script fetched galleries has its photos listed, not fetched.
        if ((cached.images?.length ?? 0) > 1 && !cached.galleryFiles) {
            await photos(cached);
            await writeFile(file, JSON.stringify(cached, null, 1));
        }
        return cached;
    }
    const html = await get(SITE + href);
    if (!html) return null;
    const product = readProduct(html, href);
    // Read again, a page keeps the SKUs it already has in the shop.
    const kept = cached ? keptSkus(cached) : {};
    if (Object.keys(kept).length) product.skus = kept;
    await photos(product);
    await writeFile(file, JSON.stringify(product, null, 1));
    return product;
}

/**
 * The product's photos in the photo folder: the main one named after the product, the others
 * numbered after an underscore, which no VNB address has, so "x_2" is never another product.
 */
async function photos(product) {
    const urls = product.images?.length ? product.images : [product.image];
    product.galleryFiles = [];
    for (const [index, url] of urls.slice(0, 1 + GALLERY).entries()) {
        const extension = url?.match(/\.(webp|jpe?g|png)$/i)?.[1];
        if (!extension) continue;
        const name =
            product.slug +
            (index ? '_' + (index + 1) : '') +
            '.' +
            extension.toLowerCase();
        const file = join(out, 'anh', name);
        if (!(await exists(file))) {
            const bytes = await get(url, 'bytes');
            if (bytes) await writeFile(file, bytes);
        }
        if (!(await exists(file))) continue;
        if (index) product.galleryFiles.push(name);
        else product.imageFile = name;
    }
}

await mkdir(join(out, 'products'), { recursive: true });
await mkdir(join(out, 'anh'), { recursive: true });

const seen = await listing();
const products = [];
const skipped = [];
// --reverse lets a second run work from the other end of the same cache.
const queue = [...seen.keys()].slice(0, limit);
if (args.reverse) queue.reverse();
for (const [index, href] of queue.entries()) {
    const cached = await load(href);
    if (!cached) {
        skipped.push([href, 'không còn trang']);
        continue;
    }
    const product = understand(cached);
    const problem = unpriced(product);
    if (problem) skipped.push([href, problem]);
    else products.push(product);
    if ((index + 1) % 25 === 0)
        console.log(index + 1 + '/' + queue.length, 'đã đọc');
}

nameBrands(products);
for (let i = products.length - 1; i >= 0; i--) {
    const reason = unwanted(products[i]);
    if (!reason) continue;
    skipped.push([products[i].href, reason]);
    products.splice(i, 1);
}

// The importer takes up to 2,000 rows per file; never split one product across files.
// One file with a clashing SKU would be refused whole, so clashes are settled here: a code
// shared by two listings falls back to the page id; the same page listed twice is dropped.
const usedSkus = new Set();
const files = [[]];
let listed = 0;
for (const product of products) {
    let productRows = rows(product);
    if (
        productRows.some((row) => usedSkus.has(row.sku)) &&
        !product.options.length
    )
        productRows = productRows.map((row) => ({
            ...row,
            sku: 'vnb' + product.id,
        }));
    if (productRows.some((row) => usedSkus.has(row.sku))) {
        skipped.push([product.href, 'trùng sản phẩm khác (cùng mã)']);
        continue;
    }
    productRows.forEach((row) => usedSkus.add(row.sku));
    if (files.at(-1).length + productRows.length > 1800) files.push([]);
    files.at(-1).push(...productRows.map(csvLine));
    listed++;
}
// Batches from an earlier run could outnumber this one; never leave a stale file to import.
for (const name of await readdir(out))
    if (/^vnb-vot-cau-long-\d+\.csv$/.test(name)) await unlink(join(out, name));
const written = [];
for (const [number, fileRows] of files.entries()) {
    const name =
        'vnb-vot-cau-long-' + String(number + 1).padStart(2, '0') + '.csv';
    await writeFile(
        join(out, name),
        '\ufeff' + [COLUMNS.join(','), ...fileRows].join('\r\n') + '\r\n',
    );
    written.push(name);
}
await writeFile(
    join(out, 'bo-qua.txt'),
    skipped.map(([href, reason]) => SITE + href + '\t' + reason).join('\n'),
);
const versioned = products.filter(dropsColours).length;
console.log(
    `Xong: ${listed} sản phẩm, ${files.flat().length} dòng SKU, bỏ qua ${skipped.length}. ${versioned} sản phẩm có cả màu lẫn nhiều phiên bản (giữ phiên bản, không tách màu).`,
);
console.log('CSV:', written.map((name) => join(out, name)).join('\n     '));
