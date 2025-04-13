import { defineConfig } from "vite";
import { resolve } from "path";
import { createHtmlPlugin } from "vite-plugin-html";
import fs from "fs";
import path from "path";

// Функция для получения всех HTML файлов в папке pages
function getHtmlFilesFromPages() {
	const pagesDir = path.resolve(__dirname, "pages");
	const files = fs.readdirSync(pagesDir);

	const htmlFiles = files.filter((file) => file.endsWith(".html"));

	const input = htmlFiles.reduce((acc, file) => {
		const name = file.replace(".html", ""); // Убираем расширение .html
		acc[name] = resolve(pagesDir, file); // Формируем объект input
		return acc;
	}, {});

	return input;
}

export default defineConfig({
	root: "pages", // Указываем корень проекта в папке 'pages'
	build: {
		outDir: "../dist", // Папка для выходных файлов (dist будет на уровне корня проекта)
		emptyOutDir: true, // Очищаем dist перед сборкой
		rollupOptions: {
			input: getHtmlFilesFromPages(), // Динамически генерируем input
		},
	},
	plugins: [createHtmlPlugin()],
	server: {
		open: false, // Не открывать браузер автоматически
	},
});
