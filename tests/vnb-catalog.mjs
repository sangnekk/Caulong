// node tests/vnb-catalog.mjs
// The VNB catalog sync without the network: markup shaped like VNB's product pages goes
// through the page reader (scripts/vnb/product.mjs) and the row builder (scripts/vnb/rows.mjs).
import assert from 'node:assert/strict';
import {
    all,
    attr,
    first,
    lines,
    parseHtml,
    text,
} from '../scripts/vnb/html.mjs';
import { PARSER, readProduct } from '../scripts/vnb/product.mjs';
import {
    balanceStyle,
    csvLine,
    dropsColours,
    keptSkus,
    nameBrands,
    readArticle,
    rows,
    understand,
    unpriced,
    unwanted,
} from '../scripts/vnb/rows.mjs';

// --- The HTML reader ---------------------------------------------------------------------

// Inline markup never splits a word or pushes punctuation away; blocks and <br> end a line.
assert.deepEqual(
    lines(
        parseHtml(
            '<div><p><span>Vợt c</span><span>ó thông số 3U tại <strong>ShopVNB</strong>.</span></p>' +
                '<p>Dòng&nbsp;một<br>dòng\u200b hai</p></div>',
        ),
    ),
    ['Vợt có thông số 3U tại ShopVNB.', 'Dòng một', 'dòng hai'],
);
// Older pages write accents as entities; they compose into the same letters as typed ones.
assert.equal(
    text(
        parseHtml(
            '<b>C&acirc;n bằng &amp; &#272;i&#x1EC1;u khiển &ndash; &unknown;</b>',
        ),
    ),
    'Cân bằng & Điều khiển – &unknown;',
);
assert.equal(text(parseHtml('C&acirc;n')), 'Cân'.normalize('NFC'));
// Paragraphs, list items and cells left open are closed by the next one, as in a browser.
const loose = parseHtml(
    '<ul><li>một<li>hai</ul><p>ba<p>bốn<table><tr><td><b>Khóa:</b><td>Giá trị<tr><td>x<td>y</table>',
);
assert.deepEqual(all(loose, 'li').map(text), ['một', 'hai']);
assert.deepEqual(all(loose, 'p').map(text), ['ba', 'bốn']);
assert.deepEqual(
    all(loose, 'tr').map((row) => all(row, 'td').map(text)),
    [
        ['Khóa:', 'Giá trị'],
        ['x', 'y'],
    ],
);
// A stray end tag closes nothing; a script is not markup and not text.
const stray = parseHtml(
    '<div id="a"><p>trong</span></h6></td></section> đoạn</p><script>if (a < b) x = "</p><i class=\'a-stock\'>";</script></div><i>ngoài</i>',
);
assert.equal(text(first(stray, '#a')), 'trong đoạn');
assert.equal(all(stray, '.a-stock').length, 0);
assert.equal(first(stray, 'i').parent.tag, '#root');
// Selectors: tag, class, id, attribute, and "anywhere inside".
const picked = parseHtml(
    '<div class="box big" data-field="x"><a href="/a" class="link">A</a></div><a href="/b">B</a><a>C</a>',
);
assert.deepEqual(all(picked, 'a[href]').map(text), ['A', 'B']);
assert.equal(
    attr(first(picked, 'div.box.big[data-field=x] a.link'), 'href'),
    '/a',
);
assert.equal(first(picked, '.big .missing'), null);
assert.equal(all(picked, '[href*=b]').length, 1);

// --- A page that sells one product -------------------------------------------------------

