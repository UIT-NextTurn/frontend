import { useQueryClient } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { useQueryState } from 'nuqs';

import RootLayout from './layout';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams('tab=overview'),
  usePathname: () => '/',
}));

function ProviderProbe() {
  const queryClient = useQueryClient();
  const [tab] = useQueryState('tab');

  return (
    <div data-testid="probe" data-has-client={String(Boolean(queryClient))}>
      {tab ?? 'none'}
    </div>
  );
}

describe('RootLayout', () => {
  it('sets lang="vi" and mounts TanStack Query and NuqsAdapter providers', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(
        <RootLayout>
          <ProviderProbe />
        </RootLayout>
      );

      const htmlElement = document.querySelector('html');
      expect(htmlElement).toHaveAttribute('lang', 'vi');
      expect(screen.getByTestId('probe')).toHaveAttribute('data-has-client', 'true');
      expect(screen.getByTestId('probe')).toHaveTextContent('overview');
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
