// Crawls VNB's badminton racket catalog (used by Shop Cầu Lông with VNB's permission) into the
// catalog importer's CSV format plus a folder of product photos.
//
//   node scripts/vnb-catalog.mjs [--out=storage/app/private/vnb] [--limit=N] [--brands=yonex,lining] [--refresh]
//   php artisan shop:import-catalog storage/app/private/vnb/vnb-vot-cau-long-01.csv --images=storage/app/private/vnb/anh
//   (one command per numbered CSV)
//
// Polite by design: one request at a time with a pause, no /ajax/ (robots.txt), cached per
// product so a rerun only fetches what is new (--refresh refetches). Stock is always 0: VNB
// does not publish counts and the shop enters its own. To refresh prices later, rerun this
// and import with --keep-stock so counts entered by the shop are not reset.
import {
    access,
    mkdir,
    readdir,
    readFile,
    unlink,
    writeFile,
} from 'node:fs/promises';
import { join, resolve } from 'node:path';

const SITE = 'https://shopvnb.com/';
const USER_AGENT = 'ShopCauLong-catalog-sync/1.0 (with permission from VNB)';
const PAUSE_MS = 450;
// Version 2 reads the older "Mô tả sản phẩm" tab (also used under a newer spec table); a page
// cached before it with no description is fetched again.
const PARSER = 2;
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

const ENTITIES = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    ndash: '–',
    mdash: '—',
    rsquo: '’',
    lsquo: '‘',
    rdquo: '”',
    ldquo: '“',
    hellip: '…',
    deg: '°',
    times: '×',
};
// Older pages name accented letters ("C&acirc;n bằng"): the letter plus a combining accent.
const ACCENTS = {
    grave: '̀',
    acute: '́',
    circ: '̂',
    tilde: '̃',
    uml: '̈',
    ring: '̊',
    cedil: '̧',
};
const decode = (text) =>
    text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code) => {
        if (code[0] === '#')
            return String.fromCodePoint(
                code[1].toLowerCase() === 'x'
                    ? parseInt(code.slice(2), 16)
                    : Number(code.slice(1)),
            );
        const accented = code.match(
            /^([a-z])(grave|acute|circ|tilde|uml|ring|cedil)$/i,
        );
        return accented
            ? (accented[1] + ACCENTS[accented[2].toLowerCase()]).normalize(
                  'NFC',
              )
            : (ENTITIES[code.toLowerCase()] ?? match);
    });
const text = (html) =>
    decode(html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' '))
        .normalize('NFC')
        .replace(/[​ \s]+/g, ' ')
        .trim();
/** Block markup as plain lines: older pages keep their copy as loose lines, not structure. */
const lines = (html) =>
    html
        // Centred paragraphs hold photos, videos and their captions, not copy.
        .replace(/<(script|style|figure|iframe)\b[\s\S]*?<\/\1>/gi, '\n')
        .replace(/<p\b[^>]*text-align:\s*center[^>]*>[\s\S]*?<\/p>/gi, '\n')
        .split(/<br\s*\/?>|<\/?(?:div|p|li|h[1-6]|tr|ul|ol|table)\b[^>]*>/i)
        .map(text)
        .filter(Boolean)
        .slice(0, 400);
const money = (value) => {
    const digits = String(value ?? '').replace(/[^\d]/g, '');
    return digits ? Number(digits) : null;
};

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

async function productLinks(category) {
    const links = [];
    for (let page = 1; page < 100; page++) {
        const html = await get(category + (page > 1 ? '?page=' + page : ''));
        const found = [
            ...(html ?? '').matchAll(
                /class="product-name"><a href="([a-z0-9-]+\.html)"/g,
            ),
        ].map(([, href]) => href);
        const fresh = found.filter((href) => !links.includes(href));
        if (!fresh.length) break;
        links.push(...fresh);
    }
    return links;
}

