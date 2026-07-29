import LoadingPage from "~/components/layouts/LoadingPage"

export default function Table({
    columnNames,
    loading,
    children
}: {
    columnNames: { name: string; className?: string; }[];
    loading: false | string;
    children: React.ReactNode;
}) {
    return (

        <table className="rounded-lg shadow-lg w-full">
            <thead>
                <tr className="bg-gray-100 transition dark:bg-gray-800 rounded-lg">
                    {columnNames.map(({ name, className }) => (
                        <th
                            scope="col"
                            className={`px-2 py-4 text-left text-sm font-medium ${className || ''}`}
                            key={name}
                        >
                            {name}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody className="gap-2 h-full">
                {(loading !== false) && (
                    <tr>
                        <td colSpan={10}>
                            <div className="my-12 flex justify-center self-center w-full">
                                <LoadingPage override={loading} />
                            </div>
                        </td>
                    </tr>
                )}
                {loading == false && children}
                <tr className="h-full"></tr>
            </tbody>

        </table>
    )
}