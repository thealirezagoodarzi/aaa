import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  Packer,
  PageBorderDisplay,
  PageBorderOffsetFrom
} from 'docx';
import { toPersianDigits } from './jalali';
import { downloadBlob } from './printDom';

export interface ContractExportData {
  companyName?: string;
  repName?: string;
  nationalId?: string;
  regPlate?: string;
  nezamNo?: string;
  phone?: string;
  area?: string;
  projectAddress?: string;
  customerAddress?: string;
  seriesCount?: string;
  pricePerSeries?: string;
  totalAmount?: string;
  labAddress?: string;
  labPhone?: string;
  isBlankTemplate?: boolean;
}

export async function generateAndDownloadContractDocx(
  data: ContractExportData,
  filename: string = 'gharardad-azmabeton.docx'
) {
  const isBlank = !!data.isBlankTemplate;

  const renderVal = (val: string | undefined | null, defaultDots: string = '...............................................') => {
    if (isBlank) return defaultDots;
    if (!val || val.trim().length === 0) return defaultDots;
    return toPersianDigits(val.trim());
  };

  let employerRaw = '';
  if (data.companyName && data.repName) {
    employerRaw = `${data.companyName} (با نمایندگی ${data.repName})`;
  } else {
    employerRaw = data.companyName || data.repName || '';
  }

  const employer = renderVal(employerRaw, '...............................................');
  const regPlate = renderVal(data.regPlate, '.....................................');
  const nationalId = renderVal(data.nationalId, '................................................');
  const nezamNo = renderVal(data.nezamNo, '................................................');
  const phone = renderVal(data.phone, '................................................');
  const area = isBlank || !data.area ? '................... متر مربع' : `${toPersianDigits(data.area)} متر مربع`;
  const projectAddress = renderVal(data.projectAddress, '........................................................................................................................');
  const customerAddress = renderVal(data.customerAddress, '....................................................................................................');
  const seriesCount = renderVal(data.seriesCount, '...........');
  
  const formatComma = (v?: string) => {
    if (!v) return '';
    const num = v.replace(/\D/g, '');
    if (!num) return '';
    return parseInt(num, 10).toLocaleString('fa-IR');
  };

  const pricePerSeries = renderVal(formatComma(data.pricePerSeries), '.........................................');
  
  let totalAmount = '.....................................';
  if (data.totalAmount && data.totalAmount.trim().length > 0) {
    totalAmount = renderVal(formatComma(data.totalAmount), '.....................................');
  } else if (data.seriesCount && data.pricePerSeries) {
    const s = parseInt(data.seriesCount.replace(/\D/g, ''), 10);
    const p = parseInt(data.pricePerSeries.replace(/\D/g, ''), 10);
    if (!isNaN(s) && !isNaN(p) && s > 0 && p > 0) {
      totalAmount = toPersianDigits((s * p).toLocaleString('fa-IR'));
    }
  }

  const labAddress = data.labAddress || 'شهرکرد، بلوار آیت الله کاشانی، انتهای کوچه ۳۰';
  const labPhone = data.labPhone || '۰۹۱۳۱۷۰۳۱۷۷';

  // Cross-platform font fallback: 'B Nazanin' as complex script with 'Tahoma' / 'Arial' fallback
  const FONT_SPEC = {
    name: 'B Nazanin',
    cs: 'B Nazanin',
    ascii: 'Tahoma',
    hAnsi: 'Tahoma'
  };

  const pProps = (
    alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.JUSTIFIED, 
    spacingBefore = 15, 
    spacingAfter = 15, 
    keepLines = true
  ) => ({
    bidirectional: true,
    alignment,
    spacing: {
      before: spacingBefore,
      after: spacingAfter,
      line: 285 // calibrated for exact 2-page fit in Word
    },
    keepLines,
    keepNext: alignment === AlignmentType.RIGHT
  });

  const runProps = (text: string, bold = false, size = 20) => new TextRun({
    text,
    font: FONT_SPEC,
    size, // 20 = 10pt, 21 = 10.5pt, 22 = 11pt, 24 = 12pt
    bold,
    rightToLeft: true
  });

  const cellBorder = {
    top: { style: BorderStyle.SINGLE, size: 6, color: '333333' },
    bottom: { style: BorderStyle.SINGLE, size: 6, color: '333333' },
    left: { style: BorderStyle.SINGLE, size: 6, color: '333333' },
    right: { style: BorderStyle.SINGLE, size: 6, color: '333333' }
  };

  // Build Project Specifications Table (2 Columns, 4 Rows)
  const projectTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    visuallyRightToLeft: true,
    alignment: AlignmentType.CENTER,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: cellBorder,
            margins: { top: 50, bottom: 50, left: 80, right: 80 },
            children: [
              new Paragraph({
                bidirectional: true,
                alignment: AlignmentType.RIGHT,
                spacing: { before: 10, after: 10, line: 260 },
                children: [
                  runProps('نام کارفرما / نماینده: ', true, 19),
                  runProps(employer, false, 19)
                ]
              })
            ]
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: cellBorder,
            margins: { top: 50, bottom: 50, left: 80, right: 80 },
            children: [
              new Paragraph({
                bidirectional: true,
                alignment: AlignmentType.RIGHT,
                spacing: { before: 10, after: 10, line: 260 },
                children: [
                  runProps('کد ملی: ', true, 19),
                  runProps(nationalId, false, 19)
                ]
              })
            ]
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: cellBorder,
            margins: { top: 50, bottom: 50, left: 80, right: 80 },
            children: [
              new Paragraph({
                bidirectional: true,
                alignment: AlignmentType.RIGHT,
                spacing: { before: 10, after: 10, line: 260 },
                children: [
                  runProps('شماره پلاک ثبتی: ', true, 19),
                  runProps(regPlate, false, 19)
                ]
              })
            ]
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: cellBorder,
            margins: { top: 50, bottom: 50, left: 80, right: 80 },
            children: [
              new Paragraph({
                bidirectional: true,
                alignment: AlignmentType.RIGHT,
                spacing: { before: 10, after: 10, line: 260 },
                children: [
                  runProps('شماره ثبت نظام مهندسی: ', true, 19),
                  runProps(nezamNo, false, 19)
                ]
              })
            ]
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: cellBorder,
            margins: { top: 50, bottom: 50, left: 80, right: 80 },
            children: [
              new Paragraph({
                bidirectional: true,
                alignment: AlignmentType.RIGHT,
                spacing: { before: 10, after: 10, line: 260 },
                children: [
                  runProps('شماره تماس: ', true, 19),
                  runProps(phone, false, 19)
                ]
              })
            ]
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: cellBorder,
            margins: { top: 50, bottom: 50, left: 80, right: 80 },
            children: [
              new Paragraph({
                bidirectional: true,
                alignment: AlignmentType.RIGHT,
                spacing: { before: 10, after: 10, line: 260 },
                children: [
                  runProps('متراژ دستور نقشه: ', true, 19),
                  runProps(area, false, 19)
                ]
              })
            ]
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 2,
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: cellBorder,
            margins: { top: 50, bottom: 50, left: 80, right: 80 },
            children: [
              new Paragraph({
                bidirectional: true,
                alignment: AlignmentType.RIGHT,
                spacing: { before: 10, after: 10, line: 260 },
                children: [
                  runProps('نشانی پروژه: ', true, 19),
                  runProps(projectAddress, false, 19)
                ]
              })
            ]
          })
        ]
      })
    ]
  });

  // Signatures Table for bottom of Page 2
  const signaturesTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    visuallyRightToLeft: true,
    alignment: AlignmentType.CENTER,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE }
            },
            children: [
              new Paragraph({
                bidirectional: true,
                alignment: AlignmentType.CENTER,
                spacing: { before: 20, after: 10 },
                children: [runProps('نام و نام خانوادگی کارفرما / نماینده کارفرما', true, 20)]
              }),
              new Paragraph({
                bidirectional: true,
                alignment: AlignmentType.CENTER,
                spacing: { before: 5, after: 10 },
                children: [runProps(employer !== '...............................................' ? employer : '.....................................', false, 19)]
              }),
              new Paragraph({
                bidirectional: true,
                alignment: AlignmentType.CENTER,
                spacing: { before: 80, after: 20 },
                children: [runProps('(محل امضا و اثر انگشت)', false, 17)]
              })
            ]
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE }
            },
            children: [
              new Paragraph({
                bidirectional: true,
                alignment: AlignmentType.CENTER,
                spacing: { before: 20, after: 10 },
                children: [runProps('نام و نام خانوادگی نماینده آزمایشگاه', true, 20)]
              }),
              new Paragraph({
                bidirectional: true,
                alignment: AlignmentType.CENTER,
                spacing: { before: 5, after: 10 },
                children: [runProps('شرکت آزما بتن پایش خاک و پی جهان بین', false, 19)]
              }),
              new Paragraph({
                bidirectional: true,
                alignment: AlignmentType.CENTER,
                spacing: { before: 80, after: 20 },
                children: [runProps('(محل امضا و مهر رسمی شرکت)', false, 17)]
              })
            ]
          })
        ]
      })
    ]
  });

  // Section 1: Page 1 with page borders
  const page1Children = [
    // Header
    new Paragraph({
      ...pProps(AlignmentType.CENTER, 0, 20),
      children: [runProps('به نام خدا', true, 24)]
    }),
    new Paragraph({
      ...pProps(AlignmentType.CENTER, 10, 40),
      children: [runProps('قرارداد ارائه خدمات آزمایشگاهی، نمونه برداری، تعیین مقاومت فشاری و مشخصات بتن', true, 21)]
    }),

    // Preamble
    new Paragraph({
      ...pProps(AlignmentType.JUSTIFIED, 15, 25),
      children: [
        runProps('این قرارداد فی مابین آقای/ خانم/ شرکت '),
        runProps(employer, true),
        runProps(' مالک/ وکیل ملک به پلاک ثبتی شماره '),
        runProps(regPlate, true),
        runProps(' که منبعد در این قرارداد '),
        runProps('کارفرما', true),
        runProps(' نامیده می شود از یک طرف، و شرکت '),
        runProps('آزما بتن پایش خاک و پی جهان بین', true),
        runProps(' با شماره ثبت '),
        runProps('16445', true),
        runProps(' دارای پروانه اشتغال به کار خدمات فنی آزمایشگاهی به شماره '),
        runProps('182700018', true),
        runProps(' از اداره کل راه و شهر سازی استان چهارمحال و بختیاری که از این پس '),
        runProps('آزمایشگاه', true),
        runProps(' نامیده می شود از سوی دیگر، طبق مقررات و شرایطی که در این قرارداد درج شده است، منعقد می گردد و طرفین متعهد به اجرای کلیه مفاد آن می باشند.')
      ]
    }),

    // Article 1
    new Paragraph({
      ...pProps(AlignmentType.RIGHT, 20, 10),
      children: [runProps('ماده ۱- موضوع قرارداد', true, 20)]
    }),
    new Paragraph({
      ...pProps(AlignmentType.JUSTIFIED, 10, 15),
      children: [
        runProps('عبارت است از انجام و ثبت آزمایش های کنترل کیفیت بتن به صورت نمونه برداری از بتن تازه و تعیین مقاومت فشاری و تهیه گزارش مربوطه به پروژه با مشخصات زیر:')
      ]
    }),

    projectTable,

    // Article 2
    new Paragraph({
      ...pProps(AlignmentType.RIGHT, 20, 10),
      children: [runProps('ماده ۲- شرح خدمات آزمایشگاه', true, 20)]
    }),
    new Paragraph({
      ...pProps(AlignmentType.JUSTIFIED, 10, 10),
      children: [
        runProps('۱-۲ ', true),
        runProps('تواتر نمونه برداری از بتن تازه مطابق با مبحث نهم مقررات ملی ساختمان، آیین نامه بتن ایران و دستورالعمل ها و الزامات سازمان نظام مهندسی استان چهارمحال و بختیاری صورت می گیرد.')
      ]
    }),
    new Paragraph({
      ...pProps(AlignmentType.JUSTIFIED, 10, 10),
      children: [
        runProps('۲-۲ ', true),
        runProps('نگهداری، عمل آوری و ارائه نتایج آزمون مقاومت های فشاری ۷ و ۲۸ روزه و نگهداری نمونه شاهد به مدت ۹۰ روز در محل آزمایشگاه.')
      ]
    }),
    new Paragraph({
      ...pProps(AlignmentType.JUSTIFIED, 10, 15),
      children: [
        runProps('۳-۲ ', true),
        runProps('انجام عملیات و آزمایش های مخرب و غیر مخرب اعم از چکش اشمیت و مغزه گیری در پروژه (هزینه این قسمت جداگانه محاسبه می گردد.)')
      ]
    }),

    // Article 3
    new Paragraph({
      ...pProps(AlignmentType.RIGHT, 20, 10),
      children: [runProps('ماده ۳- مدت زمان قرارداد', true, 20)]
    }),
    new Paragraph({
      ...pProps(AlignmentType.JUSTIFIED, 10, 15),
      children: [
        runProps('ارائه خدمات موضوع قرارداد از تاریخ عقد و به مدت ۲۴ ماه می باشد. پس از پایان این مدت با توجه به پیشرفت فیزیکی پروژه مذکور، قرارداد به احتساب نرخ مصوب جدید و پرداخت مابه التفاوت توسط صاحبکار قابل تمدید خواهد بود.')
      ]
    }),

    // Article 4
    new Paragraph({
      ...pProps(AlignmentType.RIGHT, 20, 10),
      children: [runProps('ماده ۴- مبلغ و نحوه پرداخت قرارداد', true, 20)]
    }),
    new Paragraph({
      ...pProps(AlignmentType.JUSTIFIED, 10, 10),
      children: [
        runProps('۱-۴ ', true),
        runProps('حق الزحمه ارائه خدمات آزمایشگاهی بر مبنای نرخ مصوب سازمان نظام مهندسی استان و با توجه به زیربنا و تعداد طبقات ساختمان و با احتساب ۱۰ درصد مالیات بر ارزش افزوده محاسبه و تعیین می گردد.')
      ]
    }),
    new Paragraph({
      ...pProps(AlignmentType.RIGHT, 10, 10),
      children: [
        runProps('الف: ', true),
        runProps('تعداد مورد نیاز آزمایش '),
        runProps(seriesCount, true),
        runProps(' عدد (سری)')
      ]
    }),
    new Paragraph({
      ...pProps(AlignmentType.JUSTIFIED, 10, 10),
      children: [
        runProps('ب: ', true),
        runProps('مبلغ حق الزحمه به ازای هر سری آزمایش '),
        runProps(pricePerSeries, true),
        runProps(' ریال و به مبلغ کل '),
        runProps(totalAmount, true),
        runProps(' ریال که نقدا توسط کارفرما پرداخت می گردد.')
      ]
    }),
    new Paragraph({
      ...pProps(AlignmentType.JUSTIFIED, 10, 20),
      children: [
        runProps('تبصره ۱: ', true),
        runProps('در صورت اعمال اضافه بنا و تغییر دفعات بتن ریزی و افزایش تعداد سری نمونه گیری، حق الزحمه نمونه های مازاد بر اساس نرخ مصوب ملاک عمل خدمات فنی و آزمایشگاهی محاسبه می گردد و مالک موظف به پرداخت آن خواهد بود.')
      ]
    })
  ];

  // Section 2: Page 2
  const page2Children = [
    // Header for Page 2
    new Paragraph({
      ...pProps(AlignmentType.CENTER, 0, 15),
      children: [runProps('به نام خدا - ادامه قرارداد ارائه خدمات آزمایشگاهی بتن', true, 19)]
    }),

    // Article 5: تعهدات شرکت
    new Paragraph({
      ...pProps(AlignmentType.RIGHT, 15, 10),
      children: [runProps('ماده ۵- تعهدات شرکت', true, 20)]
    }),
    new Paragraph({
      ...pProps(AlignmentType.JUSTIFIED, 10, 10),
      children: [
        runProps('۱-۵ ', true),
        runProps('حضور تکنسین با تجهیزات لازم در زمان بتن ریزی و انجام عملیات نمونه گیری.')
      ]
    }),
    new Paragraph({
      ...pProps(AlignmentType.JUSTIFIED, 10, 10),
      children: [
        runProps('۲-۵ ', true),
        runProps('زمان و محل نمونه گیری توسط مهندس ناظر سازه و در صورت عدم حضور ایشان، توسط آزمایشگاه تعیین می گردد.')
      ]
    }),
    new Paragraph({
      ...pProps(AlignmentType.JUSTIFIED, 10, 10),
      children: [
        runProps('۳-۵ ', true),
        runProps('نمونه گیری مطابق دستورالعمل های سازمان نظام مهندسی و استانداردهای معتبر، انجام آزمایش اسلامپ، حمل آزمونه ها به محل آزمایشگاه، نگهداری و عمل آوری نمونه ها در شرایط استاندارد، انجام آزمایش های مورد نیاز مطابق با استاندارد و ارائه گزارش نتایج آزمایش.')
      ]
    }),
    new Paragraph({
      ...pProps(AlignmentType.JUSTIFIED, 10, 10),
      children: [
        runProps('۴-۵ ', true),
        runProps('نتایج آزمایش ها در دو نوبت در سن ۷ و ۲۸ روزه یا مطابق با دستور کتبی ناظر سازه تهیه و ارائه می گردد.')
      ]
    }),
    new Paragraph({
      ...pProps(AlignmentType.JUSTIFIED, 10, 10),
      children: [
        runProps('۵-۵ ', true),
        runProps('حداقل یک نمونه شاهد تا ۹۰ روز در آزمایشگاه نگهداری می گردد و بنا به دستور کتبی مهندس ناظر مورد آزمایش قرار خواهد گرفت.')
      ]
    }),
    new Paragraph({
      ...pProps(AlignmentType.JUSTIFIED, 10, 15),
      children: [
        runProps('۶-۵ ', true),
        runProps('در صورت اطلاع رسانی به موقع توسط کارفرما و عدم مراجعه آزمایشگاه، هزینه آزمایشات جایگزین اعم از مخرب و غیرمخرب به عهده آزمایشگاه می باشد.')
      ]
    }),

    // Article 6: تعهدات کارفرما
    new Paragraph({
      ...pProps(AlignmentType.RIGHT, 15, 10),
      children: [runProps('ماده ۶- تعهدات کارفرما', true, 20)]
    }),
    new Paragraph({
      ...pProps(AlignmentType.JUSTIFIED, 10, 10),
      children: [
        runProps('۱-۶ ', true),
        runProps('کارفرما موظف است حداقل ۴۸ ساعت قبل از بتن ریزی و همچنین یک ساعت قبل از ورود اولین میکسر، مراتب را به آزمایشگاه اطلاع رسانی کند.')
      ]
    }),
    new Paragraph({
      ...pProps(AlignmentType.JUSTIFIED, 10, 10),
      children: [
        runProps('۲-۶ ', true),
        runProps('کارفرما موظف است با هماهنگی ناظر و مجری پروژه، شرایط لازم جهت نمونه گیری صحیح و به موقع را فراهم کند.')
      ]
    }),
    new Paragraph({
      ...pProps(AlignmentType.JUSTIFIED, 10, 10),
      children: [
        runProps('۳-۶ ', true),
        runProps('کارفرما متعهد می گردد نمونه های گرفته شده را حداکثر تا ۲۴ ساعت در شرایط مطلوب (جلوگیری از خشک شدن نمونه ها در هوای گرم، جلوگیری از سرما زدگی در هوای سرد، مراقبت از سلامت نمونه ها و جلوگیری از هر گونه آسیب و ضربه به آن ها، عدم جابجایی نمونه ها) نگهداری کند. در صورت بروز هرگونه آسیب به نمونه ها در این مدت عواقب بعدی بر عهده کارفرما خواهد بود.')
      ]
    }),
    new Paragraph({
      ...pProps(AlignmentType.JUSTIFIED, 10, 10),
      children: [
        runProps('۴-۶ ', true),
        runProps('در صورت عدم اطلاع رسانی به موقع توسط کارفرما جهت انجام عملیات نمونه گیری، هزینه آزمایشات جایگزین اعم از چکش اشمیت یا مغزه گیری بر عهده کارفرما می باشد.')
      ]
    }),
    new Paragraph({
      ...pProps(AlignmentType.JUSTIFIED, 10, 15),
      children: [
        runProps('۵-۶ ', true),
        runProps('تامین حداقل یک نفر کارگر به همراه وسایل مورد نیاز (یک عدد فرغون و بیل) برای انجام عملیات نمونه گیری توسط نیروهای آزمایشگاه، از سوی کارفرما الزامی است.')
      ]
    }),

    // Article 7: حل اختلاف
    new Paragraph({
      ...pProps(AlignmentType.RIGHT, 15, 10),
      children: [runProps('ماده ۷- حل اختلاف', true, 20)]
    }),
    new Paragraph({
      ...pProps(AlignmentType.JUSTIFIED, 10, 15),
      children: [
        runProps('کلیه اختلافاتی که ممکن است در اثر تعبیر و تفسیر مفاد این قرارداد یا در اجرای کار بین طرفین بروز نماید، که نتوان آن را از طریق مذاکرات یا مکاتبات به طور دوستانه و حداکثر ظرف مدت یک ماه حل و فصل نمود، موضوع از طریق ارجاع به هیئات حل اختلاف سازمان نظام مهندسی استان پیگیری خواهد شد و نظر این هیئات برای هر دو طرف حاکم می باشد.')
      ]
    }),

    // Article 8: نشانی و تعداد نسخه های قرارداد
    new Paragraph({
      ...pProps(AlignmentType.RIGHT, 15, 10),
      children: [runProps('ماده ۸- نشانی و تعداد نسخه های قرارداد', true, 20)]
    }),
    new Paragraph({
      ...pProps(AlignmentType.JUSTIFIED, 8, 8),
      children: [
        runProps('نشانی کارفرما: '),
        runProps(customerAddress, true),
        runProps('        تلفن: '),
        runProps(phone, true)
      ]
    }),
    new Paragraph({
      ...pProps(AlignmentType.JUSTIFIED, 8, 12),
      children: [
        runProps('نشانی آزمایشگاه: '),
        runProps(labAddress, true),
        runProps('        تلفن: '),
        runProps(labPhone, true)
      ]
    }),
    new Paragraph({
      ...pProps(AlignmentType.JUSTIFIED, 12, 25),
      children: [
        runProps('این قرارداد در دو صفحه و دو نسخه مشتمل بر ۸ ماده و با اعتبار یکسان تنظیم شده و به امضای دو طرف رسیده است.', true, 20)
      ]
    }),

    signaturesTable
  ];

  const pageBorderConfig = {
    display: PageBorderDisplay.ALL_PAGES,
    offsetFrom: PageBorderOffsetFrom.PAGE,
    top: { style: BorderStyle.SINGLE, size: 8, color: '111111', space: 18 },
    bottom: { style: BorderStyle.SINGLE, size: 8, color: '111111', space: 18 },
    left: { style: BorderStyle.SINGLE, size: 8, color: '111111', space: 18 },
    right: { style: BorderStyle.SINGLE, size: 8, color: '111111', space: 18 }
  };

  const doc = new Document({
    creator: 'سامانه مدیریت آزمایشگاه بتن جهان بین',
    title: 'قرارداد رسمی ارائه خدمات آزمایشگاهی بتن',
    description: 'قرارداد رسمی کنترل کیفیت و تعیین مقاومت فشاری بتن',
    styles: {
      default: {
        document: {
          run: {
            font: FONT_SPEC,
            size: 20,
            rightToLeft: true
          },
          paragraph: {
            alignment: AlignmentType.JUSTIFIED,
            spacing: {
              line: 285,
              before: 12,
              after: 12
            }
          }
        }
      }
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720,    // 12.7 mm
              bottom: 720, // 12.7 mm
              left: 720,   // 12.7 mm
              right: 720
            },
            borders: {
              pageBorders: pageBorderConfig
            }
          }
        },
        children: page1Children
      },
      {
        properties: {
          page: {
            margin: {
              top: 720,
              bottom: 720,
              left: 720,
              right: 720
            },
            borders: {
              pageBorders: pageBorderConfig
            }
          }
        },
        children: page2Children
      }
    ]
  });

  const blob = await Packer.toBlob(doc);
  const docxFilename = filename.endsWith('.docx') ? filename : `${filename}.docx`;
  downloadBlob(blob, docxFilename);
  return true;
}
