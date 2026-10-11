<?php

namespace App\Services;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Support\Frontend;

/**
 * What search engines and link previews are told about the public pages: a title and a
 * description, the one address a page is known by, a picture, whether it may be indexed, and
 * structured data (schema.org) for what the page really shows. Also the site map and
 * robots.txt. The storefront (Next.js) puts each page's "seo" prop into its <head>.
 *
 * Nothing here is made up to rank better: sample goods are never offered to a search engine,
 * a rating appears only when customers gave one, and nothing is indexed outside the live site.
 *
 * @phpstan-type Seo array{title: string, description: string, canonical: string, image: string, index: bool, jsonLd: list<array<string, mixed>>}
 */
class SeoService
{
    /** A racket's way of playing, as the shop's pages say it. */
    private const STYLES = ['attack' => 'tấn công', 'speed' => 'tốc độ', 'balanced' => 'cân bằng'];

    /** Pages that are a visitor's own business, or not pages at all: not to be crawled. */
    private const PRIVATE_PATHS = [
        '/admin', '/api/', '/account', '/cart', '/checkout', '/orders/', '/service-orders/', '/settings', '/dashboard',
        '/email/', '/support-chat/', '/recommendations', '/events',
    ];

    public function __construct(private ShopSettings $settings) {}

    /** Whether search engines may index this site at all: the live one only (config/shop.php). */
    public function indexable(): bool
    {
        return (bool) config('shop.seo.index');
    }

    /** @return Seo */
    public function home(): array
    {
        $name = $this->name();
        $contact = $this->settings->all();
        $shop = array_filter([
            '@context' => 'https://schema.org',
            // A shop with an address people can come to; otherwise just who runs the site.
            '@type' => $contact['contact_address'] !== '' ? 'SportingGoodsStore' : 'Organization',
            'name' => $name,
            'url' => Frontend::url('/'),
            'telephone' => $contact['hotline'],
            'email' => $contact['contact_email'],
            'address' => $contact['contact_address'],
        ], fn (string $value) => $value !== '');

        return $this->page(
            $name.' — Hiểu cây vợt trước khi chọn',
            'Xem gần từng phần của một cây vợt cầu lông qua mô hình 3D, rồi chọn vợt hợp với lối chơi của bạn.',
            '/',
            jsonLd: [
                [
                    '@context' => 'https://schema.org',
                    '@type' => 'WebSite',
                    'name' => $name,
                    'url' => Frontend::url('/'),
                    'inLanguage' => 'vi',
                    'potentialAction' => [
                        '@type' => 'SearchAction',
                        'target' => Frontend::url('/products').'?q={search_term_string}',
                        'query-input' => 'required name=search_term_string',
                    ],
                ],
                $shop,
            ],
        );
    }

    /**
     * The list of rackets. A brand, a category or a way of playing makes a page of its own;
     * a search, a price band, an order or "in stock only" is the same page looked at another
     * way, and points back at it.
     *
     * @param  array{q: string, category: string, brand: string, style: string, ...}  $filters
     * @return Seo
     */
    public function catalog(array $filters, int $total, int $page, ?Brand $brand, ?Category $category): array
    {
        $subject = ($category !== null ? $category->name : 'Vợt cầu lông').($brand !== null ? ' '.$brand->name : '');
        $style = self::STYLES[$filters['style']] ?? null;
        $title = ($brand === null && $category === null && $style === null ? 'Cửa hàng vợt cầu lông' : $subject)
            .($style !== null ? ' lối chơi '.$style : '')
            .($page > 1 ? ' (trang '.$page.')' : '');
        $query = array_filter([
            'category' => $category?->slug, 'brand' => $brand?->slug, 'style' => $style !== null ? $filters['style'] : null,
            'page' => $page > 1 ? $page : null,
        ]);
        $crumbs = [['Trang chủ', '/'], ['Cửa hàng', '/products']];
        if ($brand !== null) {
            $crumbs[] = [$brand->name, '/products?brand='.$brand->slug];
        }

        return $this->page(
            $title,
            number_format($total, 0, ',', '.').' '.mb_strtolower(mb_substr($subject, 0, 1)).mb_substr($subject, 1)
                .($style !== null ? ' lối chơi '.$style : '').' đang bán tại '.$this->name()
                .': xem giá, thông số từng cây và hàng còn sẵn.',
            '/products'.($query === [] ? '' : '?'.http_build_query($query)),
            // A search result is not a page to land on from a search engine, and neither is an empty list.
            index: $filters['q'] === '' && $total > 0,
            jsonLd: [$this->breadcrumbs($crumbs)],
        );
    }

