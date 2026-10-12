// In-memory rate limiting map for basic protection across lambda instances
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60000;
const MAX_REQUESTS_PER_WINDOW = 10;

// Helper for checking magic bytes of base64 images to prevent executable uploads
const isValidImageBase64 = (base64Str) => {
  try {
    const buffer = Buffer.from(base64Str.substring(0, 50), 'base64');
    const hex = buffer.toString('hex').toUpperCase();
    // JPEG (FFD8) or PNG (89504E47)
    return hex.startsWith('FFD8') || hex.startsWith('89504E47');
  } catch (e) {
    return false;
  }
};

// Local dev plus the URLs Vercel provides for this deployment.
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
  process.env.VERCEL_BRANCH_URL && `https://${process.env.VERCEL_BRANCH_URL}`,
  process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
].filter(Boolean);

const sniffMime = (base64Str) => {
  const hex = Buffer.from(base64Str.substring(0, 12), 'base64').toString('hex').toUpperCase();
  return hex.startsWith('89504E47') ? 'image/png' : 'image/jpeg';
};

const handle = async (event) => {
  const origin = event.headers.origin || event.headers.Origin;
  const corsHeaders = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle Preflight Options
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  // 1. Origin Spoofing & CORS validation (same-origin requests are always fine)
  const host = event.headers.host || event.headers.Host;
  const sameOrigin = origin && host && origin.replace(/^https?:\/\//, '') === host;
  if (origin && !sameOrigin && !ALLOWED_ORIGINS.includes(origin)) {
     return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ error: 'Forbidden Origin' }) };
  }

  // 2. API & Credit Abuse (Rate Limiting)
  const clientIp = (event.headers['x-forwarded-for'] || '').split(',')[0].trim() || event.headers['client-ip'] || 'unknown';
  const currentTime = Date.now();
  if (clientIp !== 'unknown') {
    const userLimit = rateLimitMap.get(clientIp) || { count: 0, startTime: currentTime };
    if (currentTime - userLimit.startTime > RATE_LIMIT_WINDOW_MS) {
      userLimit.count = 1;
      userLimit.startTime = currentTime;
    } else {
      userLimit.count++;
      if (userLimit.count > MAX_REQUESTS_PER_WINDOW) {
        return { statusCode: 429, headers: corsHeaders, body: JSON.stringify({ error: 'Too Many Requests' }) };
      }
    }
    rateLimitMap.set(clientIp, userLimit);
  }

  try {
    // 3. Payload Validation (Size limit: ~7MB for JSON)
    if (!event.body || event.body.length > 7 * 1024 * 1024) {
      return { statusCode: 413, headers: corsHeaders, body: JSON.stringify({ error: 'Payload too large. Maximum size is 7MB.' }) };
    }

    const { image, watchImage } = JSON.parse(event.body);

    if (!image || !watchImage) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Missing image or watchImage' }) };
    }
    
    // 3b. Malicious Input Validation (Magic Bytes Checking)
    if (!isValidImageBase64(image) || !isValidImageBase64(watchImage)) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Invalid file type. Only JPG and PNG images are allowed.' }) };
    }

    const apiKey = process.env.YOUCAM_API_KEY;
    if (!apiKey) {
      console.error('YOUCAM_API_KEY is not set. Add it in Vercel > Project Settings > Environment Variables.');
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'Server is not configured.' }) };
    }
    const baseUrl = 'https://yce-api-01.makeupar.com';

    // 1. Convert base64 from frontend to Buffer
    const userBuffer = Buffer.from(image, 'base64');
    const wristMime = sniffMime(image);
    const watchMime = sniffMime(watchImage);
    
    // 1a. Request Presigned Upload URL for Wrist
    const userInitRes = await fetch(`${baseUrl}/s2s/v2.0/file`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        files: [{
          file_name: wristMime === 'image/png' ? 'wrist.png' : 'wrist.jpg',
          content_type: wristMime,
          file_size: userBuffer.length
        }]
      })
    });
    const userInitData = await userInitRes.json();
    
    // The YouCam API wraps the response in a 'data' object
    const wristFiles = userInitData.data && userInitData.data.files ? userInitData.data.files : userInitData.files;

    if (!userInitRes.ok || !wristFiles || !wristFiles[0].file_id) {
      throw new Error("Failed to init wrist upload: " + JSON.stringify(userInitData));
    }
    
    const wristFileId = wristFiles[0].file_id;
    const wristUploadUrl = wristFiles[0].requests[0].url;

    // 1b. Upload Binary to Presigned S3 URL (No API Key needed)
    const userUploadRes = await fetch(wristUploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': wristMime },
      body: userBuffer
    });
    if (!userUploadRes.ok) {
      throw new Error("Failed to upload wrist binary to S3: " + userUploadRes.statusText);
    }

    // 2. Read Watch Image from frontend base64 payload
    const watchBuffer = Buffer.from(watchImage, 'base64');
    
    // 2a. Request Presigned Upload URL for Watch
    const watchInitRes = await fetch(`${baseUrl}/s2s/v2.0/file`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        files: [{
          file_name: watchMime === 'image/png' ? 'watch.png' : 'watch.jpg',
          content_type: watchMime,
          file_size: watchBuffer.length
        }]
      })
    });
    const watchInitData = await watchInitRes.json();
    const watchFiles = watchInitData.data && watchInitData.data.files ? watchInitData.data.files : watchInitData.files;

    if (!watchInitRes.ok || !watchFiles || !watchFiles[0].file_id) {
      throw new Error("Failed to init watch upload: " + JSON.stringify(watchInitData));
    }
    
    const watchFileId = watchFiles[0].file_id;
    const watchUploadUrl = watchFiles[0].requests[0].url;

    // 2b. Upload Binary to Presigned S3 URL
    const watchUploadRes = await fetch(watchUploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': watchMime },
      body: watchBuffer
    });
    if (!watchUploadRes.ok) {
      throw new Error("Failed to upload watch binary to S3: " + watchUploadRes.statusText);
    }

    // 3. Create VTO Task
    const createRes = await fetch(`${baseUrl}/s2s/v2.0/task/2d-vto/watch`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        src_file_id: wristFileId,
        ref_file_ids: [watchFileId],
        source_info: { name: "wrist" },
        object_infos: [{ name: "watch", ref_file_id: watchFileId }],
        parameters: {
          watch_wearing_location: 0,
          watch_shadow_intensity: 0.15
        }
      })
    });
    const createData = await createRes.json();
    const taskData = createData.data || createData;
    
    if (!createRes.ok || !taskData.task_id) {
      throw new Error("Failed to create VTO task: " + JSON.stringify(createData));
    }

    const taskId = taskData.task_id;

    // 4. Poll Task Status
    let status = 'processing';
    let resultUrl = '';
    let retries = 0;
    let lastPollData = null;
    
    while (status !== 'success' && status !== 'failed' && status !== 'error' && retries < 15) {
      // Wait 1.5 seconds between polls
      await new Promise(r => setTimeout(r, 1500));
      
      const pollRes = await fetch(`${baseUrl}/s2s/v2.0/task/2d-vto/watch/${taskId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      
      const pollRaw = await pollRes.json();
      const pollData = pollRaw.data || pollRaw;
      lastPollData = pollData;
      
      status = pollData.task_status || pollData.status || 'processing';
      
      if (status === 'success' || status === 'done') {
        resultUrl = pollData.result_file_url || pollData.vto_image_url || pollData.result_image_url || pollData.result_url;
        
        // Sometimes APIs nest the result
        if (!resultUrl && pollData.result) {
            resultUrl = pollData.result.result_file_url || pollData.result.image_url || pollData.result.url;
        }
        
        if (!resultUrl && pollData.results) {
            resultUrl = pollData.results.url || pollData.results.image_url;
        }
      } else if (status === 'failed' || status === 'error') {
        throw new Error("YouCam Task Failed: " + JSON.stringify(pollRaw));
      }
      
      retries++;
    }

    if (!resultUrl) {
      throw new Error("Task polling timed out or failed to parse URL. Data: " + JSON.stringify(lastPollData || {}));
    }

    // 5. Return the final generated URL to the frontend
    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ vto_image_url: resultUrl })
    };

  } catch (err) {
    console.error("VTO Proxy Error:", err);
    // 4. Information Leakage Protection: Return generic error instead of stack trace
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal Server Error while processing VTO task.' })
    };
  }
};

// Vercel Node.js adapter: translate (req, res) to the event/response shape above.
export default async function vercelHandler(req, res) {
  let body = req.body;
  if (body && typeof body === 'object') body = JSON.stringify(body);
  const out = await handle({
    httpMethod: req.method,
    headers: req.headers,
    body: typeof body === 'string' ? body : ''
  });
  for (const [k, v] of Object.entries(out.headers || {})) res.setHeader(k, v);
  res.status(out.statusCode).send(out.body || '');
}
