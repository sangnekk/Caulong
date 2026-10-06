// A small, forgiving HTML reader for the VNB catalog sync: enough of a tree to ask for "the
// rows of this table" or "the text of this paragraph" instead of matching markup with regular
// expressions. No dependency, so the script runs with plain `node`.

const VOID = new Set(
    'area base br col embed hr img input link meta param source track wbr'.split(
        ' ',
    ),
);
/** Their content is not markup: read as one piece up to the closing tag. */
const RAW = new Set(['script', 'style', 'textarea', 'title']);
/** Never part of the text a visitor reads. */
const UNSEEN = new Set(['script', 'style', 'noscript', 'template', 'svg']);
/** Elements that start a new line of text, and that a stray inline end tag never closes. */
const BLOCK = new Set(
    (
        'address article aside blockquote body caption center dd details dir div dl dt ' +
        'fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 head header hr html li ' +
        'main nav ol p pre section table tbody tfoot thead tr ul'
    ).split(' '),
);
const CELL = new Set(['td', 'th']);
const TABLE = new Set([
    'table',
    'caption',
    'thead',
    'tbody',
    'tfoot',
    'tr',
    'td',
    'th',
]);
/** A start tag from this list ends the paragraph it is written in. */
const ENDS_PARAGRAPH = new Set(
    (
        'address article aside blockquote center details dir div dl fieldset figcaption ' +
        'figure footer form h1 h2 h3 h4 h5 h6 header hr li main nav ol p pre section table ul'
    ).split(' '),
);
/** An end tag does not reach past these to find its start tag. */
const SCOPE = new Set([
    '#root',
    'table',
    'td',
    'th',
    'caption',
    'button',
    'template',
]);
const PARAGRAPH = new Set(['p']);
const sets = (closes, stops) => [new Set(closes), new Set(stops)];
/** Start tags that end an element left open: [what they close, where the search stops]. */
const IMPLIED_END = new Map(
    Object.entries({
        li: sets(['li'], [...SCOPE, 'ul', 'ol']),
        dt: sets(['dt', 'dd'], [...SCOPE, 'dl']),
        dd: sets(['dt', 'dd'], [...SCOPE, 'dl']),
        option: sets(['option'], ['select']),
        td: sets(CELL, ['#root', 'table', 'tr']),
        th: sets(CELL, ['#root', 'table', 'tr']),
        tr: sets(['tr'], ['#root', 'table', 'thead', 'tbody', 'tfoot']),
        thead: sets(['thead', 'tbody', 'tfoot'], ['#root', 'table']),
        tbody: sets(['thead', 'tbody', 'tfoot'], ['#root', 'table']),
        tfoot: sets(['thead', 'tbody', 'tfoot'], ['#root', 'table']),
    }),
);

const ENTITIES = new Map(
    Object.entries({
        amp: '&',
        lt: '<',
        gt: '>',
        quot: '"',
        apos: "'",
        nbsp: ' ',
        ensp: ' ',
        emsp: ' ',
        thinsp: ' ',
        zwnj: '',
        zwj: '',
        lrm: '',
        rlm: '',
        shy: '',
        ndash: '–',
        mdash: '—',
        rsquo: '’',
        lsquo: '‘',
        rdquo: '”',
        ldquo: '“',
        laquo: '«',
        raquo: '»',
        hellip: '…',
        bull: '•',
        middot: '·',
        deg: '°',
        times: '×',
        divide: '÷',
        plusmn: '±',
        sup2: '²',
        sup3: '³',
        frac12: '½',
        micro: 'µ',
        trade: '™',
        reg: '®',
        copy: '©',
        eth: 'đ',
        ETH: 'Đ',
    }),
);
// Older pages name accented letters ("C&acirc;n bằng"): the letter plus a combining accent.
const ACCENTS = {
    grave: '\u0300',
    acute: '\u0301',
    circ: '\u0302',
    tilde: '\u0303',
    uml: '\u0308',
    ring: '\u030a',
    cedil: '\u0327',
};

export function decode(text) {
    return text.replace(
        /&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi,
        (match, code) => {
            if (code[0] === '#') {
                const point =
                    code[1].toLowerCase() === 'x'
                        ? parseInt(code.slice(2), 16)
                        : Number(code.slice(1));
                return point > 0 && point <= 0x10ffff
                    ? String.fromCodePoint(point)
                    : match;
            }
            const accented = code.match(
                /^([a-z])(grave|acute|circ|tilde|uml|ring|cedil)$/i,
            );
            if (accented)
                return (
                    accented[1] + ACCENTS[accented[2].toLowerCase()]
                ).normalize('NFC');
            return (
                ENTITIES.get(code) ?? ENTITIES.get(code.toLowerCase()) ?? match
            );
        },
    );
}

