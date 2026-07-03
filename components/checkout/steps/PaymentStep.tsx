'use client';

import {useState} from 'react';
import {useForm, useWatch} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {FloatingLabelInput} from '@/components/shared/ui/floatingLabelInput';
import OrderTotals from '../shared/OrderTotals';
import {
  PaymentFormData,
  paymentSchema,
  DeliveryFormData,
} from '@/lib/validators/checkout-validation';
import {Button} from '@/components/shared/ui/button';
import {Accordion} from '@/components/shared/ui/Accordion';
import {SiKlarna} from 'react-icons/si';
import Image from 'next/image';
import {CiCreditCard1} from 'react-icons/ci';
import {createOrder} from '@/actions/orders.actions';
import {toast} from 'sonner';
import {CreateOrderResult} from '@/lib/types/db-types';

function isSuccessfulOrder(
  result: CreateOrderResult,
): result is {success: true; orderId: string} {
  return result.success === true;
}
interface PaymentStepProps {
  onBack?: () => void;
  onNext: (orderData: CreateOrderResult) => void;
  deliveryData?: DeliveryFormData | null;
}

export default function PaymentStep({onNext, deliveryData}: PaymentStepProps) {
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      paymentMethod: undefined,
      cardNumber: '1234 5678 9012 3456',
      expiryDate: '01/25',
      cvv: '123',
      swishNumber: '123 456 7890',
      klarnaNumber: '1234567890',
      campaignCode: '',
    },
  });

  const selectedMethod = useWatch({
    control: form.control,
    name: 'paymentMethod',
  });

  const handleSubmit = async (data: PaymentFormData) => {
    setIsLoading(true);
    try {
      const paymentInfo = {
        method: data.paymentMethod as 'card' | 'swish' | 'klarna',
      };
      if (!deliveryData) {
        throw new Error('Delivery data is required');
      }
      const result = await createOrder(deliveryData, paymentInfo);
      if (!isSuccessfulOrder(result)) {
        throw new Error(result.error || 'Failed to create order');
      }
      onNext(result);
    } catch (error) {
      console.error('Error processing payment:', error);
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'An unexpected server error occurred. Payment could not be completed.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <form onSubmit={form.handleSubmit(handleSubmit)} className='space-y-8'>
        <h3 className='font-semibold uppercase text-base mb-5'>
          PAYMENT METHOD
        </h3>
        <input type='hidden' {...form.register('paymentMethod')} />

        <Accordion.Root
          type='single'
          collapsible={false}
          className='space-y-4 '
          value={selectedMethod}
          onValueChange={(value) => {
            if (typeof value === 'string') {
              form.setValue(
                'paymentMethod',
                value as 'card' | 'swish' | 'klarna',
                {
                  shouldValidate: true,
                  shouldDirty: true,
                },
              );
            }
          }}
        >
          <Accordion.Item
            value='card'
            className='border overflow-hidden  transition-colors duration-200 data-[state=open]:border-black'
          >
            <Accordion.Trigger
              showChevron={false}
              className='px-4 py-3 cursor-pointer w-full outline-none focus-visible:outline-none pl-4 pr-2.5 data-[state=closed]:focus-visible:ring-2 data-[state=closed]:focus-visible:ring-inset data-[state=closed]:focus-visible:ring-black'
            >
              <div className='flex items-center gap-3 w-full data-[state=open]:font-semibold'>
                <div className='p-2'>
                  <CiCreditCard1 size={32} />
                </div>
                <p className='font-medium'>Visa, Mastercard</p>
              </div>
            </Accordion.Trigger>
            <Accordion.Content>
              <div className='space-y-4 px-4 py-3'>
                <FloatingLabelInput
                  {...form.register('cardNumber')}
                  type='text'
                  id='cardNumber'
                  label='Card number'
                  hasError={!!form.formState.errors.cardNumber}
                  errorMessage={form.formState.errors.cardNumber?.message}
                />

                <div className='grid grid-cols-2 gap-4'>
                  <div>
                    <FloatingLabelInput
                      {...form.register('expiryDate')}
                      type='text'
                      id='expiryDate'
                      label='Expiry date'
                      hasError={!!form.formState.errors.expiryDate}
                      errorMessage={form.formState.errors.expiryDate?.message}
                    />
                  </div>
                  <div>
                    <FloatingLabelInput
                      {...form.register('cvv')}
                      type='text'
                      id='cvv'
                      label='CVV'
                      hasError={!!form.formState.errors.cvv}
                      errorMessage={form.formState.errors.cvv?.message}
                    />
                  </div>
                </div>
              </div>
            </Accordion.Content>
          </Accordion.Item>

          <Accordion.Item
            value='swish'
            className='border overflow-hidden  transition-colors duration-200 data-[state=open]:border-black'
          >
            <Accordion.Trigger
              showChevron={false}
              className='px-4 py-3 cursor-pointer w-full outline-none focus-visible:outline-none pl-4 pr-2.5 data-[state=closed]:focus-visible:ring-2 data-[state=closed]:focus-visible:ring-inset data-[state=closed]:focus-visible:ring-black'
            >
              <div className='flex items-center gap-3 w-full data-[state=open]:font-semibold'>
                <div className='p-2'>
                  <div className='w-8 h-8 relative'>
                    <Image
                      src='/images/swish-logo-official.svg'
                      alt='Swish logo'
                      fill
                      sizes='32px'
                      priority
                      className='object-contain w-auto h-auto'
                    />
                  </div>
                </div>
                <p className='font-medium'>Swish</p>
              </div>
            </Accordion.Trigger>
            <Accordion.Content>
              <div className='px-4 py-3'>
                <FloatingLabelInput
                  {...form.register('swishNumber')}
                  type='text'
                  id='swishNumber'
                  label='Swish number'
                  hasError={!!form.formState.errors.swishNumber}
                  errorMessage={form.formState.errors.swishNumber?.message}
                />
              </div>
            </Accordion.Content>
          </Accordion.Item>

          <Accordion.Item
            value='klarna'
            className='border overflow-hidden  transition-colors duration-200 data-[state=open]:border-black'
          >
            <Accordion.Trigger
              showChevron={false}
              className='px-4 py-3 cursor-pointer w-full outline-none focus-visible:outline-none pl-4 pr-2.5 data-[state=closed]:focus-visible:ring-2 data-[state=closed]:focus-visible:ring-inset data-[state=closed]:focus-visible:ring-black'
            >
              <div className='flex items-center gap-3 w-full data-[state=open]:font-semibold'>
                <div className='p-2'>
                  <SiKlarna size={32} className='text-[#ffb3c7]' />
                </div>
                <p className='font-medium'>Klarna</p>
              </div>
            </Accordion.Trigger>
            <Accordion.Content>
              <div className='px-4 py-3'>
                <p className='text-sm text-gray-600'>Pay later with Klarna</p>
                <p className='text-xs text-gray-500 mt-2'>
                  When you click &quot;Pay&quot; you will be redirected to
                  Klarna&apos;s website to complete your payment.
                </p>
              </div>
            </Accordion.Content>
          </Accordion.Item>
        </Accordion.Root>

        <div className='md:hidden mt-6'>
          <OrderTotals />
        </div>

        <Button
          type='submit'
          className='px-4 py-3 mt-0 h-16 cursor-pointer bg-black font-bold text-xs uppercase text-white w-full'
          disabled={isLoading || !selectedMethod}
        >
          {isLoading
            ? 'Processing...'
            : selectedMethod
              ? 'Submit payment'
              : 'Select payment method'}
        </Button>
      </form>
    </div>
  );
}
