const Logo = ({
  size,
  fill,
  color,
  className,
}: {
  size?: string;
  fill?: string;
  color?: string;
  className?: string;
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size || "24"}
      height={size || "24"}
      viewBox="0 0 48 48"
      class={className || ""}
    >
      <g
        fill={fill || "none"}
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="3"
      >
        <path
          color={color}
          d="M11.999 41a32.85 32.85 0 0 0 16.68-4.52c.665-.39.61-1.348-.081-1.691L25 33c3.303 0 10-1.337 10-1.337c7.147-6.948 10.78-16.97 9.848-26.842a1.85 1.85 0 0 0-1.67-1.67A33.2 33.2 0 0 0 28 5.25S26.348 9.142 26 11l-2.024-2.817a.98.98 0 0 0-1.309-.271C13.264 13.687 7 23.36 7 36.5"
        />
        <path color={color} d="M3 45c5-14.5 21-27 34-34" />
      </g>
    </svg>
  );
};

export default Logo;
