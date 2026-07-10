// isDeliveryUrl reads the configured cloud name, so configure before requiring.
process.env.CLOUDINARY_CLOUD_NAME = 'propertyverse-test';
process.env.CLOUDINARY_API_KEY = 'key';
process.env.CLOUDINARY_API_SECRET = 'secret';

const { isDeliveryUrl } = require('../cloudinaryService');

const OURS = 'https://res.cloudinary.com/propertyverse-test/image/upload/v1/propertyverse/forms/a.jpg';

describe('isDeliveryUrl', () => {
  it('accepts an asset we hosted', () => {
    expect(isDeliveryUrl(OURS)).toBe(true);
  });

  it('rejects an arbitrary https URL a form submitter could inject', () => {
    expect(isDeliveryUrl('https://evil.example.com/payload.jpg')).toBe(false);
  });

  it('rejects another account on Cloudinary', () => {
    expect(isDeliveryUrl('https://res.cloudinary.com/someone-else/image/upload/v1/a.jpg')).toBe(false);
  });

  it('rejects a lookalike host', () => {
    expect(isDeliveryUrl('https://res.cloudinary.com.evil.example/propertyverse-test/a.jpg')).toBe(false);
  });

  it('rejects non-https and non-URLs', () => {
    expect(isDeliveryUrl('http://res.cloudinary.com/propertyverse-test/image/upload/a.jpg')).toBe(false);
    expect(isDeliveryUrl('javascript:alert(1)')).toBe(false);
    expect(isDeliveryUrl('not a url')).toBe(false);
    expect(isDeliveryUrl(undefined)).toBe(false);
  });
});
