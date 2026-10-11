/** What Laravel says about a public page to search engines and link previews (SeoService). */
export type Seo = {
    /** The whole title, site name included. */
    title: string;
    description: string;
    /** The one address the page is known by, on the public site. */
    canonical: string;
    image: string;
    /** False for a page that is not to be found by searching: a search result, sample goods. */
    index: boolean;
    /** schema.org descriptions of what the page shows. */
    jsonLd: Record<string, unknown>[];
};

/** The `seo` prop of a page, when Laravel sent one. */
export const seoOf = (props: Record<string, unknown>): Seo | undefined =>
    props.seo as Seo | undefined;

/**
 * A page's tags for search engines and link previews. React moves `<title>`, `<meta>` and
 * `<link>` into the document's head, in the HTML the server sends and on every page change.
 *
 * They are rendered with the page, not through Next.js' metadata exports: those arrive in a
 * second step after the page, and that second step loses the page's view transition (the
 * card photo growing into the product photo).
 *
 * A page Laravel sends no `seo` for is a visitor's own business (a cart, an account, an admin
 * screen) and is kept out of search engines; so is a page added later, until it says otherwise.
 */
export function SeoHead({ seo, siteName }: { seo?: Seo; siteName: string }) {
    if (!seo) return <meta name="robots" content="noindex, nofollow" />;
    return (
        <>
            <title>{seo.title}</title>
            <meta name="description" content={seo.description} />
            <link rel="canonical" href={seo.canonical} />
            {/* A page kept out of the index still lets its links be followed to those in it. */}
            <meta
                name="robots"
                content={seo.index ? 'index, follow' : 'noindex, follow'}
            />
            <meta property="og:type" content="website" />
            <meta property="og:locale" content="vi_VN" />
            <meta property="og:site_name" content={siteName} />
            <meta property="og:title" content={seo.title} />
            <meta property="og:description" content={seo.description} />
            <meta property="og:url" content={seo.canonical} />
            <meta property="og:image" content={seo.image} />
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={seo.title} />
            <meta name="twitter:description" content={seo.description} />
            <meta name="twitter:image" content={seo.image} />
            {/* What the page shows, said in schema.org terms. Data, not a script to run;
                "<" is written as its escape so no text in it can close the tag. */}
            {seo.jsonLd.map((item, index) => (
                <script
                    key={index}
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify(item).replace(/</g, '\\u003c'),
                    }}
                />
            ))}
        </>
    );
}
