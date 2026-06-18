import "./fire-detector-icon.styles.scss";

interface IFireDetectorIconProps {
    size?: number;
    isActive: boolean;
    bulbColor?: string;
}

export const FireDetectorIcon = ({ size = 200, isActive, bulbColor = "#ff3b00"}: IFireDetectorIconProps) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 400 400"
        width={size}
        height={size}
    >
        <defs>
            <filter id="softGlow">
                <feGaussianBlur stdDeviation="3" result="blur"/>
                <feMerge>
                    <feMergeNode in="blur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
        </defs>

        {/* outer circle */}
        <circle
            cx="200"
            cy="200"
            r="180"
            fill="#ffffff"
            stroke="#000000"
            strokeWidth="6"
        />

        {/* inner circle */}
        <circle
            cx="200"
            cy="200"
            r="120"
            fill="#ffffff"
            stroke="#00000095"
            strokeWidth="6"
        />

        {/* lamp */}
        <circle
            cx="280"
            cy="160"
            r="18"
            fill={isActive ? bulbColor : "#b5b5b570"}
            stroke={isActive ? bulbColor : "#b5b5b5"}
            strokeWidth="4"
            className={isActive ? "bulb" : ""}
        />
    </svg>
)