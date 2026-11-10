import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const WIDTHS = [400, 800, 1200];
const TARGET_EXTS = new Set(['.png', '.jpg', '.jpeg']);
const SCAN_DIRS = [
    'T_shirts_image',
    'logo_and_favicon',
    't_shirt_mockup_with_size_guide_image'
];

async function* getFiles(dir) {
    try {
        const dirents = await fs.readdir(dir, { withFileTypes: true });
        for (const dirent of dirents) {
            const res = path.resolve(dir, dirent.name);
            if (dirent.isDirectory()) yield* getFiles(res);
            else yield res;
        }
    } catch (err) {
        if (err.code !== 'ENOENT') console.error(`Error reading ${dir}:`, err);
    }
}

async function isNewer(src, dest) {
    try {
        const [srcStat, destStat] = await Promise.all([fs.stat(src), fs.stat(dest)]);
        return srcStat.mtimeMs > destStat.mtimeMs;
    } catch {
        return true;
    }
}

async function processImage(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (!TARGET_EXTS.has(ext)) return;

    const relativePath = path.relative(process.cwd(), filePath);
    if (/[^\w\d_./\-]/.test(relativePath)) {
        console.warn(`[WARNING: Spaces or special characters detected]: "${relativePath}"`);
    }

    const baseWithoutExt = filePath.slice(0, -ext.length);
    if (/-\d{3,4}$/.test(baseWithoutExt)) return;

    const image = sharp(filePath);
    const metadata = await image.metadata();
    const origWidth = metadata.width || 1200;

    // ফুল সাইজ WebP এবং AVIF তৈরি
    const fullWebp = `${baseWithoutExt}.webp`;
    const fullAvif = `${baseWithoutExt}.avif`;

    if (await isNewer(filePath, fullWebp)) {
        await image.clone().webp({ quality: 78 }).toFile(fullWebp);
        console.log(`Generated: ${path.relative(process.cwd(), fullWebp)}`);
    }
    if (await isNewer(filePath, fullAvif)) {
        await image.clone().avif({ quality: 50, effort: 4 }).toFile(fullAvif);
        console.log(`Generated: ${path.relative(process.cwd(), fullAvif)}`);
    }

    // ৪০০, ৮০০, ১২০০ পিক্সেলের রেসপনসিভ ভার্সন
    for (const w of WIDTHS) {
        if (w >= origWidth) continue;

        const wWebp = `${baseWithoutExt}-${w}.webp`;
        const wAvif = `${baseWithoutExt}-${w}.avif`;

        if (await isNewer(filePath, wWebp)) {
            await image.clone().resize({ width: w, withoutEnlargement: true }).webp({ quality: 78 }).toFile(wWebp);
            console.log(`Generated: ${path.relative(process.cwd(), wWebp)}`);
        }

        if (await isNewer(filePath, wAvif)) {
            await image.clone().resize({ width: w, withoutEnlargement: true }).avif({ quality: 50, effort: 4 }).toFile(wAvif);
            console.log(`Generated: ${path.relative(process.cwd(), wAvif)}`);
        }
    }
}

async function main() {
    console.log('Processing images with Sharp...');
    for (const dir of SCAN_DIRS) {
        for await (const file of getFiles(dir)) {
            try {
                await processImage(file);
            } catch (err) {
                console.error(`Error processing ${file}:`, err);
            }
        }
    }
    console.log('Image optimization complete.');
}

main();