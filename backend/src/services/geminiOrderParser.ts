import { GoogleGenAI, Type, type GenerateContentResponse } from '@google/genai';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    const err = new Error('مفتاح خدمة الذكاء الاصطناعي (GEMINI_API_KEY) غير مفعّل في إعدادات الخادم.');
    (err as Error & { code?: string; statusCode?: number }).code = 'GEMINI_API_KEY_MISSING';
    (err as Error & { code?: string; statusCode?: number }).statusCode = 503;
    throw err;
  }
  return new GoogleGenAI({
    apiKey: apiKey.trim(),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export interface ParsedOrderItem {
  nameAr: string;
  quantity: string;
  unit: string;
  notes: string;
  estimatedCategory: 'pharmacy' | 'supermarket' | 'bakery' | 'restaurant' | 'other';
}

export interface ParsedPrescriptionResult {
  detectedType: 'pharmacy_prescription' | 'grocery_list';
  summaryAr: string;
  items: ParsedOrderItem[];
  warningsAr: string[];
  requiresPharmacistReview: boolean;
}

export interface ParsedVoiceOrderResult {
  summaryAr: string;
  inferredServiceType: 'restaurant_store' | 'prescription_list' | 'errand' | 'ride';
  inferredLandmarkNameAr: string;
  items: ParsedOrderItem[];
  driverTipEgp: number;
  cashChangeForEgp: 0 | 50 | 100 | 200;
}

export async function parsePrescriptionOrListImage(params: {
  imageBase64: string;
  mimeType: string;
  listType?: 'pharmacy' | 'grocery' | 'auto';
  extraNotes?: string;
}): Promise<ParsedPrescriptionResult> {
  const ai = getGeminiClient();
  const cleanBase64 = params.imageBase64.replace(/^data:[^;]+;base64,/, '');

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: params.mimeType || 'image/jpeg',
            data: cleanBase64,
          },
        },
        {
          text: [
            'أنت مساعد ذكي لتطبيق توصيل محلي في الباجور بمحافظة المنوفية (مشوار).',
            'اقرأ هذه الصورة (روشتة طبية مكتوبة بخط اليد أو مطبوعة، أو ورقة مقاضي/طلبات منزلية باللهجة المصرية).',
            `تلميح نوع القائمة من المستخدم: ${params.listType || 'auto'}.`,
            params.extraNotes ? `ملاحظات إضافية من المستخدم: ${params.extraNotes}` : '',
            'استخرج جميع الأصناف أو الأدوية والكميات بدقة باللغة العربية المفهومة. إذا كانت روشتة طبية، اجعل requiresPharmacistReview = true وأضف تنبيهاً بضرورة مطابقة الصيدلي للصنف قبل الصرف. إذا كان أي صنف غير واضح تماماً اذكر ذلك في notes.',
          ]
            .filter(Boolean)
            .join('\n'),
        },
      ],
    },
    config: {
      systemInstruction:
        'استخرج البيانات بدقة دون تخمين خطير لأسماء الأدوية؛ إذا كان الخط غير مقروء اذكر [غير واضح - يراجع مع الصيدلي]. التزم بالرد JSON فقط.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          detectedType: {
            type: Type.STRING,
            description: 'Either pharmacy_prescription or grocery_list',
          },
          summaryAr: {
            type: Type.STRING,
            description: 'Short Arabic summary of the list or prescription',
          },
          requiresPharmacistReview: {
            type: Type.BOOLEAN,
            description: 'True if medical prescription or medicine items detected',
          },
          warningsAr: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Important safety or clarity notes in Arabic',
          },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                nameAr: { type: Type.STRING },
                quantity: { type: Type.STRING },
                unit: { type: Type.STRING },
                notes: { type: Type.STRING },
                estimatedCategory: { type: Type.STRING },
              },
              required: ['nameAr', 'quantity', 'unit', 'notes', 'estimatedCategory'],
            },
          },
        },
        required: ['detectedType', 'summaryAr', 'requiresPharmacistReview', 'warningsAr', 'items'],
      },
    },
  });

  const rawText = (response.text || '').trim();
  if (!rawText) {
    throw new Error('لم يُرجع نموذج الذكاء الاصطناعي بيانات مقروءة من الصورة.');
  }
  const parsed = JSON.parse(rawText) as ParsedPrescriptionResult;
  return {
    detectedType:
      parsed.detectedType === 'pharmacy_prescription' ? 'pharmacy_prescription' : 'grocery_list',
    summaryAr: parsed.summaryAr || 'قائمة طلبات مستخرجة بالذكاء الاصطناعي',
    requiresPharmacistReview: Boolean(parsed.requiresPharmacistReview),
    warningsAr: Array.isArray(parsed.warningsAr) ? parsed.warningsAr.slice(0, 5) : [],
    items: Array.isArray(parsed.items) ? parsed.items.slice(0, 20) : [],
  };
}

