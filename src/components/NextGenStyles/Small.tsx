export default function Small({ children, className = '' }: { children: any; className?: string; }) {
    return (
        <span className={`text-sm text-gray-500 ${className}`}>{children}</span>
    )
}