function parse(html, href) {
    const detail = html.slice(
        Math.max(0, html.search(/<div[^>]*class="details-product"/)),
    );
    const pick = (pattern, source = detail) => source.match(pattern)?.[1];
    const specs = {};
    const table =
        pick(/id="tab_thong_so"[\s\S]*?<table[^>]*>([\s\S]*?)<\/table>/) ?? '';
    for (const [, key, value] of table.matchAll(
        /<td[^>]*>\s*<b>([^<]+?):?\s*<\/b>\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/g,
    ))
        specs[text(key).replace(/:$/, '').toLowerCase()] = text(value);

    // Article: intro paragraphs as plain text; the "- Key: value" list fills gaps in the table.
    const start = detail.indexOf('data-field="bai_viet"');
    const end = detail.indexOf('id="tab_thong_so"', start);
    const article =
        start < 0 ? '' : detail.slice(start, end < 0 ? undefined : end);
    const paragraphs = [];
    let section = 0;
    for (const [, tag, attributes, inner] of article.matchAll(
        /<(h[1-6]|p|li)\b([^>]*)>([\s\S]*?)<\/\1>/g,
    )) {
        const line = text(inner);
        if (/^h/i.test(tag)) section++;
        // Centred paragraphs hold photos, videos and their captions, not copy.
        if (
            !line ||
            /text-align:\s*center/i.test(attributes) ||
            /youtube-placeholder/.test(inner)
        )
            continue;
        const listed =
            section >= 2 && line.match(/^[-•]\s*([^:]{2,40}):\s*(.+)$/);
        if (listed) {
            specs[listed[1].trim().toLowerCase()] ??= listed[2].trim();
            continue;
        }
        if (section <= 1 && !/^h/i.test(tag))
            paragraphs.push(line.replace(/^[-•]\s*/, ''));
    }
    const description = join3000(paragraphs);
    // Older pages have neither: one "Mô tả sản phẩm" tab of loose lines. They are cached as
    // lines and read at build time (readLines), so reading them better needs no refetch.
    let loose;
    if (start < 0) {
        const tab = detail.indexOf('id="tab_gioi_thieu"');
        const from = detail.indexOf('>', tab) + 1;
        // Up to the "Xem thêm" button that closes the tab, cut before its tag opens.
        const to = detail.lastIndexOf(
            '<',
            detail.indexOf('btn--view-more', from),
        );
        if (tab >= 0)
            loose = lines(detail.slice(from, to < from ? from + 60000 : to));
    }

    const choices =
        pick(/data-field="chon_nhom_san_pham"[^>]*>([\s\S]*?)<\/form>/) ?? '';
    const groups = [...choices.matchAll(/Chọn \[([^\]]+)\]/g)].map(
        ([, label]) => text(label),
    );
    const options = [
        ...choices.matchAll(
            /ChonPhienBan_2\('([^']+)','(\d+)'\)[\s\S]*?<label class="rname">([\s\S]*?)<\/label>[\s\S]*?<strong class="price">([^<]*)<\/strong>/g,
        ),
    ].map(([, group, id, label, price]) => ({
        group,
        id,
        name: text(label),
        price: money(price),
    }));
    const firstGroup = options[0]?.group;

    return {
        href,
        slug: href.replace(/\.html$/, ''),
        name: text(
            pick(/<h1 class="title-product[^"]*">([\s\S]*?)<\/h1>/) ?? '',
        ),
        id: pick(/name="sp_id" value="(\d+)"/) ?? null,
        sku: text(pick(/class="a-sku">([^<]*)</) ?? ''),
        brand: text(pick(/itemprop="name" content="([^"]+)"/) ?? ''),
        status: text(pick(/class="a-stock[^"]*">([^<]*)</) ?? ''),
        price: money(pick(/bk-product-price">(\d+)</)),
        image:
            pick(
                /id="lightgallery"[\s\S]*?href="(https:\/\/cdn\.shopvnb\.com\/[^"]+\.(?:webp|jpe?g|png))"/i,
            ) ??
            pick(/property="og:image" content="([^"]+)"/, html)?.replace(
                'shopvnb.com//',
                'cdn.shopvnb.com/',
            ),
        groups,
        // Several option groups (e.g. colour and weight) combine server-side; keep the first.
        variants: options.filter((option) => option.group === firstGroup),
        specs,
        description,
        lines: loose,
        parser: PARSER,
    };
}

function join3000(paragraphs) {
    let joined = '';
    for (const paragraph of paragraphs) {
        if ((joined + paragraph).length > 3000) break;
        joined += (joined ? '\n\n' : '') + paragraph;
    }
    return joined;
}

// The page's own words, used only when a page states no play-style field and no balance
// point, and only when every such statement agrees: the style it suits ("chơi theo lối công
// thủ toàn diện", "lối đánh thiên công") or the balance it describes ("là cây vợt nặng đầu").
const STATED =
    /(?:lối|phong cách)(?: chơi| đánh)?(?: thiên về| thiên| nghiêng về| thích)?\s+(công thủ toàn diện|toàn diện|công thủ|cân bằng|thiên công|thiên thủ|tấn công (?:và|lẫn) phòng thủ|tấn công|phòng thủ|phản tạt|tốc độ)/gi;
const STATED_BALANCE =
    /vợt (hơi nặng đầu|hơi nhẹ đầu|nặng đầu|nhẹ đầu|cân bằng)/gi;

