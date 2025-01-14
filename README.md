# [Numerade](https://www.numerade.com) Video Viewer

## Active Development Update
This project is now actively maintained with two ways to access Numerade videos:

1. **Discord Bot (Recommended)**: Join our [Discord server](https://discord.gg/D6D27pAs62) to use the bot! Simply use the `/numerade` command with any Numerade video URL.

2. **Self-Hosted API**: The `deployment` branch contains the API that powers the Discord bot. You can deploy it to Vercel using your own Numerade premium credentials:
   - Fork this repository
   - Set up a Vercel project
   - Add your credentials as environment variables:
     ```
     NUMERADE_EMAIL=your_premium_email
     NUMERADE_PASSWORD=your_premium_password
     ```
   - Deploy the `deployment` branch


## Original Project Description
<details>
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
</details>


## Current Status
- ✅ Discord Bot: Fully functional, free to use on our [Discord server](https://discord.gg/D6D27pAs62)
- ✅ API: Available for self-hosting (requires premium credentials)
- ⚠️ Userscript: Currently unmaintained (see Discord bot alternative)
- ⚠️ Web App: Currently unmaintained (see Discord bot alternative)

## Discord Bot Features
- Easy to use `/numerade` slash command
- Downloads videos directly to Discord
- Supports both question types:
  - `https://www.numerade.com/questions/...`
  - `https://www.numerade.com/ask/question/...`
- No setup required, just join and use!

## Support
- For bot support, join our [Discord server](https://discord.gg/D6D27pAs62)
- For API deployment issues, create a GitHub issue

## Contributing
Contributions are welcome! The `deployment` branch contains the current active codebase.

## Disclaimer
This application is a proof of concept and is intended for educational purposes only. It demonstrates the technical possibility of automating web content access and should not be used to infringe on the rights of Numerade or any other service. Please use responsibly and within legal boundaries. This project is not affiliated with Numerade.
