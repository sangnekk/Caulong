import type { CSSProperties, Ref } from 'react';

// Measured Hyper Core8000 geometry in the story's normalised model space: length 6 units,
// tip at y = +3, butt at y = -3 (see racket-scene.ts). String ends come from the baked bed in
// public/models/hyper-core-strings.glb, so the drawing lands on the real strings.
const MAIN_X = [
    0.0382, 0.1147, 0.1911, 0.2676, 0.344, 0.4204, 0.4969, 0.5733, 0.6498,
    0.7262,
];
const MAIN_TOP = [
    2.9608, 2.9562, 2.9456, 2.9257, 2.8938, 2.8436, 2.7665, 2.6524, 2.4988,
    2.2967,
];
const MAIN_BOTTOM = [
    0.8503, 0.8585, 0.8753, 0.8983, 0.9331, 0.9782, 1.034, 1.1062, 1.2073,
    1.3421,
];
const CROSS_HALF = [
    0.3468, 0.46, 0.5327, 0.5862, 0.6308, 0.6699, 0.704, 0.7336, 0.76, 0.782,
    0.7977, 0.8083, 0.815, 0.8185, 0.8162, 0.8076, 0.7936, 0.7701, 0.7381,
    0.6924, 0.6391, 0.5689, 0.469, 0.3468,
];
const crossY = (index: number) => 2.8933 - index * 0.08533;

/** Model units covered by the drawing; the svg box is laid out at BLUEPRINT_SCALE px per unit. */
export const BLUEPRINT_BOX = { x: -0.95, y: -3.05, width: 1.9, height: 6.1 };
export const BLUEPRINT_SCALE = 100;
/** Head centre (model y) used to frame the close-up. */
export const HEAD_CENTER = 1.9;

type Point = [number, number];
const n = (value: number) => Number(value.toFixed(4));

// Stringing order of a real one-piece job: mains from the centre outwards, alternating sides,
// then crosses from the head down. Each string runs back the way the last one came.
export const STRINGS = [
    ...MAIN_X.flatMap((x, i) => [
        [x, MAIN_TOP[i], MAIN_BOTTOM[i]],
        [-x, MAIN_TOP[i], MAIN_BOTTOM[i]],
    ]).map(([x, top, bottom], i): [Point, Point] =>
        i % 2
            ? [
                  [x, -bottom],
                  [x, -top],
              ]
            : [
                  [x, -top],
                  [x, -bottom],
              ],
    ),
    ...CROSS_HALF.map((half, i): [Point, Point] => {
        const y = -crossY(i);
        return i % 2
            ? [
                  [half, y],
                  [-half, y],
              ]
            : [
                  [-half, y],
                  [half, y],
              ];
    }),
];
export const MAIN_COUNT = MAIN_X.length * 2;
export const STRING_COUNT = STRINGS.length;

// Inner rim through the string ends, clockwise on screen from the tip.
const rightRim: Point[] = [
    [0, 2.9625],
    ...MAIN_X.slice(0, 4).map((x, i): Point => [x, MAIN_TOP[i]]),
    ...CROSS_HALF.map((half, i): Point => [half, crossY(i)]),
    ...MAIN_X.slice(0, 4)
        .map((x, i): Point => [x, MAIN_BOTTOM[i]])
        .reverse(),
    [0, 0.849],
];
// Two light smoothing passes take out measurement ripple (well under a millimetre).
const rim = [0, 1].reduce(
    (points) =>
        points.map((point, i): Point => {
            const previous = points[(i - 1 + points.length) % points.length];
            const next = points[(i + 1) % points.length];
            return [
                (previous[0] + 2 * point[0] + next[0]) / 4,
                (previous[1] + 2 * point[1] + next[1]) / 4,
            ];
        }),
    [
        ...rightRim,
        ...rightRim
            .slice(1, -1)
            .reverse()
            .map(([x, y]): Point => [-x, y]),
    ].map(([x, y]): Point => [x, -y]),
);

function offset(points: Point[], distance: number): Point[] {
    return points.map((point, i) => {
        const previous = points[(i - 1 + points.length) % points.length];
        const next = points[(i + 1) % points.length];
        const tx = next[0] - previous[0];
        const ty = next[1] - previous[1];
        const length = Math.hypot(tx, ty) || 1;
        return [
            point[0] + (ty / length) * distance,
            point[1] - (tx / length) * distance,
        ];
    });
}

// Closed Catmull-Rom spline as cubic Béziers.
function loop(points: Point[]) {
    const at = (i: number) => points[(i + points.length) % points.length];
    let d = 'M' + n(points[0][0]) + ' ' + n(points[0][1]);
    for (let i = 0; i < points.length; i++) {
        const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
        d +=
            'C' +
            [
                p1[0] + (p2[0] - p0[0]) / 6,
                p1[1] + (p2[1] - p0[1]) / 6,
                p2[0] - (p3[0] - p1[0]) / 6,
                p2[1] - (p3[1] - p1[1]) / 6,
                p2[0],
                p2[1],
            ]
                .map(n)
                .join(' ');
    }
    return d + 'Z';
}

const INNER = loop(rim);
const OUTER = loop(offset(rim, 0.042));
const HANDLE =
    'M-0.05 -0.8L-0.024 -0.62L-0.024 1.15Q-0.03 1.46 -0.137 1.72L-0.137 2.78L-0.165 2.84L-0.172 2.97Q-0.172 3 -0.14 3L0.14 3Q0.172 3 0.172 2.97L0.165 2.84L0.137 2.78L0.137 1.72Q0.03 1.46 0.024 1.15L0.024 -0.62L0.05 -0.8';
const WRAP =
    'M-0.137 1.72H0.137M-0.137 2.78H0.137' +
    Array.from(
        { length: 9 },
        (_, i) =>
            'M-0.137 ' + n(1.86 + i * 0.1) + 'L0.137 ' + n(1.79 + i * 0.1),
    ).join('');

type Props = {
    /** Strings pulled through so far, in stringing order. */
    strung: number;
    className?: string;
    style?: CSSProperties;
    ref?: Ref<SVGSVGElement>;
};

export default function RacketBlueprint({
    strung,
    className = '',
    style,
    ref,
}: Props) {
    return (
        <svg
            ref={ref}
            className={'racket-blueprint ' + className}
            style={style}
            viewBox={[
                BLUEPRINT_BOX.x,
                BLUEPRINT_BOX.y,
                BLUEPRINT_BOX.width,
                BLUEPRINT_BOX.height,
            ].join(' ')}
            width={BLUEPRINT_BOX.width * BLUEPRINT_SCALE}
            height={BLUEPRINT_BOX.height * BLUEPRINT_SCALE}
            aria-hidden="true"
            focusable="false"
        >
            <path className="racket-blueprint__bed" d={INNER} />
            <g className="racket-blueprint__strings">
                {STRINGS.map(([from, to], i) => (
                    <line
                        key={i}
                        x1={from[0]}
                        y1={from[1]}
                        x2={to[0]}
                        y2={to[1]}
                        pathLength={1}
                        data-strung={i < strung || undefined}
                        data-active={i === strung - 1 || undefined}
                    />
                ))}
            </g>
            <path
                className="racket-blueprint__frame"
                d={OUTER}
                pathLength={1}
            />
            <path
                className="racket-blueprint__frame"
                d={INNER}
                pathLength={1}
            />
            <path
                className="racket-blueprint__handle"
                d={HANDLE}
                pathLength={1}
            />
            <path className="racket-blueprint__wrap" d={WRAP} />
        </svg>
    );
}