const single = `<!doctype html><html><head>
<meta property="og:image" content="https://shopvnb.com//uploads/san_pham/og.webp">
<meta itemprop="name" content="Tên ở đầu trang, không phải hãng">
</head><body><div class="product-name"><a href="khac.html">Sản phẩm khác</a></div>
<div class="details-product">
 <div class="swiper-wrapper" id="lightgallery">
  <a class="swiper-slide" href="https://cdn.shopvnb.com/uploads/gallery/1-nitrix_1.webp"><img src="https://cdn.shopvnb.com/uploads/gallery/1-nitrix_1.webp"></a>
  <a class="swiper-slide" href="https://cdn.shopvnb.com/uploads/gallery/2-nitrix_2.webp"><img src="x"></a>
  <a class="swiper-slide" href="https://www.youtube.com/watch?v=abc">video</a>
 </div>
 <h1 class="title-product bk-product-name">Vợt cầu lông Hundred Nitrix 80
   Bullet chính hãng</h1>
 <span itemprop="brand" itemscope><meta itemprop="name" content="Hundred">Thương hiệu: <a href="hundred.html">Hundred</a></span>
 <span class="variant-sku">Mã: <span class="a-sku">VNB029914</span></span>
 <span class="a-stock bk-check-out-of-stock" >Tạm hết hàng</span>
 <form id="add-to-cart-form">
  <input type="hidden" name="sp_id" value="29914" />
  <span class="price product-price"><span style="display: none;" class=" bk-product-price">3799000</span> 3.799.000 ₫</span>
  <span class="old-price">Giá niêm yết: <del class="price product-price-old">4.558.800 ₫</del></span>
  <div class="select-swatch"><div class="swatch clearfix"><div class="header">Chọn size:</div>
   <div class=" swatch-element soldout size-4U" data-value="4U"><input type="radio" name="size" value="4U"><label><span class="ten_size">4U</span></label></div>
   <div class=" swatch-element size-3U" data-value="3U"><input type="radio" name="size" value="3U"><label><span class="ten_size">3U</span></label></div>
  </div></div>
 </form>
 <ul class="tabs"><li data-tab="#tab_gioi_thieu"><span class="h3">Mô tả sản phẩm</span></li></ul>
 <div id="tab_gioi_thieu"><div class="rte"><div class="col-md-12">
  <h3>Vợt cầu lông Hundred Nitrix 80 Bullet - Tốc độ cao</h3>
  <h2><strong><span>1. Giới thiệu về vợt cầu lông Hundred Nitrix 80 Bullet</span></strong></h2>
  <p><span>- <a href="#">Vợt cầu lông Hundred Nitrix 80 Bullet</a> là mẫu vợt ra mắt tháng 8/2026 tại <strong>ShopVNB</strong>.</span></p>
  <p style="text-align:center"><img src="a.webp"><em>Chú thích ảnh</em></p>
  <p>- Thân vợt siêu mảnh 5.9 mm giúp giảm lực cản.</p>
  <h2>2. Thông số kỹ thuật</h2>
  <p>- Thương hiệu: Hundred</p>
  <h2>- Mức căng tối đa: 32 Lbs</h2>
  <p>- Điểm cân bằng: 290mm</p>
  <h2>3. Công nghệ</h2>
  <p><strong>- T Fuse:</strong> gia tăng độ ổn định.</p>
  <p>Tham khảo thêm: các mẫu vợt khác.</p>
 </div><a class="btn btn--view-more" href="#"><span>Xem thêm</span><span>Thu gọn</span></a></div></div>
 <div id="tab_thong_so"><table><tbody>
  <tr><td width="30%" ><b>Độ Cứng Đũa:</b></td><td >Trung Bình</td></tr>
  <tr><td width="30%" ><b>Điểm Cân Bằng:</b></td><td >Nặng Đầu</td></tr>
  <tr><td width="30%" ><b>Trọng Lượng:</b></td><td >4U: 80 - 84g</td></tr>
 </tbody></table></div>
 <script>qty.html('<span class="a-stock">Còn hàng</span>'); price = '<span class="bk-product-price">1</span>';</script>
</div></body></html>`;

const one = readProduct(
    single,
    'vot-cau-long-hundred-nitrix-80-bullet-chinh-hang.html',
);
assert.equal(one.parser, PARSER);
assert.equal(one.slug, 'vot-cau-long-hundred-nitrix-80-bullet-chinh-hang');
assert.equal(one.name, 'Vợt cầu lông Hundred Nitrix 80 Bullet chính hãng');
assert.equal(one.id, '29914');
assert.equal(one.sku, 'VNB029914');
assert.equal(one.brand, 'Hundred');
// The page's own state, not the "Còn hàng" its script holds ready.
assert.equal(one.status, 'Tạm hết hàng');
assert.equal(one.price, 3799000);
assert.equal(one.listPrice, 4558800);
assert.deepEqual(one.images, [
    'https://cdn.shopvnb.com/uploads/gallery/1-nitrix_1.webp',
    'https://cdn.shopvnb.com/uploads/gallery/2-nitrix_2.webp',
]);
assert.equal(one.image, one.images[0]);
assert.deepEqual(one.options, []);
assert.deepEqual(one.sizes, [{ name: '4U', soldOut: true }, { name: '3U' }]);
assert.deepEqual(one.specs, {
    'độ cứng đũa': 'Trung Bình',
    'điểm cân bằng': 'Nặng Đầu',
    'trọng lượng': '4U: 80 - 84g',
});
// The article only: no tab title, no photo caption, no "Xem thêm" button.
assert.deepEqual(one.lines, [
    'Vợt cầu lông Hundred Nitrix 80 Bullet - Tốc độ cao',
    '1. Giới thiệu về vợt cầu lông Hundred Nitrix 80 Bullet',
    '- Vợt cầu lông Hundred Nitrix 80 Bullet là mẫu vợt ra mắt tháng 8/2026 tại ShopVNB.',
    '- Thân vợt siêu mảnh 5.9 mm giúp giảm lực cản.',
    '2. Thông số kỹ thuật',
    '- Thương hiệu: Hundred',
    '- Mức căng tối đa: 32 Lbs',
    '- Điểm cân bằng: 290mm',
    '3. Công nghệ',
    '- T Fuse: gia tăng độ ổn định.',
    'Tham khảo thêm: các mẫu vợt khác.',
]);

