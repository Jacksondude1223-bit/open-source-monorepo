export default function RobloxIcon({
  className,
}: {
  className?: string;
}): React.ReactNode {
  return (
    <>
      <span className="sr-only">Roblox</span>
      <svg
        className={className ? className : 'w-5 h-5'}
        aria-hidden="true"
        fill="currentColor"
        viewBox="3 3 24 24"
      >
        <path d="M8.3 3.7L3.6 21.8l18.1 4.6 4.6-18.1-18-4.6zm8 13.6l-3.5-.9.9-3.5 3.5.9-.9 3.5z" />
      </svg>
    </>
  );
}