/** An older page's lines: "2. Thông số" style headings, "- Key : value" rows, intro copy. */
function readLines(pageLines) {
    const specs = {};
    const intro = [];
    let section = 0;
    let numbered = false;
    for (const line of pageLines) {
        const heading = line.match(/^(\d{1,2})[.)]\s+\S/);
        if (heading) {
            numbered = true;
            section = Number(heading[1]);
            continue;
        }
        const row = line.match(/^[-–•+*]?\s*([^:\d][^:]{1,39}?)\s*:\s*(.*)$/);
        if (row) {
            const key = row[1]
                .replace(/\([^)]*\)/g, '')
                .replace(/\s+/g, ' ')
                .trim()
                .toLowerCase();
            if (row[2]) specs[key] ??= row[2];
            continue;
        }
        if (!/^(xem|khám phá|tham khảo) thêm/i.test(line))
            intro.push([section, line.replace(/^[-–•+*]\s*/, '')]);
    }
    const copy = pageLines.join('\n');
    const styles = new Set([
        ...[...copy.matchAll(STATED)].map(([, words]) =>
            classify(words, STYLES),
        ),
        ...[...copy.matchAll(STATED_BALANCE)].map(([, words]) =>
            balanceStyle(words),
        ),
    ]);
    return {
        specs,
        // With numbered headings the introduction is section 1; without, every copy line.
        description: join3000(
            intro
                .filter(([at]) => !numbered || at === 1)
                .map(([, line]) => line),
        ),
        stated: styles.size === 1 ? [...styles][0] : '',
    };
}

const STYLES = [
    [/tấn công (?:và|lẫn) phòng thủ|công (?:và|lẫn) thủ/i, 'cân bằng'],
    [/tấn công|thiên công/i, 'tấn công'],
    [/phòng thủ|thiên thủ|phản tạt|tốc độ|nhanh/i, 'tốc độ'],
    [/công thủ|toàn diện|cân bằng/i, 'cân bằng'],
];
const LEVELS = [
    [/mới chơi|mới tập|người mới|cơ bản/i, 'mới chơi'],
    [/trung bình khá|trung bình/i, 'trung bình'],
    [/khá|nâng cao|chuyên nghiệp|thi đấu|tốt/i, 'nâng cao'],
];
const classify = (value, table) =>
    (value ? table.find(([pattern]) => pattern.test(value))?.[1] : undefined) ??
    '';
const spec = (specs, ...keys) =>
    keys.map((key) => specs[key]).find(Boolean) ?? '';
const SUMMARY = [
    'trình độ chơi',
    'phong cách chơi',
    'nội dung chơi',
    'độ cứng đũa',
    'điểm cân bằng',
    'trọng lượng',
    'chiều dài vợt',
];
/** Lead-ins for media the copy no longer carries ("…mời các bạn xem video:"), empty "Key:" rows. */
const tidy = (description) =>
    description
        .split('\n\n')
        .filter(
            (paragraph) =>
                !/video.*:\s*$/i.test(paragraph) &&
                !/^[^.:]{2,40}:\s*$/.test(paragraph),
        )
        .join('\n\n');
/** No article on the source page: restate its spec table instead of leaving the copy empty. */
const summary = (product) =>
    [
        product.name + '.',
        ...SUMMARY.filter((key) => product.specs[key]).map(
            (key) =>
                key[0].toUpperCase() +
                key.slice(1) +
                ': ' +
                product.specs[key] +
                '.',
        ),
    ].join('\n');

/** Balance point → play style: words, or millimetres on a 675 mm frame (295+ head-heavy). */
function balanceStyle(balance) {
    if (/nặng đầu/i.test(balance) && !/hơi/i.test(balance)) return 'tấn công';
    if (/nhẹ đầu/i.test(balance)) return 'tốc độ';
    if (/cân bằng|hơi nặng đầu/i.test(balance)) return 'cân bằng';
    // English, unless the value is a drawn scale naming both ends ("Head Heavy -[]- Head Light").
    const heavy = /head[\s-]*heavy/i.test(balance);
    const light = /head[\s-]*light/i.test(balance);
    const even = /\beven\b/i.test(balance);
    if (heavy + light + even === 1)
        return heavy
            ? /slightly/i.test(balance)
                ? 'cân bằng'
                : 'tấn công'
            : light
              ? 'tốc độ'
              : 'cân bằng';
    // "290 ± 3mm", "295mm": the first plausible figure; "285-290mm": the middle of the range.
    const figure = '(?<!\\d)(2[5-9]\\d|3[0-4]\\d)(?!\\d)';
    const range = balance.match(new RegExp(figure + '\\s*[-–~]\\s*' + figure));
    const millimetres = !/mm/i.test(balance)
        ? 0
        : range
          ? (Number(range[1]) + Number(range[2])) / 2
          : Number(balance.match(new RegExp(figure))?.[1] ?? 0);
    if (!millimetres) return '';
    return millimetres >= 295
        ? 'tấn công'
        : millimetres <= 285
          ? 'tốc độ'
          : 'cân bằng';
}

