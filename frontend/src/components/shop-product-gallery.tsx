'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef, useState } from 'react';
import { ProductImage } from '@/layouts/shop-layout';

/** A sideways drag at least this long (px) turns to the next photo. */
const SWIPE = 40;

/**
 * A product's photos: one large, the others a tap away as thumbnails, with previous/next
 * buttons and a sideways swipe on touch screens. One photo is shown plain, as before.
 */
export default function ProductGallery({
    images,
    name,
}: {
    images: string[];
    name: string;
}) {
    const [chosen, setChosen] = useState(0);
    const start = useRef<number | null>(null);
    const count = images.length;
    const index = Math.min(chosen, count - 1);
    const turn = (step: number) => setChosen((index + step + count) % count);

    if (count < 2)
        return (
            <div className="store-gallery">
                <div className="store-gallery-stage">
                    <ProductImage src={images[0] ?? ''} name={name} eager />
                </div>
            </div>
        );

    return (
        <div className="store-gallery">
            <div
                className="store-gallery-stage"
                onPointerDown={(event) => {
                    if (event.pointerType !== 'mouse')
                        start.current = event.clientX;
                }}
                onPointerUp={(event) => {
                    const moved =
                        start.current === null
                            ? 0
                            : event.clientX - start.current;
                    start.current = null;
                    if (Math.abs(moved) >= SWIPE) turn(moved < 0 ? 1 : -1);
                }}
                onPointerCancel={() => (start.current = null)}
            >
                <ProductImage
                    src={images[index]}
                    name={name + ', ảnh ' + (index + 1) + ' trên ' + count}
                    eager
                />
                <button
                    type="button"
                    className="store-gallery-turn"
                    data-turn="previous"
                    aria-label="Ảnh trước"
                    onClick={() => turn(-1)}
                >
                    <ChevronLeft size={22} aria-hidden="true" />
                </button>
                <button
                    type="button"
                    className="store-gallery-turn"
                    data-turn="next"
                    aria-label="Ảnh sau"
                    onClick={() => turn(1)}
                >
                    <ChevronRight size={22} aria-hidden="true" />
                </button>
                <span className="store-gallery-count" aria-hidden="true">
                    {index + 1}/{count}
                </span>
            </div>
            <ul className="store-gallery-thumbs" aria-label="Ảnh sản phẩm">
                {images.map((src, position) => (
                    <li key={src}>
                        <button
                            type="button"
                            aria-label={'Xem ảnh ' + (position + 1)}
                            aria-current={position === index}
                            onClick={() => setChosen(position)}
                        >
                            <img
                                src={src}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                width="96"
                                height="96"
                            />
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