/** One line of readable text: composed accents, no invisible characters, single spaces. */
export function clean(text) {
    return text
        .normalize('NFC')
        .replace(/[\u200b\u2060\ufeff\u00ad]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function attributes(source) {
    const found = Object.create(null);
    for (const [, name, double, single, bare] of source.matchAll(
        /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g,
    ))
        found[name.toLowerCase()] ??= decode(double ?? single ?? bare ?? '');
    return found;
}

/**
 * Markup → tree of `{ tag, attrs, children, parent }` elements and `{ text }` nodes.
 * Follows the browser where real pages need it: paragraphs, list items and table cells left
 * open are closed by the next one, and an end tag with no matching start tag is ignored.
 */
export function parseHtml(html) {
    const root = { tag: '#root', attrs: {}, children: [], parent: null };
    const open = [root];
    const top = () => open[open.length - 1];
    const addText = (text) => {
        if (text) top().children.push({ text, parent: top() });
    };
    // Closes the nearest open `tags` element, unless a `stops` element comes first.
    const closeOpen = (tags, stops) => {
        for (let i = open.length - 1; i > 0; i--) {
            if (tags.has(open[i].tag)) {
                open.length = i;
                return;
            }
            if (stops.has(open[i].tag)) return;
        }
    };
    const start = (tag, attrs) => {
        if (ENDS_PARAGRAPH.has(tag)) closeOpen(PARAGRAPH, SCOPE);
        if (IMPLIED_END.has(tag)) closeOpen(...IMPLIED_END.get(tag));
        const node = { tag, attrs, children: [], parent: top() };
        top().children.push(node);
        if (!VOID.has(tag)) open.push(node);
        return node;
    };
    const end = (tag) => {
        const inline = !BLOCK.has(tag) && !TABLE.has(tag);
        for (let i = open.length - 1; i > 0; i--) {
            const node = open[i];
            if (node.tag === tag) {
                open.length = i;
                return;
            }
            // A stray end tag never closes the block, cell or table it is written in.
            if (
                TABLE.has(tag)
                    ? node.tag === 'table'
                    : SCOPE.has(node.tag) || (inline && BLOCK.has(node.tag))
            )
                return;
        }
    };

    const TAG =
        /<(?:!--[\s\S]*?-->|[!?][^>]*>|\/([a-zA-Z][^\s>/]*)[^>]*>|([a-zA-Z][^\s>/]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>)/g;
    let at = 0;
    for (let match; (match = TAG.exec(html));) {
        addText(decode(html.slice(at, match.index)));
        at = TAG.lastIndex;
        const [, closing, opening, attrs = ''] = match;
        if (closing) {
            end(closing.toLowerCase());
        } else if (opening) {
            const tag = opening.toLowerCase();
            const node = start(tag, attributes(attrs.replace(/\/\s*$/, '')));
            if (RAW.has(tag)) {
                const close = new RegExp('</' + tag + '\\b[^>]*>', 'gi');
                close.lastIndex = at;
                const found = close.exec(html);
                const content = html.slice(at, found ? found.index : undefined);
                node.children.push({
                    text: UNSEEN.has(tag) ? content : decode(content),
                    parent: node,
                });
                open.length = open.indexOf(node);
                at = TAG.lastIndex = found ? close.lastIndex : html.length;
            }
        }
    }
    addText(decode(html.slice(at)));
    return root;
}

export const attr = (node, name) => node?.attrs?.[name] ?? null;
export const hasClass = (node, name) =>
    (attr(node, 'class') ?? '').split(/\s+/).includes(name);

/** `tag`, `.class`, `#id`, `[attr]`, `[attr=value]`, `[attr*=part]` and any mix of them. */
function matcher(part) {
    const tests = [];
    const rest = part.replace(
        /\[([\w-]+)(?:(\*?)=([^\]]*))?\]|([#.]?)([\w-]+)/g,
        (_, name, contains, value, prefix, word) => {
            if (name)
                tests.push((node) => {
                    const actual = attr(node, name);
                    if (actual === null) return false;
                    if (value === undefined) return true;
                    return contains ? actual.includes(value) : actual === value;
                });
            else if (prefix === '.') tests.push((node) => hasClass(node, word));
            else if (prefix === '#')
                tests.push((node) => attr(node, 'id') === word);
            else tests.push((node) => node.tag === word.toLowerCase());
            return '';
        },
    );
    if (rest) throw new Error('Unsupported selector: ' + part);
    return (node) => tests.every((test) => test(node));
}

/** Elements under `node` matching `selector`; a space means "anywhere inside", as in CSS. */
export function all(node, selector) {
    const parts = selector.trim().split(/\s+/).map(matcher);
    const last = parts.pop();
    const inside = (element) => {
        let ancestor = element.parent;
        for (let i = parts.length - 1; i >= 0; i--) {
            while (ancestor && ancestor !== node.parent && !parts[i](ancestor))
                ancestor = ancestor.parent;
            if (!ancestor || ancestor === node.parent) return false;
            ancestor = ancestor.parent;
        }
        return true;
    };
    const found = [];
    const visit = (element) => {
        for (const child of element.children ?? []) {
            if (child.tag === undefined) continue;
            if (last(child) && inside(child)) found.push(child);
            visit(child);
        }
    };
    if (node) visit(node);
    return found;
}

export const first = (node, selector) => all(node, selector)[0] ?? null;

const BREAK = Symbol('line break');

function pieces(node, skip, out) {
    if (node.tag === undefined) {
        out.push(node.text);
        return;
    }
    if (UNSEEN.has(node.tag) || skip?.(node)) return;
    if (node.tag === 'br') {
        out.push(BREAK);
        return;
    }
    const block = BLOCK.has(node.tag);
    if (block) out.push(BREAK);
    // Cells of a row read as words of one line.
    else if (CELL.has(node.tag)) out.push(' ');
    for (const child of node.children) pieces(child, skip, out);
    if (block) out.push(BREAK);
}

/**
 * The text of `node` as a visitor reads it, line by line. Blocks and <br> start a new line;
 * inline markup joins without a space, so a word split by a <span> stays one word.
 * `skip(element)` leaves an element and its content out.
 */
export function lines(node, skip) {
    if (!node) return [];
    const out = [];
    pieces(node, skip, out);
    const found = [];
    let line = '';
    for (const piece of [...out, BREAK]) {
        if (piece !== BREAK) {
            line += piece;
            continue;
        }
        line = clean(line);
        if (line) found.push(line);
        line = '';
    }
    return found;
}

/** The text of `node` on one line. */
export const text = (node) => lines(node).join(' ');
