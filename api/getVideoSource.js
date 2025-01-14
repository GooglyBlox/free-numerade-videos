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
    await Promise.race([
      page.waitForSelector("#my-video_html5_api", { timeout: 30000 }),
      page.waitForSelector(".video-redesign__video-container video", {
        timeout: 30000,
      }),
    ]);

    return await page.evaluate(() => {
      const selectors = [
        "#my-video_html5_api",
        ".video-redesign__video-container video",
        ".video-js video",
        "video[data-video-url]",
      ];

      let videoElement = null;
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element?.src) {
          videoElement = element;
          break;
        }
      }

      if (!videoElement?.src) return null;

      const container =
        videoElement.closest(".video-redesign__video-container") ||
        videoElement.closest(".video-js");

      let title = document.title.replace(" | Numerade", "").trim();

      if (container) {
        title =
          container.getAttribute("data-video-title") ||
          container
            .getAttribute("aria-label")
            ?.replace("Video Player", "")
            .trim() ||
          title;
      }

      const videoId =
        videoElement.getAttribute("data-video-url") ||
        videoElement.getAttribute("data-answer-id") ||
        videoElement.src.split("/").pop()?.split(".")[0];

      return {
        url: videoElement.src,
        title: title,
        videoId: videoId,
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
