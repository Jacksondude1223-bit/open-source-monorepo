import { PropsWithChildren } from 'react';
import Spinner from '~/components/ui/Spinner';

export default function LoadingPage({
  children,
  override = 'Loading your data...',
}: PropsWithChildren<{
  override?: string;
}>) {
  return (
    <div className="w-full justify-center flex flex-row">
      {children}
      <div className="flex flex-row justify-center gap-2">
        <Spinner className="mt-2 self-center align-middle" align="center" />
        <div>
          <h1 className="text-lg font-bold transition dark:text-gray-100">Please wait</h1>
          <p className='transition dark:text-gray-300'>{override}</p>
        </div>
      </div>
    </div>
  );
}