    /**
     * One racket. Sample goods are shown to visitors but kept out of search engines: they are
     * not for sale, so they are neither indexed nor described as an offer.
     *
     * @param  array{count: int, average: float|null}  $reviews  ReviewService::summary()
     * @return Seo
     */
    public function product(Product $product, array $reviews): array
    {
        $url = '/products/'.$product->slug;
        $image = $this->absolute($product->image_url);
        $description = $this->excerpt((string) $product->description);
        if ($description === '') {
            $description = $product->name.': vợt cầu lông lối chơi '.(self::STYLES[$product->play_style] ?? 'cân bằng').'.';
        }
        $crumbs = [['Trang chủ', '/'], ['Cửa hàng', '/products']];
        if ($product->brand !== null) {
            $crumbs[] = [$product->brand->name, '/products?brand='.$product->brand->slug];
        }
        $crumbs[] = [$product->name, $url];
        $jsonLd = [$this->breadcrumbs($crumbs)];

        $variants = $product->variants->where('is_active', true)->values();
        if (! $product->is_demo && $variants->isNotEmpty()) {
            $availability = 'https://schema.org/'.($variants->contains(fn (ProductVariant $variant) => $variant->stock > 0) ? 'InStock' : 'OutOfStock');
            $prices = $variants->map(fn (ProductVariant $variant): int => (int) $variant->price);
            // One version on sale is one offer; several are a range of prices.
            $only = $variants->count() === 1 ? $variants->first() : null;
            $jsonLd[] = array_filter([
                '@context' => 'https://schema.org',
                '@type' => 'Product',
                'name' => $product->name,
                'description' => $description,
                'image' => array_map($this->absolute(...), $product->relationLoaded('images') ? $product->gallery_urls : [$product->image_url]),
                'sku' => $only?->sku,
                'brand' => $product->brand !== null ? ['@type' => 'Brand', 'name' => $product->brand->name] : null,
                'category' => $product->category?->name,
                'offers' => $only !== null
                    ? ['@type' => 'Offer', 'url' => Frontend::url($url), 'price' => $prices->first(), 'priceCurrency' => 'VND', 'availability' => $availability]
                    : [
                        '@type' => 'AggregateOffer', 'url' => Frontend::url($url), 'lowPrice' => $prices->min(), 'highPrice' => $prices->max(),
                        'offerCount' => $variants->count(), 'priceCurrency' => 'VND', 'availability' => $availability,
                    ],
                // Only what customers who received the racket said; never a rating of the shop's own.
                'aggregateRating' => $reviews['count'] > 0
                    ? ['@type' => 'AggregateRating', 'ratingValue' => $reviews['average'], 'reviewCount' => $reviews['count'], 'bestRating' => 5, 'worstRating' => 1]
                    : null,
            ], fn ($value) => $value !== null);
        }

        return $this->page($product->name, $description, $url, index: ! $product->is_demo, image: $image, jsonLd: $jsonLd);
    }

    /** @return Seo */
    public function advisor(): array
    {
        return $this->page(
            'Gợi ý chọn vợt cầu lông',
            'Chọn ngân sách, lối chơi và trình độ để xem những cây vợt cầu lông hợp với bạn. Gợi ý dựa trên thông số của từng cây vợt đang bán, không dùng AI.',
            '/advisor',
            jsonLd: [$this->breadcrumbs([['Trang chủ', '/'], ['Gợi ý chọn vợt', '/advisor']])],
        );
    }

    /** @return Seo */
    public function services(bool $offered): array
    {
        return $this->page(
            'Dịch vụ đan dây vợt cầu lông',
            'Gửi yêu cầu đan dây trước, mang vợt tới cửa hàng và nhận lại khi đan xong: chọn dây của cửa hàng hoặc mang dây của bạn, chọn mức căng.',
            '/services',
            // Not a page to send people to while the shop takes no requests.
            index: $offered,
            jsonLd: [$this->breadcrumbs([['Trang chủ', '/'], ['Đan dây', '/services']])],
        );
    }

