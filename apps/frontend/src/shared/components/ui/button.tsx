import { Slot } from '@radix-ui/react-slot';
import * as React from 'react';

import { cn } from '../../../shared/utils';

import { buttonVariants, type ButtonProps } from './button.utils';

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    const classes = buttonVariants({ variant, size, className });

    return <Comp className={cn(classes)} ref={ref} {...props} />;
  },
);
Button.displayName = 'Button';

export { Button };
