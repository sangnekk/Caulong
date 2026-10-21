/** A small, code-native illustration. Coordinates are in a 520px-tall world. */
export type DeliveryStage = 'packing' | 'shipping' | 'approaching';

const color = {
    ink: 'oklch(0.27 0.075 262)',
    blue: 'oklch(0.49 0.21 263)',
    blueLight: 'oklch(0.68 0.16 258)',
    blueDark: 'oklch(0.36 0.16 263)',
    lime: 'oklch(0.91 0.14 115)',
    skin: 'oklch(0.88 0.08 60)',
    cheek: 'oklch(0.77 0.12 25)',
    sky: 'oklch(0.965 0.016 250)',
    mint: 'oklch(0.84 0.065 166)',
    white: 'oklch(1 0 0)',
};

type Context = CanvasRenderingContext2D;

export type DeliveryMotion = { travel: number; wheel: number; phase: number };
export type DeliveryFrame = {
    stage: DeliveryStage;
    time: number;
    motion: DeliveryMotion;
};
export type DeliveryMorph = { from: DeliveryFrame; time: number };
export const DELIVERY_MORPH_SECONDS = 1.6;
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);

/** Shared motion origins keep the road and wheels moving forward across stages. */
export function deliveryMotion(
    stage: DeliveryStage,
    time: number,
    origin: DeliveryMotion = { travel: 0, wheel: 0, phase: 0 },
): DeliveryMotion {
    const p = Math.min(time / 5.5, 1);
    return {
        travel:
            origin.travel +
            (stage === 'approaching'
                ? 95 * (1 - Math.pow(1 - p, 3))
                : time * 40),
        wheel:
            origin.wheel +
            (stage === 'approaching'
                ? 9.625 * (1 - Math.pow(1 - p, 4))
                : time * 7),
        phase: origin.phase + time,
    };
}

type ParcelPose = {
    x: number;
    y: number;
    length: number;
    depth: number;
    angle: number;
    upright: number;
};

