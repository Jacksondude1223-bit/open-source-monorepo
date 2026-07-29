import { BackspaceIcon } from "@heroicons/react/24/outline";
import Button from "../forms/Button";
import { useRouter } from "next/router";
import Header from "../NextGenStyles/Header";
import Small from "../NextGenStyles/Small";

export default function PageHeading({
  title,
  description = '',
  children,
  disableDivide = false,
  className = '',
  backUrl,
  loading = false,
}: {
  className?: string;
  disableDivide?: boolean;
  title?: string;
  description?: string | React.ReactNode;
  children?: React.ReactNode;
  backUrl?: string;
  loading?: boolean;
}) {
  const router = useRouter();

  const LoadingUI = () => { return (<div className="animate-pulse h-2 max-w-lg bg-slate-700 rounded"></div>) }

  return backUrl ? (
    <div
      className={`${!disableDivide && 'border-b border-gray-200 transition dark:border-gray-800'} ${description !== '' && 'pb-3'} fade-in animate-in slide-in-from-top mb-2 ${className}`}
    >
      <div className="flex flex-row items-center gap-2">
        <div className="shrink-0 self-center align-middle" onClick={() => {
          router.push(backUrl);
        }}>
          <Button variant="discrete" icon={BackspaceIcon}></Button>
        </div>
        <div className="min-w-0 self-center align-middle">
          {title && (
            <Header className="wrap-break-word">{loading == true ? <LoadingUI /> : title}</Header>
          )}
          {(description !== '' || !description) && (
            <Small>{description}</Small>
          )}
        </div>
      </div>
      {(children && children) || <></>}
    </div>
  ) : (
    <div
      className={`${!disableDivide && 'border-b border-gray-200 transition dark:border-gray-800'} ${description !== '' && 'pb-3'} flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4 fade-in animate-in slide-in-from-top mb-2 ${className}`}
    >
      <div className="flex flex-col justify-start text-left min-w-0">
        <Header className="wrap-break-word">{loading == true ? <LoadingUI /> : title}</Header>
        {(description !== '' || !description) && (
          <Small className="text-start">{description}</Small>
        )}
      </div>
      {children && <div className="shrink-0 w-full sm:w-auto">{children}</div>}
    </div>
  );
}
