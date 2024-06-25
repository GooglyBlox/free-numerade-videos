// ==UserScript==
// @name         Numerade Video Viewer
// @namespace    https://github.com/GooglyBlox/free-numerade-videos
// @updateURL    https://raw.githubusercontent.com/GooglyBlox/free-numerade-videos/main/userscript/numerade-video-viewer.user.js
// @version      1.2
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
                videoElement.className = 'rounded';
                videoElement.style.width = '100%';
                videoElement.style.height = 'auto';

                let containerElement = document.querySelector('.video-redesign__video-container') ||
                                       document.querySelector('.ask-question-detail__simplified-video-container');

                if (containerElement) {
                    while (containerElement.firstChild) {
                        containerElement.removeChild(containerElement.firstChild);
                    }
                    containerElement.appendChild(videoElement);
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
        const doc = document;
        const possibleSelectors = [
            'img[src^="https://cdn.numerade.com/ask_previews/"]',
            'video[poster^="https://cdn.numerade.com/project-universal/previews/"]',
            'img.background-gif',
            '.vjs-poster[style*="background-image"]'
        ];

        for (const selector of possibleSelectors) {
            const element = doc.querySelector(selector);
            if (element) {
                let src;
                if (selector.includes('style')) {
                    const style = element.getAttribute('style');
                    const match = style.match(/url\("(.+?)"\)/);
                    src = match ? match[1] : null;
                } else {
                    src = element.getAttribute(selector.includes('video') ? 'poster' : 'src');
                }

                if (src) {
                    src = src.split('?')[0];
                    const fileExtension = src.split('.').pop().toLowerCase();
                    src = src.replace(/(_large)?(\.jpg|\.gif|\.png)?$/, '');

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
                            const videoSrc = `${baseUrl}${src.split('/').pop()}.${fileType}`;
                            const response = await fetch(videoSrc, { method: 'HEAD' });
                            if (response.ok) {
                                return videoSrc;
                            }
                        }
                    }
                }
            }
        }

        return null;
    }

    processLink();
})();