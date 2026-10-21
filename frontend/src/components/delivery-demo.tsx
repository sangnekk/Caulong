'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Bike, Heart } from 'lucide-react';
import {
    DeliveryJourney,
    DeliveryStagePicker,
} from '@/components/delivery-journey';
import type { DeliveryStage } from '@/lib/delivery-scene';

export default function DeliveryDemo() {
    const [stage, setStage] = useState<DeliveryStage>('packing');
    const [selection, setSelection] = useState(0);
    const selectStage = (next: DeliveryStage) => {
        setStage(next);
        setSelection((value) => value + 1);
    };

    return (
        <div className="delivery-demo">
            <header className="delivery-header">
                <Link
                    href="/products"
                    className="delivery-brand"
                    aria-label="Shop Cầu Lông, về cửa hàng"
                >
                    <span className="delivery-brand-mark">
                        <Bike size={23} strokeWidth={1.8} />
                    </span>
                    <span>
                        shop<span className="delivery-brand-dot">.</span>cầu
                        lông
                    </span>
                </Link>
                <Link href="/products" className="delivery-back">
                    <ArrowLeft size={16} /> Về cửa hàng
                </Link>
            </header>

            <main className="delivery-main">
                <div className="delivery-intro">
                    <div>
                        <p className="delivery-kicker">
                            <Heart size={15} /> Giao một chiếc vợt, gửi một niềm
                            vui
                        </p>
                        <h1>
                            Một chút nữa,
                            <br />
                            <span>vợt xinh tới rồi.</span>
                        </h1>
                        <p className="delivery-lead">
                            Có một người bạn nhỏ đang mang niềm vui đến tận cửa
                            nhà bạn.
                        </p>
                    </div>
                    <DeliveryStagePicker stage={stage} onChange={selectStage} />
                </div>

                <DeliveryJourney
                    key={selection}
                    stage={stage}
                    isDemo
                    onStageChange={setStage}
                    onSelectStage={selectStage}
                />

                <footer className="delivery-footer">
                    <p>Chọn một mốc để xem nhanh từ gói ghém đến chặng đó.</p>
                    <Link href="/products">
                        Chọn người bạn ra sân <ArrowUpRight size={15} />
                    </Link>
                </footer>
            </main>
        </div>
    );
}
