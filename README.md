# [Numerade](https://www.numerade.com) Video Viewer

## ⚠️ Disclaimer: Issues with the Script?

> **Not working?** It happens! Numerade makes a lot of unnecessary DOM changes that can break my method.  
> If this is currently the case, please [open an issue](https://github.com/GooglyBlox/free-numerade-videos/issues)!  
> I usually fix the script within half an hour of noticing that it broke.

> **Important Notice**: The hosted version of this project's website is no longer available due to a DMCA takedown request. You will have to manually deploy the web application on your machine.

---


The Numerade Video Viewer is a web application designed to provide easy access to Numerade videos without the need for a subscription. It serves as a proof of concept (POC) for a scraper that can bypass the subscription requirements on the Numerade platform.

**Easy to Use**: Simply input the URL of the Numerade question, and the video viewer will retrieve the video for you.

**Bypass Subscription**: This tool allows you to access Numerade's video content without needing a subscription.

## Option 1: Web Application

1. Open the Numerade Video Viewer website by cloning this repository to your machine.
2. In the input box, paste the URL of the Numerade question you want to view. The URL should start with `https://www.numerade.com/questions/` or `https://www.numerade.com/ask/question/`.
3. Click the `Submit` button to process the link.
4. The video will be displayed on the screen if available. You can watch it directly within the web application.

## Option 2: Userscript
Alternatively, you can use the Numerade Video Viewer as a userscript. This allows you to automatically fetch and display the unlocked video directly on the Numerade question page.

[![Install Userscript](https://img.shields.io/badge/Install-Userscript-green?style=for-the-badge)](https://github.com/GooglyBlox/free-numerade-videos/raw/main/userscript/numerade-video-viewer.user.js)
1. Install a userscript manager extension like [Tampermonkey](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) or [Violentmonkey](https://chromewebstore.google.com/detail/violentmonkey/jinjaccalgkegednnccohejagnlnfdag) in your browser.
2. Click on the "Install Userscript" button above to install the userscript.
3. Navigate to a valid Numerade question page, and the userscript will automatically execute, fetching and displaying the unlocked video where there would normally be a static paywall image.

## Disclaimer

This application is a proof of concept and is intended for educational purposes only. It demonstrates the technical possibility of scraping web content and should not be used to infringe on the rights of Numerade or any other service.

Please note that this tool should be used responsibly and within the confines of legal and ethical boundaries. This project is not affiliated with Numerade.
