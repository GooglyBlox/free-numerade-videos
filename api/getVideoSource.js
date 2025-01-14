const chromium = require("@sparticuz/chromium");
let puppeteer;

if (process.env.VERCEL) {
  puppeteer = require("puppeteer-core");
} else {
  puppeteer = require("puppeteer");
}

async function isValidNumeradeUrl(url) {
  console.log("Validating URL:", url);
  try {
    const parsedUrl = new URL(url);
    const isValid =
      parsedUrl.hostname === "www.numerade.com" &&
      (url.startsWith("https://www.numerade.com/ask/question/") ||
        url.startsWith("https://www.numerade.com/questions/"));
    console.log("URL validation result:", isValid);
    return isValid;
  } catch (error) {
    console.error("URL validation error:", error);
    return false;
  }
}

async function attemptLogin(page) {
  console.log("Attempting login...");
  try {
    const initialCookies = await page.cookies();
    console.log("Initial cookies:", initialCookies);

    console.log("Navigating to login page...");
    await page.goto("https://www.numerade.com/login/", {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

    console.log("Waiting for login form...");
    const formSelector = "#signUpForm";
    const emailSelector = 'input[data-test-id="user-email"]';
    const passwordSelector = 'input[data-test-id="user-password"]';
    const loginButtonSelector = 'button[data-test-id="login-button"]';

    const formExists = await page
      .waitForSelector(formSelector, {
        visible: true,
        timeout: 10000,
      })
      .catch(() => false);

    if (!formExists) {
      console.log("No login form found - may already be logged in");
      return true;
    }

    await Promise.all([
      page.waitForSelector(emailSelector, { visible: true, timeout: 5000 }),
      page.waitForSelector(passwordSelector, { visible: true, timeout: 5000 }),
    ]);

    console.log("Filling login credentials...");
    await page.evaluate(
      (email, password, emailSel, passwordSel) => {
        document.querySelector(emailSel).value = email;
        document.querySelector(passwordSel).value = password;
      },
      process.env.NUMERADE_EMAIL,
      process.env.NUMERADE_PASSWORD,
      emailSelector,
      passwordSelector
    );

    await page.waitForSelector(loginButtonSelector, {
      visible: true,
      timeout: 5000,
    });

    console.log("Submitting login form...");
    await Promise.all([
      page.click(loginButtonSelector),
      page.waitForNavigation({
        waitUntil: "networkidle0",
        timeout: 30000,
      }),
    ]);

    const postLoginCookies = await page.cookies();
    console.log("Post-login cookies:", postLoginCookies);

    const currentUrl = page.url();
    console.log("Post-login URL:", currentUrl);

    if (currentUrl.includes("/login")) {
      const errorMessages = await page.evaluate(() => {
        const errorElements = document.querySelectorAll(
          ".error-message, .alert, .flash-message"
        );
        return Array.from(errorElements).map((el) => el.textContent.trim());
      });

      if (errorMessages.length > 0) {
        console.log("Login errors encountered:", errorMessages);
        return false;
      }

      console.log("Still on login page - login may have failed");
      return false;
    }

    await page.waitForTimeout(2000);

    const finalCookies = await page.cookies();
    console.log("Final cookies after login:", finalCookies);

    console.log("Login appears successful");
    return true;
  } catch (error) {
    console.log("Login attempt failed:", error.message);
    return false;
  }
}

async function getVideoInfo(page, url) {
  console.log("Navigating to video page:", url);
  const videoPageResponse = await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 5000,
  });

  if (!videoPageResponse.ok()) {
    const errorStatus = videoPageResponse.status();
    console.error(`Failed to load video page: ${errorStatus}`);
    if (errorStatus === 404) {
      throw new Error("Video not found");
    }
    throw new Error(`Failed to load video page: ${errorStatus}`);
  }

  console.log("Video page loaded, waiting for player...");

  console.log("Waiting for play button...");
  await page.waitForSelector(".vjs-big-play-button", { 
    visible: true,
    timeout: 5000 
  });

  console.log("Clicking play button...");
  await page.click(".vjs-big-play-button");

  console.log("Waiting for video source to be available...");
  
  const videoInfo = await page.evaluate(async () => {
    const waitFor = (condition, timeout = 5000, interval = 50) => {
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const check = () => {
          const result = condition();
          if (result) {
            resolve(result);
          } else if (Date.now() - startTime >= timeout) {
            reject(new Error('Timeout waiting for condition'));
          } else {
            setTimeout(check, interval);
          }
        };
        
        check();
      });
    };

    try {
      const videoData = await waitFor(() => {
        const video = document.querySelector(".video-redesign__video-container video");
        if (!video) return null;
        
        console.log("Video element state:", {
          src: video.src,
          currentSrc: video.currentSrc,
          readyState: video.readyState,
          networkState: video.networkState,
          dataSrc: video.dataset.src,
          dataUrl: video.getAttribute('data-video-url'),
          poster: video.poster
        });
        
        const src = video.src || video.currentSrc || video.dataset.src;
        if (!src || !(src.endsWith(".mp4") || src.endsWith(".webm"))) return null;
        
        const container = video.closest(".video-redesign__video-container");
        const title = container?.getAttribute("data-video-title") || 
                     document.title.replace(" | Numerade", "").trim();
        
        console.log("Found video source:", { src, title });
        return { url: src, title };
      }, 5000);

      if (!videoData) {
        throw new Error("Failed to find valid video source after play");
      }

      return videoData;
    } catch (error) {
      console.error("Error waiting for video source:", error);
      
      const allVideos = document.querySelectorAll("video");
      console.log("All video elements found:", Array.from(allVideos).map(v => ({
        src: v.src,
        currentSrc: v.currentSrc,
        className: v.className,
        id: v.id,
        dataAttrs: Object.keys(v.dataset)
      })));
      
      return { error: error.message };
    }
  });

  if (!videoInfo?.url) {
    console.error("No valid video found:", videoInfo);
    throw new Error(videoInfo?.error || "Video source not found");
  }

  return videoInfo;
}

