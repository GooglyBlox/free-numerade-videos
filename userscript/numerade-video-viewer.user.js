// ==UserScript==
// @name         Numerade Video Viewer
// @namespace    https://github.com/GooglyBlox/free-numerade-videos
// @updateURL    https://raw.githubusercontent.com/GooglyBlox/free-numerade-videos/main/userscript/numerade-video-viewer.user.js
// @version      1.7
// @description  Unlock Numerade video answers for free.
// @author       GooglyBlox
// @match        https://www.numerade.com/questions/*
// @match        https://www.numerade.com/ask/question/*
// @icon         https://raw.githubusercontent.com/GooglyBlox/free-numerade-videos/main/no-more-numerade.ico
// @grant        GM_xmlhttpRequest
// @connect      cdn.numerade.com
// @license      CC-BY-NC-SA-4.0; https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG = {
        videoStyles: `
            .video-js.vjs-16-9 {
                padding-top: 0 !important;
            }
        `,
        videoConfig: {
            className: 'video-js vjs-fill vjs-big-play-centered video-player--is-large',
            width: '100%',
            height: '500px'
        },
        baseUrls: [
            'https://cdn.numerade.com/ask_previews/',
            'https://cdn.numerade.com/project-universal/previews/',
            'https://cdn.numerade.com/ask_video/',
            'https://cdn.numerade.com/project-universal/encoded/',
            'https://cdn.numerade.com/encoded/'
        ],
        fileTypes: ['webm', 'mp4', 'm4a'],
        elementsToRemove: [
            '.vjs-poster',
            '.vjs-text-track-display',
            '.vjs-loading-spinner',
            '.vjs-big-play-button',
            '.vjs-control-bar',
            '#register-modal'
        ]
    };

    function initialize() {
        injectStyles();
        window.addEventListener('load', processVideo);
    }

    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = CONFIG.videoStyles;
        document.head.appendChild(style);
    }

    async function processVideo() {
        try {
            const videoSrc = await findVideoSource();
            if (!videoSrc) {
                throw new Error('Failed to find video source');
            }

            const videoElement = createVideoElement(videoSrc);
            const container = findVideoContainer();
            
            if (!container) {
                throw new Error('Video container not found');
            }

            replaceOrAppendVideo(container, videoElement);
            cleanupInterface(container);
        } catch (error) {
            console.error('Video processing failed:', error);
            alert(`Error: ${error.message}`);
        }
    }

    function createVideoElement(src) {
        const video = document.createElement('video');
        video.src = src;
        video.controls = true;
        Object.assign(video.style, {
            width: CONFIG.videoConfig.width,
            height: CONFIG.videoConfig.height
        });
        video.className = CONFIG.videoConfig.className;
        return video;
    }

    function findVideoContainer() {
        return document.querySelector(
            '.solution-registration-form-r.multi-part-form.multi-part-visible[data-form-order="1"]'
        );
    }

    function replaceOrAppendVideo(container, videoElement) {
        const existingVideo = container.querySelector('video');
        if (existingVideo) {
            existingVideo.parentNode.replaceChild(videoElement, existingVideo);
        } else {
            container.appendChild(videoElement);
        }
    }

    function cleanupInterface(container) {
        const purpleOverlay = container.querySelector('.purple-overlay');
        if (purpleOverlay) {
            purpleOverlay.remove();
        }
        
        CONFIG.elementsToRemove.forEach(selector => {
            const element = document.querySelector(selector);
            if (element) {
                element.remove();
            }
        });
    }

    async function findVideoSource() {
        const videoId = await extractVideoId();
        if (!videoId) {
            throw new Error('Could not find video ID');
        }

        return await findValidVideoUrl(videoId);
    }

    async function extractVideoId() {
        const extractors = [
            extractFromScripts,
            extractFromMetaTags,
            extractFromPoster
        ];

        for (const extractor of extractors) {
            const videoId = await extractor();
            if (videoId) return videoId;
        }

        return null;
    }

    function extractFromScripts() {
        const scripts = document.getElementsByTagName('script');
        for (const script of scripts) {
            if (!script.src) {
                const match = script.textContent.match(/videoUrl\s*=\s*['"](.+?)['"]/);
                if (match) return match[1];
            }
        }
        return null;
    }

    function extractFromMetaTags() {
        const metaElement = document.querySelector('meta[property="twitter:image"]');
        if (metaElement) {
            const content = metaElement.getAttribute('content');
            const match = content.match(/\/([^/]+?)_large\.jpg$/);
            return match ? match[1] : null;
        }
        return null;
    }

    function extractFromPoster() {
        const videoElement = document.querySelector('video.vjs-tech');
        if (videoElement) {
            const poster = videoElement.getAttribute('poster');
            if (poster) {
                const match = poster.match(/\/([^/]+?)_[^/]+\.jpg$/);
                return match ? match[1] : null;
            }
        }
        return null;
    }

    async function findValidVideoUrl(videoId) {
        for (const baseUrl of CONFIG.baseUrls) {
            for (const fileType of CONFIG.fileTypes) {
                const url = `${baseUrl}${videoId}.${fileType}`;
                try {
                    const exists = await checkResourceExists(url);
                    if (exists) return url;
                } catch (error) {
                    console.error(`Failed to check URL ${url}:`, error);
                }
            }
        }
        return null;
    }

    function checkResourceExists(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'HEAD',
                url: url,
                onload: response => resolve(response.status === 200),
                onerror: reject
            });
        });
    }

    initialize();
})();