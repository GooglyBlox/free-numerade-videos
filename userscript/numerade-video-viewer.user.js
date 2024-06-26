// ==UserScript==
// @name         Numerade Video Viewer
// @namespace    https://github.com/GooglyBlox/free-numerade-videos
// @updateURL    https://raw.githubusercontent.com/GooglyBlox/free-numerade-videos/main/userscript/numerade-video-viewer.user.js
// @version      1.3
// @description  Unlock Numerade video answers for free.
// @author       GooglyBlox
// @match        https://www.numerade.com/questions/*
// @match        https://www.numerade.com/ask/question/*
// @icon         https://raw.githubusercontent.com/GooglyBlox/free-numerade-videos/main/no-more-numerade.ico
// @grant        none
// @license      CC-BY-NC-SA-4.0; https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    async function processLink() {
        try {
            const videoSrc = await fetchVideoSrc();
            if (videoSrc) {
                const videoElement = document.createElement('video');
                videoElement.src = videoSrc;
                videoElement.controls = true;
                videoElement.className = 'video-js vjs-fill vjs-big-play-centered video-player--is-large';
                videoElement.style.width = '100%';
                videoElement.style.height = '500px';

                const containerElement = document.querySelector('.solution-registration-form-r.multi-part-form.multi-part-visible[data-form-order="1"]');

                if (containerElement) {
                    const existingVideoElement = containerElement.querySelector('video');
                    if (existingVideoElement) {
                        existingVideoElement.parentNode.replaceChild(videoElement, existingVideoElement);
                    } else {
                        containerElement.appendChild(videoElement);
                    }

                    // Remove the purple overlay element
                    const purpleOverlayElement = containerElement.querySelector('.purple-overlay');
                    if (purpleOverlayElement) {
                        purpleOverlayElement.remove();
                    }
                } else {
                    console.error('Container element not found.');
                }
            } else {
                alert('Failed to load the video.');
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    }

    async function fetchVideoSrc() {
        let videoId = null;

        // Check for videoUrl in the script tag
        const scriptElements = document.getElementsByTagName('script');
        for (const scriptElement of scriptElements) {
            if (!scriptElement.src) {
                const scriptText = scriptElement.textContent;
                if (scriptText.includes('videoUrl')) {
                    const videoUrlMatch = scriptText.match(/videoUrl\s*=\s*['"](.+?)['"]/);
                    if (videoUrlMatch) {
                        videoId = videoUrlMatch[1];
                        break;
                    }
                }
            }
        }

        // Check for videoUrl in the meta tag
        if (!videoId) {
            const metaElement = document.querySelector('meta[property="twitter:image"]');
            if (metaElement) {
                const contentValue = metaElement.getAttribute('content');
                const videoIdMatch = contentValue.match(/\/([^/]+)_large\.jpg$/);
                if (videoIdMatch) {
                    videoId = videoIdMatch[1];
                }
            }
        }

        if (videoId) {
            const baseUrls = [
                'https://cdn.numerade.com/ask_previews/',
                'https://cdn.numerade.com/project-universal/previews/',
                'https://cdn.numerade.com/ask_video/',
                'https://cdn.numerade.com/project-universal/encoded/',
                'https://cdn.numerade.com/encoded/'
            ];
            const fileTypes = ['webm', 'mp4', 'm4a'];

            for (const baseUrl of baseUrls) {
                for (const fileType of fileTypes) {
                    const videoSrc = `${baseUrl}${videoId}.${fileType}`;
                    const response = await fetch(videoSrc, { method: 'HEAD' });
                    if (response.ok) {
                        return videoSrc;
                    }
                }
            }
        }

        return null;
    }

    processLink();
})();