function parcelPose(
    width: number,
    stage: DeliveryStage,
    time: number,
    phase = time,
): ParcelPose {
    if (stage === 'packing')
        return {
            x: width * 0.52 + 5,
            y: 337.5,
            length: 352,
            depth: 109,
            angle: 0,
            upright: 0,
        };
    const progress = Math.min(time / 5.5, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const speed = stage === 'approaching' ? 1 - eased : 1;
    const riderX =
        stage === 'approaching'
            ? mix(width * 0.43, width * 0.8 - 157, eased)
            : width * 0.43;
    return {
        x: riderX - 79,
        y: 274 + Math.sin(phase * 10) * 1.7 * speed,
        length: 134,
        depth: 51,
        angle: -Math.PI / 2 - 0.14 + Math.sin(phase * 6) * 0.018 * speed,
        upright: 1,
    };
}

/** The same parcel geometry is used on the bench, on the bike, and during the morph. */
function parcel(c: Context, pose: ParcelPose, time: number) {
    const { x, y, length, depth, angle, upright } = pose;
    c.save();
    c.translate(x, y);
    c.rotate(angle);
    box(c, -length / 2, -depth / 2, length, depth, 10, 'oklch(0.86 0.095 74)');
    box(c, -length / 2, depth / 2 - 15, length, 15, 5, 'oklch(0.79 0.09 64)');
    const tape = mix(29, 13, upright);
    box(c, -tape / 2, -depth / 2, tape, depth, 0, color.lime);
    box(c, -length / 2, -6, length, mix(13, 10, upright), 0, color.lime);
    c.save();
    c.translate(mix(length * 0.25, -length * 0.26, upright), -2);
    c.rotate(-angle);
    const labelWidth = mix(121, 31, upright);
    const labelHeight = mix(62, 25, upright);
    box(
        c,
        -labelWidth / 2,
        -labelHeight / 2,
        labelWidth,
        labelHeight,
        mix(7, 5, upright),
        color.white,
    );
    if (upright < 0.5) {
        c.save();
        c.scale(1 - upright * 2, 1 - upright * 2);
        c.fillStyle = color.ink;
        c.font = '600 12px "Delivery Archivo", sans-serif';
        c.fillText('Hyper Core8000', -50, -9);
        c.restore();
    }
    line(
        c,
        [
            [-labelWidth * 0.38, 5],
            [labelWidth * 0.22, 5],
        ],
        'oklch(0.7 0.03 250)',
        mix(3, 2, upright),
    );
    line(
        c,
        [
            [-labelWidth * 0.38, 13 - upright * 2],
            [labelWidth * 0.04, 13 - upright * 2],
        ],
        'oklch(0.7 0.03 250)',
        mix(3, 2, upright),
    );
    c.restore();
    c.save();
    c.translate(mix(-length * 0.29, length * 0.08, upright), -2);
    c.rotate(-angle);
    smile(c, 0, 0, mix(1.15, 0.85, upright), time % 4.4 > 4.22);
    c.restore();
    c.restore();
}

function oval(
    c: Context,
    x: number,
    y: number,
    rx: number,
    ry: number,
    fill: string,
) {
    c.fillStyle = fill;
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    c.fill();
}

function box(
    c: Context,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    fill: string,
) {
    c.fillStyle = fill;
    c.beginPath();
    c.roundRect(x, y, w, h, r);
    c.fill();
}

function line(c: Context, points: number[][], stroke: string, width = 4) {
    c.beginPath();
    c.strokeStyle = stroke;
    c.lineWidth = width;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.stroke();
}

function smile(c: Context, x: number, y: number, size = 1, blink = false) {
    if (blink) {
        line(
            c,
            [
                [x - 10 * size, y],
                [x - 5 * size, y],
            ],
            color.ink,
            3 * size,
        );
        line(
            c,
            [
                [x + 5 * size, y],
                [x + 10 * size, y],
            ],
            color.ink,
            3 * size,
        );
    } else {
        oval(c, x - 8 * size, y, 2.7 * size, 3.8 * size, color.ink);
        oval(c, x + 8 * size, y, 2.7 * size, 3.8 * size, color.ink);
    }
    oval(c, x - 15 * size, y + 8 * size, 5 * size, 3 * size, color.cheek);
    oval(c, x + 15 * size, y + 8 * size, 5 * size, 3 * size, color.cheek);
    c.beginPath();
    c.strokeStyle = color.ink;
    c.lineWidth = 2.5 * size;
    c.arc(x, y + 6 * size, 6 * size, 0.12, Math.PI - 0.12);
    c.stroke();
}

function cloud(c: Context, x: number, y: number, scale: number) {
    c.save();
    c.translate(x, y);
    c.scale(scale, scale);
    box(c, -45, 0, 100, 22, 11, color.white);
    oval(c, -14, 0, 24, 23, color.white);
    oval(c, 17, -8, 30, 30, color.white);
    oval(c, 41, 3, 19, 17, color.white);
    c.restore();
}

function tree(
    c: Context,
    x: number,
    ground: number,
    scale: number,
    pale = false,
) {
    c.save();
    c.translate(x, ground);
    c.scale(scale, scale);
    box(
        c,
        -5,
        -80,
        10,
        80,
        5,
        pale ? 'oklch(0.84 0.025 210)' : 'oklch(0.65 0.055 165)',
    );
    oval(c, 0, -100, 35, 46, pale ? 'oklch(0.9 0.036 170)' : color.mint);
    oval(c, -19, -79, 26, 30, pale ? 'oklch(0.9 0.036 170)' : color.mint);
    oval(c, 21, -79, 26, 30, pale ? 'oklch(0.9 0.036 170)' : color.mint);
    line(
        c,
        [
            [0, -21],
            [0, -91],
            [13, -103],
        ],
        pale ? 'oklch(0.84 0.04 170)' : 'oklch(0.74 0.065 166)',
        3,
    );
    line(
        c,
        [
            [0, -57],
            [-14, -71],
        ],
        pale ? 'oklch(0.84 0.04 170)' : 'oklch(0.74 0.065 166)',
        3,
    );
    c.restore();
}

function townHouse(
    c: Context,
    x: number,
    y: number,
    width: number,
    height: number,
    tint: string,
) {
    box(c, x, y - height, width, height, 9, tint);
    box(c, x + 10, y - height - 7, width - 20, 10, 4, tint);
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 2; col++) {
            box(
                c,
                x + 15 + col * (width - 38),
                y - height + 20 + row * 35,
                13,
                19,
                4,
                'oklch(0.97 0.01 250)',
            );
        }
    }
}

