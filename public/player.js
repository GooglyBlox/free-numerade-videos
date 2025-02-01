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
  });

  const videoSource = document.getElementById("video-source");
  const videoTitle = document.getElementById("video-title");
  const downloadBtn = document.getElementById("download-btn");
  const countdownElement = document.getElementById("countdown");

  let expiryTimer;
  const baseUrl = window.location.origin;
  const proxyUrl = `${baseUrl}/api/getVideoSource?key=${videoKey}`;

  videoSource.src = proxyUrl;

  async function fetchVideoInfo() {
    try {
      const response = await fetch(proxyUrl);

      if (!response.ok) {
        if (response.status === 404) {
          videoTitle.textContent = "Video has expired";
          clearInterval(expiryTimer);
          countdownElement.textContent = "0:00";
          return;
        }
        throw new Error("Failed to load video");
      }

      const contentDisposition = response.headers.get("content-disposition");
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(
          /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
        );
        if (filenameMatch && filenameMatch[1]) {
          const filename = filenameMatch[1].replace(/['"]/g, "");
          videoTitle.textContent = decodeURIComponent(filename);
        }
      }

      downloadBtn.addEventListener("click", () => {
        const a = document.createElement("a");
        a.href = proxyUrl;
        a.download = videoTitle.textContent || "numerade-video.mp4";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      });

      startCountdown(5 * 60);
    } catch (error) {
      console.error("Error:", error);
      videoTitle.textContent = "Error loading video";
    }
  }

  function startCountdown(duration) {
    let timeLeft = duration;

    function updateCountdown() {
      const minutes = Math.floor(timeLeft / 60);
      const seconds = timeLeft % 60;
      countdownElement.textContent = `${minutes}:${seconds
        .toString()
        .padStart(2, "0")}`;

      if (timeLeft === 0) {
        clearInterval(expiryTimer);
        videoTitle.textContent = "Video has expired";
        return;
      }

      timeLeft--;
    }

    updateCountdown();
    expiryTimer = setInterval(updateCountdown, 1000);
  }

  fetchVideoInfo();
});
