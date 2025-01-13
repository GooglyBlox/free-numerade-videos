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
      waitUntil: 'networkidle0',
      timeout: 20000
    });
    console.log('Login page loaded');

    console.log('Waiting for email input...');
    await page.waitForSelector('[data-test-id="user-email"]', { timeout: 10000 });
    console.log('Email input found');

    console.log('Waiting for password input...');
    await page.waitForSelector('[data-test-id="user-password"]', { timeout: 10000 });
    console.log('Password input found');

    console.log('Typing email...');
    await page.type(
      '[data-test-id="user-email"]',
      process.env.NUMERADE_EMAIL || ''
    );
    console.log('Email typed');

    console.log('Typing password...');
    await page.type(
      '[data-test-id="user-password"]',
      process.env.NUMERADE_PASSWORD || ''
    );
    console.log('Password typed');

    console.log('Clicking login button...');
    await page.click('[data-test-id="login-button"]');
    
    console.log('Waiting for navigation after login...');
    await page.waitForNavigation({ 
      waitUntil: 'networkidle0',
      timeout: 20000 
    });
    console.log('Login navigation complete');

    return true;
  } catch (error) {
    console.error('Login error:', error);
    // Take a screenshot on login failure to debug
    try {
      await page.screenshot({ path: '/tmp/login-error.png' });
      console.log('Error screenshot saved');
    } catch (screenshotError) {
      console.error('Failed to save error screenshot:', screenshotError);
    }
    return false;
  }
}

module.exports = async (req, res) => {
  console.log('Request received:', {
    method: req.method,
    query: req.query,
    body: req.method === 'POST' ? req.body : undefined,
    headers: req.headers
  });

  const startTime = Date.now();
  const url = req.method === 'POST' ? req.body.url : req.query.url;
  const directDownload = req.method === 'GET';

  console.log('Processing request for URL:', url);
  console.log('Direct download:', directDownload);

  if (!url) {
    console.log('No URL provided');
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  if (!await isValidNumeradeUrl(url)) {
    console.log('Invalid URL format');
    return res.status(400).json({ error: 'Invalid Numerade URL' });
  }

  let browser;
  try {
    console.log('Launching browser...');
    browser = await puppeteer.launch({
      args: [...chromium.args, '--disable-dev-shm-usage', '--no-sandbox'],
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      timeout: 20000
    });
    console.log('Browser launched successfully');

    console.log('Creating new page...');
    const page = await browser.newPage();
    console.log('Page created');

    console.log('Setting up request interception...');
    await page.setRequestInterception(true);
    page.on('request', request => {
      if (request.resourceType() === 'image' || request.resourceType() === 'stylesheet' || request.resourceType() === 'font') {
        request.abort();
      } else {
        request.continue();
      }
    });
    console.log('Request interception set up');

    // Add console log listener
    page.on('console', msg => console.log('Browser console:', msg.text()));

    console.log('Starting login process...');
    const loginSuccess = await loginToNumerade(page);
    if (!loginSuccess) {
      console.log('Login failed');
      await browser.close();
      return res.status(500).json({ error: 'Login failed' });
    }
    console.log('Login successful');

    console.log('Navigating to video page:', url);
    await page.goto(url, { 
      waitUntil: 'networkidle0',
      timeout: 20000 
    });
    console.log('Video page loaded');

    console.log('Waiting for video element...');
    await page.waitForSelector('#my-video_html5_api', { 
      timeout: 20000,
      visible: true 
    });
    console.log('Video element found');

    console.log('Extracting video info...');
    const videoInfo = await page.evaluate(() => {
      const videoElement = document.querySelector('#my-video_html5_api');
      console.log('Video element:', videoElement);
      if (!videoElement?.src) {
        console.log('No video source found');
        throw new Error('Video source not found');
      }

      return {
        url: videoElement.src,
        title: document.title.replace(' | Numerade', '').trim(),
      };
    });
    console.log('Video info extracted:', videoInfo);

    console.log('Closing browser...');
    await browser.close();
    console.log('Browser closed');

    const totalTime = Date.now() - startTime;
    console.log(`Total execution time: ${totalTime}ms`);

    if (videoInfo?.url) {
      if (directDownload) {
        console.log('Redirecting to video URL');
        res.redirect(videoInfo.url);
      } else {
        console.log('Sending video info response');
        res.json(videoInfo);
      }
    } else {
      console.log('No video info found');
      res.status(404).json({ error: 'Video source not found' });
    }
  } catch (error) {
    console.error('Fatal error:', error);
    console.error('Error stack:', error.stack);
    if (browser) {
      console.log('Cleaning up browser after error');
      await browser.close();
    }
    res.status(500).json({ 
      error: error.message,
      stack: error.stack,
      executionTime: Date.now() - startTime
    });
  }
};