function rows(product) {
    const { specs } = product;
    const balance = spec(
        specs,
        'điểm cân bằng',
        'điểm cân bằng vợt',
        'cân bằng',
        'độ cân bằng',
        'điểm nặng đầu',
        'balance',
    );
    // Play style from VNB's own field; then the balance point it is usually based on; then a
    // style the page states in its copy (older pages only).
    const style =
        classify(spec(specs, 'phong cách chơi', 'lối chơi'), STYLES) ||
        balanceStyle(balance) ||
        (product.stated ?? '');
    const frame = spec(
        specs,
        'khung vợt',
        'chất liệu khung',
        'công nghệ khung',
        'frame',
    );
    const shaft = spec(
        specs,
        'thân vợt',
        'đũa vợt',
        'chất liệu thân',
        'chất liệu đũa',
        'công nghệ thân',
        'shaft',
    );
    const product_fields = {
        ten_san_pham: product.name,
        duong_dan: product.slug.replace(/^-+|-+$/g, ''),
        hang: product.brandName,
        danh_muc: 'Vợt cầu lông',
        mo_ta: tidy(product.description) || summary(product),
        loi_choi: style,
        trinh_do: classify(spec(specs, 'trình độ chơi'), LEVELS),
        trong_luong: spec(specs, 'trọng lượng', 'weight').slice(0, 200),
        diem_can_bang: balance.slice(0, 200),
        do_cung: spec(specs, 'độ cứng đũa', 'độ cứng', 'độ dẻo', 'flex').slice(
            0,
            200,
        ),
        chat_lieu: (
            [frame && 'Khung: ' + frame, shaft && 'Thân: ' + shaft]
                .filter(Boolean)
                .join(' · ') || spec(specs, 'chất liệu', 'cấu tạo vợt')
        ).slice(0, 200),
        suc_cang_toi_da: spec(
            specs,
            'sức căng tối đa',
            'mức căng tối đa',
            'mức căng max',
            'mức căng dây khuyến nghị',
            'mức căng dây khuyên dùng',
            'mức căng dây',
            'sức căng dây',
            'sức căng vợt',
            'mức căng',
            'sức căng',
            'tension',
        ).slice(0, 200),
        anh: product.imageFile ?? '',
    };
    const variants = product.variants.length
        ? product.variants.map((variant) => ({
              name: variant.name,
              sku: 'vnb' + product.id + '-' + variant.id,
              price: variant.price ?? product.price,
          }))
        : [
              {
                  name: 'Tiêu chuẩn',
                  sku: (product.sku || 'vnb' + product.id).toLowerCase(),
                  price: product.price,
              },
          ];
    return variants.map((variant, index) => ({
        ...(index === 0
            ? product_fields
            : {
                  ten_san_pham: product.name,
                  duong_dan: product_fields.duong_dan,
              }),
        ten_phien_ban: variant.name.slice(0, 120),
        sku: variant.sku,
        gia: variant.price,
        ton_kho: 0,
        dang_ban: 'có',
    }));
}

