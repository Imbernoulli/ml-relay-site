"use client";

import { PrismLight } from "react-syntax-highlighter";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash";
import yaml from "react-syntax-highlighter/dist/esm/languages/prism/yaml";
import json from "react-syntax-highlighter/dist/esm/languages/prism/json";
import diff from "react-syntax-highlighter/dist/esm/languages/prism/diff";
import toml from "react-syntax-highlighter/dist/esm/languages/prism/toml";
import cpp from "react-syntax-highlighter/dist/esm/languages/prism/cpp";
import markdown from "react-syntax-highlighter/dist/esm/languages/prism/markdown";
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

PrismLight.registerLanguage("python", python);
PrismLight.registerLanguage("bash", bash);
PrismLight.registerLanguage("sh", bash);
PrismLight.registerLanguage("shell", bash);
PrismLight.registerLanguage("yaml", yaml);
PrismLight.registerLanguage("json", json);
PrismLight.registerLanguage("diff", diff);
PrismLight.registerLanguage("toml", toml);
PrismLight.registerLanguage("cpp", cpp);
PrismLight.registerLanguage("markdown", markdown);
PrismLight.registerLanguage("typescript", typescript);

export const Highlighter = PrismLight;
export const codeTheme = oneDark;
export const KNOWN_LANGS = new Set(["python", "bash", "sh", "shell", "yaml", "json", "diff", "toml", "cpp", "markdown", "typescript"]);
