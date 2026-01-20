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
						{ label: "Capability Sources", link: "/configuration/capabilities" },
					],
				},
				{
					label: "Capabilities",
					items: [
						{ label: "Overview", link: "/capabilities/overview" },
						{ label: "Structure", link: "/capabilities/structure" },
						{ label: "capability.toml", link: "/capabilities/capability-toml" },
						{ label: "CLI Commands", link: "/capabilities/cli-commands" },
						{ label: "Commands", link: "/capabilities/commands" },
						{ label: "Skills", link: "/capabilities/skills" },
						{ label: "Rules", link: "/capabilities/rules" },
						{ label: "Docs", link: "/capabilities/docs" },
						{ label: "Subagents", link: "/capabilities/subagents" },
						{ label: "MCP Servers", link: "/capabilities/mcp-servers" },
						{ label: "Type Exports", link: "/capabilities/type-exports" },
						{ label: "Best Practices", link: "/capabilities/best-practices" },
					],
				},
				{
					label: "Commands Reference",
					items: [
						{ label: "Core Commands", link: "/commands/core" },
						{ label: "Capability Management", link: "/commands/capability-management" },
						{ label: "Profile Management", link: "/commands/profile-management" },
						{ label: "Provider Management", link: "/commands/provider-management" },
						{ label: "Add Commands", link: "/commands/add" },
					],
				},
				{
					label: "Advanced",
					items: [{ label: "Hooks (Planned)", link: "/advanced/hooks" }],
				},
			],
		}),
	],
});
