// A real badminton court (BWF measurements, metres) seen from behind one baseline, as a
// broadcast camera sees it, projected once into SVG path data. Lines are filled 40 mm strips,
// so they thin with distance like painted lines do; nothing is computed per frame.

type Point = [x: number, y: number, z: number];
type Project = (point: Point) => [number, number];

const WIDTH = 6.1; // doubles width
const LENGTH = 13.4;
const NET = LENGTH / 2;
const LINE = 0.04;
const HALF = WIDTH / 2;
const SINGLES = 0.46; // singles sideline, inside the doubles one
const LONG_SERVICE = 0.76; // doubles long service line, in from the baseline
const SHORT_SERVICE = 1.98; // from the net
const NET_TOP_POST = 1.55;
const NET_TOP_CENTRE = 1.524;
const NET_DEPTH = 0.76;
const TAPE = 0.075;

export type CourtView = {
    width: number;
    height: number;
    floor: string;
    court: string;
    lines: string;
    shadow: string;
    net: string;
    mesh: string;
    tape: string;
    posts: string;
    /** Screen point of the court centre and the far floor edge, for light and haze. */
    centre: [number, number];
    horizon: number;
};

type Camera = {
    eye: Point;
    target: Point;
    fov: number;
    width: number;
    height: number;
};

// Composition per layout, like a broadcast camera: high and far back with a long lens, so both
// halves read. Wide screens keep the court right of centre under the racket (the copy sits over
// the dim left); tall screens look down the court with the net across the middle.
const CAMERAS: Record<'wide' | 'tall', Camera> = {
    wide: {
        eye: [-3, 10, -13.5],
        target: [-2.2, 0, 6.4],
        fov: 27,
        width: 1600,
        height: 1000,
    },
    tall: {
        eye: [0, 7.4, -5.6],
        target: [0, 0, 7.4],
        fov: 58,
        width: 800,
        height: 1600,
    },
};

const sub = (a: Point, b: Point): Point => [
    a[0] - b[0],
    a[1] - b[1],
    a[2] - b[2],
];
const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Point, b: Point): Point => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
];
const unit = (a: Point): Point => {
    const length = Math.hypot(...a);
    return [a[0] / length, a[1] / length, a[2] / length];
};

function projector({ eye, target, fov, width, height }: Camera): Project {
    const forward = unit(sub(target, eye));
    const right = unit(cross([0, 1, 0], forward));
    const up = cross(forward, right);
    const focal = height / 2 / Math.tan((fov * Math.PI) / 360);
    return (point) => {
        const offset = sub(point, eye);
        const depth = dot(offset, forward);
        return [
            width / 2 + (focal * dot(offset, right)) / depth,
            height / 2 - (focal * dot(offset, up)) / depth,
        ];
    };
}

const n = (value: number) => Math.round(value * 10) / 10;

function polygon(project: Project, points: Point[]) {
    return (
        'M' +
        points.map((point) => project(point).map(n).join(' ')).join('L') +
        'Z'
    );
}

/** A flat rectangle on the floor, x0..x1 across, z0..z1 along the court. */
const floorRect = (x0: number, x1: number, z0: number, z1: number): Point[] => [
    [x0, 0, z0],
    [x1, 0, z0],
    [x1, 0, z1],
    [x0, 0, z1],
];

const netTop = (x: number) =>
    NET_TOP_CENTRE + (NET_TOP_POST - NET_TOP_CENTRE) * (x / HALF) ** 2;

/** A band of the net between two heights measured down from its (sagging) top. */
function netBand(from: number, to: number): Point[] {
    const steps = 24;
    const top: Point[] = [];
    const bottom: Point[] = [];
    for (let i = 0; i <= steps; i++) {
        const x = -HALF + (WIDTH * i) / steps;
        top.push([x, netTop(x) - from, NET]);
        bottom.unshift([x, netTop(x) - to, NET]);
    }
    return [...top, ...bottom];
}