function home(c: Context, x: number, time: number, arrived: boolean) {
    c.save();
    c.translate(x, 397);
    oval(c, 0, 8, 108, 10, 'oklch(0.86 0.035 230)');
    box(c, -65, -137, 130, 140, 8, color.white);
    box(c, 40, -193, 17, 40, 4, color.blueDark);
    c.beginPath();
    c.moveTo(-82, -131);
    c.lineTo(-8, -199);
    c.quadraticCurveTo(0, -206, 8, -199);
    c.lineTo(82, -131);
    c.quadraticCurveTo(86, -123, 77, -122);
    c.lineTo(-77, -122);
    c.quadraticCurveTo(-86, -123, -82, -131);
    c.fillStyle = color.blue;
    c.fill();
    line(
        c,
        [
            [-54, -138],
            [0, -187],
            [54, -138],
        ],
        color.blueLight,
        4,
    );
    box(c, -13, -77, 44, 80, 21, 'oklch(0.85 0.065 250)');
    box(c, -8, -70, 34, 73, 17, 'oklch(0.91 0.045 250)');
    oval(c, 19, -28, 3, 3, color.blue);
    box(c, -48, -94, 25, 32, 6, color.lime);
    line(
        c,
        [
            [-35, -92],
            [-35, -63],
        ],
        color.white,
        3,
    );
    line(
        c,
        [
            [-46, -78],
            [-25, -78],
        ],
        color.white,
        3,
    );
    box(c, 38, -94, 20, 28, 5, 'oklch(0.85 0.075 250)');
    box(c, -74, -2, 148, 8, 4, 'oklch(0.78 0.045 250)');
    tree(c, 96, 3, 0.55);
    box(c, -95, -18, 22, 22, 5, 'oklch(0.76 0.09 45)');
    oval(c, -84, -26, 18, 22, color.mint);

    // A location marker stays above the destination; a single wave acknowledges arrival.
    const pulse = arrived ? (time % 2.5) / 2.5 : 0;
    if (arrived) {
        c.globalAlpha = (1 - pulse) * 0.35;
        oval(c, 0, -240, 20 + pulse * 22, 20 + pulse * 22, color.blueLight);
        c.globalAlpha = 1;
    }
    oval(c, 0, -240, 18, 18, color.blue);
    c.beginPath();
    c.moveTo(-8, -227);
    c.lineTo(0, -216);
    c.lineTo(8, -227);
    c.fillStyle = color.blue;
    c.fill();
    oval(c, 0, -241, 6, 6, color.white);
    c.restore();
}

function wheel(c: Context, x: number, rotation: number) {
    c.save();
    c.translate(x, -5);
    oval(c, 0, 0, 26, 26, color.ink);
    oval(c, 0, 0, 17, 17, 'oklch(0.9 0.025 250)');
    c.rotate(rotation);
    for (let i = 0; i < 4; i++) {
        c.rotate(Math.PI / 2);
        line(
            c,
            [
                [0, 7],
                [0, 13],
            ],
            'oklch(0.65 0.065 250)',
            3,
        );
    }
    oval(c, 0, 0, 6, 6, color.blueDark);
    c.restore();
}

