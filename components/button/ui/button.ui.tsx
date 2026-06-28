import { ButtonHTMLAttributes, ReactNode } from 'react';
import './button.styles.scss';

interface IButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  mode: 'primary' | 'secondary' | 'primary-inverted';
  children: ReactNode;
}

export const Button = ({ children, mode, ...props }: IButtonProps) => (
  <button className={`btn btn-${mode}`} {...props}>
    {children}
  </button>
);
