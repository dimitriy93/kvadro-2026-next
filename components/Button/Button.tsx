import {ButtonHTMLAttributes, ReactNode} from "react";
import "./styles.scss";

interface IButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    mode: 'primary' | 'secondary',
    children: ReactNode,
}

export const Button = ({ children, mode }: IButtonProps) => (
    <button className={`btn-${mode}`}>
        {children}
    </button>
)