function courier(
    c: Context,
    x: number,
    time: number,
    speed: number,
    arrived: boolean,
    wheelRotation: number,
    hideParcel = false,
) {
    const bob = Math.sin(time * 10) * 1.7 * speed;
    const blink = time % 4.4 > 4.22;
    c.save();
    c.translate(x, 405);
    oval(c, 4, 28, 117, 10, 'oklch(0.8 0.04 250 / 0.3)');
    wheel(c, -61, wheelRotation);
    wheel(c, 77, wheelRotation);
    c.translate(0, bob);

    if (!hideParcel)
        parcel(
            c,
            {
                x: -79,
                y: -131,
                length: 134,
                depth: 51,
                angle: -Math.PI / 2 - 0.14 + Math.sin(time * 6) * 0.018 * speed,
                upright: 1,
            },
            time,
        );

    // Back arm, coat, bent trouser leg and a little white sneaker.
    line(
        c,
        [
            [-10, -119],
            [-30, -89],
        ],
        color.blueDark,
        19,
    );
    box(c, -30, -135, 63, 79, 25, color.blue);
    box(c, -26, -124, 13, 55, 6, color.blueLight);
    line(
        c,
        [
            [4, -68],
            [37, -53],
            [26, -25],
        ],
        color.ink,
        23,
    );
    box(c, 14, -28, 37, 14, 6, color.white);
    line(
        c,
        [
            [19, -15],
            [48, -15],
        ],
        'oklch(0.74 0.04 250)',
        3,
    );

    // Scarf ends trail behind; the helmet is intentionally oversized.
    c.beginPath();
    c.moveTo(-15, -134);
    c.quadraticCurveTo(-39, -151, -61, -137 + Math.sin(time * 7) * 4 * speed);
    c.lineTo(-52, -125);
    c.quadraticCurveTo(-35, -133, -14, -122);
    c.fillStyle = color.lime;
    c.fill();
    box(c, -18, -141, 44, 16, 7, color.lime);
    box(c, 3, -153, 20, 23, 7, color.skin);
    oval(c, 9, -184, 52, 50, color.blueDark);
    oval(c, 8, -190, 49, 46, color.blue);
    oval(c, 23, -170, 32, 36, color.skin);
    oval(c, 49, -169, 8, 11, color.skin);
    // A swept fringe beneath the helmet and a glossy stripe, not a heavy outline.
    c.beginPath();
    c.moveTo(-6, -191);
    c.quadraticCurveTo(20, -207, 48, -186);
    c.quadraticCurveTo(18, -188, 4, -175);
    c.closePath();
    c.fillStyle = color.ink;
    c.fill();
    c.beginPath();
    c.arc(7, -193, 39, Math.PI + 0.25, Math.PI * 1.62);
    c.lineWidth = 8;
    c.strokeStyle = color.blueLight;
    c.stroke();
    box(c, -24, -193, 80, 12, 6, color.blue);
    box(c, -17, -188, 15, 32, 7, color.blueDark);
    oval(c, -10, -171, 6, 6, color.lime);
    smile(c, 28, -164, 1, blink);

    // Hand stays on the handlebar until the bike has stopped.
    if (arrived) {
        c.save();
        c.translate(24, -119);
        c.rotate(-0.15 + Math.sin(time * 5) * 0.2);
        line(
            c,
            [
                [0, 0],
                [37, -14],
                [56, -49],
            ],
            color.blue,
            17,
        );
        oval(c, 56, -55, 10, 12, color.skin);
        line(
            c,
            [
                [49, -60],
                [47, -69],
            ],
            color.skin,
            5,
        );
        line(
            c,
            [
                [55, -63],
                [55, -73],
            ],
            color.skin,
            5,
        );
        line(
            c,
            [
                [61, -62],
                [64, -70],
            ],
            color.skin,
            5,
        );
        c.restore();
    } else {
        line(
            c,
            [
                [22, -118],
                [46, -96],
                [74, -98],
            ],
            color.blueLight,
            18,
        );
        oval(c, 76, -98, 10, 8, color.skin);
    }

    // Scooter: rounded rear body, footboard, curved front apron and headlamp.
    line(
        c,
        [
            [-81, -67],
            [-51, -67],
        ],
        color.ink,
        7,
    );
    box(c, -93, -64, 89, 43, 19, color.blue);
    box(c, -87, -59, 48, 25, 12, color.blueLight);
    box(c, -80, -75, 74, 13, 6, color.ink);
    box(c, -93, -53, 7, 17, 3, 'oklch(0.74 0.16 35)');
    line(
        c,
        [
            [-10, -26],
            [58, -26],
            [73, -86],
        ],
        color.blueDark,
        15,
    );
    c.beginPath();
    c.moveTo(59, -88);
    c.bezierCurveTo(89, -94, 101, -58, 96, -31);
    c.lineTo(66, -31);
    c.quadraticCurveTo(56, -50, 59, -88);
    c.fillStyle = color.blue;
    c.fill();
    line(
        c,
        [
            [69, -76],
            [76, -45],
        ],
        color.blueLight,
        7,
    );
    box(c, 64, -100, 39, 22, 10, color.blue);
    box(c, 91, -96, 14, 15, 6, color.lime);
    line(
        c,
        [
            [70, -99],
            [64, -111],
            [53, -111],
        ],
        color.ink,
        5,
    );
    line(
        c,
        [
            [69, -108],
            [73, -128],
        ],
        color.blueDark,
        3,
    );
    oval(c, 75, -132, 11, 7, color.blueLight);
    line(
        c,
        [
            [-11, -18],
            [54, -18],
        ],
        color.blueLight,
        4,
    );
    oval(c, -61, -5, 7, 7, color.blueDark);
    oval(c, 77, -5, 7, 7, color.blueDark);
    c.restore();
}

