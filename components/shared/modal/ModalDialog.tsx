'use client';

import {ReactNode, useEffect, useRef, useState} from 'react';
import {cn} from '@/styles/style.utils';

export type PanelVariant = 'right' | 'left' | 'bottom' | 'top';

const DEFAULT_VARIANT: PanelVariant = 'right';

interface ModalDialogProps {
  id: string;
  children: ReactNode;
  className?: string;
  variant?: PanelVariant;
  onClose?: () => void;
  // Keep children in the DOM while closed. By default they unmount once the
  // close animation finishes (dialog shell always stays mounted).
  keepMounted?: boolean;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}

// Native <dialog> owns open/close and animates via CSS. We mount children on
// open and unmount on close, but wait for the exit animation to finish first
// (getAnimations().finished) so React does not cut it off. The shell stays
// mounted since that is what animates.
export function ModalDialog({
  id,
  children,
  className,
  variant = DEFAULT_VARIANT,
  onClose,
  keepMounted = false,
  'aria-labelledby': ariaLabelledby,
  'aria-describedby': ariaDescribedby,
}: ModalDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [contentMounted, setContentMounted] = useState(false);

  useEffect(() => {
    if (keepMounted) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleToggle = () => {
      if (dialog.open) setContentMounted(true);
    };

    const handleClose = () => {
      requestAnimationFrame(() => {
        const done = () => {
          if (!dialog.open) setContentMounted(false);
        };
        const anims = dialog.getAnimations({subtree: true});
        if (anims.length === 0) {
          done();
          return;
        }
        void Promise.all(
          anims.map((animation) => animation.finished.catch(() => {})),
        ).then(done);
      });
    };

    dialog.addEventListener('toggle', handleToggle);
    dialog.addEventListener('close', handleClose);
    return () => {
      dialog.removeEventListener('toggle', handleToggle);
      dialog.removeEventListener('close', handleClose);
    };
  }, [keepMounted]);

  const showChildren = keepMounted || contentMounted;

  return (
    <dialog
      ref={dialogRef}
      id={id}
      className={cn('modal-dialog', `modal-variant-${variant}`, className)}
      aria-labelledby={ariaLabelledby}
      aria-describedby={ariaDescribedby}
      closedby='any'
      onClose={onClose}
      // Fix for Safari aka New IE
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          (event.currentTarget as HTMLDialogElement).close();
        }
      }}
    >
      {showChildren ? children : null}
    </dialog>
  );
}