const racket = understand(one);
nameBrands([racket]);
racket.imageFile = 'nitrix.webp';
// The introduction is the description; the table's balance point wins over the article's.
assert.equal(
    racket.description,
    'Vợt cầu lông Hundred Nitrix 80 Bullet là mẫu vợt ra mắt tháng 8/2026 tại ShopVNB.\n\n' +
        'Thân vợt siêu mảnh 5.9 mm giúp giảm lực cản.',
);
assert.equal(racket.specs['điểm cân bằng'], 'Nặng Đầu');
assert.equal(racket.specs['mức căng tối đa'], '32 Lbs');
assert.deepEqual(rows(racket), [
    {
        ten_san_pham: 'Vợt cầu lông Hundred Nitrix 80 Bullet chính hãng',
        duong_dan: 'vot-cau-long-hundred-nitrix-80-bullet-chinh-hang',
        hang: 'Hundred',
        danh_muc: 'Vợt cầu lông',
        mo_ta: racket.description,
        loi_choi: 'tấn công',
        trinh_do: '',
        trong_luong: '4U: 80 - 84g',
        diem_can_bang: 'Nặng Đầu',
        do_cung: 'Trung Bình',
        chat_lieu: '',
        suc_cang_toi_da: '32 Lbs',
        anh: 'nitrix.webp',
        ten_phien_ban: 'Tiêu chuẩn',
        sku: 'vnb029914',
        gia: 3799000,
        ton_kho: 0,
        dang_ban: 'có',
    },
]);
assert.equal(unpriced(racket), null);
assert.equal(unwanted(racket), null);

// --- A page that sells several products as one -------------------------------------------

