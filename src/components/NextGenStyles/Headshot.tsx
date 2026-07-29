import { useWorkspace } from "../contexts/workspace";

export default function Headshot({ src, alt = "User icon", size = 'normal', color = 'blue' }: { src: string; alt?: string; size?: 'normal'; color?: 'blue' }) {
    const workspace = useWorkspace();
    const brandColor = workspace?.brandColor || color;
    return (
        <img
            className={`inline-block h-14 w-14 self-center align-middle rounded-full bg-linear-to-br from-${brandColor}-500 to-${brandColor}-700 dark:border-${brandColor}-700 border shadow-lg`}
            src={src}
            alt={alt}
        />
    )
}