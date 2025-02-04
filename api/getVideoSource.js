const chromium = require("@sparticuz/chromium");
const https = require("https");
const crypto = require("crypto");
const Redis = require("ioredis");
let puppeteer;

if (process.env.VERCEL) {
  puppeteer = require("puppeteer-core");
} else {
  puppeteer = require("puppeteer");
}

const redis = new Redis({
  port: 14018,
  host: process.env.REDIS_HOST,
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
});

const VIDEO_KEY_EXPIRY = 5 * 60;

function generateVideoKey() {
  return crypto.randomBytes(32).toString("hex");
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
      timeout: 60000,
    });

    await page.waitForSelector("#signUpForm", { timeout: 30000 });
    await page.waitForSelector('[name="csrfmiddlewaretoken"]', {
      timeout: 30000,
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
      timeout: 60000,
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
      page.waitForSelector("#my-video_html5_api", { timeout: 60000 }),
      page.waitForSelector(".video-redesign__video-container video", {
        timeout: 60000,
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
      { timeout: 60000, polling: 100 }
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

      const scripts = document.querySelectorAll("script");
      let isAIGenerated = false;

      for (const script of scripts) {
        const content = script.textContent;
        if (content && content.includes("aiVideoGPTVersion")) {
          const match = content.match(
            /aiVideoGPTVersion\s*=\s*['"]([^'"]*)['"]/
          );
          if (match && match[1] === "") {
            isAIGenerated = true;
            break;
          }
        }
      }

      return {
        url: videoElement.src,
        title: title,
        videoId: videoId,
        isAIGenerated: isAIGenerated,
      };
    });
  } catch (error) {
    console.error("Video extraction failed:", error);
    return null;
  }
}

async function waitForMathJax(page) {
  try {
    await page.waitForFunction(
      () => {
        return (
          typeof MathJax !== "undefined" &&
          typeof MathJax.typesetPromise === "function" &&
          document.querySelector(".MathJax_SVG,.MathJax")
        );
      },
      { timeout: 10000 }
    );

    await page.evaluate(() => MathJax.typesetPromise());
  } catch (error) {
    console.error("MathJax rendering error:", error);
  }
}

async function captureInstantAnswer(page, answerHtml) {
  try {
    const stepsMatch = answerHtml.match(
      /<div class="postorder-steps-list">([\s\S]*?)<\/div>\s*<\/div>/
    );
    if (!stepsMatch) {
      console.error("Could not find steps content");
      return null;
    }

    const stepsContent = stepsMatch[1];

    const cleanHtml = stepsContent
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<button[^>]*>.*?<\/button>/gi, "")
      .replace(/<img[^>]*>/gi, "")
      .replace(
        /<mjx-container[^>]*>([\s\S]*?)<\/mjx-container>/g,
        (match, content) => {
          const mathMatch = content.match(/<math[^>]*>([\s\S]*?)<\/math>/);
          if (mathMatch) {
            return `\\(${mathMatch[1]}\\)`;
          }
          return "";
        }
      );

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <script src="https://polyfill.io/v3/polyfill.min.js?features=es6"></script>
          <script>
            window.MathJax = {
              tex: {
                inlineMath: [['\\\\(', '\\\\)']],
                displayMath: [['\\\\[', '\\\\]']],
                processEscapes: true
              },
              svg: {
                fontCache: 'global'
              }
            };
          </script>
          <script id="MathJax-script" src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"></script>
          <style>
            body {
              margin: 20px;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
              background: white;
              color: black;
              line-height: 1.6;
              width: 800px;
              padding: 20px;
            }
            .solution {
              padding: 20px;
              background: white;
            }
            .postorder-steps-item {
              margin-bottom: 30px;
            }
            .postorder-steps-item-step {
              font-weight: bold;
              margin-bottom: 10px;
            }
            .postorder-steps-item-text {
              padding: 15px;
              background: #f8f9fa;
              border-radius: 8px;
            }
            .MathJax { 
              font-size: 115% !important; 
            }
          </style>
        </head>
        <body>
          <div class="solution">
            ${cleanHtml}
          </div>
        </body>
      </html>
    `;

    const renderPage = await page.browser().newPage();

    await renderPage.setViewport({ width: 900, height: 1200 });

    await renderPage.setRequestInterception(true);
    renderPage.on("request", (request) => {
      if (
        request.url().includes("mathjax") ||
        request.url().includes("polyfill.io") ||
        request.url().startsWith("data:")
      ) {
        request.continue();
      } else {
        request.abort();
      }
    });

    await renderPage.setContent(html, { waitUntil: "networkidle0" });
    await waitForMathJax(renderPage);

    const element = await renderPage.$(".solution");
    if (!element) {
      throw new Error("Solution element not found");
    }

    const imageBuffer = await element.screenshot({
      type: "png",
      omitBackground: true,
      padding: 20,
    });

    await renderPage.close();

    return `data:image/png;base64,${imageBuffer.toString("base64")}`;
  } catch (error) {
    console.error("Error capturing instant answer:", error);
    return null;
  }
}

async function extractInstantAnswer(page) {
  try {
    await page
      .waitForSelector(".postorder-steps-container", { timeout: 30000 })
      .catch(() => null);

    const answer = await page.evaluate(() => {
      const container = document.querySelector(".postorder-steps-container");
      if (!container) return null;

      return {
        rawHtml: container.innerHTML,
      };
    });

    if (!answer) return null;

    const imageData = await captureInstantAnswer(page, answer.rawHtml);

    return {
      image: imageData,
      rawHtml: answer.rawHtml,
    };
  } catch (error) {
    console.error("Answer extraction failed:", error);
    return null;
  }
}

function normalizeFilename(title) {
  let normalized = title
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, "_")
    .toLowerCase();

  normalized = normalized.slice(0, 100);

  if (!normalized.endsWith(".mp4")) {
    normalized += ".mp4";
  }

  return normalized;
}

async function proxyVideo(videoUrl, res, title) {
  return new Promise((resolve, reject) => {
    const request = https.get(videoUrl, (videoResponse) => {
      res.writeHead(200, {
        "Content-Type": "video/mp4",
        "Content-Length": videoResponse.headers["content-length"],
        "Content-Disposition": `attachment; filename="${encodeURIComponent(
          normalizeFilename(title || "numerade-video.mp4")
        )}"`,
        "Cache-Control":
          "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      });

      videoResponse.pipe(res);
      videoResponse.on("end", resolve);
      videoResponse.on("error", reject);
    });

    request.on("error", reject);
  });
}