function packingScene(
    c: Context,
    width: number,
    time: number,
    reduced: boolean,
    racket?: HTMLImageElement,
    hideParcel = false,
) {
    const phase = reduced ? 7 : time;
    const step = (start: number, duration: number) => {
        const p = Math.max(0, Math.min((phase - start) / duration, 1));
        return 1 - Math.pow(1 - p, 3);
    };
    const cx = width * 0.52;
    box(c, 0, 0, width, 520, 0, color.sky);
    // A little packing room, with a window and neatly stacked parcels.
    box(c, width * 0.8 - 54, 105, 108, 134, 18, color.white);
    box(c, width * 0.8 - 46, 113, 92, 118, 12, 'oklch(0.89 0.05 250)');
    oval(c, width * 0.8 + 11, 145, 17, 17, color.lime);
    cloud(c, width * 0.8 - 15, 183, 0.48);
    line(
        c,
        [
            [width * 0.8, 113],
            [width * 0.8, 231],
        ],
        color.white,
        6,
    );
    line(
        c,
        [
            [width * 0.8 - 46, 170],
            [width * 0.8 + 46, 170],
        ],
        color.white,
        6,
    );
    box(c, 0, 420, width, 100, 0, 'oklch(0.92 0.035 175)');
    box(c, cx - 280, 476, 560, 9, 4, 'oklch(0.85 0.04 175)');

    // Same little helper, now in a soft shop cap, preparing the parcel.
    c.save();
    c.translate(cx - 213, 326);
    box(c, -30, -51, 64, 99, 23, color.blue);
    box(c, -19, -22, 43, 66, 10, color.lime);
    box(c, -15, -17, 35, 48, 8, 'oklch(0.86 0.12 115)');
    oval(c, 1, -93, 39, 42, color.skin);
    oval(c, 36, -89, 8, 10, color.skin);
    oval(c, -29, -108, 12, 25, color.ink);
    oval(c, 0, -119, 42, 28, color.blue);
    box(c, -36, -120, 91, 13, 6, color.blueDark);
    box(c, -9, -142, 18, 14, 6, color.lime);
    smile(c, 8, -87, 1.1, !reduced && time % 4.4 > 4.22);
    const reach = Math.sin(Math.min(phase, 4.7) * 3) * 8;
    line(
        c,
        [
            [26, -34],
            [46, -17 + reach],
            [68, -23 + reach],
        ],
        color.blueLight,
        17,
    );
    oval(c, 70, -23 + reach, 10, 9, color.skin);
    line(
        c,
        [
            [-24, -30],
            [-33, 3],
            [-12, 11],
        ],
        color.blue,
        16,
    );
    oval(c, -9, 11, 10, 9, color.skin);
    c.restore();

    // Workbench and the open, elongated racket box.
    box(c, cx - 260, 388, 520, 22, 9, color.blueLight);
    box(c, cx - 246, 410, 14, 70, 5, color.blueDark);
    box(c, cx + 232, 410, 14, 70, 5, color.blueDark);
    if (!hideParcel && phase < 5.7) {
        box(c, cx - 168, 286, 346, 107, 10, 'oklch(0.75 0.08 65)');
        box(c, cx - 161, 293, 332, 89, 6, 'oklch(0.9 0.065 75)');
        box(c, cx - 151, 302, 312, 69, 8, color.white);

        const placed = step(0.3, 1.8);
        c.save();
        c.translate(cx + 9, 193 + placed * 139);
        c.rotate(Math.PI / 3 + (1 - placed) * -0.12);
        if (racket?.complete && racket.naturalWidth > 0) {
            c.drawImage(racket, -150, -187.5, 300, 375);
        }
        c.restore();

        // Protective wrap settles over the real model's poster before the lid closes.
        const wrapped = step(2.1, 0.9);
        if (wrapped > 0) {
            c.save();
            c.globalAlpha = wrapped * 0.86;
            box(c, cx - 151, 299, 312, 75, 8, 'oklch(0.94 0.028 250)');
            for (let row = 0; row < 3; row++) {
                for (let col = 0; col < 13; col++) {
                    oval(
                        c,
                        cx - 138 + col * 23 + (row % 2) * 6,
                        313 + row * 22,
                        6,
                        6,
                        color.white,
                    );
                }
            }
            c.restore();
        }
        const closed = step(3.1, 1.2);
        if (closed > 0) {
            c.save();
            c.globalAlpha = Math.min(closed * 4, 1);
            box(
                c,
                cx - 171,
                202 + closed * 81,
                352,
                109,
                10,
                'oklch(0.86 0.095 74)',
            );
            box(
                c,
                cx - 171,
                293 + closed * 81,
                352,
                18,
                5,
                'oklch(0.79 0.09 64)',
            );
            c.restore();
        }
        const taped = step(4.3, 0.8);
        if (taped > 0) {
            box(c, cx - 18, 283, 29, 109 * taped, 0, color.lime);
            box(c, cx - 171, 325, 352 * taped, 13, 0, color.lime);
        }
        const labeled = step(5.1, 0.6);
        if (labeled > 0) {
            c.save();
            c.globalAlpha = labeled;
            box(c, cx + 33, 303 - (1 - labeled) * 22, 121, 62, 7, color.white);
            c.fillStyle = color.ink;
            c.font = '600 12px "Delivery Archivo", sans-serif';
            c.fillText('Hyper Core8000', cx + 43, 326);
            line(
                c,
                [
                    [cx + 44, 340],
                    [cx + 109, 340],
                ],
                'oklch(0.7 0.03 250)',
                3,
            );
            line(
                c,
                [
                    [cx + 44, 348],
                    [cx + 88, 348],
                ],
                'oklch(0.7 0.03 250)',
                3,
            );
            smile(c, cx - 99, 335, 1.15, !reduced && time % 4.4 > 4.22);
            c.restore();
        }
    }
    if (!hideParcel && phase >= 5.7)
        parcel(c, parcelPose(width, 'packing', phase), reduced ? 0 : time);
    if (!hideParcel && phase > 5.8) {
        const shine = reduced ? 1 : 0.7 + Math.sin(time * 2) * 0.3;
        c.save();
        c.globalAlpha = shine;
        for (const [x, y, s] of [
            [cx + 199, 276, 9],
            [cx + 153, 245, 5],
            [cx - 148, 261, 6],
        ]) {
            line(
                c,
                [
                    [x - s, y],
                    [x + s, y],
                ],
                color.blueLight,
                3,
            );
            line(
                c,
                [
                    [x, y - s],
                    [x, y + s],
                ],
                color.blueLight,
                3,
            );
        }
        c.restore();
    }
    // Spare tape roll and parcel on the bench.
    oval(c, cx + 225, 375, 17, 13, color.lime);
    oval(c, cx + 225, 373, 8, 6, color.white);
}

