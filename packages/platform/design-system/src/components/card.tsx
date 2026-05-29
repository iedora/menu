import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

type CardIndexProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

type CardVisualProps = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode;
};

type CardTitleProps = HTMLAttributes<HTMLHeadingElement> & {
  children: ReactNode;
  as?: "h2" | "h3" | "h4" | "h5" | "h6";
};

type CardDescProps = HTMLAttributes<HTMLParagraphElement> & {
  children: ReactNode;
};

type CardFootProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

/**
 * Iedora Manual § VI.3. A hairline frame, paper bg, square corners. Hover
 * darkens the border. Compose with the slot helpers below.
 */
export function Card({ className, children, ...rest }: CardProps) {
  return (
    <div {...rest} className={cn("ds-card", className)}>
      {children}
    </div>
  );
}

export function CardIndex({ className, children, ...rest }: CardIndexProps) {
  return (
    <div {...rest} className={cn("ds-card__idx", className)}>
      {children}
    </div>
  );
}

export function CardVisual({ className, children, ...rest }: CardVisualProps) {
  return (
    <div
      {...rest}
      className={cn("ds-card__visual", className)}
      aria-hidden={children ? undefined : "true"}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  as: Tag = "h5",
  className,
  children,
  ...rest
}: CardTitleProps) {
  return (
    <Tag {...rest} className={cn("ds-card__title", className)}>
      {children}
    </Tag>
  );
}

export function CardDesc({ className, children, ...rest }: CardDescProps) {
  return (
    <p {...rest} className={cn("ds-card__desc", className)}>
      {children}
    </p>
  );
}

export function CardFoot({ className, children, ...rest }: CardFootProps) {
  return (
    <div {...rest} className={cn("ds-card__foot", className)}>
      {children}
    </div>
  );
}
