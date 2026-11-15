import { redirect } from 'next/navigation';

import HomePage from './page';

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

describe('HomePage', () => {
  it('redirects root requests to /login', () => {
    HomePage();
    expect(redirect).toHaveBeenCalledWith('/login');
  });
});