const several = `<div class="details-product">
 <div id="lightgallery"></div>
 <h1 class="title-product ">Cặp Vợt Cầu Lông Kumpoo E30</h1>
 <span class="nhom_sp_html bk-product-name" data-field="ten_sp" style="display: none;">Cặp Vợt Cầu Lông Kumpoo E30 - Hồng Tím - Có bảo hành</span>
 <span itemprop="brand"><meta itemprop="name" content="Kumpoo"></span><span class="a-sku">VNB024912</span>
 <span class="nhom_sp_html" data-field="tinh_trang_con_hang"> <span class="a-stock ">Còn hàng</span> </span>
 <input type="hidden" name="sp_id" value="24737" id="sel_san_pham_id" />
 <span class="price nhom_sp_html" data-field="gia_ban_nhom"><span style="display: none;" class=" bk-product-price">690000</span>690.000 ₫</span>
 <div class="nhom_sp_html" data-field="chon_nhom_san_pham">
  <div class="row_dong" class="c_m"><div class="memory"><div class="m_default"><b>Chọn [Phiên bản]:</b></div><div class="reprelst">
   <bt class="item active nhom__02_phien_ban" onclick="return ChonPhienBan_2('02_phien_ban','5344');"><div class="content"><span><i></i><label class="rname">Có bảo hành<span> </span> </label></span><strong class="price">690.000 ₫</strong></div></bt>
   <bt class="item nhom__02_phien_ban" onclick="return ChonPhienBan_2('02_phien_ban','5345');"><div class="content"><label class="rname">Không bảo hành</label><strong class="price">650.000 ₫</strong></div></bt>
  </div></div></div>
  <div class="row_dong" class="c_m"><div class="memory"><div class="m_default"><b>Chọn [Màu sắc]:</b></div><div class="reprelst">
   <bt class="item active nhom__01_mau" onclick="return ChonPhienBan_2('01_mau','5342');"><img src="https://cdn.shopvnb.com/img/50x50/uploads/gallery/e30-hong.webp" class="img_bien_the"><div class="content"><label class="rname">Hồng Tím</label><strong class="price">690.000 ₫</strong></div></bt>
   <bt class="item nhom__01_mau" onclick="return ChonPhienBan_2('01_mau','5343');"><img src="https://cdn.shopvnb.com/img/50x50/uploads/gallery/e30-xanh.webp" class="img_bien_the"><div class="content"><label class="rname">Xanh</label><strong class="price"></strong></div></bt>
  </div></div></div>
 </div>
 <div class="select-swatch div_chon_size nhom_sp_html" data-field="size_list"><div class="swatch"><div class="header"><b>Chọn [Size]:</b></div>
  <div class="swatch-element soldout size-4U5" data-value="4U5"><label><span class="ten_size">4U5</span></label></div></div></div>
 <div id="tab_gioi_thieu"><div class="col-md-12 " data-field="bai_viet" >
  <p><strong>1. Giới thiệu Cặp Vợt Cầu Lông Kumpoo E30</strong></p>
  <p>- Mẫu vợt giá rẻ, phù hợp lối chơi công thủ toàn diện.</p>
  <p><strong>Xem thêm</strong>: Những mẫu vợt cầu lông mới nhất.</p>
  <p><strong>2. Thông số</strong></p>
  <p>- Sức căng dây: 24 lbs (Tối đa 10.8kg)</p>
 </div></div>
 <div id="tab_thong_so"><table><tr><td><b>Trình Độ Chơi:</b></td><td>Mới Chơi</td></tr></table></div>
</div>
<meta property="og:image" content="https://shopvnb.com//uploads/gallery/e30-hong.webp">`;

const pair = readProduct(several, 'cap-vot-cau-long-kumpoo-e30.html');
assert.equal(pair.name, 'Cặp Vợt Cầu Lông Kumpoo E30');
assert.equal(pair.id, '24737');
assert.equal(pair.status, 'Còn hàng');
assert.equal('listPrice' in pair, false);
// An empty gallery falls back to the share image, on the CDN.
assert.deepEqual(pair.images, [
    'https://cdn.shopvnb.com/uploads/gallery/e30-hong.webp',
]);
// Every group is kept, in page order, with the photo behind each colour swatch.
assert.deepEqual(pair.options, [
    {
        group: '02_phien_ban',
        label: 'Phiên bản',
        id: '5344',
        name: 'Có bảo hành',
        price: 690000,
        selected: true,
    },
    {
        group: '02_phien_ban',
        label: 'Phiên bản',
        id: '5345',
        name: 'Không bảo hành',
        price: 650000,
    },
    {
        group: '01_mau',
        label: 'Màu sắc',
        id: '5342',
        name: 'Hồng Tím',
        price: 690000,
        image: 'https://cdn.shopvnb.com/uploads/gallery/e30-hong.webp',
        selected: true,
    },
    {
        group: '01_mau',
        label: 'Màu sắc',
        id: '5343',
        name: 'Xanh',
        price: null,
        image: 'https://cdn.shopvnb.com/uploads/gallery/e30-xanh.webp',
    },
]);
assert.deepEqual(pair.sizes, [{ name: '4U5', soldOut: true }]);

