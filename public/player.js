document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const videoKey = urlParams.get("watch");

  if (!videoKey) {
    window.location.href = "/";
    return;
  }

  const player = new Plyr("#player", {
    controls: [
      "play-large",
      "play",
      "progress",
      "current-time",
      "duration",
      "mute",
      "volume",
      "captions",
      "settings",
      "pip",
      "fullscreen",
    ],
    settings: ["quality", "speed"],
    speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] },
    resetOnEnd: false,
  });

  const videoSource = document.getElementById("video-source");
  const videoTitle = document.getElementById("video-title");
  const downloadBtn = document.getElementById("download-btn");
  const countdownElement = document.getElementById("countdown");

  let expiryTimer;
  const baseUrl = window.location.origin;
  const proxyUrl = `${baseUrl}/api/getVideoSource?key=${videoKey}`;

  const mediaSource = new MediaSource();
  const video = document.getElementById("player");
  video.src = URL.createObjectURL(mediaSource);

  mediaSource.addEventListener("sourceopen", async () => {
    try {
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        throw new Error("Failed to load video");
      }

      const sourceBuffer = mediaSource.addSourceBuffer(
        'video/mp4; codecs="avc1.42E01E,mp4a.40.2"'
      );
      const reader = response.body.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Wait for the previous append to finish
        if (!sourceBuffer.updating) {
          sourceBuffer.appendBuffer(value);
        }
      }

      mediaSource.endOfStream();
    } catch (error) {
      console.error("Error loading video:", error);
      videoTitle.textContent = "Error loading video";
    }
  });

  async function fetchVideoInfo() {
    try {
      const response = await fetch(proxyUrl, { method: "HEAD" });

      if (!response.ok) {
        if (response.status === 404) {
          videoTitle.textContent = "Video has expired";
          clearInterval(expiryTimer);
          countdownElement.textContent = "0:00";
          return;
        }
        throw new Error("Failed to load video");
      }

      const infoResponse = await fetch(
        `${baseUrl}/api/getVideoSource?key=${videoKey}`
      );
      if (!infoResponse.ok) {
        throw new Error("Failed to load video info");
      }

      const data = await infoResponse.json();
      if (data.error) {
        throw new Error(data.error);
      }

      videoTitle.textContent = data.title || "Untitled Video";
      const expiryTime = data.expiryTime;

      downloadBtn.addEventListener("click", () => {
        const a = document.createElement("a");
        a.href = proxyUrl;
        a.download = "";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      });

      if (expiryTime) {
        startCountdown(expiryTime);
      }
    } catch (error) {
      console.error("Error:", error);
      videoTitle.textContent = "Error loading video";
    }
  }

  function startCountdown(expiryTime) {
    function updateCountdown() {
      const now = Math.floor(Date.now() / 1000);
      const timeLeft = expiryTime - now;

      if (timeLeft <= 0) {
        clearInterval(expiryTimer);
        countdownElement.textContent = "0:00";
        videoTitle.textContent = "Video has expired";
        return;
      }

      const minutes = Math.floor(timeLeft / 60);
      const seconds = timeLeft % 60;
      countdownElement.textContent = `${minutes}:${seconds
        .toString()
        .padStart(2, "0")}`;
    }

    updateCountdown();
    expiryTimer = setInterval(updateCountdown, 1000);
  }

  fetchVideoInfo();
});