    /**
     * The privacy policy; a draft only admins can open says nothing to search engines.
     *
     * @return Seo
     */
    public function privacy(bool $published): array
    {
        return $this->page(
            'Chính sách quyền riêng tư',
            $this->name().' ghi lại những gì về khách hàng, dùng để làm gì, giữ trong bao lâu, và cách bạn xem, sửa hoặc xóa dữ liệu của mình.',
            '/privacy',
            index: $published,
            jsonLd: [$this->breadcrumbs([['Trang chủ', '/'], ['Chính sách quyền riêng tư', '/privacy']])],
        );
    }

    /**
     * The site map: the public pages, each brand and category with something on sale, and
     * every real racket on sale (never sample goods).
     */
    public function sitemap(): string
    {
        $real = fn ($query) => $query->active()->where('is_demo', false);
        $urls = [['/', null], ['/products', null], ['/advisor', null]];
        if ($this->settings->stringing()['enabled']) {
            $urls[] = ['/services', null];
        }
        if ($this->settings->privacyPublished()) {
            $urls[] = ['/privacy', (string) config('shop.privacy.updated')];
        }
        foreach (Category::query()->whereHas('products', $real)->orderBy('slug')->pluck('slug') as $slug) {
            $urls[] = ['/products?category='.$slug, null];
        }
        foreach (Brand::query()->whereHas('products', $real)->orderBy('slug')->pluck('slug') as $slug) {
            $urls[] = ['/products?brand='.$slug, null];
        }
        $products = Product::query()->where($real)->whereHas('variants', fn ($query) => $query->active())
            ->orderBy('id')->toBase()->get(['slug', 'updated_at']);
        foreach ($products as $product) {
            $urls[] = ['/products/'.$product->slug, substr((string) $product->updated_at, 0, 10)];
        }

        $xml = '<?xml version="1.0" encoding="UTF-8"?>'."\n".'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'."\n";
        foreach ($urls as [$path, $changed]) {
            $xml .= '  <url><loc>'.htmlspecialchars(Frontend::url($path), ENT_XML1).'</loc>'
                .($changed !== null && $changed !== '' ? '<lastmod>'.$changed.'</lastmod>' : '').'</url>'."\n";
        }

        return $xml.'</urlset>'."\n";
    }

    /** robots.txt: everything public on the live site, nothing at all anywhere else. */
    public function robots(): string
    {
        if (! $this->indexable()) {
            return "User-agent: *\nDisallow: /\n";
        }

        return "User-agent: *\n"
            .implode('', array_map(fn (string $path) => 'Disallow: '.$path."\n", self::PRIVATE_PATHS))
            ."\nSitemap: ".Frontend::url('/sitemap.xml')."\n";
    }

    /**
     * @param  list<array<string, mixed>>  $jsonLd
     * @return Seo
     */
    private function page(string $title, string $description, string $path, bool $index = true, ?string $image = null, array $jsonLd = []): array
    {
        return [
            // The same form the pages' own titles have: "Page - Shop".
            'title' => str_starts_with($title, $this->name()) ? $title : $title.' - '.$this->name(),
            'description' => $description,
            'canonical' => Frontend::url($path),
            'image' => $image ?? Frontend::url('/models/hyper-core-poster.png'),
            'index' => $index && $this->indexable(),
            'jsonLd' => $jsonLd,
        ];
    }

    /**
     * @param  list<array{string, string}>  $crumbs  name and path, from the home page down
     * @return array<string, mixed>
     */
    private function breadcrumbs(array $crumbs): array
    {
        return [
            '@context' => 'https://schema.org',
            '@type' => 'BreadcrumbList',
            'itemListElement' => array_map(fn (array $crumb, int $index) => [
                '@type' => 'ListItem', 'position' => $index + 1, 'name' => $crumb[0], 'item' => Frontend::url($crumb[1]),
            ], $crumbs, array_keys($crumbs)),
        ];
    }

    /** The start of a text as one line of at most 160 characters, cut between words. */
    private function excerpt(string $text): string
    {
        $text = trim((string) preg_replace('/\s+/u', ' ', strip_tags($text)));
        if (mb_strlen($text) <= 160) {
            return $text;
        }
        $cut = mb_substr($text, 0, 159);
        $space = mb_strrpos($cut, ' ');

        return rtrim($space !== false && $space > 100 ? mb_substr($cut, 0, $space) : $cut, ' ,;:.').'…';
    }

    /** A picture's address on the public site, whatever host this request came through. */
    private function absolute(string $url): string
    {
        $path = (string) (parse_url($url, PHP_URL_PATH) ?: $url);

        return Frontend::url($path);
    }

    private function name(): string
    {
        return (string) config('app.name');
    }
}
