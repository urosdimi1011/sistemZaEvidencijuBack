import sharp from "sharp";
import fs from "fs";

const sizes = [192, 256, 384, 512];
const inputFile = "public/logo.png";
const outputDir = "public";

if (!fs.existsSync(inputFile)) {
    console.error(`❌ Fajl ${inputFile} ne postoji!`);
    process.exit(1);
}

(async () => {
    for (const size of sizes) {
        const outputFile = `${outputDir}/pwa-${size}x${size}.png`;
        await sharp(inputFile)
            .resize(size, size)
            .toFile(outputFile);
        console.log(`✅ Generisana ikona: ${outputFile}`);
    }
})();