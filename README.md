# BUYSELL WhatsApp Vision Collector (Bot 2) 🤖📸

An intelligent WhatsApp collector bot for **BUYSELL Nigeria** powered by **Groq Multimodal Vision AI (`qwen/qwen3.8-27b`)** and **Baileys**.

---

## 🌟 Key Features

- **Multimodal Visual AI Analysis:** Even if a seller posts an image with **no description** or only a price tag (e.g. `330k`, `₦45,000`, `price: 50k`), the Vision AI inspects the photo, detects the exact item (brand, model, category, specs, condition), and crafts a rich title and description.
- **Price Extraction:** Automatically extracts Nigerian price formats (`350k` -> ₦350,000, `1.5m` -> ₦1,500,000, `₦45,000`) from message text, follow-up messages, or visible price tags/flyers in the photo.
- **Smart Follow-Up Buffering:** If a seller posts photos first and sends the price a few seconds later, the bot buffers the photos for up to 30 seconds, joins them with the price, and processes them as one complete listing.
- **Note Merging:** If the seller leaves short notes (e.g. `UK used, battery 88%`), the bot seamlessly merges the seller's notes with the AI's visual product description.
- **Cloudinary Image Hosting:** Automatically optimizes and uploads WhatsApp images directly to Cloudinary.
- **Direct Marketplace Ingestion:** Publishes approved listings straight into the BUYSELL Supabase catalog.
- **Interactive Seller Feedback:** Automatically DMs the seller with their public link and management controls (replying `SOLD` or `DELETE` marks the item sold).
- **Keep-Alive Health Check:** Built-in HTTP server on `PORT` for 24/7 uptime monitoring with UptimeRobot.

---

## 🛠️ Environment Variables

Copy `.env.example` to `.env` and fill in the required keys:

```properties
# Supabase credentials
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
WHATSAPP_INGEST_SECRET=your-secret

# Cloudinary credentials
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Groq Vision Key
GROQ_API_KEY=gsk_your_groq_key
GROQ_MODEL=qwen/qwen3.8-27b

# Bot Settings
WHATSAPP_PHONE_NUMBER=234...
WHATSAPP_MONITOR_ALL_GROUPS=true
WHATSAPP_LISTINGS_SELLER_ID=e525b6d9-4f81-4522-822d-119151671dba
PUBLIC_SITE_URL=https://your-buysell-site.com
```

---

## 🚀 Deployment (Render)

1. Create a new **Web Service** on Render and connect this repository:
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** `Free`
2. Add the environment variables listed above.
3. Check the Render logs on first run to copy your 8-digit **WhatsApp Pairing Code** and link the device on WhatsApp.
4. Add your Render service URL to **UptimeRobot** (5-minute interval) to keep it awake 24/7.