export async function parseEgyptianArabicVoiceOrder(params: {
  transcriptText: string;
}): Promise<ParsedVoiceOrderResult> {
  const ai = getGeminiClient();

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: [
      'حلّل هذا الطلب الصوتي المكتوب باللهجة المصرية من عميل في مركز الباجور - المنوفية:',
      `"${params.transcriptText}"`,
      'استخرج الأصناف والكميات المطلوبة، ونوع الخدمة الأنسب (restaurant_store | prescription_list | errand | ride)، وأي معلم مذكور في الباجور أو قراها (مثل: ميدان المحطة، شارع الجيش، مستشفى الباجور، كفر الباجور، شنتنا الحجر، جروان، ميت عفيف)، والإكرامية إن ذُكرت، وفئة الفكة إن ذكر (50 أو 100 أو 200 أو 0).',
    ].join('\n'),
    config: {
      systemInstruction: 'أجب بصيغة JSON منظمة مطابقة للمخطط المحدد بدقة.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summaryAr: { type: Type.STRING },
          inferredServiceType: { type: Type.STRING },
          inferredLandmarkNameAr: { type: Type.STRING },
          driverTipEgp: { type: Type.INTEGER },
          cashChangeForEgp: { type: Type.INTEGER },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                nameAr: { type: Type.STRING },
                quantity: { type: Type.STRING },
                unit: { type: Type.STRING },
                notes: { type: Type.STRING },
                estimatedCategory: { type: Type.STRING },
              },
              required: ['nameAr', 'quantity', 'unit', 'notes', 'estimatedCategory'],
            },
          },
        },
        required: [
          'summaryAr',
          'inferredServiceType',
          'inferredLandmarkNameAr',
          'driverTipEgp',
          'cashChangeForEgp',
          'items',
        ],
      },
    },
  });

  const rawText = (response.text || '').trim();
  if (!rawText) {
    throw new Error('تعذر تحليل النص الصوتي بالذكاء الاصطناعي.');
  }
  const parsed = JSON.parse(rawText) as ParsedVoiceOrderResult;
  const allowedChange = [0, 50, 100, 200].includes(Number(parsed.cashChangeForEgp))
    ? (Number(parsed.cashChangeForEgp) as 0 | 50 | 100 | 200)
    : 0;
  return {
    summaryAr: parsed.summaryAr || params.transcriptText.slice(0, 120),
    inferredServiceType: ['restaurant_store', 'prescription_list', 'errand', 'ride'].includes(
      parsed.inferredServiceType
    )
      ? parsed.inferredServiceType
      : 'errand',
    inferredLandmarkNameAr: parsed.inferredLandmarkNameAr || '',
    driverTipEgp: Math.max(0, Math.min(500, Math.round(Number(parsed.driverTipEgp) || 0))),
    cashChangeForEgp: allowedChange,
    items: Array.isArray(parsed.items) ? parsed.items.slice(0, 20) : [],
  };
}
