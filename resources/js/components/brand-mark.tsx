/** Racket head with three mains and three crosses, tilted like the story pose. */
export default function BrandMark({
    size = 32,
    className,
}: {
    size?: number;
    className?: string;
}) {
    return (
        <svg
            className={className}
            width={size}
            height={size}
            viewBox="0 0 32 32"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            aria-hidden="true"
            focusable="false"
        >
            <g transform="rotate(28 19 12)">
                <ellipse
                    cx="19"
                    cy="11.5"
                    rx="7.5"
                    ry="9.5"
                    strokeWidth="2.2"
                />
                <path
                    d="M16 2.8V20.2M19 2V21M22 2.8V20.2M12 8H26M11.5 11.5H26.5M12 15H26"
                    strokeWidth="1.1"
                />
                <path d="M19 21.2V31" strokeWidth="2.2" />
            </g>
        </svg>
    );
}
