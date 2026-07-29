export default function TableRow({
    index,
    onClick,
    datas,
    className
}: {
    className?: string;
    index: number;
    onClick?: () => void;
    datas?: { children: React.ReactNode, id: string; className?: string; dataStyle?: 'end'; }[];
}) {
    return (
        <tr
            className={`py-1 h-min hover:bg-blue-200 transition dark:hover:bg-blue-800 ${index % 2 == 1 ? 'bg-white transition dark:bg-gray-800' : 'bg-gray-100 transition dark:bg-gray-700'} ${className || ''}`}
            onClick={onClick}
        >
            {datas?.map(data => (
                <td className={`py-2 text-left ${data?.className || ''} ${data?.dataStyle == 'end' ? 'py-2 flex flex-row gap-2 justify-end pr-2 align-middle flex-wrap self-center' : ''}`} key={data.id}>{data.children}</td>
            ))}
        </tr>
    )
}