/** Geometry morph: one parcel changes pose while the camera pans between locations. */
export function drawDeliveryMorph(
    c: Context,
    width: number,
    height: number,
    morph: DeliveryMorph,
    target: DeliveryFrame,
    racket?: HTMLImageElement,
) {
    const progress = Math.min(morph.time / DELIVERY_MORPH_SECONDS, 1);
    const from = morph.from;
    if (progress === 0) {
        drawDeliveryScene(
            c,
            width,
            height,
            from.stage,
            from.time,
            false,
            racket,
            { motion: from.motion },
        );
        return;
    }
    if (from.stage !== 'packing' && target.stage !== 'packing') {
        const t = smooth(progress);
        const worldWidth = (width / height) * 520;
        const sourcePose = parcelPose(
            worldWidth,
            from.stage,
            from.time,
            from.motion.phase,
        );
        const targetPose = parcelPose(
            worldWidth,
            target.stage,
            target.time,
            target.motion.phase,
        );
        const speed = (frame: DeliveryFrame) =>
            frame.stage === 'shipping'
                ? 1
                : Math.pow(1 - Math.min(frame.time / 5.5, 1), 3);
        drawDeliveryScene(
            c,
            width,
            height,
            target.stage,
            target.time,
            false,
            racket,
            {
                environment: mix(
                    from.stage === 'approaching' ? 1 : 0,
                    target.stage === 'approaching' ? 1 : 0,
                    t,
                ),
                riderX: mix(sourcePose.x, targetPose.x, t) + 79,
                speed: mix(speed(from), speed(target), t),
                motion: {
                    travel: mix(from.motion.travel, target.motion.travel, t),
                    wheel: mix(from.motion.wheel, target.motion.wheel, t),
                    phase: mix(from.motion.phase, target.motion.phase, t),
                },
            },
        );
        return;
    }
    const leavingShop = from.stage === 'packing';
    // An interrupted packing scene finishes its wrapping before the parcel lifts off.
    if (leavingShop && progress < 0.22) {
        const settled = mix(
            from.time,
            Math.max(from.time, 7),
            smooth(progress / 0.22),
        );
        drawDeliveryScene(c, width, height, 'packing', settled, false, racket);
        return;
    }
    const t = smooth(leavingShop ? (progress - 0.22) / 0.78 : progress);
    const worldWidth = (width / height) * 520;
    const road = leavingShop ? target : from;
    c.save();
    c.scale(height / 520, height / 520);
    c.clearRect(0, 0, worldWidth, 520);
    const panel = (x: number, draw: () => void) => {
        c.save();
        c.translate(x, 0);
        c.beginPath();
        c.rect(0, 0, worldWidth, 520);
        c.clip();
        draw();
        c.restore();
    };
    panel(leavingShop ? -worldWidth * t : -worldWidth * (1 - t), () =>
        packingScene(c, worldWidth, 7, false, racket, true),
    );
    panel(leavingShop ? worldWidth * (1 - t) : worldWidth * t, () =>
        drawDeliveryScene(
            c,
            worldWidth,
            520,
            road.stage,
            road.time,
            false,
            racket,
            { motion: road.motion, hideParcel: true },
        ),
    );
    const a = parcelPose(worldWidth, from.stage, from.time, from.motion.phase);
    const b = parcelPose(
        worldWidth,
        target.stage,
        target.time,
        target.motion.phase,
    );
    parcel(
        c,
        {
            x: mix(a.x, b.x, t),
            y: mix(a.y, b.y, t) - Math.sin(Math.PI * t) * 85,
            length: mix(a.length, b.length, t),
            depth: mix(a.depth, b.depth, t),
            angle: mix(a.angle, b.angle, t),
            upright: mix(a.upright, b.upright, t),
        },
        mix(from.motion.phase, target.motion.phase, t),
    );
    c.restore();
}

