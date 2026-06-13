import {ElementType, ReactNode} from "react";

type TMode = "light" | "dark";

export interface IHeadingProps {
    eyebrow?: string;
    children: ReactNode;
    as?: ElementType;
    mode?: TMode;
}