const COLUMNS = [
    'ten_san_pham',
    'duong_dan',
    'hang',
    'danh_muc',
    'mo_ta',
    'loi_choi',
    'trinh_do',
    'trong_luong',
    'diem_can_bang',
    'do_cung',
    'chat_lieu',
    'suc_cang_toi_da',
    'anh',
    'ten_phien_ban',
    'sku',
    'gia',
    'ton_kho',
    'dang_ban',
];
const cell = (value) => {
    const string = String(value ?? '');
    return /[",\r\n]/.test(string)
        ? '"' + string.replace(/"/g, '""') + '"'
        : string;
};

await mkdir(join(out, 'products'), { recursive: true });
await mkdir(join(out, 'anh'), { recursive: true });
// The listing is cached too, so rebuilding the CSV needs no request (--relist refreshes it).
const linksFile = join(out, 'links.json');
const seen = new Map(
    !args.relist && !args.refresh && (await exists(linksFile))
        ? JSON.parse(await readFile(linksFile, 'utf8'))
        : [],
);
if (!seen.size) {
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
        await writeFile(linksFile, JSON.stringify([...seen]));
}

const products = [];
const skipped = [];
let index = 0;
// --reverse lets a second run work from the other end of the same cache.
const queue = [...seen.keys()].slice(0, limit);
if (args.reverse) queue.reverse();
for (const href of queue) {
    index++;
    const cache = join(out, 'products', href.replace(/\.html$/, '.json'));
    // Pages cached before text was normalised may spell "Vợt" with combining marks.
    let product =
        !args.refresh && (await exists(cache))
            ? JSON.parse((await readFile(cache, 'utf8')).normalize('NFC'))
            : null;
    if (product && (product.parser ?? 1) < PARSER && !product.description)
        product = null;
    if (!product) {
        const html = await get(SITE + href);
        if (!html) {
            skipped.push([href, 'không còn trang']);
            continue;
        }
        product = parse(html, href);
        if (product.image) {
            const extension = product.image
                .match(/\.(webp|jpe?g|png)$/i)[1]
                .toLowerCase();
            const file = product.slug + '.' + extension;
            if (!(await exists(join(out, 'anh', file)))) {
                const bytes = await get(product.image, 'bytes');
                if (bytes) await writeFile(join(out, 'anh', file), bytes);
            }
            if (await exists(join(out, 'anh', file))) product.imageFile = file;
        }
        await writeFile(cache, JSON.stringify(product, null, 1));
    }
    if (product.lines) {
        const read = readLines(product.lines);
        // A spec table, when the page has one, wins over loose lines.
        product.specs = { ...read.specs, ...product.specs };
        product.description ||= read.description;
        product.stated = read.stated;
    }
    const problem = !product.name
        ? 'không đọc được tên'
        : !product.price && !product.variants.some((variant) => variant.price)
          ? 'không có giá (liên hệ)'
          : null;
    if (problem) skipped.push([href, problem]);
    else products.push(product);
    if (index % 25 === 0)
        console.log(index + '/' + Math.min(seen.size, limit), 'đã đọc');
}

// "Không" is VNB's "no brand"; the model name nearly always carries a brand seen elsewhere.
const knownBrands = [
    ...new Set(
        products
            .map((product) => product.brand)
            .filter((brand) => brand && !/^(không|khác)$/i.test(brand)),
    ),
].sort((a, b) => b.length - a.length);
for (const product of products)
    product.brandName = /^(không|khác|)$/i.test(product.brand)
        ? (knownBrands.find((brand) =>
              new RegExp(
                  '(^|\\s)' +
                      brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
                      '(\\s|$)',
                  'i',
              ).test(product.name),
          ) ?? '')
        : product.brand;

// Only single rackets the shop can describe: bundles with gifts and non-racket items stay out,
// and a racket with no play-style information is listed for the shop rather than guessed.
for (let i = products.length - 1; i >= 0; i--) {
    const product = products[i];
    const reason = !/vợt/i.test(product.name)
        ? 'không phải vợt'
        : /^combo|tặng/i.test(product.name)
          ? 'combo kèm quà'
          : !rows(product)[0].loi_choi
            ? 'thiếu thông tin lối chơi'
            : null;
    if (reason) {
        skipped.push([product.href, reason]);
        products.splice(i, 1);
    }
}

// The importer takes up to 2,000 rows per file; never split one product across files.
// One file with a clashing SKU would be refused whole, so clashes are settled here: a code
// shared by two listings falls back to the page id; the same page listed twice is dropped.
const usedSkus = new Set();
const files = [[]];
for (const product of products) {
    let productRows = rows(product);
    if (
        productRows.some((row) => usedSkus.has(row.sku)) &&
        !product.variants.length
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
    productRows = productRows.map((row) =>
        COLUMNS.map((column) => cell(row[column])).join(','),
    );
    if (files.at(-1).length + productRows.length > 1800) files.push([]);
    files.at(-1).push(...productRows);
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
        '﻿' + [COLUMNS.join(','), ...fileRows].join('\r\n') + '\r\n',
    );
    written.push(name);
}
await writeFile(
    join(out, 'bo-qua.txt'),
    skipped.map(([href, reason]) => SITE + href + '\t' + reason).join('\n'),
);
const multiGroup = products.filter(
    (product) => product.groups.length > 1,
).length;
console.log(
    `Xong: ${products.length} sản phẩm, ${files.flat().length} dòng SKU, bỏ qua ${skipped.length}. ${multiGroup} sản phẩm có nhiều nhóm tùy chọn (giữ nhóm đầu).`,
);
console.log('CSV:', written.map((name) => join(out, name)).join('\n     '));
