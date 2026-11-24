# Hosted WhatsApp receipts

The receipt flow uses a Vercel serverless function and a Cloudinary image account:

1. The customer reviews the generated bill and consents to sharing their details.
2. The browser uploads the PNG to `/api/receipt`.
3. The server signs the upload with the Cloudinary API secret and returns a unique receipt link.
4. The link opens an Open Graph page so WhatsApp can show the bill image preview with the order text.

The customer still needs to press **Send** in WhatsApp. A website cannot send a WhatsApp message on their behalf.

## Deploy

1. Import this project into Vercel, using the repository root as the project root. Vercel serves the existing HTML files and deploys `api/receipt.js` as a serverless function.
2. Create a Cloudinary account and get the cloud name, API key, and API secret from the Cloudinary dashboard.
3. Add these environment variables in the Vercel project's Settings → Environment Variables. Keep the API secret server-side; never add it to browser JavaScript.

   - `SITE_URL`: the public HTTPS origin, for example `https://your-project.vercel.app` (no trailing slash).
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`

4. Redeploy after adding or changing environment variables.
5. Use Node.js 20 or newer. To test locally, copy `.env.example` to `.env.local`, fill in the same Cloudinary credentials and the deployed public `SITE_URL`, then run `node dev-server.js` and open `http://127.0.0.1:3000/order.html`. Do not use VS Code Live Server or Python's `http.server`; they only serve static files and return `405 Method Not Allowed` for the receipt upload POST.
6. For real orders, test from the deployed HTTPS site. A receipt URL generated during local testing points to the deployed `SITE_URL`, so deploy the Vercel API before sending a test order.

## Privacy

Receipt images are public Cloudinary assets. The unguessable receipt URL is not an access-control mechanism: anyone who receives the URL can view the bill, including the customer name, phone number, and delivery address. Customers must agree in the order form before upload. Assets remain in Cloudinary until deleted from the Cloudinary account.

The upload endpoint accepts PNG bills up to 2 MB, requires a same-origin browser request, and keeps Cloudinary credentials on the server. Add platform-level rate limiting and define a receipt retention/deletion policy before using this for high-volume production orders.