export function courtView(kind: 'wide' | 'tall'): CourtView {
    const camera = CAMERAS[kind];
    const project = projector(camera);
    const path = (shapes: Point[][]) =>
        shapes.map((shape) => polygon(project, shape)).join('');

    const lines = [
        // Doubles and singles sidelines.
        floorRect(-HALF, -HALF + LINE, 0, LENGTH),
        floorRect(HALF - LINE, HALF, 0, LENGTH),
        floorRect(-HALF + SINGLES, -HALF + SINGLES + LINE, 0, LENGTH),
        floorRect(HALF - SINGLES - LINE, HALF - SINGLES, 0, LENGTH),
        // Baselines and doubles long service lines.
        floorRect(-HALF, HALF, 0, LINE),
        floorRect(-HALF, HALF, LENGTH - LINE, LENGTH),
        floorRect(-HALF, HALF, LONG_SERVICE - LINE, LONG_SERVICE),
        floorRect(
            -HALF,
            HALF,
            LENGTH - LONG_SERVICE,
            LENGTH - LONG_SERVICE + LINE,
        ),
        // Short service lines, and the centre lines from them to the baselines.
        floorRect(-HALF, HALF, NET - SHORT_SERVICE - LINE, NET - SHORT_SERVICE),
        floorRect(-HALF, HALF, NET + SHORT_SERVICE, NET + SHORT_SERVICE + LINE),
        floorRect(-LINE / 2, LINE / 2, 0, NET - SHORT_SERVICE),
        floorRect(-LINE / 2, LINE / 2, NET + SHORT_SERVICE, LENGTH),
    ];

    // Mesh: strands drawn every few centimetres, a lighter suggestion of the real 2 cm weave.
    const mesh: string[] = [];
    for (let x = -HALF + 0.12; x < HALF; x += 0.12) {
        const [a, b] = [
            project([x, netTop(x) - TAPE, NET]),
            project([x, netTop(x) - NET_DEPTH, NET]),
        ];
        mesh.push(
            'M' + n(a[0]) + ' ' + n(a[1]) + 'L' + n(b[0]) + ' ' + n(b[1]),
        );
    }
    for (let depth = TAPE + 0.1; depth < NET_DEPTH; depth += 0.1) {
        mesh.push(
            netBand(depth, depth)
                .slice(0, 25)
                .map(
                    (point, i) =>
                        (i ? 'L' : 'M') + project(point).map(n).join(' '),
                )
                .join(''),
        );
    }

    const post = (x: number): Point[] => [
        [x - 0.025, 0, NET],
        [x + 0.025, 0, NET],
        [x + 0.025, NET_TOP_POST + 0.02, NET],
        [x - 0.025, NET_TOP_POST + 0.02, NET],
    ];

    return {
        width: camera.width,
        height: camera.height,
        floor: path([floorRect(-14, 14, camera.eye[2] + 1.2, 30)]),
        // The mat runs a little past the lines, as a laid court does.
        court: path([floorRect(-HALF - 0.6, HALF + 0.6, -0.9, LENGTH + 0.9)]),
        lines: path(lines),
        // Overhead light: the net and posts leave a soft band on the far side.
        shadow: path([
            floorRect(-HALF, HALF, NET, NET + 0.55),
            floorRect(-HALF - 0.08, -HALF + 0.08, NET, NET + 0.9),
            floorRect(HALF - 0.08, HALF + 0.08, NET, NET + 0.9),
        ]),
        net: path([netBand(TAPE, NET_DEPTH)]),
        mesh: mesh.join(''),
        tape: path([netBand(0, TAPE)]),
        posts: path([post(-HALF), post(HALF)]),
        centre: project([0, 0, NET]),
        horizon: project([0, 0, 30])[1],
    };
}

export type StyleZone = {
    id: 'speed' | 'balance' | 'attack';
    area: string;
    label: [number, number];
};

export type HalfCourtView = {
    width: number;
    height: number;
    court: string;
    lines: string;
    net: string;
    tape: string;
    posts: string;
    zones: StyleZone[];
};

/**
 * One half of the court from behind its baseline, split where play styles happen: the back
 * court (attack), the middle, and the front court up to the short service line (speed).
 */
export function halfCourtView(): HalfCourtView {
    const camera: Camera = {
        eye: [0, 7.2, -5.4],
        target: [0, 0, 3.9],
        fov: 40,
        width: 900,
        height: 760,
    };
    const project = projector(camera);
    const path = (shapes: Point[][]) =>
        shapes.map((shape) => polygon(project, shape)).join('');
    const front = NET - SHORT_SERVICE;
    const back = 2.2;
    const zone = (id: StyleZone['id'], z0: number, z1: number): StyleZone => ({
        id,
        area: path([floorRect(-HALF, HALF, z0, z1)]),
        // Centre of the left service court, clear of the centre line.
        label: project([-HALF / 2, 0, (z0 + z1) / 2]),
    });
    const post = (x: number): Point[] => [
        [x - 0.03, 0, NET],
        [x + 0.03, 0, NET],
        [x + 0.03, NET_TOP_POST + 0.02, NET],
        [x - 0.03, NET_TOP_POST + 0.02, NET],
    ];
    return {
        width: camera.width,
        height: camera.height,
        court: path([floorRect(-HALF - 0.5, HALF + 0.5, -0.7, NET + 0.4)]),
        lines: path([
            floorRect(-HALF, -HALF + LINE, 0, NET),
            floorRect(HALF - LINE, HALF, 0, NET),
            floorRect(-HALF + SINGLES, -HALF + SINGLES + LINE, 0, NET),
            floorRect(HALF - SINGLES - LINE, HALF - SINGLES, 0, NET),
            floorRect(-HALF, HALF, 0, LINE),
            floorRect(-HALF, HALF, LONG_SERVICE - LINE, LONG_SERVICE),
            floorRect(-HALF, HALF, front - LINE, front),
            floorRect(-LINE / 2, LINE / 2, 0, front),
        ]),
        net: path([netBand(TAPE, NET_DEPTH)]),
        tape: path([netBand(0, TAPE)]),
        posts: path([post(-HALF), post(HALF)]),
        zones: [
            zone('attack', 0, back),
            zone('balance', back, front),
            zone('speed', front, NET),
        ],
    };
}
