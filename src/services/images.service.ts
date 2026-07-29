import { uploadImage, uploadImageBuffer } from './CDN-service';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { sendReAdminInternalWebhookMessage } from './discord.service';
import fs from 'fs';
import path from 'path';

export async function capturePageScreenshotAndUpload(url: string, bucketPathUrl: string) {
  let browser;
  try {
    // Try to find a local Chrome installation first (for local dev), fall back to Lambda chromium
    const localChromePaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      process.env.LOCALAPPDATA && `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
    ].filter(Boolean) as string[];

    let executablePath: string | undefined;
    for (const p of localChromePaths) {
      if (fs.existsSync(p)) {
        executablePath = p;
        break;
      }
    }

    if (!executablePath) {
      // Lambda environment — use @sparticuz/chromium
      chromium.setGraphicsMode = false;
      executablePath = await chromium.executablePath(path.join(process.cwd(), '/node_modules/@sparticuz/chromium/bin/'));
    }

    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--hide-scrollbars",
        "--disable-web-security",
      ],
      defaultViewport: { width: 800, height: 600 },
      executablePath,
      headless: true,
      timeout: 0,
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36');
    await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });
    // Extra wait for content like PDFs to fully render in the viewer
    await new Promise(resolve => setTimeout(resolve, 2000));
    const screenshot = (await page.screenshot({
      encoding: "binary",
      captureBeyondViewport: false,
      clip: { width: 800, height: 600, x: 0, y: 0 },
    })) as Buffer;

    await uploadImageBuffer(bucketPathUrl, screenshot);
    await sendReAdminInternalWebhookMessage(
      "imageUploads",
      "blue",
      "Image upload - Hub Screenshot",
      `https://cdn.readmin.app/${bucketPathUrl}`,
      `https://cdn.readmin.app/${bucketPathUrl}`,
    );

    await browser.close();
  } catch (e) {
    console.error('Failed to capture screenshot:', e);
    if (browser) {
      try { await browser.close(); } catch (_) {}
    }
  }
}
