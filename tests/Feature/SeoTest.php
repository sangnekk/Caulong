<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductReview;
use App\Models\User;
use App\Services\ShopSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * What search engines and link previews are told: each public page's title, description,
 * address and structured data, the site map and robots.txt. Nothing made up, nothing private,
 * and nothing at all outside the live site.
 */
class SeoTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // The live site, at its public address.
        config(['shop.seo.index' => true, 'app.frontend_url' => 'https://shop.example', 'app.name' => 'Shop Cầu Lông']);
    }

    /** @param  array<string, mixed>  $attributes */
    private function product(string $name, array $attributes = [], int $price = 900000, int $stock = 3): Product
    {
        $product = Product::create(array_merge([
            'name' => $name, 'slug' => Str::slug($name), 'description' => 'Cây vợt cân bằng cho người mới chơi.',
            'play_style' => 'balanced', 'skill_level' => 'beginner', 'is_active' => true, 'is_demo' => false,
        ], $attributes));
        $product->variants()->create(['sku' => 'SKU-'.$product->id, 'name' => '4U', 'price' => $price, 'stock' => $stock, 'is_active' => true]);

        return $product;
    }

    /** @return array<string, mixed> the page's "seo" prop */
    private function seo(string $url): array
    {
        return $this->get($url)->assertOk()->viewData('page')['props']['seo'];
    }

    /** @return array<string, mixed>|null the structured data of that type on the page */
    private function schema(array $seo, string $type): ?array
    {
        return collect($seo['jsonLd'])->firstWhere('@type', $type);
    }

    public function test_a_racket_is_described_as_what_the_shop_really_sells(): void
    {
        $brand = Brand::create(['name' => 'Apacs', 'slug' => 'apacs']);
        $category = Category::create(['name' => 'Vợt cầu lông', 'slug' => 'vot-cau-long']);
        $racket = $this->product('Apacs Virtus 80', [
            'brand_id' => $brand->id, 'category_id' => $category->id, 'image_path' => 'products/virtus.webp',
            'description' => "Mùa giải 2018/19 chứng kiến sự ra mắt của dòng vợt Virtus.\n\n<b>Khung vợt</b> được thiết kế để giảm lực cản của không khí, cho một cây vợt nhanh hơn và cơ động hơn trong những pha đôi công ở tốc độ cao, phù hợp nhiều lối chơi khác nhau.",
        ]);

        $seo = $this->seo('/products/apacs-virtus-80');
        $this->assertSame('Apacs Virtus 80 - Shop Cầu Lông', $seo['title']);
        $this->assertSame('https://shop.example/products/apacs-virtus-80', $seo['canonical']);
        // The picture on the public site, whichever host the request came through.
        $this->assertSame('https://shop.example/storage/products/virtus.webp', $seo['image']);
        $this->assertTrue($seo['index']);
        // One line of plain text, cut between words.
        $this->assertStringStartsWith('Mùa giải 2018/19 chứng kiến sự ra mắt của dòng vợt Virtus. Khung vợt được thiết kế', $seo['description']);
        $this->assertLessThanOrEqual(160, mb_strlen($seo['description']));
        $this->assertStringEndsWith('…', $seo['description']);
        $this->assertStringNotContainsString('<', $seo['description']);

        $product = $this->schema($seo, 'Product');
        $this->assertSame(['Apacs Virtus 80', $racket->variants()->sole()->sku, ['@type' => 'Brand', 'name' => 'Apacs'], 'Vợt cầu lông'], [
            $product['name'], $product['sku'], $product['brand'], $product['category'],
        ]);
        $this->assertSame(['https://shop.example/storage/products/virtus.webp'], $product['image']);
        $this->assertSame([
            '@type' => 'Offer', 'url' => 'https://shop.example/products/apacs-virtus-80', 'price' => 900000,
            'priceCurrency' => 'VND', 'availability' => 'https://schema.org/InStock',
        ], $product['offers']);
        // Nobody has reviewed it: no rating is claimed.
        $this->assertArrayNotHasKey('aggregateRating', $product);

        $this->assertSame([
            ['Trang chủ', 'https://shop.example/'], ['Cửa hàng', 'https://shop.example/products'],
            ['Apacs', 'https://shop.example/products?brand=apacs'], ['Apacs Virtus 80', 'https://shop.example/products/apacs-virtus-80'],
        ], array_map(fn (array $item) => [$item['name'], $item['item']], $this->schema($seo, 'BreadcrumbList')['itemListElement']));
    }

    public function test_a_rating_is_only_what_customers_published(): void
    {
        $racket = $this->product('Astrox 77');
        foreach ([[5, 'published'], [4, 'published'], [1, 'pending'], [1, 'hidden']] as [$rating, $status]) {
            ProductReview::create(['user_id' => User::factory()->create()->id, 'product_id' => $racket->id, 'rating' => $rating, 'status' => $status]);
        }
        $this->assertSame(
            ['@type' => 'AggregateRating', 'ratingValue' => 4.5, 'reviewCount' => 2, 'bestRating' => 5, 'worstRating' => 1],
            $this->schema($this->seo('/products/astrox-77'), 'Product')['aggregateRating'],
        );
    }

    public function test_versions_at_different_prices_and_a_sold_out_racket(): void
    {
        $racket = $this->product('Nanoflare 700', price: 3200000, stock: 0);
        $racket->variants()->create(['sku' => 'NF-3U', 'name' => '3U', 'price' => 3350000, 'stock' => 0, 'is_active' => true]);
        $racket->variants()->create(['sku' => 'NF-OLD', 'name' => 'Bản cũ', 'price' => 100000, 'stock' => 9, 'is_active' => false]);

        $product = $this->schema($this->seo('/products/nanoflare-700'), 'Product');
        // The versions on sale only; the page says it cannot be bought right now.
        $this->assertSame([
            '@type' => 'AggregateOffer', 'url' => 'https://shop.example/products/nanoflare-700', 'lowPrice' => 3200000, 'highPrice' => 3350000,
            'offerCount' => 2, 'priceCurrency' => 'VND', 'availability' => 'https://schema.org/OutOfStock',
        ], $product['offers']);
        $this->assertArrayNotHasKey('sku', $product);
        // No description of its own: a plain sentence from its data, nothing invented.
        $racket->update(['description' => '']);
        $this->assertSame('Nanoflare 700: vợt cầu lông lối chơi cân bằng.', $this->seo('/products/nanoflare-700')['description']);
    }

    public function test_sample_goods_are_never_offered_to_a_search_engine(): void
    {
        $this->product('Vợt mẫu Minh Họa', ['is_demo' => true]);
        $real = $this->product('Vợt thật');

        $seo = $this->seo('/products/vot-mau-minh-hoa');
        $this->assertFalse($seo['index']);
        $this->assertNull($this->schema($seo, 'Product'));
        $map = $this->get('/sitemap.xml')->assertOk()->getContent();
        $this->assertStringNotContainsString('vot-mau-minh-hoa', $map);
        $this->assertStringContainsString('https://shop.example/products/'.$real->slug, $map);
    }

    public function test_the_list_of_rackets_has_one_address_per_page_worth_finding(): void
    {
        $yonex = Brand::create(['name' => 'Yonex', 'slug' => 'yonex']);
        $category = Category::create(['name' => 'Vợt cầu lông', 'slug' => 'vot-cau-long']);
        foreach (range(1, 26) as $number) {
            $this->product('Astrox '.$number, ['brand_id' => $yonex->id, 'category_id' => $category->id, 'play_style' => 'attack']);
        }
        $this->product('Arcsaber Lẻ');

        $all = $this->seo('/products');
        $this->assertSame(['Cửa hàng vợt cầu lông - Shop Cầu Lông', 'https://shop.example/products', true], [$all['title'], $all['canonical'], $all['index']]);
        $this->assertStringStartsWith('27 vợt cầu lông đang bán tại Shop Cầu Lông', $all['description']);

        // A brand, a category and a way of playing are pages of their own.
        $brand = $this->seo('/products?brand=yonex&style=attack');
        $this->assertSame('Vợt cầu lông Yonex lối chơi tấn công - Shop Cầu Lông', $brand['title']);
        $this->assertSame('https://shop.example/products?brand=yonex&style=attack', $brand['canonical']);
        $this->assertStringStartsWith('26 vợt cầu lông Yonex lối chơi tấn công đang bán', $brand['description']);
        $this->assertSame('Yonex', $this->schema($brand, 'BreadcrumbList')['itemListElement'][2]['name']);

        // An order, a price band or "in stock only" is the same page looked at another way.
        $sorted = $this->seo('/products?brand=yonex&sort=price_asc&price=under-1m&stock=in');
        $this->assertSame('https://shop.example/products?brand=yonex', $sorted['canonical']);
        $this->assertTrue($sorted['index']);

        // The second page is its own page.
        $second = $this->seo('/products?category=vot-cau-long&page=2');
        $this->assertSame(['Vợt cầu lông (trang 2) - Shop Cầu Lông', 'https://shop.example/products?category=vot-cau-long&page=2'], [$second['title'], $second['canonical']]);

        // A search, or a list with nothing in it, is not a page to land on.
        $this->assertFalse($this->seo('/products?q=astrox')['index']);
        $this->assertSame('https://shop.example/products', $this->seo('/products?q=astrox')['canonical']);
        $this->assertFalse($this->seo('/products?style=speed')['index']);
    }

    public function test_the_site_map_lists_what_is_on_sale_and_nothing_else(): void
    {
        $yonex = Brand::create(['name' => 'Yonex', 'slug' => 'yonex']);
        $empty = Brand::create(['name' => 'Hãng Trống', 'slug' => 'hang-trong']);
        $category = Category::create(['name' => 'Vợt cầu lông', 'slug' => 'vot-cau-long']);
        $onSale = $this->product('Astrox 88', ['brand_id' => $yonex->id, 'category_id' => $category->id]);
        $onSale->forceFill(['updated_at' => '2026-10-06 06:44:33'])->saveQuietly();
        $this->product('Vợt đang ẩn', ['is_active' => false, 'brand_id' => $empty->id]);
        $this->product('Vợt không còn phiên bản')->variants()->update(['is_active' => false]);
        $this->product('Vợt hết hàng', stock: 0);

        $response = $this->get('/sitemap.xml')->assertOk()->assertHeader('Content-Type', 'application/xml; charset=UTF-8');
        $map = simplexml_load_string($response->getContent());
        $this->assertNotFalse($map);
        $urls = [];
        foreach ($map->url as $url) {
            $urls[(string) $url->loc] = (string) $url->lastmod;
        }
        $this->assertSame([
            'https://shop.example/', 'https://shop.example/products', 'https://shop.example/advisor', 'https://shop.example/services',
            'https://shop.example/products?category=vot-cau-long', 'https://shop.example/products?brand=yonex',
            'https://shop.example/products/astrox-88', 'https://shop.example/products/vot-het-hang',
        ], array_keys($urls));
        $this->assertSame('2026-10-06', $urls['https://shop.example/products/astrox-88']);

        // The stringing page is listed only while the shop takes requests.
        app(ShopSettings::class)->save(['stringing_enabled' => 0]);
        $this->assertStringNotContainsString('/services', $this->get('/sitemap.xml')->getContent());
        $this->assertFalse($this->seo('/services')['index']);
    }

    public function test_robots_txt_keeps_crawlers_out_of_what_is_private(): void
    {
        $response = $this->get('/robots.txt')->assertOk()->assertHeader('Content-Type', 'text/plain; charset=UTF-8');
        $robots = $response->getContent();
        foreach (['/admin', '/account', '/cart', '/checkout', '/orders/', '/service-orders/', '/api/'] as $path) {
            $this->assertStringContainsString("Disallow: {$path}\n", $robots);
        }
        $this->assertStringNotContainsString("Disallow: /\n", $robots);
        $this->assertStringNotContainsString('Disallow: /products', $robots);
        $this->assertStringContainsString("Sitemap: https://shop.example/sitemap.xml\n", $robots);
        // A crawler is not a visitor: no session is started for it.
        $this->assertSame([], $response->headers->getCookies());
        $this->assertSame([], $this->get('/sitemap.xml')->headers->getCookies());
    }

    public function test_nothing_is_indexed_outside_the_live_site(): void
    {
        config(['shop.seo.index' => false]);
        $this->product('Astrox 88');

        $this->assertSame("User-agent: *\nDisallow: /\n", $this->get('/robots.txt')->getContent());
        foreach (['/', '/products', '/products/astrox-88', '/advisor', '/services'] as $url) {
            $this->assertFalse($this->seo($url)['index'], $url);
        }
        // What the page is stays described: only the permission to index is withheld.
        $this->assertNotNull($this->schema($this->seo('/products/astrox-88'), 'Product'));
    }

    public function test_the_home_page_says_who_the_shop_is_with_what_the_owner_entered(): void
    {
        $home = $this->seo('/');
        $this->assertSame(['Shop Cầu Lông — Hiểu cây vợt trước khi chọn', 'https://shop.example/', true], [$home['title'], $home['canonical'], $home['index']]);
        $this->assertSame('https://shop.example/models/hyper-core-poster.png', $home['image']);
        $this->assertSame('https://shop.example/products?q={search_term_string}', $this->schema($home, 'WebSite')['potentialAction']['target']);
        // No contact details were entered: none are stated.
        $this->assertSame(['@context' => 'https://schema.org', '@type' => 'Organization', 'name' => 'Shop Cầu Lông', 'url' => 'https://shop.example/'], $this->schema($home, 'Organization'));

        app(ShopSettings::class)->save(['hotline' => '0901 234 567', 'contact_address' => '36 Thạch Lam, Tân Phú']);
        $store = $this->schema($this->seo('/'), 'SportingGoodsStore');
        $this->assertSame(['0901 234 567', '36 Thạch Lam, Tân Phú'], [$store['telephone'], $store['address']]);
        $this->assertArrayNotHasKey('email', $store);

        $this->assertSame(['Gợi ý chọn vợt cầu lông - Shop Cầu Lông', 'https://shop.example/advisor'], [$this->seo('/advisor')['title'], $this->seo('/advisor?budget=2000000')['canonical']]);
        $this->assertSame(['Dịch vụ đan dây vợt cầu lông - Shop Cầu Lông', true], [$this->seo('/services')['title'], $this->seo('/services')['index']]);
    }

    public function test_pages_that_are_a_visitors_own_business_say_nothing_to_search_engines(): void
    {
        // No "seo" prop: the storefront marks every such page "noindex".
        foreach (['/cart', '/checkout', '/login', '/register'] as $url) {
            $this->get($url)->assertOk()->assertInertia(fn (Assert $page) => $page->missing('seo'));
        }
        $this->actingAs(User::factory()->create())->get('/account')->assertInertia(fn (Assert $page) => $page->missing('seo'));
    }
}
