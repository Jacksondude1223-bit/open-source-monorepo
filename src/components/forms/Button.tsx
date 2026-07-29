import { cva, cx, VariantProps } from 'class-variance-authority';
import clsx from 'clsx';
import Link from 'next/link';
import { ComponentPropsWithRef, JSX, SVGProps } from 'react';
import { useWorkspace } from '../contexts/workspace';
export type ButtonVariants = 'default' | 'danger' | 'light_danger' | 'success' | 'primary' | 'blue' | 'discrete' | 'light_warning' | 'warning'

const styles = cva('transition-colors rounded-md', {
  variants: {
    disabled: {
      true: 'opacity-60 cursor-not-allowed',
    },
    variant: {
      default: 'bg-gray-500 hover:bg-gray-600 text-white',
      danger: 'bg-red-500 hover:bg-red-600 text-white',
      light_danger: 'bg-red-100 hover:bg-red-200 text-red-500 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400',
      success: 'bg-green-500 hover:bg-green-600 text-white',
      primary: 'bg-blue-600 hover:bg-blue-700 text-white',
      blue: 'bg-blue-100 hover:bg-blue-200 text-blue-600 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-400',
      discrete: 'bg-gray-100 hover:bg-gray-200 text-gray-600 transition dark:bg-gray-800 transition dark:hover:bg-gray-900 transition dark:text-gray-400',
      discrete_danger: 'bg-gray-100 hover:bg-red-200 text-gray-600 transition dark:bg-gray-800 transition dark:hover:bg-red-900 transition dark:text-gray-400',
      discrete_success: 'bg-gray-100 hover:bg-green-200 text-gray-600 transition dark:bg-gray-800 transition dark:hover:bg-green-900 transition dark:text-gray-400',
      light_warning: 'bg-orange-100 hover:bg-orange-200 text-yellow-600 dark:bg-orange-900/30 dark:hover:bg-orange-900/50 dark:text-orange-400',
      warning: 'bg-yellow-100 hover:bg-yellow-200 text-yellow-600 dark:bg-yellow-900/30 dark:hover:bg-yellow-900/50 dark:text-yellow-400',
      pagination: 'bg-gray-100 hover:bg-gray-300 text-gray-700 dark:bg-gray-800 dark:hover:bg-gray-900 hover:bg-gray-600 border dark:border-gray-700 border-gray-300 dark:text-white',
    },
    size: {
      small: 'py-2 px-3 font-medium text-xs',
      medium: 'py-2 px-3 font-medium text-sm',
      large: 'py-3 px-4 font-medium text-medium',
    },
    width: {
      full: 'w-full',
      min: 'w-min',
    },
  },
  defaultVariants: {
    size: 'small',
    variant: 'default',
  },
});

type Props = {
  href?: string;
  icon?: any;
} & Partial<ComponentPropsWithRef<'button'> & ComponentPropsWithRef<'a'>> &
  VariantProps<typeof styles>;

export default function Button({ href, icon, ...props }: Props): JSX.Element {
  const workspace = useWorkspace();
  const brandColor = workspace?.brandColor || 'blue';
  
  const Content = href ? 'a' : 'button';
  const Icon = icon;

  // Generate brand color classes for primary and blue variants
  const getBrandColorClasses = () => {
    if (props.variant === 'primary') {
      return `bg-${brandColor}-600 hover:bg-${brandColor}-700 text-white`;
    }
    if (props.variant === 'blue') {
      return `bg-${brandColor}-100 hover:bg-${brandColor}-200 text-${brandColor}-600 dark:bg-${brandColor}-900/30 dark:hover:bg-${brandColor}-900/50 dark:text-${brandColor}-400`;
    }
    return null;
  };

  const brandColorClasses = getBrandColorClasses();

  const component = (
    <Content
      {...props}
      className={cx(
        //@ts-expect-error this works
        styles(props),
        props.className,
        brandColorClasses,
        href && 'flex flex-row justify-center'
      )}
      disabled={props.disabled}
    >
      <div className={cx('flex items-center justify-center text-center')}>
        {Icon && (
          <span className={props.children ? `mr-2` : ''}>
            <Icon className={clsx('h-5 w-5', props.children && 'mr-2 -ml-1')} />
          </span>
        )}
        {props.children}
      </div>
    </Content>
  );

  return href ? (
    <Link href={href} legacyBehavior={true}>
      {component}
    </Link>
  ) :
    component
}
