// Reads one VNB product page into plain data: what the page states, nothing derived.
// Deciding what that means for the shop (play style, CSV columns) is rows.mjs, at build time,
// so a better reading of the same facts never needs the page fetched again.
import { all, attr, first, hasClass, lines, parseHtml, text } from './html.mjs';

/** Version of the shape below, stored with each cached product. */
export const PARSER = 3;

const PHOTO = /^https:\/\/cdn\.shopvnb\.com\/[^?#]+\.(?:webp|jpe?g|png)$/i;

const money = (value) => {
    const digits = String(value ?? '').replace(/[^\d]/g, '');
    return digits ? Number(digits) : null;
};

/** Photos of the gallery, largest size, in the order the page shows them. */
function photos(detail, page) {
    const gallery = all(detail, '#lightgallery a[href]')
        .map((link) => attr(link, 'href'))
        .filter((href) => PHOTO.test(href));
    if (gallery.length) return [...new Set(gallery)];
    // No gallery: the share image, which the page links on the shop's host instead of its CDN.
    const shared = attr(first(page, 'meta[property=og:image]'), 'content');
    return shared ? [shared.replace('shopvnb.com//', 'cdn.shopvnb.com/')] : [];
}

/**
 * Option groups of a page that sells several products as one ("Chọn [Màu sắc]"): every
 * option with the price the page shows for it. Prices of combinations across groups come
 * from /ajax/, which robots.txt closes, so they are not read.
 */
function options(detail) {
    const found = [];
    for (const row of all(
        detail,
        '[data-field=chon_nhom_san_pham] .row_dong',
    )) {
        const label =
            text(first(row, 'b')).match(/Chọn \[([^\]]+)\]/)?.[1] ?? '';
        for (const item of all(row, '[onclick*=ChonPhienBan_2]')) {
            const chosen = attr(item, 'onclick').match(
                /ChonPhienBan_2\('([^']+)','(\d+)'\)/,
            );
            if (!chosen) continue;
            // Swatches are thumbnails of a gallery photo: /img/50x50/uploads/… → /uploads/…
            const swatch = attr(first(item, 'img'), 'src');
            found.push({
                group: chosen[1],
                label,
                id: chosen[2],
                name: text(first(item, '.rname')),
                price: money(text(first(item, '.price'))),
                ...(swatch && {
                    image: swatch.replace(/\/img\/\d+x\d+\//, '/'),
                }),
                ...(hasClass(item, 'active') && { selected: true }),
            });
        }
    }
    return found;
}

/** Sizes the page offers ("4U", "3U") and whether VNB has each in stock. */
function sizes(detail) {
    return all(detail, '.select-swatch .swatch-element')
        .map((element) => ({
            name: attr(element, 'data-value') ?? text(element),
            ...(hasClass(element, 'soldout') && { soldOut: true }),
        }))
        .filter((size) => size.name);
}

/** The "Thông số kỹ thuật" table: lower-cased name → value. */
function specTable(detail) {
    const specs = {};
    for (const row of all(detail, '#tab_thong_so tr')) {
        const [name, value] = all(row, 'td').map(text);
        const key = (name ?? '').replace(/\s*:$/, '').toLowerCase();
        if (key && value) specs[key] ??= value;
    }
    return specs;
}

const centred = (node) =>
    /text-align:\s*center/i.test(attr(node, 'style') ?? '');

/**
 * The "Mô tả sản phẩm" article as lines of text. Heading tags are not kept: the pages use
 * them for body copy as often as for headings, and number their real headings ("2. Thông số").
 * Left out: photos and videos with their (centred) captions, and the "Xem thêm" button.
 */
function article(detail) {
    return lines(
        first(detail, '#tab_gioi_thieu'),
        (node) =>
            ['figure', 'iframe', 'video'].includes(node.tag) ||
            hasClass(node, 'btn--view-more') ||
            hasClass(node, 'youtube-placeholder') ||
            (node.tag === 'p' && centred(node)),
    ).slice(0, 400);
}

export function readProduct(html, href) {
    const page = parseHtml(html);
    const detail = first(page, '.details-product') ?? page;
    const images = photos(detail, page);
    const id = attr(first(detail, 'input[name=sp_id]'), 'value') ?? '';
    const listPrice = money(text(first(detail, '.product-price-old')));

    return {
        href,
        slug: href.replace(/\.html$/, ''),
        name: text(first(detail, 'h1.title-product')),
        // On a page of several products this is the one selected when the page opens.
        id: /^\d+$/.test(id) ? id : null,
        sku: text(first(detail, '.a-sku')),
        brand:
            attr(
                first(detail, '[itemprop=brand] meta[itemprop=name]'),
                'content',
            ) ?? text(first(detail, '.a-vendor')),
        status: text(first(detail, '.a-stock')),
        price: money(text(first(detail, '.bk-product-price'))),
        ...(listPrice && { listPrice }),
        image: images[0] ?? null,
        images,
        options: options(detail),
        sizes: sizes(detail),
        specs: specTable(detail),
        lines: article(detail),
        parser: PARSER,
    };
}
