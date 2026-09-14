/**
 * Re-downloads corrupted font files (some were saved as GitHub HTML error pages)
 * from the Google Fonts CSS2 API. Verifies each file is a real TTF afterwards.
 *
 * Usage: bunx tsx scripts/fix-fonts.ts
 */
import fs from 'node:fs';
import path from 'node:path';

const FONTS: Array<{ file: string; css: string }> = [
  { file: 'Cinzel-Bold.ttf', css: 'https://fonts.googleapis.com/css2?family=Cinzel:wght@700' },
  { file: 'CinzelDecorative-Bold.ttf', css: 'https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700' },
  { file: 'Orbitron-Bold.ttf', css: 'https://fonts.googleapis.com/css2?family=Orbitron:wght@700' },
  { file: 'Outfit-Bold.ttf', css: 'https://fonts.googleapis.com/css2?family=Outfit:wght@700' },
  { file: 'Outfit-Medium.ttf', css: 'https://fonts.googleapis.com/css2?family=Outfit:wght@500' },
  { file: 'Outfit-Regular.ttf', css: 'https://fonts.googleapis.com/css2?family=Outfit:wght@400' },
  { file: 'SpaceGrotesk-Bold.ttf', css: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700' },
  { file: 'SpaceGrotesk-Medium.ttf', css: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500' },
  { file: 'Syne-Bold.ttf', css: 'https://fonts.googleapis.com/css2?family=Syne:wght@700' },
  { file: 'Syne-ExtraBold.ttf', css: 'https://fonts.googleapis.com/css2?family=Syne:wght@800' },
];

const isTtf = (buf: Buffer) =>
  (buf.subarray(0, 4).toString('hex') === '00010000' ||
    buf.subarray(0, 4).toString('ascii') === 'OTTO' ||
    buf.subarray(0, 4).toString('ascii') === 'true');

async function main() {
  const fontsDir = path.join(process.cwd(), 'fonts');
  let fixed = 0;
  let failed = 0;

  for (const { file, css } of FONTS) {
    const target = path.join(fontsDir, file);
    // Skip files that are already valid fonts.
    if (fs.existsSync(target) && isTtf(fs.readFileSync(target))) {
      console.log(`OK      ${file} (already valid)`);
      continue;
    }

    try {
      const cssRes = await fetch(css, { headers: { 'User-Agent': 'curl/8.0' } });
      const cssText = await cssRes.text();
      const match = cssText.match(/url\((https:[^)]+\.ttf)\)/);
      if (!match) throw new Error('no ttf url found in CSS response');

      const fontRes = await fetch(match[1]);
      if (!fontRes.ok) throw new Error(`font download HTTP ${fontRes.status}`);
      const buf = Buffer.from(await fontRes.arrayBuffer());
      if (!isTtf(buf)) throw new Error('downloaded file is not a TTF');

      fs.writeFileSync(target, buf);
      console.log(`FIXED   ${file} (${(buf.length / 1024).toFixed(1)} KB)`);
      fixed++;
    } catch (err: any) {
      console.log(`FAILED  ${file}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone. fixed=${fixed} failed=${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
