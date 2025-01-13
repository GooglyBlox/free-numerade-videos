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
    return (
      parsedUrl.hostname === 'www.numerade.com' &&
      (url.startsWith('https://www.numerade.com/ask/question/') ||
        url.startsWith('https://www.numerade.com/questions/'))
    );
  } catch {
    return false;
  }
}

async function loginToNumerade(page) {
  try {
    await page.goto('https://www.numerade.com/login/', {
      waitUntil: 'networkidle0',
    });
    await page.waitForSelector('[data-test-id="user-email"]');
    await page.waitForSelector('[data-test-id="user-password"]');

    await page.type(
      '[data-test-id="user-email"]',
      process.env.NUMERADE_EMAIL || ''
    );
    await page.type(
      '[data-test-id="user-password"]',
      process.env.NUMERADE_PASSWORD || ''
    );
    await page.click('[data-test-id="login-button"]');
    await page.waitForNavigation({ waitUntil: 'networkidle0' });

    return true;
  } catch {
    return false;
  }
}

module.exports = async (req, res) => {
  console.log('Received request:', req.method === 'POST' ? req.body : req.query);
  const url = req.method === 'POST' ? req.body.url : req.query.url;
  const directDownload = req.method === 'GET';

  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  if (!await isValidNumeradeUrl(url)) {
    return res.status(400).json({ error: 'Invalid Numerade URL' });
  }

  try {
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', request => request.continue());

    const loginSuccess = await loginToNumerade(page);
    if (!loginSuccess) {
      await browser.close();
      return res.status(500).json({ error: 'Login failed' });
    }

    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForSelector('#my-video_html5_api', { timeout: 30000 });

    const videoInfo = await page.evaluate(() => {
      const videoElement = document.querySelector('#my-video_html5_api');
      if (!videoElement?.src) {
        throw new Error('Video source not found');
      }

      return {
        url: videoElement.src,
        title: document.title.replace(' | Numerade', '').trim(),
      };
    });

    await browser.close();

    if (videoInfo && videoInfo.url) {
      console.log('Found video source:', videoInfo.url);
      if (directDownload) {
        res.redirect(videoInfo.url);
      } else {
        res.json(videoInfo);
      }
    } else {
      console.log('No video source found.');
      res.status(404).json({ error: 'Video source not found.' });
    }
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: error.message });
  }
};