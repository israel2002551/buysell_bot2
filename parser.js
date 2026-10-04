import Groq from 'groq-sdk';
import 'dotenv/config';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const PROMPT_TEMPLATE = `
You extract marketplace listing fields from WhatsApp sale posts and product images for BUYSELL Nigeria.

Your core capability is MULTIMODAL PRODUCT VISION:
- When a product image is provided, carefully examine the photo to determine what product is being sold (brand, model, category, color, material, physical features, packaging).
- Even if the seller provided NO text description (or only a price like "330k", "₦50,000", "45k available", etc.), generate an accurate, appealing product title and a rich, professional 1-3 sentence description based on the item seen in the image.
- If the seller provided short notes in text (e.g. "UK used", "battery 88%", "clean"), combine those notes with your visual analysis into the description.
- Extract the price from the post text, or if text has no price, check if a price or flyer text is visible inside the image.
- Expand Nigerian price shorthand: "350k" -> 350000, "1.5m" -> 1500000, "45k" -> 45000, "₦60,000" -> 60000.

Return exactly one JSON object with these keys:
- is_commercial_listing: boolean (true if an item or service is being offered for sale; false for general chat, memes, complaints, requests to buy)
- title: concise, attractive product title (maximum 80 characters) clearly identifying the item (e.g. "Apple iPhone 12 (128GB, Blue)", "Nike Air Force 1 Low White Sneaker")
- description: clear, appealing product description (1-3 sentences) detailing the item seen in the image and incorporating any details from the seller's text
- price: whole Nigerian naira amount as a number, or null when there is no stated fixed price
- category: one of "Phones & Tablets", "Computers & Laptops", "Electronics", "Vehicles", "Fashion", "Home & Furniture", "Beauty & Health", "Services", "Other"
- condition: one of "brand_new", "foreign_used", "local_used", "refurbished", "unknown"
- brand: manufacturer/brand or null (e.g. "Apple", "Samsung", "Nike", "Toyota", "HP")
- location: city, area, campus, or town or null
- seller_phone: Nigerian seller phone digits only or null
- specs: short factual specification summary or null

Do not invent a price if none was stated in text or visible in the image. Output only JSON.
`;

const VISION_MODELS = [
  process.env.GROQ_MODEL,
  'qwen/qwen3.8-27b',
].filter(Boolean);

const FALLBACK_TEXT_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
];

export async function parseListingWithVision({ text = '', media = [] } = {}) {
  const message = String(text || '').trim();
  const imageItems = (media || []).filter(
    (m) => m?.kind === 'image' && Buffer.isBuffer(m?.buffer) && m.buffer.length > 0,
  );

  // If no text and no images, nothing to parse
  if (!message && imageItems.length === 0) {
    return { is_commercial_listing: false };
  }

  // Multimodal prompt construction
  if (imageItems.length > 0) {
    const userContent = [
      {
        type: 'text',
        text: message
          ? `Seller's WhatsApp post:\n"""${message}"""\n\nPlease examine the attached product image(s). Identify the item, generate a complete title and descriptive summary, and extract the price.`
          : `A seller posted this product image without any text description. Please examine the image, identify the item, extract any visible price or text from the image, and generate an appealing marketplace title and description.`,
      },
    ];

    // Attach up to 2 images, keeping size safely below Groq 4MB limit
    for (const item of imageItems.slice(0, 2)) {
      if (item.buffer.length > 3_500_000) continue;
      const mime = item.mimeType || 'image/jpeg';
      userContent.push({
        type: 'image_url',
        image_url: {
          url: `data:${mime};base64,${item.buffer.toString('base64')}`,
        },
      });
    }

    for (const model of VISION_MODELS) {
      try {
        const completion = await groq.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: PROMPT_TEMPLATE },
            { role: 'user', content: userContent },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
          max_tokens: 750,
        });
        const parsed = JSON.parse(completion.choices?.[0]?.message?.content || '{}');
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      } catch (error) {
        console.warn(`[Vision parser] Model ${model} failed (${error?.message || error}), trying next...`);
      }
    }
  }

  // Fallback to text-only parsing if image vision failed or no images were provided
  if (message.length >= 3) {
    const textModelsToTry = [...new Set([...VISION_MODELS, ...FALLBACK_TEXT_MODELS])];
    for (const model of textModelsToTry) {
      try {
        const completion = await groq.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: PROMPT_TEMPLATE },
            { role: 'user', content: `WhatsApp sale post:\n"""${message}"""` },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
          max_tokens: 600,
        });
        const parsed = JSON.parse(completion.choices?.[0]?.message?.content || '{}');
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      } catch (error) {
        console.warn(`[Text parser] Model ${model} failed (${error?.message || error}), trying fallback...`);
      }
    }
  }

  console.error('[Vision parser] All candidate models failed to parse listing.');
  return null;
}

export function looksLikeSalePost(text = '', hasMedia = false) {
  const source = String(text || '').toLowerCase().trim();
  if (hasMedia) {
    if (!source) return true; // Image with no text can be scanned for flyer/price stickers
    // When media is attached, any price shorthand, naira symbols, digits, or sale terms match
    if (/(?:\b\d+(?:[.,]\d+)?\s*[km]\b|₦|\bngn\b|\b\d{4,9}\b|\bprice\b|\bavailable\b|\bselling\b|\bfor sale\b|\bdm\b|\bcall\b|\bdeal\b|\bcondition\b)/i.test(source)) {
      return true;
    }
  }
  return /(?:\bfor sale\b|\bavailable\b|\bselling\b|\bprice\b|\b\d+(?:[.,]\d+)?\s*[km]\b|₦|\bngn\b|\bnego\b|\bforeign used\b|\btokunbo\b|\bdm\b|\bcall\b)/i.test(source);
}
