const chromium = require("@sparticuz/chromium");
const crypto = require("crypto");
const https = require("https");
let puppeteer;

if (process.env.VERCEL) {
  puppeteer = require("puppeteer-core");
} else {
  puppeteer = require("puppeteer");
}

const PROXY_SECRET =
  process.env.PROXY_SECRET || crypto.randomBytes(32).toString("hex");
const TOKEN_EXPIRY = 3600;

function generateSecureToken(videoUrl) {
  const expiryTime = Math.floor(Date.now() / 1000) + TOKEN_EXPIRY;
  const data = `${videoUrl}|${expiryTime}`;
  const hmac = crypto.createHmac("sha256", PROXY_SECRET);
  hmac.update(data);
  const signature = hmac.digest("hex");

  return Buffer.from(
    JSON.stringify({
      url: videoUrl,
      exp: expiryTime,
      sig: signature,
    })
  ).toString("base64");
}

function verifySecureToken(token) {
  try {
    const decoded = JSON.parse(Buffer.from(token, "base64").toString());
    const { url, exp, sig } = decoded;

    if (Date.now() / 1000 > exp) {
      return null;
    }

    const hmac = crypto.createHmac("sha256", PROXY_SECRET);
    hmac.update(`${url}|${exp}`);
    const expectedSignature = hmac.digest("hex");

    return sig === expectedSignature ? url : null;
  } catch {
    return null;
  }
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

    await page.waitForFunction(
      () => {
        const selectors = [
          "#my-video_html5_api",
          ".video-redesign__video-container video",
          ".video-js video",
          "video[data-video-url]",
        ];

        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element?.src) {
            return true;
          }
        }
        return false;
      },
      { timeout: 30000, polling: 100 }
    );

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

async function proxyVideo(videoUrl, res) {
  return new Promise((resolve, reject) => {
    https
      .get(
        videoUrl,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            Referer: "https://www.numerade.com/",
          },
        },
        (stream) => {
          res.setHeader("Content-Type", "video/mp4");
          res.setHeader(
            "Cache-Control",
            "no-store, no-cache, must-revalidate, proxy-revalidate"
          );
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");

          stream.pipe(res);
          stream.on("end", resolve);
          stream.on("error", reject);
        }
      )
      .on("error", reject);
  });
}

async function cleanupBrowser(browser, page) {
  if (page) {
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      const cookies = document.cookie.split(";");
      cookies.forEach((cookie) => {
        document.cookie = cookie
          .replace(/^ +/, "")
          .replace(/=.*/, `=;expires=${new Date(0).toUTCString()};path=/`);
      });
    });
  }
  if (browser) {
    await browser.close();
  }
}

module.exports = async (req, res) => {
  console.log(
    `Processing ${req.method} request for URL:`,
    req.method === "POST" ? req.body?.url : req.query?.url
  );

  if (req.query?.token) {
    const originalUrl = verifySecureToken(req.query.token);
    if (!originalUrl) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    try {
      await proxyVideo(originalUrl, res);
    } catch (error) {
      console.error("Proxy error:", error);
      res.status(500).json({ error: "Failed to proxy video" });
    }
    return;
  }

  const url = req.method === "POST" ? req.body?.url : req.query?.url;
  const isDirectDownload = req.method === "GET";

  if (!url) {
    return res.status(400).json({ error: "URL parameter is required" });
  }

  if (!(await validateNumeradeUrl(url))) {
    return res.status(400).json({ error: "Invalid Numerade URL" });
  }

  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  let browser;
  let page;
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

    page = await browser.newPage();
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

    const proxyToken = generateSecureToken(videoInfo.url);
    const proxyUrl = `${req.headers["x-forwarded-proto"] || "http"}://${
      req.headers.host
    }/api/getVideoSource?token=${proxyToken}`;

    await cleanupBrowser(browser, page);

    if (isDirectDownload) {
      res.redirect(307, proxyUrl);
    } else {
      res.json({
        url: proxyUrl,
        title: videoInfo.title,
        expires_in: TOKEN_EXPIRY,
      });
    }
  } catch (error) {
    console.error("Error processing request:", error);
    await cleanupBrowser(browser, page);
    res.status(500).json({ error: error.message });
  }
};
