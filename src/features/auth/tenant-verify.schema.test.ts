import { tenantVerifySchema } from './tenant-verify.schema';

describe('tenantVerifySchema', () => {
  it('trims outer whitespace and accepts valid 3-30 char lowercase alphanumeric/hyphen tenant codes', () => {
    expect(tenantVerifySchema.parse({ tenantCode: '  pk-alpha-01  ' })).toEqual({
      tenantCode: 'pk-alpha-01',
    });
    expect(tenantVerifySchema.parse({ tenantCode: 'abc' })).toEqual({
      tenantCode: 'abc',
    });
    expect(tenantVerifySchema.parse({ tenantCode: 'a'.repeat(30) })).toEqual({
      tenantCode: 'a'.repeat(30),
    });
  });

  it('rejects empty, out-of-range, uppercase, spaces, underscores, and Vietnamese accents', () => {
    const invalidInputs = [
      '',
      '   ',
      'ab',
      'a'.repeat(31),
      'PK-ALPHA',
      'pk_alpha',
      'pk alpha',
      'pk-ánh',
    ];

    for (const input of invalidInputs) {
      const result = tenantVerifySchema.safeParse({ tenantCode: input });
      expect(result.success).toBe(false);
    }
  });
});
