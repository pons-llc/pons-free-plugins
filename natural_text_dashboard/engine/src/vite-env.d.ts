/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** .env の GEMINI_API_KEY。src/app/chat.ts のローカル動作確認専用（本番配布では使わない） */
  readonly GEMINI_API_KEY?: string;
  readonly GEMINI_MODEL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