const cheap = understand(pair);
nameBrands([cheap]);
assert.deepEqual(cheap.groups, ['Phiên bản', 'Màu sắc']);
assert.equal(
    cheap.description,
    'Mẫu vợt giá rẻ, phù hợp lối chơi công thủ toàn diện.',
);
assert.equal(cheap.stated, 'cân bằng');
// The page offers a choice of versions at different prices, so those are the SKUs and the
// colours are not split out: the price of "Xanh, không bảo hành" is not on the page.
assert.equal(dropsColours(cheap), true);
const pairRows = rows(cheap);
assert.deepEqual(
    pairRows.map((row) => [row.ten_phien_ban, row.sku, row.gia]),
    [
        ['Có bảo hành', 'vnb024912-5344', 690000],
        ['Không bảo hành', 'vnb024912-5345', 650000],
    ],
);
// With one version there is nothing to choose but the colour: the colours are the SKUs,
// named with the version as VNB names them. A colour without its own price has the page's.
const coloured = understand({
    ...pair,
    options: pair.options.filter((option) => option.id !== '5345'),
});
assert.equal(dropsColours(coloured), false);
assert.deepEqual(
    rows(coloured).map((row) => [row.ten_phien_ban, row.sku, row.gia]),
    [
        ['Hồng Tím - Có bảo hành', 'vnb024912-5342', 690000],
        ['Xanh - Có bảo hành', 'vnb024912-5343', 690000],
    ],
);
// Colours alone are named as they are; one the page prices at nothing is not for sale.
const colours = pair.options.filter((option) => option.group === '01_mau');
assert.deepEqual(
    rows(understand({ ...pair, price: null, options: colours })).map((row) => [
        row.ten_phien_ban,
        row.sku,
    ]),
    [['Hồng Tím', 'vnb024912-5342']],
);
assert.equal(
    unpriced(
        understand({
            ...pair,
            price: null,
            options: colours.map((option) => ({ ...option, price: 0 })),
        }),
    ),
    'không có giá (liên hệ)',
);
// SKUs are built on the page's code and VNB's option ids: the id in the form (24737) is only
// the product selected today. A page whose SKUs an earlier version built on that id keeps
// them, option by option, when it is read again; an option new to the shop gets the code.
const before = {
    id: '20001',
    sku: 'VNB024912',
    variants: [{ group: '02_phien_ban', id: '5344' }],
};
assert.deepEqual(keptSkus(before), { 5344: 'vnb20001-5344' });
assert.deepEqual(keptSkus(pair), {});
assert.deepEqual(keptSkus({ ...pair, skus: { 1: 'a-1' } }), { 1: 'a-1' });
assert.deepEqual(
    rows(understand({ ...pair, skus: keptSkus(before) })).map((row) => row.sku),
    ['vnb20001-5344', 'vnb024912-5345'],
);
// A code the importer would refuse as a SKU is not built on.
assert.deepEqual(
    rows(understand({ ...pair, sku: 'VNB 24912' })).map((row) => row.sku),
    ['vnb24737-5344', 'vnb24737-5345'],
);
assert.equal(pairRows[0].loi_choi, 'cân bằng');
assert.equal(pairRows[0].trinh_do, 'mới chơi');
assert.equal(pairRows[0].suc_cang_toi_da, '24 lbs (Tối đa 10.8kg)');
// Product columns appear once, on the first row of the product.
assert.deepEqual(Object.keys(pairRows[1]), [
    'ten_san_pham',
    'duong_dan',
    'ten_phien_ban',
    'sku',
    'gia',
    'ton_kho',
    'dang_ban',
]);

// --- Products cached by earlier versions of the script -----------------------------------

// Parser 2, one product: the article's lines, read when rows are built.
const cachedSingle = understand({
    href: 'vot-cau-long-apacs-blend-pro.html',
    slug: 'vot-cau-long-apacs-blend-pro',
    name: 'Vợt cầu lông Apacs Blend Pro',
    id: '111',
    sku: 'VNB000111',
    brand: 'Không',
    price: 1000000,
    groups: [],
    variants: [],
    specs: {},
    description: '',
    lines: [
        'Vợt cầu lông Apacs Blend Pro - Cao thủ cân bằng.',
        '1. Giới thiệu',
        '- Vợt dành cho lối đánh thiên công.',
        '2. Thông số',
        '- Trọng lượng (U): 4U',
        '- Điểm cân bằng: 295mm',
    ],
    parser: 2,
    imageFile: 'vot-cau-long-apacs-blend-pro.webp',
});
assert.equal(cachedSingle.description, 'Vợt dành cho lối đánh thiên công.');
assert.equal(cachedSingle.specs['trọng lượng'], '4U');
// Parser 1, several products: description already read, the first option group as variants.
const cachedSeveral = understand({
    href: 'vot-a.html',
    slug: 'vot-a',
    name: 'Vợt cầu lông Yonex A',
    id: '9',
    sku: 'VNB000009',
    brand: 'Yonex',
    price: 500000,
    groups: ['Màu sắc', 'Size'],
    variants: [
        { group: '01_mau', id: '71', name: 'Đen', price: 500000 },
        { group: '01_mau', id: '72', name: 'Trắng', price: null },
    ],
    specs: { 'phong cách chơi': 'Phản tạt, phòng thủ' },
    description: 'Mô tả đã đọc sẵn.',
});
nameBrands([cachedSingle, cachedSeveral]);
// "Không" is no brand: the name carries one seen on another product, or none at all.
assert.equal(cachedSingle.brandName, '');
assert.equal(cachedSeveral.brandName, 'Yonex');
assert.deepEqual(
    rows(cachedSingle).map((row) => [
        row.sku,
        row.loi_choi,
        row.diem_can_bang,
        row.anh,
    ]),
    [['vnb000111', 'tấn công', '295mm', 'vot-cau-long-apacs-blend-pro.webp']],
);
assert.deepEqual(
    rows(cachedSeveral).map((row) => [
        row.ten_phien_ban,
        row.sku,
        row.gia,
        row.loi_choi,
    ]),
    [
        ['Đen', 'vnb9-71', 500000, 'tốc độ'],
        ['Trắng', 'vnb9-72', 500000, undefined],
    ],
);
assert.equal(rows(cachedSeveral)[0].mo_ta, 'Mô tả đã đọc sẵn.');
assert.deepEqual(cachedSeveral.groups, ['Màu sắc', 'Size']);

