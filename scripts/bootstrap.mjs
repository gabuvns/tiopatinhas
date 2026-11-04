import { writeFile } from "node:fs/promises";
const manifest = {
  name: "tiopatinhas",
  private: true,
  version: "0.2.0",
  type: "module",
  engines: { node: ">=24.12.0" },
  overrides: { "@grpc/grpc-js": "1.14.7" },
  scripts: {
    dev: "vite",
    build: "tsc -b && vite build",
    preview: "vite preview",
    check:
      "node scripts/verify-planning.mjs && node scripts/verify-storage.mjs && node scripts/verify-export.mjs && node scripts/verify-currency-categories.mjs && node scripts/verify-platform.mjs && node scripts/verify-experience.mjs && node scripts/verify-monthly-goal.mjs && node scripts/verify-comparison.mjs && node scripts/verify-chart-layout.mjs",
  },
  dependencies: {
    "@vitejs/plugin-react": "4.3.4",
    "lucide-react": "0.468.0",
    react: "18.3.1",
    "react-dom": "18.3.1",
    vite: "6.4.5",
    firebase: "13.2.0",
  },
  devDependencies: {
    "@types/react": "18.3.18",
    "@types/react-dom": "18.3.5",
    typescript: "5.7.3",
    "axe-core": "4.14.0",
  },
};
const typescript = {
  compilerOptions: {
    target: "ES2020",
    useDefineForClassFields: true,
    lib: ["ES2020", "DOM", "DOM.Iterable"],
    module: "ESNext",
    skipLibCheck: true,
    moduleResolution: "Bundler",
    allowImportingTsExtensions: true,
    resolveJsonModule: true,
    isolatedModules: true,
    noEmit: true,
    jsx: "react-jsx",
    strict: true,
    noUnusedLocals: true,
    noUnusedParameters: true,
  },
  include: ["src"],
};
await writeFile("package.json", JSON.stringify(manifest, null, 2));
await writeFile("tsconfig.json", JSON.stringify(typescript, null, 2));
