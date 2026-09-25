import { Link, type LinkProps } from 'react-router'

export function TextLink({ className = '', ...props }: LinkProps) {
  return (
    <Link
      className={`font-medium text-indigo-600 hover:underline dark:text-indigo-400 ${className}`}
      {...props}
    />
  )
}
