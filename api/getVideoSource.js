const chromium = require('@sparticuz/chromium');
let puppeteer;

if (process.env.VERCEL) {
  puppeteer = require('puppeteer-core');
} else {
  puppeteer = require('puppeteer');
}

async function isValidNumeradeUrl(url) {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname === 'www.numerade.com' &&
      (url.startsWith('https://www.numerade.com/ask/question/') ||
        url.startsWith('https://www.numerade.com/questions/'));
  } catch (error) {
    return false;
  }
}

async function loginToNumerade(page) {
  try {
    const response = await page.goto('https://www.numerade.com/login/', {
      waitUntil: 'domcontentloaded',
      timeout: 5000
    });

    if (!response.ok()) {
      throw new Error(`Failed to load login page: ${response.status()}`);
    }

    await page.waitForSelector('#signUpForm', { timeout: 3000 });
    await page.waitForSelector('[name="csrfmiddlewaretoken"]', { timeout: 3000 });
    await page.waitForSelector('[data-test-id="user-email"]', { timeout: 3000 });
    await page.waitForSelector('[data-test-id="user-password"]', { timeout: 3000 });
    await page.waitForSelector('[data-test-id="login-button"]', { timeout: 3000 });

    const csrfToken = await page.$eval('[name="csrfmiddlewaretoken"]', el => el.value);

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
      timeout: 5000 
    });

    const currentUrl = page.url();
    
    if (currentUrl.includes('/login')) {
      throw new Error('Still on login page after attempt');
    }

    return true;
  } catch (error) {
    return false;
  }
}

module.exports = async (req, res) => {
  const url = req.method === 'POST' ? req.body.url : req.query.url;
  const directDownload = req.method === 'GET';

  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  if (!await isValidNumeradeUrl(url)) {
    return res.status(400).json({ error: 'Invalid Numerade URL' });
  }

  let browser;
  try {
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
      timeout: 5000
    });

    const page = await browser.newPage();

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

    page.setDefaultTimeout(5000);
    page.setDefaultNavigationTimeout(5000);

    const loginSuccess = await loginToNumerade(page);
    if (!loginSuccess) {
      throw new Error('Login failed');
    }

    const videoPageResponse = await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 5000
    });

    if (!videoPageResponse.ok()) {
      throw new Error(`Failed to load video page: ${videoPageResponse.status()}`);
    }

    await page.waitForSelector('#my-video_html5_api', { timeout: 5000 });
    
    const videoInfo = await page.evaluate(() => {
      const videoElement = document.querySelector('#my-video_html5_api');
      const videoContainer = document.querySelector('.video-redesign__video-container');
      
      if (!videoElement?.src) {
        throw new Error('Video source not found');
      }

      return {
        url: videoElement.src,
        title: videoContainer ? videoContainer.getAttribute('data-video-title') || document.title.replace(' | Numerade', '').trim() : document.title.replace(' | Numerade', '').trim()
      };
    });

    await browser.close();

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
    if (browser) {
      await browser.close();
    }
    res.status(500).json({ 
      error: error.message
    });
  }
};