// What a cached VNB product means for the shop: its article read into specs and a
// description, its play style, and the rows it becomes in the catalog importer's CSV.
// Works on the cache, so reading a page's facts better never needs the page fetched again.

/** Columns of the importer's CSV (app/Services/CatalogImporter.php), in file order. */
export const COLUMNS = [
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
    'anh_phu',
    'ten_phien_ban',
    'sku',
    'gia',
    'gia_goc',
    'ton_kho',
    'dang_ban',
];

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

// The page's own words, used only when a page states no play-style field and no balance
// point, and only when every such statement agrees: the style it suits ("chơi theo lối công
// thủ toàn diện", "lối đánh thiên công") or the balance it describes ("là cây vợt nặng đầu").
const STATED =
    /(?:lối|phong cách)(?: chơi| đánh)?(?: thiên về| thiên| nghiêng về| thích)?\s+(công thủ toàn diện|toàn diện|công thủ|cân bằng|thiên công|thiên thủ|tấn công (?:và|lẫn) phòng thủ|tấn công|phòng thủ|phản tạt|tốc độ)/gi;
const STATED_BALANCE =
    /vợt (hơi nặng đầu|hơi nhẹ đầu|nặng đầu|nhẹ đầu|cân bằng)/gi;

/** Balance point → play style: words, or millimetres on a 675 mm frame (295+ head-heavy). */
export function balanceStyle(balance) {
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

function join3000(paragraphs) {
    let joined = '';
    for (const paragraph of paragraphs) {
        if ((joined + paragraph).length > 3000) break;
        joined += (joined ? '\n\n' : '') + paragraph;
    }
    return joined;
}

/**
 * An article's lines: numbered section headings ("2. Thông số"), "- Key : value" rows, and
 * copy. With headings the description is section 1, the introduction (a title line above it
 * is not copy); without, every line of copy.
 */
export function readArticle(lines) {
    const specs = {};
    const copy = [];
    let section = 0;
    let numbered = false;
    for (const line of lines) {
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
            copy.push([section, line.replace(/^[-–•+*]\s*/, '')]);
    }
    const text = lines.join('\n');
    const styles = new Set([
        ...[...text.matchAll(STATED)].map(([, words]) =>
            classify(words, STYLES),
        ),
        ...[...text.matchAll(STATED_BALANCE)].map(([, words]) =>
            balanceStyle(words),
        ),
    ]);
    return {
        specs,
        description: join3000(
            copy
                .filter(([at]) => !numbered || at === 1)
                .map(([, line]) => line),
        ),
        stated: styles.size === 1 ? [...styles][0] : '',
    };
}

/**
 * SKUs a page of several products already has in the shop, by option id. Earlier versions of
 * the script built them on the id in the page's form, which is whichever product the page has
 * selected that day; the script carries them along (`skus` in the cache) when it reads such a
 * page again, so they still match. Every other SKU is built on the page's own code
 * ("VNB030143"), which never changes.
 */
export const keptSkus = (product) =>
    product.skus ??
    (product.options
        ? {}
        : Object.fromEntries(
              (product.variants ?? []).map((option) => [
                  option.id,
                  'vnb' + product.id + '-' + option.id,
              ]),
          ));

/**
 * A cached product ready for rows(): article read, options and their groups listed. Entries
 * cached by earlier parsers differ only in shape: the first option group alone, as `variants`,
 * and on pages of several products a description already read instead of the article's lines.
 */
export function understand(product) {
    const read = product.lines ? readArticle(product.lines) : null;
    const options = product.options ?? product.variants ?? [];
    return {
        ...product,
        skus: keptSkus(product),
        options,
        groups: product.groups ?? [
            ...new Set(options.map((option) => option.label)),
        ],
        // A spec table, when the page has one, wins over the article's lines.
        specs: { ...read?.specs, ...product.specs },
        description: product.description || read?.description || '',
        stated: read?.stated ?? '',
    };
}

/** "Không" is VNB's "no brand"; the model name nearly always carries a brand seen elsewhere. */
export function nameBrands(products) {
    const unnamed = /^(không|khác|)$/i;
    const known = [
        ...new Set(
            products
                .map((product) => product.brand)
                .filter((brand) => !unnamed.test(brand ?? '')),
        ),
    ].sort((a, b) => b.length - a.length);
    for (const product of products)
        product.brandName = unnamed.test(product.brand ?? '')
            ? (known.find((brand) =>
                  new RegExp(
                      '(^|\\s)' +
                          brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
                          '(\\s|$)',
                      'i',
                  ).test(product.name),
              ) ?? '')
            : product.brand;
}

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

/**
 * The option groups of a page of several products, in page order: the colours, and the rest
 * (versions: with or without warranty, usually at different prices).
 */
function optionGroups(product) {
    const groups = new Map();
    for (const option of product.options)
        groups.set(option.group, [...(groups.get(option.group) ?? []), option]);
    // Entries cached by earlier parsers have the group's key ("01_mau") but not its label.
    const colours = [...groups.keys()].find(
        (group) =>
            groups.get(group)[0].label === 'Màu sắc' || /(^|_)mau$/.test(group),
    );
    return {
        colours: groups.get(colours) ?? [],
        versions: [...groups.keys()]
            .filter((group) => group !== colours)
            .map((group) => groups.get(group)),
    };
}

/**
 * True when the page offers both colours and a choice of versions: only one of the two can
 * become SKUs, because the price of each combination comes from /ajax/, which is not read.
 */
export const dropsColours = (product) => {
    const { colours, versions } = optionGroups(product);
    return colours.length > 0 && versions.some((group) => group.length > 1);
};

/**
 * What the shop sells of this product, one per SKU. On a page of several products the
 * colours are the SKUs, each named with a version that is not a choice ("Đen - Có bảo
 * hành"), as VNB names them. Where the page does offer a choice of versions, those are the
 * SKUs instead: they carry the price difference. An option the page prices at nothing is not
 * for sale.
 *
 * The page states one list price ("Giá niêm yết"), that of the product it has selected: it
 * goes to that SKU alone, and only where it is above the price.
 */
function variants(product) {
    const { colours, versions } = optionGroups(product);
    const chosen =
        versions.find((group) => group.length > 1) ??
        (colours.length ? colours : versions[0]);
    const listed = (price, selected) =>
        selected && price === product.price && product.listPrice > price
            ? product.listPrice
            : '';
    if (!chosen)
        return [
            {
                name: 'Tiêu chuẩn',
                sku: (product.sku || 'vnb' + product.id).toLowerCase(),
                price: product.price,
                list: listed(product.price, true),
            },
        ].filter((variant) => variant.price);
    const fixed =
        chosen === colours ? versions.map((group) => group[0].name) : [];
    const code = /^[\w.-]+$/.test(product.sku ?? '')
        ? product.sku.toLowerCase()
        : 'vnb' + product.id;
    return chosen
        .map((option) => ({
            name: [option.name, ...fixed].join(' - '),
            sku: product.skus[option.id] ?? code + '-' + option.id,
            price: option.price || product.price,
            list: listed(option.price || product.price, option.selected),
        }))
        .filter((variant) => variant.price);
}

/** Importer rows of an understood product: product columns on its first row only. */
export function rows(product) {
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
    // style the article states in its copy.
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
    const slug = product.slug.replace(/^-+|-+$/g, '');
    const fields = {
        ten_san_pham: product.name,
        duong_dan: slug,
        hang: product.brandName ?? product.brand,
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
        anh_phu: (product.galleryFiles ?? []).join(' | '),
    };
    return variants(product).map((variant, index) => ({
        ...(index === 0
            ? fields
            : { ten_san_pham: product.name, duong_dan: slug }),
        ten_phien_ban: variant.name.slice(0, 120),
        sku: variant.sku,
        gia: variant.price,
        gia_goc: variant.list,
        ton_kho: 0,
        dang_ban: 'có',
    }));
}

/** Why a product cannot be priced at all, or null. */
export const unpriced = (product) =>
    !product.name
        ? 'không đọc được tên'
        : !variants(product).length
          ? 'không có giá (liên hệ)'
          : null;

/**
 * Why the shop does not take a product, or null. Only single rackets it can describe:
 * bundles with gifts and non-racket items stay out, and a racket with no play-style
 * information is listed for the shop rather than guessed.
 */
export const unwanted = (product) =>
    !/vợt/i.test(product.name)
        ? 'không phải vợt'
        : /^combo|tặng/i.test(product.name)
          ? 'combo kèm quà'
          : !rows(product)[0].loi_choi
            ? 'thiếu thông tin lối chơi'
            : null;

const cell = (value) => {
    const string = String(value ?? '');
    return /[",\r\n]/.test(string)
        ? '"' + string.replace(/"/g, '""') + '"'
        : string;
};

export const csvLine = (row) =>
    COLUMNS.map((column) => cell(row[column])).join(',');