module.exports = async (req, res) => {
  const startTime = Date.now();
  console.log("Request received:", {
    method: req.method,
    query: req.query,
    body: req.method === "POST" ? req.body : undefined,
  });

  const url = req.method === "POST" ? req.body.url : req.query.url;
  const directDownload = req.method === "GET";

  console.log("Processing request for URL:", url);

  if (!url) {
    return res.status(400).json({ error: "URL parameter is required" });
  }

  if (!(await isValidNumeradeUrl(url))) {
    return res.status(400).json({ error: "Invalid Numerade URL" });
  }

  let browser;
  try {
    console.log("Launching browser...");
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
      defaultViewport: {
        width: 1280,
        height: 720,
      },
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      timeout: 30000,
    });
    console.log("Browser launched");

    const page = await browser.newPage();
    console.log("Page created");

    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (
        request.resourceType() === "image" ||
        request.resourceType() === "font" ||
        request.url().includes("google-analytics") ||
        request.url().includes("doubleclick") ||
        request.url().includes("facebook") ||
        request.url().includes("analytics") ||
        request.url().includes("tracker") ||
        request.url().includes("pixel")
      ) {
        request.abort();
      } else {
        request.continue();
      }
    });

    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Request timeout")), 60000);
    });

    await Promise.race([
      (async () => {
        // Try login but continue regardless of result
        await attemptLogin(page);

        // Get video info whether login worked or not
        const videoInfo = await getVideoInfo(page, url);

        if (directDownload) {
          res.redirect(videoInfo.url);
        } else {
          res.json(videoInfo);
        }
      })(),
      timeoutPromise,
    ]);
  } catch (error) {
    console.error("Error:", error);
    res.status(error.message === "Request timeout" ? 504 : 500).json({
      error: error.message,
      executionTime: Date.now() - startTime,
    });
  } finally {
    if (browser) {
      await browser.close();
      console.log("Browser closed");
    }
    const totalTime = Date.now() - startTime;
    console.log(`Total execution time: ${totalTime}ms`);
  }
};
