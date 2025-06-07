// vite.config.js
import { defineConfig } from "vite";
import handlebars from "vite-plugin-handlebars";
import viteImagemin from "vite-plugin-imagemin";
import postcssUrl from "postcss-url";
import { resolve } from "path";
import fs from "fs";

// Собираем все HTML страницы (index + src/pages/*.html)
function getHtmlInputs() {
	const inputs = { index: resolve(__dirname, "index.html") };
	const pagesDir = resolve(__dirname, "src/pages");
	if (fs.existsSync(pagesDir)) {
		for (const file of fs.readdirSync(pagesDir)) {
			if (file.endsWith(".html")) {
				const name = file.replace(/\.html$/, "");
				inputs[name] = resolve(pagesDir, file);
			}
		}
	}
	return inputs;
}

export default defineConfig(({ command }) => {
	const isBuild = command === "build";

	return {
		root: ".",
		base: "./",

		plugins: [
			// 1) Handlebars для partials
			handlebars({
				partialDirectory: resolve(__dirname, "src/partials"),
			}),

			// 2) Dev middleware для отдачи любых .html, но через transformIndexHtml
			{
				name: "multi-page-dev",
				configureServer(server) {
					server.middlewares.use(async (req, res, next) => {
						const urlPath = req.url.split("?")[0];
						if (!urlPath.endsWith(".html") && urlPath !== "/") {
							return next();
						}

						let filePath;
						if (urlPath === "/" || urlPath === "/index.html") {
							filePath = resolve(__dirname, "index.html");
						} else {
							filePath = resolve(__dirname, "src/pages", urlPath.slice(1));
						}

						if (fs.existsSync(filePath)) {
							try {
								let html = fs.readFileSync(filePath, "utf-8");
								html = await server.transformIndexHtml(req.url, html);
								res.setHeader("Content-Type", "text/html; charset=utf-8");
								res.statusCode = 200;
								res.end(html);
							} catch (error) {
								console.error("Ошибка при рендере Handlebars:", error.message);
								res.statusCode = 500;
								res.setHeader("Content-Type", "text/html; charset=utf-8");
								res.end(`
						<h1>Ошибка в шаблоне</h1>
						<pre style="color:red; white-space:pre-wrap">${error.message}</pre>
					`);
							}
							return;
						}

						next();
					});
				},
			},
			!isBuild && {
				name: "floating-menu",
				transformIndexHtml(html, { path }) {
					const inputs = getHtmlInputs();
					const links = Object.entries(inputs)
						.map(([name, filePath]) => {
							const fileName = filePath.endsWith("index.html")
								? "index.html"
								: "src/pages/" + filePath.split("/src/pages/")[1];
							const href = name === "index" ? "/" : `/${name}.html`;
							return `<a href="${href}">${name}</a>`;
						})
						.join("");

					const menuHtml = `
	<div id="floating-menu">
		<div class="floating-trigger">☰</div>
		<div class="floating-links">
			${links}
		</div>
	</div>
	<style>
		#floating-menu {
			position: fixed;
			top: 50%;
			right: 0;
			transform: translateY(-50%) translateX(calc(100% - 30px));
			color: #fff;
			font-size: 14px;
			z-index: 9999;
			border-radius: 8px 0 0 8px;
			overflow: hidden;
			transition: width 0.3s ease, height 0.3s ease;

			display: flex;
			align-items: center;
		}
		#floating-menu:hover  {
			flex-direction: column;
			align-items: flex-start;
			transform: translateY(-50%) translateX(0);
			background: #222;
		}
		.floating-trigger {
			padding: 8px 10px;
			background: #444;
			cursor: pointer;
			white-space: nowrap;
		}
		.floating-links {
		display: flex;
			flex-direction: column;
			padding: 10px;
			background: #222;
			white-space: nowrap;
		}
		.floating-links a {
			color: #ffeb3b;
			text-decoration: none;
			margin-bottom: 6px;
			padding-block: 4px 10px;
			border-bottom: 1px solid #333;
		}
		.floating-links a:hover {
			text-decoration: underline;
		}

	</style>
`;

					return html.replace(/<body.*?>/, (match) => `${match}\n${menuHtml}`);
				},
			},

			// 3) HMR — полная перезагрузка при любых изменениях HTML или partials
			{
				name: "watch-html-and-partials",
				handleHotUpdate({ file, server }) {
					if (
						file.endsWith(".html") &&
						(file.includes("/src/pages/") ||
							file.includes("/src/partials/") ||
							file.endsWith("index.html"))
					) {
						server.ws.send({ type: "full-reload" });
					}
				},
			},

			// 4) Копируем public/ ресурсы в dist/ (Vite делает это сам, но на всякий случай)
			{
				name: "copy-public",
				apply: "build",
				generateBundle() {
					/* ничего не делаем — Vite по умолчанию копирует public/ */
				},
			},

			// 5) Оптимизация изображений только при build
			...(isBuild
				? [
						viteImagemin({
							gifsicle: { optimizationLevel: 3 },
							optipng: { optimizationLevel: 5 },
							mozjpeg: { quality: 75 },
							svgo: {
								plugins: [
									{ name: "removeViewBox", active: false },
									{ name: "removeEmptyAttrs", active: true },
								],
							},
						}),
				  ]
				: []),
		],

		server: {
			fs: { allow: ["."] },
			watch: { usePolling: true },
		},

		build: {
			outDir: "dist",
			emptyOutDir: true,
			rollupOptions: {
				input: getHtmlInputs(),
				output: {
					entryFileNames: "assets/[name].js",
					chunkFileNames: "assets/[name].js",
					assetFileNames: ({ name }) =>
						name && name.endsWith(".css")
							? "assets/[name][extname]"
							: "[name][extname]",
				},
			},
		},

		css: {
			preprocessorOptions: {
				scss: {},
			},
			postcss: {
				plugins: [
					postcssUrl({
						url: (asset) => {
							// Если путь начинается с /images/, превращаем /images/foo → ../images/foo
							if (asset.url.startsWith("/images/")) {
								return asset.url.replace(/^\//, "../");
							}
							// аналогично для icons, fonts, favicons
							if (asset.url.startsWith("/icons/")) {
								return asset.url.replace(/^\//, "../");
							}
							if (asset.url.startsWith("/fonts/")) {
								return asset.url.replace(/^\//, "../");
							}
							if (asset.url.startsWith("/favicons/")) {
								return asset.url.replace(/^\//, "../");
							}
							return asset.url;
						},
					}),
				],
			},
		},

		resolve: {
			alias: {
				"@styles": resolve(__dirname, "src/styles"),
				"@scripts": resolve(__dirname, "src/scripts"),
				"@partials": resolve(__dirname, "src/partials"),
			},
		},
	};
});
