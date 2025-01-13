// god this is so jank but I have literally no idea how else to get puppeteer to work on vercel

import chromium from '@sparticuz/chromium';
import type { Browser, Page } from 'puppeteer-core';
import puppeteer from 'puppeteer-core';
import { NextRequest, NextResponse } from 'next/server';

async function isValidNumeradeUrl(url: string) {
  try {
    const parsedUrl = new URL(url);
    return (
      parsedUrl.hostname === 'www.numerade.com' &&
      (url.startsWith('https://www.numerade.com/ask/question/') ||
        url.startsWith('https://www.numerade.com/questions/'))
    );
  } catch {
    return false;
  }
}

async function loginToNumerade(page: Page) {
  try {
    await page.goto('https://www.numerade.com/login/', {
      waitUntil: 'networkidle0',
    });
    await page.waitForSelector('[data-test-id="user-email"]');
    await page.waitForSelector('[data-test-id="user-password"]');

    await page.type(
      '[data-test-id="user-email"]',
      process.env.NUMERADE_EMAIL || ''
    );
    await page.type(
      '[data-test-id="user-password"]',
      process.env.NUMERADE_PASSWORD || ''
    );
    await page.click('[data-test-id="login-button"]');
    await page.waitForNavigation({ waitUntil: 'networkidle0' });

    return true;
  } catch {
    return false;
  }
}

interface VideoInfo {
  url: string;
  title: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const url = body.url;

    if (!url) {
      return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
    }

    if (!await isValidNumeradeUrl(url)) {
      return NextResponse.json({ error: 'Invalid Numerade URL' }, { status: 400 });
    }

    const browser: Browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', request => request.continue());

    const loginSuccess = await loginToNumerade(page);
    if (!loginSuccess) {
      await browser.close();
      return NextResponse.json({ error: 'Login failed' }, { status: 500 });
    }

    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForSelector('#my-video_html5_api', { timeout: 30000 });

    const videoInfo: VideoInfo = await page.evaluate(() => {
      const videoElement = document.querySelector('#my-video_html5_api') as HTMLVideoElement;
      if (!videoElement?.src) {
        throw new Error('Video source not found');
      }

      return {
        url: videoElement.src,
        title: document.title.replace(' | Numerade', '').trim(),
      };
    });

    await browser.close();

    if (videoInfo && videoInfo.url) {
      return NextResponse.json(videoInfo);
    } else {
      return NextResponse.json({ error: 'Video source not found' }, { status: 404 });
    }
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl.searchParams.get('url');

    if (!url) {
      return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
    }

    if (!await isValidNumeradeUrl(url)) {
      return NextResponse.json({ error: 'Invalid Numerade URL' }, { status: 400 });
    }

    const browser: Browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', request => request.continue());

    const loginSuccess = await loginToNumerade(page);
    if (!loginSuccess) {
      await browser.close();
      return NextResponse.json({ error: 'Login failed' }, { status: 500 });
    }

    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForSelector('#my-video_html5_api', { timeout: 30000 });

    const videoUrl = await page.evaluate(() => {
      const videoElement = document.querySelector('#my-video_html5_api') as HTMLVideoElement;
      return videoElement?.src;
    });

    await browser.close();

    if (videoUrl) {
      return NextResponse.redirect(videoUrl);
    } else {
      return NextResponse.json({ error: 'Video source not found' }, { status: 404 });
    }
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}