'use client';

import { Link } from '@/lib/page';
import type { MouseEvent } from 'react';
import { DemoBadge, ProductImage } from '@/layouts/shop-layout';
import {
    discount,
    playStyles,
    vnd,
    type Product,
    type ProductCard as Card,
} from '@/types/commerce';

/** The card of a product the page has in full (the grid of the product list). */
export function toCard(product: Product): Card {
    const variants = product.variants.filter((variant) => variant.is_active);
    const cheapest = variants.reduce<(typeof variants)[number] | null>(
        (lowest, variant) =>
            lowest === null || variant.price < lowest.price ? variant : lowest,
        null,
    );
    return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        image_url: product.image_url,
        play_style: product.play_style,
        is_demo: product.is_demo,
        brand: product.brand?.name ?? product.category?.name ?? null,
        price: cheapest?.price ?? null,
        compare_at_price: cheapest?.compare_at_price ?? null,
        in_stock: variants.some((variant) => variant.stock > 0),
    };
}

/** Name only the clicked card's photo, so it alone morphs into the product page photo. */
function heroFrom(event: MouseEvent<Element>) {
    document
        .querySelectorAll<HTMLElement>('.store-product-card .store-image')
        .forEach((figure) => (figure.style.viewTransitionName = ''));
    const figure = event.currentTarget
        .closest('.store-product-card')
        ?.querySelector<HTMLElement>('.store-image');
    if (figure) figure.style.viewTransitionName = 'product-hero';
}

/**
 * One product: photo, brand, name, play style, price and whether it can be bought now. The
 * whole card is its one link. `hero` morphs the photo into the product page's; a page that
 * already shows a product photo (the product page itself) leaves it off.
 */
export function ProductCard({
    card,
    heading: Heading = 'h2',
    hero = false,
}: {
    card: Card;
    heading?: 'h2' | 'h3';
    hero?: boolean;
}) {
    return (
        <article className="store-product-card" data-available={card.in_stock}>
            <ProductImage src={card.image_url} name={card.name} />
            <div className="store-product-meta">
                <span>{card.brand ?? 'Vợt cầu lông'}</span>
                {card.is_demo && <DemoBadge />}
            </div>
            <Heading className="store-card-title">
                {/* The whole card is this one link (see .store-card-link). */}
                <Link
                    href={'/products/' + card.slug}
                    className="store-card-link"
                    prefetch="hover"
                    onClick={hero ? heroFrom : undefined}
                >
                    {card.name}
                </Link>
            </Heading>
            <p>{playStyles[card.play_style]}</p>
            <div className="store-product-price">
                <span className="store-card-price">
                    <strong>
                        {card.price === null
                            ? 'Chưa có giá'
                            : 'Từ ' + vnd(card.price)}
                    </strong>
                    {card.price !== null && card.compare_at_price !== null && (
                        <>
                            <del>
                                <span className="store-sr-only">
                                    Giá niêm yết{' '}
                                </span>
                                {vnd(card.compare_at_price)}
                            </del>
                            <span className="store-discount">
                                {discount(card.price, card.compare_at_price)}
                            </span>
                        </>
                    )}
                </span>
                <span className={card.in_stock ? 'store-stock' : 'store-out'}>
                    {card.in_stock ? 'Còn hàng' : 'Hết hàng'}
                </span>
            </div>
        </article>
    );
}

/**
 * A titled row of product cards; on a narrow screen it scrolls sideways. `pending` draws that
 * many placeholders while the cards are on their way. With neither cards nor placeholders
 * there is no row: an empty list of suggestions is not worth a heading.
 */
export function ProductStrip({
    id,
    title,
    note,
    cards,
    pending = 0,
}: {
    id: string;
    title: string;
    note?: string;
    cards: Card[];
    pending?: number;
}) {
    if (!cards.length && !pending) return null;
    return (
        <section
            className="store-strip"
            aria-labelledby={id}
            aria-busy={!cards.length}
        >
            <header>
                <h2 id={id}>{title}</h2>
                {note && <p>{note}</p>}
            </header>
            <div className="store-strip-track">
                {cards.length
                    ? cards.map((card) => (
                          <ProductCard key={card.id} card={card} heading="h3" />
                      ))
                    : Array.from({ length: pending }, (_, index) => (
                          <div
                              key={index}
                              className="store-card-placeholder"
                              aria-hidden="true"
                          >
                              <span />
                              <span />
                              <span />
                          </div>
                      ))}
            </div>
        </section>
    );
}
