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
    const response = await page.goto('https://www.numerade.com/login/', {
      waitUntil: 'domcontentloaded',
      timeout: 10000
    });

    if (!response.ok()) {
      throw new Error(`Failed to load login page: ${response.status()}`);
    }
    console.log('Login page loaded');

    console.log('Waiting for form elements...');
    await page.waitForSelector('#signUpForm', { timeout: 5000 });
    await page.waitForSelector('[name="csrfmiddlewaretoken"]', { timeout: 5000 });
    await page.waitForSelector('[data-test-id="user-email"]', { timeout: 5000 });
    await page.waitForSelector('[data-test-id="user-password"]', { timeout: 5000 });
    await page.waitForSelector('[data-test-id="login-button"]', { timeout: 5000 });
    console.log('Form elements found');

    const csrfToken = await page.$eval('[name="csrfmiddlewaretoken"]', el => el.value);
    console.log('CSRF token obtained');

    console.log('Submitting form...');
    await page.evaluate(
      ({ email, password, csrf }) => {
        const form = document.getElementById('signUpForm');
        const emailInput = form.querySelector('[data-test-id="user-email"]');
        const passwordInput = form.querySelector('[data-test-id="user-password"]');
        const csrfInput = form.querySelector('[name="csrfmiddlewaretoken"]');
        
        emailInput.value = email;
        passwordInput.value = password;
        csrfInput.value = csrf;
        
        form.submit();
      },
      { 
        email: process.env.NUMERADE_EMAIL || '',
        password: process.env.NUMERADE_PASSWORD || '',
        csrf: csrfToken 
      }
    );

    await page.waitForNavigation({ 
      waitUntil: 'domcontentloaded',
      timeout: 10000 
    });

    const currentUrl = page.url();
    console.log('Current URL after login:', currentUrl);
    
    if (currentUrl.includes('/login')) {
      throw new Error('Still on login page after attempt');
    }

    console.log('Login successful');
    return true;
  } catch (error) {
    console.error('Login error:', error);
    return false;
  }
}

module.exports = async (req, res) => {
  const startTime = Date.now();
  console.log('Request received:', {
    method: req.method,
    query: req.query,
    body: req.method === 'POST' ? req.body : undefined
  });

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
        '--disable-gpu',
        '--disable-web-security'
      ],
      defaultViewport: {
        width: 1280,
        height: 720
      },
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      timeout: 10000
    });
    console.log('Browser launched');

    const page = await browser.newPage();
    console.log('Page created');

    await page.setRequestInterception(true);
    page.on('request', request => {
      if (
        request.resourceType() === 'image' ||
        request.resourceType() === 'font' ||
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

    page.setDefaultTimeout(10000);
    page.setDefaultNavigationTimeout(10000);

    const loginSuccess = await loginToNumerade(page);
    if (!loginSuccess) {
      throw new Error('Login failed');
    }

    console.log('Navigating to video page:', url);
    const videoPageResponse = await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 10000
    });

    if (!videoPageResponse.ok()) {
      throw new Error(`Failed to load video page: ${videoPageResponse.status()}`);
    }
    console.log('Video page loaded');

    console.log('Waiting for video element...');
    let retries = 3;
    let videoInfo;
    
    while (retries > 0) {
      try {
        await page.waitForTimeout(2000);
        videoInfo = await page.evaluate(() => {
          const videoElement = 
            document.querySelector('#my-video_html5_api') || 
            document.querySelector('video') ||
            document.querySelector('[data-test-id="video-player"] video');

          if (!videoElement?.src) {
            throw new Error('Video source not found');
          }

          return {
            url: videoElement.src || videoElement.dataset.src,
            title: document.title.replace(' | Numerade', '').trim(),
          };
        });
        break;
      } catch (error) {
        console.log(`Retry ${4 - retries} failed:`, error.message);
        retries--;
        if (retries === 0) throw error;
      }
    }

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