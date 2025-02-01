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

  const video = document.getElementById("player");
  const videoSource = document.getElementById("video-source");
  const videoTitle = document.getElementById("video-title");
  const downloadBtn = document.getElementById("download-btn");
  const countdownElement = document.getElementById("countdown");

  let expiryTimer;
  const baseUrl = window.location.origin;
  const proxyUrl = `${baseUrl}/api/getVideoSource?key=${videoKey}`;

  async function fetchVideoInfo() {
    try {
      const infoResponse = await fetch(proxyUrl, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!infoResponse.ok) {
        if (infoResponse.status === 404) {
          videoTitle.textContent = "Video has expired";
          clearInterval(expiryTimer);
          countdownElement.textContent = "0:00";
          return;
        }
        throw new Error("Failed to load video info");
      }

      const data = await infoResponse.json();
      videoTitle.textContent = data.title || "Untitled Video";

      videoSource.src = proxyUrl;
      video.load();

      downloadBtn.addEventListener("click", () => {
        const a = document.createElement("a");
        a.href = proxyUrl;
        a.download = "";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      });

      if (data.expiryTime) {
        startCountdown(data.expiryTime);
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
