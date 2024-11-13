// ==UserScript==
// @name         Numerade Video Viewer [ARCHIVED]
// @namespace    https://github.com/GooglyBlox/free-numerade-videos
// @version      1.8
// @description  [ARCHIVED] This userscript is no longer functional due to Numerade's security updates.
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
 
    const styles = `
        .numerade-archive-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            z-index: 999999;
            display: flex;
            justify-content: center;
            align-items: center;
        }
 
        .numerade-archive-popup {
            background: white;
            padding: 2rem;
            border-radius: 10px;
            max-width: 500px;
            width: 90%;
            position: relative;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
        }
 
        .numerade-archive-title {
            font-size: 1.5rem;
            font-weight: bold;
            color: #e74c3c;
            margin-bottom: 1rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
 
        .numerade-archive-content {
            color: #2c3e50;
            line-height: 1.6;
            margin-bottom: 1.5rem;
        }
 
        .numerade-archive-warning {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 1rem;
            margin: 1rem 0;
            color: #856404;
        }
 
        .numerade-archive-button {
            background: #e74c3c;
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 5px;
            cursor: pointer;
            font-size: 1rem;
            transition: background 0.3s ease;
            width: 100%;
        }
 
        .numerade-archive-button:hover {
            background: #c0392b;
        }
    `;
 
    function createPopup() {
        const styleElement = document.createElement('style');
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
 
        const overlay = document.createElement('div');
        overlay.className = 'numerade-archive-overlay';
 
        const popup = document.createElement('div');
        popup.className = 'numerade-archive-popup';
 
        popup.innerHTML = `
            <div class="numerade-archive-title">
                <span>⚠️ Numerade Video Viewer - Project Archived</span>
            </div>
            <div class="numerade-archive-content">
                <p>This userscript is no longer functional due to Numerade implementing CloudFront signed URLs for their video content.</p>
 
                <div class="numerade-archive-warning">
                    <strong>Note:</strong> This popup will continue to appear on all Numerade pages until you uninstall the userscript.
                </div>
 
                <p><strong>Please take the following actions:</strong></p>
                <ol>
                    <li>Uninstall this userscript as it will no longer work</li>
                    <li>Visit <a href="https://github.com/GooglyBlox/free-numerade-videos" target="_blank">our GitHub repository</a> for more information</li>
                </ol>
            </div>
            <button class="numerade-archive-button">I understand - Close this popup</button>
        `;
 
        const closeButton = popup.querySelector('.numerade-archive-button');
        closeButton.addEventListener('click', () => {
            overlay.remove();
        });
 
        overlay.appendChild(popup);
        document.body.appendChild(overlay);
    }
 
    window.addEventListener('load', createPopup);
})();
