const chromium = require("@sparticuz/chromium");
let puppeteer;

if (process.env.VERCEL) {
  puppeteer = require("puppeteer-core");
} else {
  puppeteer = require("puppeteer");
}

async function validateNumeradeUrl(url) {
  try {
    const parsedUrl = new URL(url);
    return (
      parsedUrl.hostname === "www.numerade.com" &&
      (url.startsWith("https://www.numerade.com/ask/question/") ||
        url.startsWith("https://www.numerade.com/questions/"))
    );
  } catch {
    return false;
  }
}

async function performLogin(page) {
  try {
    await page.goto("https://www.numerade.com/login/", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await page.waitForSelector("#signUpForm", { timeout: 10000 });
    await page.waitForSelector('[name="csrfmiddlewaretoken"]', {
      timeout: 10000,
    });

    const csrfToken = await page.$eval(
      '[name="csrfmiddlewaretoken"]',
      (el) => el.value
    );

    await page.evaluate(
      ({ email, password, csrf }) => {
        const form = document.getElementById("signUpForm");
        const emailInput = form.querySelector('[data-test-id="user-email"]');
        const passwordInput = form.querySelector(
          '[data-test-id="user-password"]'
        );
        const csrfInput = form.querySelector('[name="csrfmiddlewaretoken"]');

        emailInput.value = email;
        passwordInput.value = password;
        csrfInput.value = csrf;

        form.submit();
      },
      {
        email: process.env.NUMERADE_EMAIL,
        password: process.env.NUMERADE_PASSWORD,
        csrf: csrfToken,
      }
    );

    await page.waitForNavigation({
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    return !page.url().includes("/login");
  } catch (error) {
    console.error("Login failed:", error);
    return false;
  }
}

async function extractVideoInfo(page) {
  try {
    await page.waitForSelector("#my-video_html5_api", { timeout: 30000 });

    return await page.evaluate(() => {
      const videoElement = document.querySelector("#my-video_html5_api");
      if (!videoElement?.src) return null;

      const container = videoElement.closest(
        ".video-redesign__video-container"
      );
      const title = container
        ? container.getAttribute("data-video-title") ||
          document.title.replace(" | Numerade", "").trim()
        : document.title.replace(" | Numerade", "").trim();

      return {
        url: videoElement.src,
        title: title,
        videoId: videoElement.getAttribute("data-video-url"),
      };
    });
  } catch (error) {
    console.error("Video extraction failed:", error);
    return null;
  }
}

module.exports = async (req, res) => {
  console.log(
    `Processing ${req.method} request for URL:`,
    req.method === "POST" ? req.body?.url : req.query?.url
  );

  const url = req.method === "POST" ? req.body?.url : req.query?.url;
  const isDirectDownload = req.method === "GET";

  if (!url) {
    return res.status(400).json({ error: "URL parameter is required" });
  }

  if (!(await validateNumeradeUrl(url))) {
    return res.status(400).json({ error: "Invalid Numerade URL" });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        "--disable-dev-shm-usage",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
        "--disable-web-security",
      ],
      defaultViewport: { width: 1280, height: 720 },
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (
        ["image", "font", "stylesheet"].includes(request.resourceType()) ||
        request
          .url()
          .match(
            /google-analytics|doubleclick|facebook|analytics|tracker|pixel/
          )
      ) {
        request.abort();
      } else {
        request.continue();
      }
    });

    const loginSuccess = await performLogin(page);
    if (!loginSuccess) {
      throw new Error("Authentication failed");
    }

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    const videoInfo = await extractVideoInfo(page);
    if (!videoInfo?.url) {
      throw new Error("Video source not found");
    }

    await browser.close();

    if (isDirectDownload) {
      res.redirect(videoInfo.url);
    } else {
      res.json(videoInfo);
    }
  } catch (error) {
    console.error("Error processing request:", error);
    if (browser) {
      await browser.close();
    }
    res.status(500).json({ error: error.message });
  }
};