/** `time` is active playback time, so pausing freezes every moving detail. */
export function drawDeliveryScene(
    c: Context,
    width: number,
    height: number,
    stage: DeliveryStage,
    time: number,
    reducedMotion: boolean,
    racket?: HTMLImageElement,
    options: {
        motion?: DeliveryMotion;
        hideParcel?: boolean;
        environment?: number;
        riderX?: number;
        speed?: number;
        noCourier?: boolean;
    } = {},
) {
    const worldWidth = (width / height) * 520;
    if (stage === 'packing') {
        c.save();
        c.scale(height / 520, height / 520);
        c.clearRect(0, 0, worldWidth, 520);
        packingScene(
            c,
            worldWidth,
            time,
            reducedMotion,
            racket,
            options.hideParcel,
        );
        c.restore();
        return false;
    }
    const approaching = stage === 'approaching';
    const progress = reducedMotion ? 1 : Math.min(time / 5.5, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const speed = options.speed ?? (approaching ? 1 - eased : 1);
    const arrived = approaching && progress >= 0.99;
    const motion =
        options.motion ??
        deliveryMotion(stage, time, { travel: 0, wheel: 0, phase: 0 });
    const movement = motion.travel;
    const environment = options.environment ?? (approaching ? 1 : 0);
    c.save();
    c.scale(height / 520, height / 520);
    c.clearRect(0, 0, worldWidth, 520);
    box(c, 0, 0, worldWidth, 520, 0, color.sky);

    // Sun and clouds move much slower than the foreground.
    oval(c, worldWidth * 0.76, 106, 32, 32, color.lime);
    oval(c, worldWidth * 0.76 - 8, 101, 3, 3, color.ink);
    oval(c, worldWidth * 0.76 + 8, 101, 3, 3, color.ink);
    c.beginPath();
    c.strokeStyle = color.ink;
    c.lineWidth = 2.5;
    c.arc(worldWidth * 0.76, 109, 6, 0.1, Math.PI - 0.1);
    c.stroke();
    cloud(c, worldWidth * 0.23 - ((movement * 0.035) % 50), 131, 0.9);
    cloud(c, worldWidth * 0.6 - ((movement * 0.025) % 50), 78, 0.6);
    cloud(c, worldWidth * 0.93 - ((movement * 0.02) % 50), 157, 0.65);

    // Distant town repeats seamlessly; the final destination is fixed in the last scene.
    for (let i = -1; i < Math.ceil(worldWidth / 260) + 2; i++) {
        const x = i * 260 - ((movement * 0.25) % 260);
        townHouse(c, x + 8, 368, 74, 130, 'oklch(0.91 0.025 253)');
        townHouse(c, x + 97, 368, 88, 166, 'oklch(0.925 0.023 250)');
        tree(c, x + 215, 377, 0.78, true);
    }
    box(c, 0, 373, worldWidth, 147, 0, 'oklch(0.92 0.035 175)');
    box(c, 0, 398, worldWidth, 122, 0, 'oklch(0.9 0.025 250)');
    box(c, 0, 398, worldWidth, 5, 0, color.white);
    box(c, 0, 495, worldWidth, 25, 0, 'oklch(0.95 0.022 175)');
    for (let i = -1; i < worldWidth / 105 + 2; i++) {
        box(c, i * 105 - (movement % 105), 462, 46, 5, 2.5, color.white);
    }

    if (environment > 0) {
        home(
            c,
            worldWidth * 0.8 + (1 - environment) * worldWidth * 0.65,
            reducedMotion ? 0 : motion.phase,
            arrived && !reducedMotion,
        );
    }
    if (environment < 1) {
        for (let i = -1; i < worldWidth / 650 + 2; i++) {
            tree(
                c,
                i * 650 +
                    100 -
                    (movement % 650) -
                    environment * (worldWidth + 1300),
                397,
                0.9,
            );
            tree(
                c,
                i * 650 +
                    560 -
                    (movement % 650) -
                    environment * (worldWidth + 1300),
                397,
                0.6,
            );
        }
    }

    const start = worldWidth * 0.43;
    const end = worldWidth * 0.8 - 157;
    if (!options.noCourier)
        courier(
            c,
            options.riderX ??
                (approaching ? start + (end - start) * eased : start),
            reducedMotion ? 0 : motion.phase,
            reducedMotion ? 0 : speed,
            arrived,
            reducedMotion ? 0 : motion.wheel,
            options.hideParcel,
        );

    // Quiet roadside flowers give the foreground a little scale.
    for (let i = -1; i < worldWidth / 190 + 2; i++) {
        const x = i * 190 + 63 - ((movement * 1.2) % 190);
        line(
            c,
            [
                [x, 518],
                [x + 2, 505],
            ],
            'oklch(0.67 0.07 165)',
            2,
        );
        oval(c, x + 2, 503, 4, 4, color.white);
        oval(c, x + 2, 503, 1.5, 1.5, color.lime);
    }
    c.restore();
    return arrived;
}
