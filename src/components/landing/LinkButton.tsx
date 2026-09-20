import type { ReactNode } from "react";
import { Link, type LinkProps } from "react-router";
import { linkButtonClass, type LinkButtonSize, type LinkButtonVariant } from "./linkButtonClass";

/*
 * A router link that looks like the Button primitive. Navigation stays a real
 * anchor (middle-click, open in new tab, screen-reader "link") instead of a
 * button with an onClick.
 */

export function LinkButton({
  variant = "primary",
  size = "md",
  icon,
  className,
  children,
  ...rest
}: LinkProps & { variant?: LinkButtonVariant; size?: LinkButtonSize; icon?: ReactNode }) {
  return (
    <Link className={linkButtonClass(variant, size, className)} {...rest}>
      {children}
      {icon}
    </Link>
  );
}
