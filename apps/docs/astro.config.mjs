// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: "omnidev",
			logo: {
				src: "./public/logo.png",
				replacesTitle: false,
			},
			customCss: ["./src/styles/custom.css"],
			head: [
				{
					tag: "link",
					attrs: {
						rel: "icon",
						type: "image/png",
						href: "/favicon.png",
					},
				},
				{
					tag: "link",
					attrs: {
						rel: "icon",
						type: "image/x-icon",
						href: "/favicon/favicon.ico",
					},
				},
				{
					tag: "link",
					attrs: {
						rel: "icon",
						type: "image/png",
						sizes: "16x16",
						href: "/favicon/favicon-16x16.png",
					},
				},
				{
					tag: "link",
					attrs: {
						rel: "icon",
						type: "image/png",
						sizes: "32x32",
						href: "/favicon/favicon-32x32.png",
					},
				},
				{
					tag: "link",
					attrs: {
						rel: "apple-touch-icon",
						sizes: "180x180",
						href: "/favicon/apple-touch-icon.png",
					},
				},
				{
					tag: "link",
					attrs: {
						rel: "manifest",
						href: "/favicon/site.webmanifest",
					},
				},
				{
					tag: "link",
					attrs: {
						rel: "preconnect",
						href: "https://fonts.googleapis.com",
					},
				},
				{
					tag: "link",
					attrs: {
						rel: "preconnect",
						href: "https://fonts.gstatic.com",
						crossorigin: true,
					},
				},
				{
					tag: "link",
					attrs: {
						rel: "stylesheet",
						href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap",
					},
				},
			],
			social: [
				{ icon: "github", label: "GitHub", href: "https://github.com/Nikola-Milovic/omnidev" },
			],
			sidebar: [
				{
					label: "Getting Started",
					items: [{ label: "Quick Start", link: "/getting-started/" }],
				},
				{
					label: "Configuration",
					items: [
						{ label: "Configuration", link: "/configuration/config-files" },
						{ label: "OMNI.md", link: "/configuration/omni-md" },
						{ label: "Profiles", link: "/configuration/profiles" },
						{ label: "Capability Sources", link: "/configuration/capability-sources" },
					],
				},
				{
					label: "Capabilities",
					items: [
						{ label: "Overview", link: "/capabilities/overview" },
						{ label: "Skills", link: "/capabilities/skills" },
						{ label: "Rules", link: "/capabilities/rules" },
						{ label: "Docs", link: "/capabilities/docs" },
						{ label: "Commands", link: "/capabilities/commands" },
						{ label: "Subagents", link: "/capabilities/subagents" },
						{ label: "CLI Commands", link: "/capabilities/cli-commands" },
						{ label: "MCP Servers", link: "/capabilities/mcp-servers" },
					],
				},
				{
					label: "Commands Reference",
					items: [
						{ label: "init", link: "/commands/init" },
						{ label: "sync", link: "/commands/sync" },
						{ label: "doctor", link: "/commands/doctor" },
						{ label: "add", link: "/commands/add" },
						{ label: "capability", link: "/commands/capability" },
						{ label: "capability new", link: "/commands/capability-new" },
						{ label: "profile", link: "/commands/profile" },
						{ label: "provider", link: "/commands/provider" },
					],
				},
				{
					label: "Advanced",
					items: [
						{ label: "Creating Capabilities", link: "/advanced/creating-capabilities" },
						{ label: "Claude Code Hooks", link: "/advanced/hooks" },
						{ label: "Best Practices", link: "/advanced/best-practices" },
					],
				},
			],
		}),
	],
});
