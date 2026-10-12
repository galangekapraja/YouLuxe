# YouLuxe - Redefining the Luxury Watch Experience.

*"Don't just browse. Wear it."*

**YouLuxe** is a premium digital storefront with an AI **Virtual Try-On for watches**. A shopper picks a timepiece (or uploads any watch image), shows their wrist to the camera, and sees how the watch looks on them in seconds, powered by the **YouCam AI Watch Virtual Try-On API** from Perfect Corp.

Built for the **YouCam API Skin AI & eCommerce VTO Hackathon** (Devpost).

## Try it (for judges)

No login and no API key are needed. The server keeps the key.

1. Open the live demo (desktop Chrome recommended) and allow camera access.
2. Click the try-on button and choose a watch from the **Preset Catalog**, or use **Custom Upload** for your own watch image.
3. Hold your wrist in the frame. The YouCam camera kit captures it automatically; you can also upload a wrist photo instead.
4. Wait about 10 to 20 seconds. The generated image shows the watch on your wrist.
5. Click **RESERVE** to see the concierge reservation flow.

If a try-on cannot be generated (for example, the API is busy), the app shows a preview image instead of the AI result. Please retry in a moment.

## How YouLuxe uses the YouCam API

| Step | What happens |
| --- | --- |
| 1. Capture | The **YouCam Camera Kit** (`YMK`, mode `wrist`) captures a wrist image in the browser. |
| 2. Upload | The browser downsizes the image and sends it, with the chosen watch image, to our serverless function `/api/vto`. |
| 3. Proxy | The function validates the files and rate-limits each visitor, then calls the YouCam API with the secret key. The key never reaches the browser. |
| 4. Try-on | `POST /s2s/v2.0/task/2d-vto/watch` creates the AI Watch VTO task, and we poll `GET /s2s/v2.0/task/2d-vto/watch/{task_id}` until the result URL is ready. |
| 5. Result | The final image is shown to the shopper, who can then reserve the watch. |

---

## Concept & Value Proposition

Purchasing luxury timepieces online is often plagued by buyer hesitation—customers cannot physically feel the watch or validate its proportions on their wrist. YouLuxe solves this friction through an innovative **Two-Funnel Architecture**:

### 1. The Exploration Funnel (Virtual Try-On)
Before committing, users can virtually try on any timepiece using our intelligent AI-powered camera integration. 
- **Smart Validation:** Validates the proportions, shadow, and fit of the watch on the user's actual wrist.
- **Flexibility:** Supports both an integrated **Preset Catalog** (for curated collections) and a **Custom Upload** feature (allowing users to try on any watch image they possess).
- **Result:** This high-fidelity visual validation effectively destroys pre-purchase hesitation.

### 2. The Conversion Funnel (White-Glove Concierge)
Once the customer is confident in their choice through the VTO experience, they enter the conversion funnel.
- **Exclusive Collection:** Customers browse detailed specifications and pricing for premium pieces.
- **Reservation System:** By clicking 'RESERVE', users fill out an exclusive form.
- **Personalized Service:** Instead of a generic checkout cart, a personal concierge representative will contact the user directly via WhatsApp to finalize the acquisition, perfectly replicating a high-end, white-glove boutique experience.

---

---

## Tech Stack

- **Frontend:** Responsive HTML, CSS and vanilla JavaScript (glassmorphism UI) bundled with **Vite**. Animations by GSAP and smooth scrolling by Lenis.
- **Backend:** a **Vercel serverless function** (`api/vto.js`) acts as a secure proxy. It protects the API key, checks the origin, validates uploads (size limit and magic bytes) and limits requests per visitor.
- **AI Engine:** **YouCam AI Watch Virtual Try-On API (Perfect Corp)** and the **YouCam Camera Kit** SDK.

---

## Local Setup

You need Node.js 18 or newer and the Vercel CLI (`npm i -g vercel`).

1. **Clone the repository:**
   ```bash
   git clone https://github.com/galangekapraja/YouLuxe.git
   cd YouLuxe
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Add your YouCam API key** (never commit `.env`):
   ```bash
   cp .env.example .env
   ```
   Then set `YOUCAM_API_KEY` in `.env`.
4. **Run locally:**
   ```bash
   vercel dev
   ```
   Open `http://localhost:3000`.

---

## Deploy to Vercel

The app needs a server for the try-on proxy, so it cannot run on GitHub Pages. Vercel's free Hobby plan is enough.

1. In Vercel choose **Add New > Project** and import this repository (Vite is detected automatically).
2. Settings come from `vercel.json` (build `npm run build`, output `dist`, and `api/vto.js` with a 60 second limit).
3. Add the environment variable `YOUCAM_API_KEY`. Optionally add `VITE_FORM_ENDPOINT` (for example a Formspree URL) so reservations reach your inbox.
4. Deploy, then turn off **Deployment Protection** for production so visitors can open the site without logging in.

## Known limits

- Each try-on uses one unit of YouCam API credit. Check your plan before sharing the link widely.
- Without `VITE_FORM_ENDPOINT` the reservation form only shows the confirmation (demo mode).
- Camera capture needs HTTPS (Vercel provides it) and the visitor's permission.

## License

MIT, see [LICENSE](LICENSE).
