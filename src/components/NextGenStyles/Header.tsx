import { ReactNode } from "react";

export default function Header({ children, fontSize, className }: { className?: string; children: ReactNode; fontSize?: 'sm' | 'md' | 'xl' | 'lg' }) {
    // h3 className="whitespace-nowrap leading-6 text-gray-900 transition dark:text-gray-100 self-center align-middle text-xl font-bold"
    return (
        <h1 className={`${className} ${!fontSize ? 'text-lg' : fontSize == 'sm' ? 'text-sm' : fontSize == 'md' ? 'text-md' : fontSize == 'lg' ? 'text-lg' : fontSize == 'xl' ? 'text-xl' : ''} font-bold text-gray-900 dark:text-gray-100`}>
            {children}
        </h1>
    );
}