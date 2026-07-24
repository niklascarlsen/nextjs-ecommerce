'use client';

import {ModalDialog} from '@/components/shared/modal/ModalDialog';
import {ModalCloseButton} from '@/components/shared/modal/ModalCloseButton';
import {FocusHeading} from '@/components/shared/FocusHeading';
import {useEffect, useId, useRef, useState} from 'react';
import ProductForm from './products/ProductForm';
import CategoryForm from './categories/CategoryForm';
import {useAdmin} from '@/context/AdminProvider';
import {Product} from '@/lib/types/db-types';
import {Category} from '@/lib/types/category-types';
import {ADMIN_FORM_DIALOG_ID} from './adminForm.constants';
import {focusInitialIn} from '@/lib/focus';

type DisplayedForm = {
  type: 'category' | 'product';
  data: Category | Product | null;
  session: number;
};

export default function FormWrapper({onClose}: {onClose: () => void}) {
  const {activeSidebar, editData} = useAdmin();
  const titleId = useId();
  const isFormOpen = activeSidebar !== null;
  const [displayed, setDisplayed] = useState<DisplayedForm | null>(null);
  const sessionRef = useRef(0);

  useEffect(() => {
    if (activeSidebar) {
      sessionRef.current += 1;
      setDisplayed({
        type: activeSidebar,
        data: editData,
        session: sessionRef.current,
      });
    }
  }, [activeSidebar, editData]);

  useEffect(() => {
    const dialog = document.getElementById(
      ADMIN_FORM_DIALOG_ID,
    ) as HTMLDialogElement | null;
    if (!dialog) return;

    if (isFormOpen) {
      const frame = requestAnimationFrame(() => focusInitialIn(dialog));
      return () => cancelAnimationFrame(frame);
    }

    if (dialog.open) dialog.close();
  }, [isFormOpen]);

  const isEditMode = displayed?.data != null;

  const isProduct = (data: Category | Product | null): data is Product =>
    data !== null && 'price' in data;

  const isCategory = (data: Category | Product | null): data is Category =>
    data !== null && 'type' in data;

  const renderForm = () => {
    if (!displayed) return null;

    switch (displayed.type) {
      case 'product':
        return (
          <ProductForm
            mode={isEditMode ? 'edit' : 'create'}
            initialData={isProduct(displayed.data) ? displayed.data : null}
          />
        );
      case 'category':
        return (
          <CategoryForm
            mode={isEditMode ? 'edit' : 'create'}
            initialData={isCategory(displayed.data) ? displayed.data : null}
          />
        );
      default:
        return null;
    }
  };

  const getTitle = () => {
    if (!displayed) return '';
    if (displayed.type === 'product') {
      return isEditMode ? 'edit product' : 'new product';
    }
    return isEditMode ? 'edit category' : 'new category';
  };

  return (
    <ModalDialog
      id={ADMIN_FORM_DIALOG_ID}
      variant='right'
      className='w-full  max-w-full sm:max-w-[640px]'
      onClose={onClose}
      aria-labelledby={titleId}
    >
      <div className='flex flex-col h-full bg-white outline-none'>
        <div className='flex justify-between items-center pl-4 sm:pl-6 pt-4 pb-0.5'>
          <FocusHeading
            as='h1'
            id={titleId}
            className='font-medium uppercase text-base'
          >
            {getTitle()}
          </FocusHeading>
          <ModalCloseButton
            dialogId={ADMIN_FORM_DIALOG_ID}
            size={16}
            strokeWidth={2}
            className='pl-6 pr-5 py-3 mr-2'
            aria-label='Close form'
          />
        </div>

        <div
          key={displayed?.session}
          className='px-3 sm:px-5 flex-1 overflow-y-auto'
        >
          {renderForm()}
        </div>
      </div>
    </ModalDialog>
  );
}
