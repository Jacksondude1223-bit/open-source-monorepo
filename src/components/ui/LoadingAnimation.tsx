import { JSX } from 'react';
import Spinner from './Spinner';

export default function LoadingAnimation(): JSX.Element {
  return (
    <div className="w-full h-full flex flex-row justify-center">
      <Spinner size={10} align="center" />
    </div>
  );
}
