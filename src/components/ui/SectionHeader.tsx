import { JSX } from "react";
import Header from "../NextGenStyles/Header";

export default function SectionHeader({
  title = '',
  desc = '',
  enableMt = true,
  icon: Icon,
  children,
}: {
  title?: string;
  desc?: string;
  enableMt?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  children?: React.ReactNode;
}): JSX.Element {
  return (
    <div
      className={`w-full flex flex-row justify-between mb-2 pb-2 border-b-2 transition dark:border-gray-800 border-gray-100 ${enableMt ? 'mt-4' : ''
        }`}
    >
      <div className="flex flex-row items-center gap-2">
        {Icon && <Icon className="w-5 h-5 shrink-0 text-gray-400" />}
        <div>
          <Header>{title}</Header>
          {desc && <h2 className="text-sm font-medium transition dark:text-gray-200">{desc}</h2>}
        </div>
      </div>
      {children}
    </div>
  );
}