module.exports = async (req, res) => {
  if (req.query.key) {
    try {
      const videoData = await redis.get(req.query.key);
      if (!videoData) {
        return res.status(404).json({ error: "Video not found or expired" });
      }

      const data = JSON.parse(videoData);

      if (req.headers.accept === "application/json") {
        return res.json({
          title: data.title,
          expiryTime: data.expiryTime,
          instantAnswer: data.instantAnswer,
        });
      }

      await proxyVideo(data.url, res, data.title);
    } catch (error) {
      console.error("Error streaming video:", error);
      res.status(500).json({ error: "Error streaming video" });
    }
    return;
  }

  const url = req.method === "POST" ? req.body?.url : req.query?.url;

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
      const shouldBlock =
        ["image", "stylesheet", "font"].includes(request.resourceType()) ||
        request
          .url()
          .match(
            /google-analytics|doubleclick|facebook|analytics|tracker|pixel/
          );

      if (
        request.url().includes("mathjax") ||
        request.url().includes("polyfill.io")
      ) {
        request.continue();
      } else if (shouldBlock) {
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
      timeout: 60000,
    });

    const [videoInfo, instantAnswer] = await Promise.all([
      extractVideoInfo(page),
      extractInstantAnswer(page),
    ]);

    await browser.close();

    if (!videoInfo?.url && !instantAnswer) {
      throw new Error("No content found");
    }

    if (!videoInfo?.url) {
      return res.json({
        error: "Video source not found",
        instantAnswer: instantAnswer,
      });
    }

    const videoKey = generateVideoKey();
    const expiryTime = Math.floor(Date.now() / 1000) + VIDEO_KEY_EXPIRY;
    await redis.setex(
      videoKey,
      VIDEO_KEY_EXPIRY,
      JSON.stringify({
        url: videoInfo.url,
        title: videoInfo.title,
        expiryTime: expiryTime,
        instantAnswer: instantAnswer,
      })
    );

    const baseUrl = process.env.NEXT_PUBLIC_API_URL
      ? `https://${process.env.NEXT_PUBLIC_API_URL}`
      : "http://localhost:3000";

    res.json({
      key: videoKey,
      title: videoInfo.title,
      proxyUrl: `${baseUrl}/api/getVideoSource?key=${videoKey}`,
      watchUrl: `${baseUrl}/watch?watch=${videoKey}`,
      isAIGenerated: videoInfo.isAIGenerated,
      instantAnswer: instantAnswer,
    });
  } catch (error) {
    console.error("Error processing request:", error);
    if (browser) {
      await browser.close();
    }
    res.status(500).json({
      error: error.message,
      instantAnswer: error.instantAnswer || null,
    });
  }
};
