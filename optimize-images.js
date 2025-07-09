import sharp from "sharp";
import glob from "fast-glob";
import fs from "fs/promises";

const files = await glob(["dist/images/**/*.{jpg,png,webp}"]);

for (const file of files) {
	const buffer = await fs.readFile(file);
	const img = sharp(buffer);

	const meta = await img.metadata();

	if (meta.format === "jpeg") {
		await img.jpeg({ quality: 75 }).toFile(file);
	} else if (meta.format === "png") {
		await img.png({ quality: 80, compressionLevel: 9 }).toFile(file);
	} else if (meta.format === "webp") {
		await img.webp({ quality: 75 }).toFile(file);
	}
}

console.log("Изображения оптимизированы");
