'use client';

import * as React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button, type ButtonProps } from '@/components/ui/button';

/**
 * A destructive action behind a confirm dialog. Dark, never red. The trigger
 * renders `children`; `onConfirm` runs only after the user confirms.
 */
export function ConfirmButton({
  title,
  description,
  confirmLabel = 'Remove',
  onConfirm,
  children,
  variant = 'destructive',
  ...props
}: Omit<ButtonProps, 'onClick'> & {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant={variant} {...props}>
          {children}
        </Button>
      </AlertDialogTrigger>
      <ConfirmDialogBody
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        onConfirm={onConfirm}
      />
    </AlertDialog>
  );
}

/**
 * A confirm dialog opened from code (`open`/`onOpenChange`), for cases where
 * the trigger isn't a button — a checkbox being unchecked, a select change.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  ...body
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <ConfirmDialogBody {...body} />
    </AlertDialog>
  );
}

function ConfirmDialogBody({
  title,
  description,
  confirmLabel = 'Remove',
  onConfirm,
}: {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        {description ? (
          <AlertDialogDescription>{description}</AlertDialogDescription>
        ) : (
          <AlertDialogDescription className="sr-only">
            Confirm or cancel.
          </AlertDialogDescription>
        )}
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirm}>
          {confirmLabel}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}