// --- Reading an article ------------------------------------------------------------------

// Without numbered headings every line of copy is the description; rows are still specs.
assert.deepEqual(
    readArticle([
        'Vợt nhẹ, dễ đánh.',
        'Chiều dài: 675MM',
        'Xem thêm các mẫu khác',
    ]),
    {
        specs: { 'chiều dài': '675MM' },
        description: 'Vợt nhẹ, dễ đánh.',
        stated: '',
    },
);
// A style stated in the copy counts only when the article does not contradict itself.
assert.equal(
    readArticle(['Đây là cây vợt nặng đầu.', 'Hợp lối chơi tấn công.']).stated,
    'tấn công',
);
assert.equal(
    readArticle(['Đây là cây vợt nặng đầu.', 'Hợp lối đánh phòng thủ.']).stated,
    '',
);
// The description stops at a paragraph rather than run past 3,000 characters.
assert.equal(
    readArticle(['a'.repeat(1600), 'b'.repeat(1300), 'c'.repeat(200)])
        .description.length,
    2902,
);

assert.equal(balanceStyle('Nặng Đầu'), 'tấn công');
assert.equal(balanceStyle('Hơi Nặng Đầu'), 'cân bằng');
assert.equal(balanceStyle('Head Light'), 'tốc độ');
assert.equal(balanceStyle('Head Heavy -[]- Head Light'), '');
assert.equal(balanceStyle('285-290mm'), 'cân bằng');
assert.equal(balanceStyle('280 ± 3mm'), 'tốc độ');
assert.equal(balanceStyle('7 điểm'), '');

// --- What stays out of the CSV -----------------------------------------------------------

const product = (fields) =>
    understand({
        slug: 'x',
        name: 'Vợt cầu lông X',
        id: '1',
        sku: 'VNB1',
        brand: 'X',
        price: 1,
        specs: { 'phong cách chơi': 'Tấn công' },
        ...fields,
    });
assert.equal(unpriced(product({ name: '' })), 'không đọc được tên');
assert.equal(unpriced(product({ price: null })), 'không có giá (liên hệ)');
assert.equal(
    unpriced(
        product({
            price: null,
            options: [{ group: 'a', id: '1', name: 'Đỏ', price: 5 }],
        }),
    ),
    null,
);
assert.equal(unwanted(product({ name: 'Túi cầu lông X' })), 'không phải vợt');
assert.equal(
    unwanted(product({ name: 'Combo vợt X kèm túi' })),
    'combo kèm quà',
);
assert.equal(
    unwanted(product({ name: 'Mua vợt X tặng quấn cán' })),
    'combo kèm quà',
);
assert.equal(unwanted(product({ specs: {} })), 'thiếu thông tin lối chơi');

assert.equal(
    csvLine({
        ten_san_pham: 'Vợt "A", bản mới',
        mo_ta: 'dòng 1\ndòng 2',
        sku: 'a-1',
        gia: 5,
        ton_kho: 0,
    }),
    '"Vợt ""A"", bản mới",,,,"dòng 1\ndòng 2",,,,,,,,,,a-1,5,0,',
);

console.log('vnb-catalog: ok');
