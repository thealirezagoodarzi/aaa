/**
 * Lab configuration constants for Laboratory DB
 *
 * NOTE (delivery / handover build):
 * All demo & sample seed data has been intentionally REMOVED from this file.
 * The system ships with a completely empty database; the lab owner enters
 * real records (users, customers, reports, invoices, calibrations, ...)
 * through the admin panel at runtime. Nothing here is mock/sample data:
 * LAB_INFO holds the real official identity of the laboratory and is used
 * across the landing page, SMS templates, invoices and report headers.
 */

// Lab official contact and accreditation information matching official poster
export const LAB_INFO = {
  name: 'آزما بتن پایش خاک و پی جهان بین',
  shortName: 'آزما بتن جهان بین',
  subtitle: 'آزمایشگاه تخصصی مقاومت مصالح، بتن و ژئوتکنیک',
  englishSubtitle: 'SPECIALIZED MATERIALS RESISTANCE, CONCRETE & GEOTECHNICAL LAB',
  activityScope: 'آزمایش‌های تخصصی مقاومت مصالح، بتن و ژئوتکنیک',
  slogan: 'دقت در آزمون - اطمینان در ساخت',
  englishSlogan: 'Accuracy in Testing, Confidence in Construction',
  manager: 'مهندس صادقی نیا',
  managerFullName: 'مهندس صالح صادقی نیا',
  managerRole: 'مدیریت ارشد آزمایشگاه و عضو سازمان نظام مهندسی ساختمان',
  registrationNo: '16445', // شماره ثبت شرکت
  licenseNo: '182700018', // پروانه اشتغال به کار خدمات فنی آزمایشگاهی
  licenseIssuer: 'اداره کل راه و شهر سازی استان چهارمحال و بختیاری',
  phone: '0913 170 3177',
  phoneRaw: '09131703177',
  landline: '038-32245678',
  address: 'شهرکرد، بلوار آیت الله کاشانی، انتهای کوچه ۳۰',
  fullAddress: 'شهرکرد، بلوار آیت الله کاشانی، انتهای کوچه ۳۰',
  province: 'چهارمحال و بختیاری',
  city: 'شهرکرد',
  postalCode: '8817654321',
  domain: 'www.azmajahanbin.ir',
  website: 'www.azmajahanbin.ir',
  websiteUrl: 'https://www.azmajahanbin.ir',
  email: 'info@azmajahanbin.ir',
  supportEmail: 'support@azmajahanbin.ir',
  googleMapsUrl: 'https://maps.app.goo.gl/kefSiPgv6BPFoqet5',
  wazeUrl: 'https://waze.com/ul?ll=32.329447,50.862980&navigate=yes',
  coordinates: {
    lat: 32.329447,
    lng: 50.862980,
    displayText: '32.329447, 50.862980'
  }
};
