import { render, screen } from '@testing-library/react';
import { createRef } from 'react';

import { Alert, AlertDescription, AlertTitle } from './alert';
import { Button } from './button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './card';
import { Input } from './input';
import { Label } from './label';

describe('UI primitives', () => {
  it('renders accessible Button with >= 44px touch-target classes and supports asChild', () => {
    render(
      <>
        <Button size="lg">Tiếp tục</Button>
        <Button asChild variant="secondary">
          <a href="/login">Quay lại</a>
        </Button>
      </>
    );

    const primaryButton = screen.getByRole('button', { name: 'Tiếp tục' });
    expect(primaryButton.className).toContain('min-h-[48px]');
    expect(primaryButton.className).toContain('focus-visible:ring-4');

    const linkButton = screen.getByRole('link', { name: 'Quay lại' });
    expect(linkButton).toHaveAttribute('href', '/login');
    expect(linkButton.className).toContain('min-h-[44px]');
  });

  it('associates Label with Input and forwards ref + invalid state', () => {
    const inputRef = createRef<HTMLInputElement>();

    render(
      <div>
        <Label htmlFor="tenant-code">Mã cơ sở</Label>
        <Input id="tenant-code" ref={inputRef} aria-invalid="true" placeholder="pk-alpha" />
      </div>
    );

    const input = screen.getByLabelText('Mã cơ sở');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.className).toContain('min-h-[48px]');
    expect(inputRef.current).toBe(input);
  });

  it('renders Card structure and Alert with role="alert" for warning/destructive variants', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Đăng nhập nhân sự</CardTitle>
          <CardDescription>Mô tả</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="warning">
            <AlertTitle>Cảnh báo</AlertTitle>
            <AlertDescription>Đang chờ phê duyệt</AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter>Hỗ trợ</CardFooter>
      </Card>
    );

    expect(screen.getByText('Đăng nhập nhân sự')).toBeInTheDocument();
    expect(screen.getByText('Mô tả')).toBeInTheDocument();
    expect(screen.getByText('Hỗ trợ')).toBeInTheDocument();

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Cảnh báo');
    expect(alert).toHaveTextContent('Đang chờ phê duyệt');
  });
});
