const chromium = require('@sparticuz/chromium');
let puppeteer;

if (process.env.VERCEL) {
  puppeteer = require('puppeteer-core');
} else {
  puppeteer = require('puppeteer');
}

async function isValidNumeradeUrl(url) {
  console.log('Validating URL:', url);
  try {
    const parsedUrl = new URL(url);
    const isValid = parsedUrl.hostname === 'www.numerade.com' &&
      (url.startsWith('https://www.numerade.com/ask/question/') ||
        url.startsWith('https://www.numerade.com/questions/'));
    console.log('URL validation result:', isValid);
    return isValid;
  } catch (error) {
    console.error('URL validation error:', error);
    return false;
  }
}

async function loginToNumerade(page) {
  console.log('Starting login process...');
  try {
    console.log('Navigating to login page...');
    await page.goto('https://www.numerade.com/login/', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });
    console.log('Login page loaded');

    console.log('Waiting for email input...');
    await page.waitForSelector('[data-test-id="user-email"]', { timeout: 10000 });
    console.log('Email input found');

    console.log('Waiting for password input...');
    await page.waitForSelector('[data-test-id="user-password"]', { timeout: 10000 });
    console.log('Password input found');

    console.log('Typing credentials...');
    await Promise.all([
      page.type('[data-test-id="user-email"]', process.env.NUMERADE_EMAIL || ''),
      page.type('[data-test-id="user-password"]', process.env.NUMERADE_PASSWORD || '')
    ]);
    console.log('Credentials typed');

    console.log('Clicking login button...');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }),
      page.click('[data-test-id="login-button"]')
    ]);
    console.log('Login navigation complete');

    return true;
  } catch (error) {
    console.error('Login error:', error);
    return false;
  }
}

module.exports = async (req, res) => {
  console.log('Request received:', {
    method: req.method,
    query: req.query,
    body: req.method === 'POST' ? req.body : undefined
  });

  const startTime = Date.now();
  const url = req.method === 'POST' ? req.body.url : req.query.url;
  const directDownload = req.method === 'GET';

  console.log('Processing request for URL:', url);

  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  if (!await isValidNumeradeUrl(url)) {
    return res.status(400).json({ error: 'Invalid Numerade URL' });
  }

  let browser;
  try {
    console.log('Launching browser...');
    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ],
      defaultViewport: {
        width: 1280,
        height: 720
      },
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      timeout: 15000
    });
    console.log('Browser launched');

    const page = await browser.newPage();
    console.log('Page created');

    await page.setRequestInterception(true);
    page.on('request', request => {
      if (
        request.resourceType() === 'image' ||
        request.url().includes('google-analytics') ||
        request.url().includes('doubleclick') ||
        request.url().includes('facebook') ||
        request.url().includes('analytics') ||
        request.url().includes('tracker') ||
        request.url().includes('pixel')
      ) {
        request.abort();
      } else {
        request.continue();
      }
    });

    const loginSuccess = await loginToNumerade(page);
    if (!loginSuccess) {
      throw new Error('Login failed');
    }

    console.log('Navigating to video page:', url);
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });
    console.log('Video page loaded');

    // Wait a bit for the video player to initialize
    await page.waitForTimeout(2000);

    console.log('Checking for video element...');
    const videoInfo = await page.evaluate(() => {
      // Try multiple possible video element selectors
      const videoElement = 
        document.querySelector('#my-video_html5_api') || 
        document.querySelector('video') ||
        document.querySelector('[data-test-id="video-player"] video');

      if (!videoElement?.src) {
        throw new Error('Video source not found');
      }

      // Get both the direct src and data-src if available
      const videoSrc = videoElement.src || videoElement.dataset.src;
      
      return {
        url: videoSrc,
        title: document.title.replace(' | Numerade', '').trim(),
      };
    });
    console.log('Video info:', videoInfo);

    await browser.close();
    console.log('Browser closed');

    const totalTime = Date.now() - startTime;
    console.log(`Total execution time: ${totalTime}ms`);

    if (videoInfo?.url) {
      if (directDownload) {
        res.redirect(videoInfo.url);
      } else {
        res.json(videoInfo);
      }
    } else {
      res.status(404).json({ error: 'Video source not found' });
    }
  } catch (error) {
    console.error('Error:', error);
    if (browser) {
      await browser.close();
    }
    res.status(500).json({ 
      error: error.message,
      executionTime: Date.now() - startTime
    });
  }
};