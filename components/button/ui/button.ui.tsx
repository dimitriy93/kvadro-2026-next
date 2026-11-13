import { ButtonHTMLAttributes, ReactNode } from 'react';
import './button.styles.scss';

interface IButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  mode: 'primary' | 'secondary' | 'primary-inverted';
  children: ReactNode;
}

export const Button = ({ children, mode, className, ...props }: IButtonProps) => (
  <button className={`btn btn-${mode}${className ? ` ${className}` : ''}`} {...props}>
    {children}
  </button>
);
