import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

// Аналог __dirname в ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pagesDir = path.join(__dirname, "dist/src/pages");
const srcDir = path.join(__dirname, "dist/src");
const distDir = path.join(__dirname, "dist");

const moveFiles = async () => {
	if (fs.existsSync(pagesDir)) {
		const files = await fs.readdir(pagesDir);
		for (const file of files) {
			await fs.move(path.join(pagesDir, file), path.join(distDir, file), {
				overwrite: true,
			});
		}
		await fs.remove(srcDir);
	}
};

moveFiles().then(() => console.log("✅ HTML файлы перемещены в корень dist!"));
